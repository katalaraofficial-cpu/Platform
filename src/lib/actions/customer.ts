"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import { revalidatePath } from "next/cache";

export interface CustomerResult {
  id: string;
  name: string;
  phone: string | null;
  vehicle_plate: string | null;
  address: string | null;
}

export type CustomerActionState = { error?: string; success?: string };

async function ownerTenantGuard() {
  const ctx = await getUserContext();
  if (!ctx.tenantId || ctx.role !== "owner") {
    throw new Error("Hanya owner yang dapat mengelola data pelanggan");
  }
  return ctx.tenantId;
}

export async function searchCustomers(query: string): Promise<CustomerResult[]> {
  if (!query || query.trim().length < 1) return [];
  const ctx = await getUserContext();
  if (!ctx.tenantId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, name, phone, notes, vehicle_info")
    .eq("tenant_id", ctx.tenantId)
    .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
    .limit(8)
    .order("name");
  return (data ?? []).map((c) => {
    const vi = c.vehicle_info as { plate?: string } | null;
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      vehicle_plate: vi?.plate ?? null,
      address: c.notes,
    };
  });
}

export async function updateCustomerFromInvoice(
  customerId: string,
  payload: { name: string; phone: string; address: string }
): Promise<CustomerActionState> {
  try {
    if (!customerId) return { error: "ID pelanggan tidak valid" };
    const ctx = await getUserContext();
    if (!ctx.tenantId || (ctx.role !== "owner" && ctx.role !== "admin")) {
      return { error: "Anda tidak memiliki akses untuk mengubah data pelanggan" };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("customers")
      .update({
        name: payload.name.trim(),
        phone: payload.phone.trim() || null,
        notes: payload.address.trim() || null,
      })
      .eq("tenant_id", ctx.tenantId)
      .eq("id", customerId);

    if (error) return { error: `Gagal memperbarui pelanggan: ${error.message}` };
    revalidatePath("/owner/customers");
    revalidatePath("/owner/invoices");
    revalidatePath("/admin/invoices");
    return { success: "Data pelanggan berhasil diperbarui" };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function quickCreateCustomer(
  name: string,
  phone: string,
  address: string
): Promise<{ id: string; name: string } | { error: string }> {
  const ctx = await getUserContext();
  if (!ctx.tenantId) return { error: "Tidak ada tenant" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      tenant_id: ctx.tenantId,
      name: name.trim(),
      phone: phone.trim() || null,
      notes: address.trim() || null,
      vehicle_info: {},
    })
    .select("id, name")
    .single();
  if (error || !data) return { error: error?.message ?? "Gagal buat pelanggan" };
  return { id: data.id, name: data.name };
}

export async function updateOwnerCustomer(
  customerId: string,
  payload: { name: string; phone: string; address: string }
): Promise<CustomerActionState> {
  try {
    if (!customerId) return { error: "ID pelanggan tidak valid" };
    const tenantId = await ownerTenantGuard();
    const supabase = await createClient();

    const { error } = await supabase
      .from("customers")
      .update({
        name: payload.name.trim(),
        phone: payload.phone.trim() || null,
        notes: payload.address.trim() || null,
      })
      .eq("tenant_id", tenantId)
      .eq("id", customerId);

    if (error) return { error: `Gagal memperbarui pelanggan: ${error.message}` };
    revalidatePath("/owner/customers");
    revalidatePath("/owner/invoices");
    return { success: "Data pelanggan berhasil diperbarui" };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function deleteOwnerCustomer(customerId: string): Promise<CustomerActionState> {
  try {
    if (!customerId) return { error: "ID pelanggan tidak valid" };
    const tenantId = await ownerTenantGuard();
    const supabase = await createClient();

    await supabase
      .from("invoices")
      .update({ customer_id: null })
      .eq("tenant_id", tenantId)
      .eq("customer_id", customerId);

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("id", customerId);

    if (error) return { error: `Gagal menghapus pelanggan: ${error.message}` };
    revalidatePath("/owner/customers");
    revalidatePath("/owner/invoices");
    return { success: "Pelanggan berhasil dihapus" };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function bulkDeleteOwnerCustomers(customerIds: string[]): Promise<CustomerActionState> {
  try {
    const ids = [...new Set(customerIds.filter(Boolean))];
    if (ids.length === 0) return { error: "Pilih pelanggan yang ingin dihapus" };

    const tenantId = await ownerTenantGuard();
    const supabase = await createClient();

    await supabase
      .from("invoices")
      .update({ customer_id: null })
      .eq("tenant_id", tenantId)
      .in("customer_id", ids);

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("tenant_id", tenantId)
      .in("id", ids);

    if (error) return { error: `Gagal bulk hapus pelanggan: ${error.message}` };
    revalidatePath("/owner/customers");
    revalidatePath("/owner/invoices");
    return { success: `${ids.length} pelanggan berhasil dihapus` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
