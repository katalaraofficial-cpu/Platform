"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";

export interface CustomerResult {
  id: string;
  name: string;
  phone: string | null;
  vehicle_plate: string | null;
}

export async function searchCustomers(query: string): Promise<CustomerResult[]> {
  if (!query || query.trim().length < 1) return [];
  const ctx = await getUserContext();
  if (!ctx.tenantId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, name, phone, vehicle_info")
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
    };
  });
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
