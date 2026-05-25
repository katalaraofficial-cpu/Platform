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
  paymentMethod: "kas_tunai" | "bank";
}): Promise<{ success: true } | { error: string }> {
  const ctx = await getUserContext();
  if (!ctx.tenantId) return { error: "Tenant tidak ditemukan" };
  if (!["owner", "admin"].includes(ctx.role)) return { error: "Akses ditolak" };

  const supabase = await createClient();

  // 1. Record reimbursement in mechanic debt ledger
  const { error: debtError } = await supabase.from("mechanic_debt_ledger").insert({
    tenant_id: ctx.tenantId,
    mechanic_id: data.mechanicId,
    transaction_type: "reimbursement",
    invoice_item_id: null,
    amount: data.amount,
    notes: data.notes || null,
    is_paid: true,
    created_by: ctx.id,
  });

  if (debtError) return { error: debtError.message };

  // 2. Deduct from kas/bank ledger so balance reflects the payment
  const { error: ledgerError } = await supabase.from("ledger").insert({
    tenant_id: ctx.tenantId,
    transaction_type: "kas_keluar",
    account_type: data.paymentMethod,
    category: "Reimburse Mekanik",
    amount: data.amount,
    notes: data.notes || null,
    transfer_ref: null,
    created_by: ctx.id,
  });

  if (ledgerError) return { error: ledgerError.message };

  revalidatePath("/owner/mechanics");
  revalidatePath("/owner/kas");
  revalidatePath("/owner/dashboard");
  revalidatePath("/admin/reimburse");
  return { success: true };
}
