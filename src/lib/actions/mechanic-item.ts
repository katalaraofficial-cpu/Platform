"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import { revalidatePath } from "next/cache";

export async function addMechanicItem(data: {
  invoiceId: string;
  description: string;
  qty: number;
}): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx.tenantId) return { error: "Tenant tidak ditemukan" };

  const { error } = await supabase.from("invoice_items").insert({
    invoice_id: data.invoiceId,
    tenant_id: ctx.tenantId,
    item_type: "part_external",
    description: data.description,
    quantity: data.qty,
    unit_price: 0,
    markup_pct: 0,
    final_price: 0,
    payment_source: "mechanic",
    submitted_by: ctx.id,
  });

  if (error) return { error: "Gagal menyimpan: " + error.message };

  revalidatePath(`/mechanic/dashboard/${data.invoiceId}`);
  return { success: true };
}
