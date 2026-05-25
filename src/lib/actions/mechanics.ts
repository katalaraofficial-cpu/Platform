"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import { revalidatePath } from "next/cache";

// ============================================================
// REIMBURSE  — owner or admin records a reimbursement payment
//              to settle mechanic's advance purchases.
// ============================================================
export async function reimburseDebt(data: {
  mechanicId: string;
  amount: number;
  notes?: string;
}): Promise<{ success: true } | { error: string }> {
  const ctx = await getUserContext();
  if (!ctx.tenantId) return { error: "Tenant tidak ditemukan" };
  if (!["owner", "admin"].includes(ctx.role)) return { error: "Akses ditolak" };

  const supabase = await createClient();

  const { error } = await supabase.from("mechanic_debt_ledger").insert({
    tenant_id: ctx.tenantId,
    mechanic_id: data.mechanicId,
    transaction_type: "reimbursement",
    invoice_item_id: null,
    amount: data.amount,
    notes: data.notes || null,
    is_paid: true,
    created_by: ctx.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/owner/mechanics");
  revalidatePath("/admin/reimburse");
  return { success: true };
}
