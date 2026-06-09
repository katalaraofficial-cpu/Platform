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

// ── Owner: sesuaikan jam kehadiran (override durasi manual) ──
// Mendukung skenario terlambat: owner set jam masuk/keluar aktual.
// Bila recordId kosong → buat entri manual untuk tanggal tsb.
export async function adjustAttendanceRecord(data: {
  recordId?: string;
  profileId: string;
  attendanceDate: string; // YYYY-MM-DD
  checkInTime: string; // "HH:MM" (WIB)
  checkOutTime: string; // "HH:MM" (WIB)
  status?: "present" | "invalid";
}): Promise<AttendanceActionState> {
  try {
    const { tenantId } = await ownerAttendanceGuard();

    const { profileId, attendanceDate, checkInTime, checkOutTime } = data;
    if (!profileId || !attendanceDate) return { error: "Data kehadiran tidak lengkap" };

    const timeRe = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRe.test(checkInTime) || !timeRe.test(checkOutTime))
      return { error: "Format jam tidak valid (HH:MM)" };

    // Konstruksi waktu dalam zona WIB (+07:00).
    const checkInIso = `${attendanceDate}T${checkInTime}:00+07:00`;
    const checkOutIso = `${attendanceDate}T${checkOutTime}:00+07:00`;
    const inMs = new Date(checkInIso).getTime();
    const outMs = new Date(checkOutIso).getTime();
    if (Number.isNaN(inMs) || Number.isNaN(outMs)) return { error: "Waktu tidak valid" };
    if (outMs <= inMs) return { error: "Jam keluar harus lebih besar dari jam masuk" };

    const admin = createTenantAdminClient(tenantId);
    const status = data.status ?? "present";

    if (data.recordId) {
      const { error } = await admin
        .from("attendance_records")
        .update({
          check_in_at: new Date(inMs).toISOString(),
          check_out_at: new Date(outMs).toISOString(),
          status,
        })
        .eq("id", data.recordId)
        .eq("tenant_id", tenantId);
      if (error) return { error: error.message };
    } else {
      const { error } = await admin.from("attendance_records").insert({
        tenant_id: tenantId,
        profile_id: profileId,
        location_id: null,
        mode: "office",
        attendance_date: attendanceDate,
        check_in_at: new Date(inMs).toISOString(),
        check_out_at: new Date(outMs).toISOString(),
        check_in_lat: null,
        check_in_lng: null,
        distance_m: null,
        status,
        notes: "Penyesuaian manual oleh owner",
      });
      if (error) {
        if (error.code === "23505")
          return { error: "Engineer sudah memiliki kehadiran di tanggal tersebut" };
        return { error: error.message };
      }
    }

    revalidatePath("/owner/mechanics");
    return { success: "Kehadiran diperbarui" };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ── Owner: hapus catatan kehadiran (bulk) ───────────────────
export async function deleteAttendanceRecords(
  ids: string[]
): Promise<AttendanceActionState> {
  try {
    const { tenantId } = await ownerAttendanceGuard();
    const clean = (ids ?? []).filter(Boolean);
    if (clean.length === 0) return { error: "Tidak ada kehadiran yang dipilih" };

    const admin = createTenantAdminClient(tenantId);
    const { error } = await admin
      .from("attendance_records")
      .delete()
      .eq("tenant_id", tenantId)
      .in("id", clean);
    if (error) return { error: error.message };

    revalidatePath("/owner/mechanics");
    return { success: `${clean.length} catatan kehadiran dihapus` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
