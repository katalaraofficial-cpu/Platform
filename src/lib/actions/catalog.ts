"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserContext } from "@/lib/get-user-context";
import { revalidatePath } from "next/cache";

export type CatalogItem = {
  description: string;
  primaryType: "service" | "part_internal" | "part_external";
  totalRows: number;
  serviceCount: number;
  partInternalCount: number;
  partExternalCount: number;
  lastSellPrice: number;
  lastUnitLabel: string | null;
  lastUsedAt: string;
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
  const { data, error } = await supabase
    .from("invoice_items")
    .select("description, item_type, unit_price, quantity, final_price, unit_label, created_at")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) return { error: error.message };

  type Row = {
    description: string;
    item_type: "service" | "part_internal" | "part_external";
    quantity: number | string | null;
    final_price: number | string | null;
    unit_label: string | null;
    created_at: string;
  };

  const groups = new Map<string, CatalogItem>();
  for (const r of (data ?? []) as Row[]) {
    const key = (r.description ?? "").trim().toLowerCase();
    if (!key) continue;
    const qty = Number(r.quantity ?? 1) || 1;
    const final = Number(r.final_price ?? 0);
    const sell = qty > 0 ? Math.round(final / qty) : 0;

    let g = groups.get(key);
    if (!g) {
      g = {
        description: r.description,
        primaryType: r.item_type,
        totalRows: 0,
        serviceCount: 0,
        partInternalCount: 0,
        partExternalCount: 0,
        lastSellPrice: sell,
        lastUnitLabel: r.unit_label ?? null,
        lastUsedAt: r.created_at,
      };
      groups.set(key, g);
    }
    g.totalRows += 1;
    if (r.item_type === "service") g.serviceCount += 1;
    else if (r.item_type === "part_internal") g.partInternalCount += 1;
    else g.partExternalCount += 1;
  }

  // Resolve primary type by majority vote (tie → keep most recent)
  const result: CatalogItem[] = [];
  for (const g of groups.values()) {
    const counts = [
      ["service", g.serviceCount] as const,
      ["part_internal", g.partInternalCount] as const,
      ["part_external", g.partExternalCount] as const,
    ];
    counts.sort((a, b) => b[1] - a[1]);
    g.primaryType = counts[0][0] as CatalogItem["primaryType"];
    result.push(g);
  }
  result.sort((a, b) => b.totalRows - a.totalRows);
  return { data: result };
}

/**
 * Pindahkan semua `invoice_items` dengan deskripsi yang sama
 * (case-insensitive, scoped per tenant) ke `item_type` baru.
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

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("invoice_items")
    .update({ item_type: newType })
    .eq("tenant_id", ctx.tenantId)
    .ilike("description", trimmed)
    .select("id");
  if (error) return { error: error.message };

  const updated = (data ?? []).length;
  revalidatePath("/owner/katalog");
  revalidatePath("/owner/dashboard");
  return {
    success: `${updated} baris diperbarui ke ${labelFor(newType)}`,
    updated,
  };
}

function labelFor(t: string) {
  if (t === "service") return "Jasa";
  if (t === "part_internal") return "Barang (stok)";
  return "Barang (beli)";
}
