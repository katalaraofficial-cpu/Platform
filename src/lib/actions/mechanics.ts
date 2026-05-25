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
  transferProofUrl?: string;
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
    transfer_ref: data.paymentMethod === "bank" ? (data.transferProofUrl ?? null) : null,
    reference_id: null,
    created_by: ctx.id,
  });

  if (ledgerError) return { error: ledgerError.message };

  revalidatePath("/owner/mechanics");
  revalidatePath("/owner/kas");
  revalidatePath("/owner/dashboard");
  revalidatePath("/admin/reimburse");
  revalidatePath("/mechanic/debts");
  return { success: true };
}

// ============================================================
// DELETE DEBT ENTRIES  — bulk delete rows from debt ledger
// ============================================================
export async function deleteDebtEntries(
  ids: string[]
): Promise<{ success: true } | { error: string }> {
  if (!ids.length) return { success: true };
  const ctx = await getUserContext();
  if (!ctx.tenantId) return { error: "Tenant tidak ditemukan" };
  if (!["owner", "admin"].includes(ctx.role)) return { error: "Akses ditolak" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("mechanic_debt_ledger")
    .delete()
    .in("id", ids)
    .eq("tenant_id", ctx.tenantId);

  if (error) return { error: error.message };

  revalidatePath("/owner/mechanics");
  revalidatePath("/owner/dashboard");
  revalidatePath("/admin/reimburse");
  revalidatePath("/mechanic/debts");
  return { success: true };
}

// ============================================================
// MARK DEBT ENTRIES  — bulk mark advance rows as is_paid = true
// ============================================================
export async function markDebtEntries(
  ids: string[]
): Promise<{ success: true } | { error: string }> {
  if (!ids.length) return { success: true };
  const ctx = await getUserContext();
  if (!ctx.tenantId) return { error: "Tenant tidak ditemukan" };
  if (!["owner", "admin"].includes(ctx.role)) return { error: "Akses ditolak" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("mechanic_debt_ledger")
    .update({ is_paid: true })
    .in("id", ids)
    .eq("tenant_id", ctx.tenantId);

  if (error) return { error: error.message };

  revalidatePath("/owner/mechanics");
  revalidatePath("/admin/reimburse");
  revalidatePath("/mechanic/debts");
  return { success: true };
}

// ============================================================
// RESTORE DEBT ENTRIES  — re-insert rows after undo-delete
// ============================================================
export async function restoreDebtEntries(
  rows: {
    mechanic_id: string;
    transaction_type: string;
    invoice_item_id: string | null;
    amount: number;
    notes: string | null;
    is_paid: boolean;
  }[]
): Promise<{ success: true } | { error: string }> {
  if (!rows.length) return { success: true };
  const ctx = await getUserContext();
  if (!ctx.tenantId) return { error: "Tenant tidak ditemukan" };
  if (!["owner", "admin"].includes(ctx.role)) return { error: "Akses ditolak" };

  const supabase = await createClient();
  const { error } = await supabase.from("mechanic_debt_ledger").insert(
    rows.map((r) => ({
      tenant_id: ctx.tenantId!,
      mechanic_id: r.mechanic_id,
      transaction_type: r.transaction_type as "advance" | "reimbursement",
      invoice_item_id: r.invoice_item_id,
      amount: r.amount,
      notes: r.notes,
      is_paid: r.is_paid,
      created_by: ctx.id,
    }))
  );

  if (error) return { error: error.message };

  revalidatePath("/owner/mechanics");
  revalidatePath("/owner/dashboard");
  revalidatePath("/admin/reimburse");
  revalidatePath("/mechanic/debts");
  return { success: true };
}
