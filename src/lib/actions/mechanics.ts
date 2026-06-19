"use server";

import { createClient } from "@/lib/supabase/server";
import { createTenantAdminClient } from "@/lib/supabase/tenant-admin";
import { getUserContext } from "@/lib/get-user-context";
import { revalidatePath } from "next/cache";

// ── COA mapping for mechanic reimbursement ───────────────────
// Maps a claim category to the proper Chart-of-Account category used in kas.
//   bensin            → 605 Transportasi & Bensin Teknisi
//   kesehatan/lainnya → 610 Beban Lainnya
//   null (part terkait invoice) → 604 Bahan & Sparepart Bengkel (Habis Pakai)
function claimCoaCategory(claimCategory: string | null): string {
  switch (claimCategory) {
    case "bensin":
      return "605 - Transportasi & Bensin Teknisi";
    case "kesehatan":
    case "lainnya":
      return "610 - Beban Lainnya";
    default:
      return "604 - Bahan & Sparepart Bengkel (Habis Pakai)";
  }
}

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
  const { data: debtRow, error: debtError } = await supabase
    .from("mechanic_debt_ledger")
    .insert({
      tenant_id: ctx.tenantId,
      mechanic_id: data.mechanicId,
      transaction_type: "reimbursement",
      invoice_item_id: null,
      amount: data.amount,
      notes: data.notes || null,
      // Engineer page reads reimbursement proof from debt ledger.
      receipt_image_url: data.paymentMethod === "bank" ? (data.transferProofUrl ?? null) : null,
      is_paid: true,
      created_by: ctx.id,
    })
    .select("id")
    .single();

  if (debtError) return { error: debtError.message };

  // 2. Determine COA classification by allocating this reimbursement across the
  //    mechanic's advance claims (FIFO). Each claim carries a category:
  //      bensin            → 605 Transportasi & Bensin Teknisi
  //      invoice/part      → 604 Bahan & Sparepart Bengkel (Habis Pakai)
  //      kesehatan/lainnya → 610 Beban Lainnya
  const { data: advances } = await supabase
    .from("mechanic_debt_ledger")
    .select("amount, claim_category, invoice_item_id")
    .eq("tenant_id", ctx.tenantId)
    .eq("mechanic_id", data.mechanicId)
    .eq("transaction_type", "advance")
    .order("created_at", { ascending: true });

  const { data: reimbursements } = await supabase
    .from("mechanic_debt_ledger")
    .select("id, amount")
    .eq("tenant_id", ctx.tenantId)
    .eq("mechanic_id", data.mechanicId)
    .eq("transaction_type", "reimbursement");

  // Amount already reimbursed before the row we just inserted.
  const priorReimbursed = (reimbursements ?? [])
    .filter((r) => r.id !== debtRow?.id)
    .reduce((s, r) => s + Number(r.amount), 0);

  const coaTotals = new Map<string, number>();
  let toSkip = priorReimbursed;
  let remaining = data.amount;
  for (const adv of advances ?? []) {
    let advAmt = Number(adv.amount);
    if (toSkip > 0) {
      const skipped = Math.min(toSkip, advAmt);
      toSkip -= skipped;
      advAmt -= skipped;
    }
    if (advAmt <= 0 || remaining <= 0) continue;
    const alloc = Math.min(advAmt, remaining);
    const coa = claimCoaCategory(adv.claim_category ?? null);
    coaTotals.set(coa, (coaTotals.get(coa) ?? 0) + alloc);
    remaining -= alloc;
  }
  // Any leftover (over-reimburse / no matching advance) falls back to generic.
  if (remaining > 0) {
    coaTotals.set(
      "Reimburse Mekanik",
      (coaTotals.get("Reimburse Mekanik") ?? 0) + remaining
    );
  }
  if (coaTotals.size === 0) coaTotals.set("Reimburse Mekanik", data.amount);

  const proofUrl =
    data.paymentMethod === "bank" ? (data.transferProofUrl ?? null) : null;
  const ledgerRows = Array.from(coaTotals.entries()).map(([category, amount]) => ({
    transaction_type: "kas_keluar",
    account_type: data.paymentMethod,
    category,
    amount,
    notes: data.notes || "Reimburse Mekanik",
    proof_url: proofUrl,
    transfer_ref: null,
    reference_id: debtRow?.id ?? null,
    created_by: ctx.id,
  }));

  // 3. Deduct from kas/bank ledger (admin — owner is blocked from ledger by RLS).
  // Tenant-scoped wrapper auto-inject tenant_id.
  const adminClient = createTenantAdminClient(ctx.tenantId);
  const { error: ledgerError } = (await adminClient
    .from("ledger")
    .insert(ledgerRows)) as { error: { message: string } | null };

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
