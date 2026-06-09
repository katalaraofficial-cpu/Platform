"use server";

import { createTenantAdminClient } from "@/lib/supabase/tenant-admin";
import { getUserContext } from "@/lib/get-user-context";
import { revalidatePath } from "next/cache";

export type AttendanceActionState = { error?: string; success?: string };

// Durasi shift default untuk auto check-out (jam).
export const SHIFT_HOURS = 8;

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
