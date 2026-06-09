"use server";

import { createTenantAdminClient } from "@/lib/supabase/tenant-admin";
import { getUserContext } from "@/lib/get-user-context";
import { revalidatePath } from "next/cache";
import { SHIFT_HOURS } from "@/lib/attendance-constants";
import type { WorkLocation, AttendanceMode } from "@/types/database";

export type AttendanceActionState = { error?: string; success?: string };

async function ownerAttendanceGuard(): Promise<{ tenantId: string; id: string }> {
  const ctx = await getUserContext();
  if (!ctx.tenantId || ctx.role !== "owner")
    throw new Error("Hanya owner yang dapat mengubah lokasi kerja");
  if (ctx.featureToggles?.module_attendance !== true)
    throw new Error("Modul absensi belum diaktifkan oleh admin platform");
  return { tenantId: ctx.tenantId, id: ctx.id };
}

// ── Simpan / perbarui lokasi kerja ──────────────────────────
export async function saveWorkLocation(data: {
  id?: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusM: number;
  allowFieldWork: boolean;
  isActive: boolean;
}): Promise<AttendanceActionState> {
  try {
    const { tenantId } = await ownerAttendanceGuard();

    const name = data.name.trim();
    if (!name) return { error: "Nama lokasi wajib diisi" };
    if (!Number.isFinite(data.latitude) || !Number.isFinite(data.longitude))
      return { error: "Koordinat tidak valid" };
    if (data.latitude < -90 || data.latitude > 90 || data.longitude < -180 || data.longitude > 180)
      return { error: "Koordinat di luar rentang yang valid" };
    if (!Number.isFinite(data.radiusM) || data.radiusM <= 0)
      return { error: "Radius harus lebih dari 0 meter" };

    const admin = createTenantAdminClient(tenantId);
    const payload = {
      name,
      latitude: data.latitude,
      longitude: data.longitude,
      radius_m: Math.round(data.radiusM),
      allow_field_work: data.allowFieldWork,
      is_active: data.isActive,
      updated_at: new Date().toISOString(),
    };

    if (data.id) {
      const { error } = await admin
        .from("work_locations")
        .update(payload)
        .eq("id", data.id)
        .eq("tenant_id", tenantId);
      if (error) return { error: error.message };
    } else {
      const { error } = await admin.from("work_locations").insert({
        tenant_id: tenantId,
        ...payload,
      });
      if (error) return { error: error.message };
    }

    revalidatePath("/owner/settings");
    return { success: data.id ? "Lokasi kerja diperbarui" : "Lokasi kerja ditambahkan" };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ── Hapus lokasi kerja ──────────────────────────────────────
export async function deleteWorkLocation(id: string): Promise<AttendanceActionState> {
  try {
    const { tenantId } = await ownerAttendanceGuard();
    if (!id) return { error: "Lokasi tidak valid" };

    const admin = createTenantAdminClient(tenantId);
    const { error } = await admin
      .from("work_locations")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId);
    if (error) return { error: error.message };

    revalidatePath("/owner/settings");
    return { success: "Lokasi kerja dihapus" };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ── Aktif / nonaktifkan lokasi kerja ────────────────────────
export async function toggleWorkLocationActive(
  id: string,
  isActive: boolean
): Promise<AttendanceActionState> {
  try {
    const { tenantId } = await ownerAttendanceGuard();
    if (!id) return { error: "Lokasi tidak valid" };

    const admin = createTenantAdminClient(tenantId);
    const { error } = await admin
      .from("work_locations")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", tenantId);
    if (error) return { error: error.message };

    revalidatePath("/owner/settings");
    return { success: isActive ? "Lokasi diaktifkan" : "Lokasi dinonaktifkan" };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ── Helper: jarak Haversine (meter) ─────────────────────────
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // radius bumi (m)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// Tanggal bisnis WIB (Asia/Jakarta) dalam format YYYY-MM-DD.
function jakartaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// ── Engineer check-in (manual, checkout otomatis +8 jam) ────
export async function submitCheckIn(coords: {
  latitude: number;
  longitude: number;
}): Promise<AttendanceActionState> {
  try {
    const ctx = await getUserContext();
    if (!ctx.tenantId || ctx.role !== "mechanic")
      return { error: "Hanya engineer yang dapat melakukan absen" };
    if (ctx.featureToggles?.module_attendance !== true)
      return { error: "Modul absensi belum diaktifkan oleh admin platform" };

    const { latitude, longitude } = coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
      return { error: "Koordinat GPS tidak valid" };

    const admin = createTenantAdminClient(ctx.tenantId);

    // Ambil lokasi kerja aktif.
    const { data: locRows } = await admin
      .from("work_locations")
      .select("*")
      .eq("is_active", true);
    const locations = (locRows ?? []) as WorkLocation[];
    if (locations.length === 0)
      return { error: "Owner belum menetapkan lokasi kerja" };

    // Cari lokasi kantor terdekat dalam radius.
    let nearest: WorkLocation | null = null;
    let nearestDist = Infinity;
    for (const loc of locations) {
      const d = haversineMeters(latitude, longitude, Number(loc.latitude), Number(loc.longitude));
      if (d < nearestDist) {
        nearestDist = d;
        nearest = loc;
      }
    }

    let mode: AttendanceMode = "office";
    let chosen: WorkLocation | null = null;
    let distance = nearest ? nearestDist : null;
    let status: "present" | "invalid" = "invalid";

    if (nearest && nearestDist <= nearest.radius_m) {
      // Berada dalam radius kantor → hadir.
      chosen = nearest;
      mode = "office";
      status = "present";
      distance = nearestDist;
    } else {
      // Di luar radius semua kantor. Jika ada lokasi proyek (field), absen lapangan tetap sah.
      const fieldLoc = locations.find((l) => l.allow_field_work);
      if (fieldLoc) {
        chosen = fieldLoc;
        mode = "field";
        status = "present";
        distance = haversineMeters(
          latitude,
          longitude,
          Number(fieldLoc.latitude),
          Number(fieldLoc.longitude)
        );
      } else {
        return {
          error: `Anda berada ${nearestDist} m dari lokasi kerja terdekat (radius ${nearest?.radius_m ?? 0} m). Absen ditolak.`,
        };
      }
    }

    const now = new Date();
    const checkOut = new Date(now.getTime() + SHIFT_HOURS * 3_600_000);

    const { error } = await admin.from("attendance_records").insert({
      tenant_id: ctx.tenantId,
      profile_id: ctx.id,
      location_id: chosen?.id ?? null,
      mode,
      attendance_date: jakartaToday(),
      check_in_at: now.toISOString(),
      check_out_at: checkOut.toISOString(),
      check_in_lat: latitude,
      check_in_lng: longitude,
      distance_m: distance,
      status,
    });

    if (error) {
      // Unique index attendance_one_per_day → sudah absen hari ini.
      if (error.code === "23505")
        return { error: "Anda sudah melakukan absen hari ini" };
      return { error: error.message };
    }

    revalidatePath("/mechanic/dashboard");
    return {
      success:
        mode === "field"
          ? "Absen lapangan tercatat. Selamat bekerja!"
          : "Absen masuk berhasil. Selamat bekerja!",
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
