"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import { revalidatePath } from "next/cache";
import type { PaymentSource } from "@/types/database";

export async function addMechanicItem(data: {
  invoiceId: string;
  description: string;
  itemType: "service" | "part_external";
  qty: number;
  paymentSource?: PaymentSource;
}): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx.tenantId) return { error: "Tenant tidak ditemukan" };

  const { error } = await supabase.from("invoice_items").insert({
    invoice_id: data.invoiceId,
    tenant_id: ctx.tenantId,
    item_type: data.itemType,
    description: data.description,
    quantity: data.qty,
    unit_price: 0,
    markup_pct: 0,
    final_price: 0,
    payment_source:
      data.itemType === "part_external"
        ? (data.paymentSource ?? "mechanic")
        : null,
    submitted_by: ctx.id,
  });

  if (error) return { error: "Gagal menyimpan: " + error.message };

  revalidatePath(`/mechanic/dashboard/${data.invoiceId}`);
  return { success: true };
}
