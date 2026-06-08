"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./../supabase/server";
import { getUserContext } from "@/lib/get-user-context";

export type CatalogItem = {
  id: string;
  description: string;
  item_type: "service" | "part_internal" | "part_external";
  unit_label: string | null;
  default_buy_price: number;
  default_sell_price: number;
  updated_at: string;
};

/**
 * Ambil ringkasan katalog implicit dari `invoice_items`.
 * Dikelompokkan case-insensitive berdasarkan `description`.
 * Dipakai owner untuk audit klasifikasi & melihat distribusi tipe per nama.
 */
export async function getItemCatalog(): Promise<{
  data?: CatalogItem[];
  error?: string;
}> {
  const ctx = await getUserContext();
  if (!ctx.tenantId || ctx.role !== "owner") {
    return { error: "Akses ditolak" };
  }

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("settings")
    .select("feature_catalog_enabled")
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();

  if (!settings?.feature_catalog_enabled) {
    return { error: "Modul katalog belum diaktifkan" };
  }

  const { data, error } = await supabase
    .from("catalog_items")
    .select("id, description, item_type, unit_label, default_buy_price, default_sell_price, updated_at")
    .eq("tenant_id", ctx.tenantId)
    .order("description", { ascending: true });

  if (error) return { error: error.message };

  // Map to the expected type, ensuring numbers are numbers.
  const catalogData = (data ?? []).map(item => ({
    ...item,
    default_buy_price: Number(item.default_buy_price ?? 0),
    default_sell_price: Number(item.default_sell_price ?? 0),
  }));

  return { data: catalogData as CatalogItem[] };
}

/**
 * Reklasifikasi tipe item di tabel master `catalog_items`.
 * Ini tidak lagi mengubah data historis di `invoice_items`.
 * Dipakai untuk reklasifikasi data lama (mis. barang yang terlanjur
 * tercatat sebagai jasa).
 */
export async function reclassifyItemDescription(
  description: string,
  newType: "service" | "part_internal" | "part_external",
): Promise<{ success?: string; error?: string; updated?: number }> {
  const trimmed = description.trim();
  if (!trimmed) return { error: "Deskripsi kosong" };
  const ctx = await getUserContext();
  if (!ctx.tenantId || ctx.role !== "owner") {
    return { error: "Akses ditolak" };
  }
  if (!["service", "part_internal", "part_external"].includes(newType)) {
    return { error: "Tipe tidak valid" };
  }

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("settings")
    .select("feature_catalog_enabled")
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!settings?.feature_catalog_enabled) {
    return { error: "Modul katalog belum diaktifkan" };
  }

  const { data, error } = await supabase
    .from("catalog_items")
    .update({ item_type: newType })
    .eq("tenant_id", ctx.tenantId)
    .eq("description", trimmed)
    .select("id");

  if (error) return { error: error.message };

  const updated = (data ?? []).length;
  revalidatePath("/owner/katalog");
  return {
    success: `Katalog '${trimmed}' diperbarui ke tipe ${labelFor(newType)}`,
    updated,
  };
}

function labelFor(t: string) {
  if (t === "service") return "Jasa";
  if (t === "part_internal") return "Barang (stok)";
  return "Barang (beli)";
}
