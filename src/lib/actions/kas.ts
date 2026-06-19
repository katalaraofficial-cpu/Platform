"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import { revalidatePath } from "next/cache";
import type { AccountType, LedgerType } from "@/types/database";

// ── Auth helper ─────────────────────────────────────────────
async function getOwnerCtx() {
  const ctx = await getUserContext();
  if (!ctx.tenantId || ctx.role !== "owner") return null;
  return ctx;
}

// ── Format helpers ───────────────────────────────────────────
type AddKasInput = {
  transaction_type: LedgerType;
  account_type: AccountType;
  category: string;
  amount: number;
  notes?: string;
  transaction_date?: string; // YYYY-MM-DD; defaults to today
};

// ============================================================
// ADD  — single income or expense entry
// ============================================================
export async function addKasEntry(
  data: AddKasInput
): Promise<{ success: true } | { error: string }> {
  const ctx = await getOwnerCtx();
  if (!ctx) return { error: "Akses ditolak" };
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from("ledger").insert({
    tenant_id: ctx.tenantId!,
    transaction_type: data.transaction_type,
    account_type: data.account_type,
    category: data.category,
    amount: data.amount,
    notes: data.notes || null,
    transaction_date: data.transaction_date || today,
    created_by: ctx.id,
  } as never);

  if (error) return { error: error.message };
  revalidatePath("/owner/kas");
  return { success: true };
}

// ============================================================
// TRANSFER  — moves money between kas_tunai ↔ bank
//             Creates two linked ledger entries.
// ============================================================
export async function createKasTransfer(data: {
  from_account: AccountType;
  amount: number;
  notes?: string;
}): Promise<{ success: true } | { error: string }> {
  const ctx = await getOwnerCtx();
  if (!ctx) return { error: "Akses ditolak" };
  const supabase = await createClient();

  const toAccount: AccountType =
    data.from_account === "kas_tunai" ? "bank" : "kas_tunai";
  const fromLabel = data.from_account === "kas_tunai" ? "Kas Tunai" : "Bank";
  const toLabel = toAccount === "kas_tunai" ? "Kas Tunai" : "Bank";
  const noteText = data.notes || `Transfer ke ${toLabel}`;

  // 1. Outgoing entry (keluar from source)
  const { data: outRow, error: outErr } = await supabase
    .from("ledger")
    .insert({
      tenant_id: ctx.tenantId!,
      transaction_type: "kas_keluar" as LedgerType,
      account_type: data.from_account,
      category: "105 - Mutasi Kas dan Bank",
      amount: data.amount,
      notes: noteText,
      created_by: ctx.id,
    } as never)
    .select("id")
    .single();

  if (outErr) return { error: outErr.message };

  // 2. Incoming entry (masuk to destination), linked back to source
  const { data: inRow, error: inErr } = await supabase
    .from("ledger")
    .insert({
      tenant_id: ctx.tenantId!,
      transaction_type: "kas_masuk" as LedgerType,
      account_type: toAccount,
      category: "105 - Mutasi Kas dan Bank",
      amount: data.amount,
      notes: `Transfer dari ${fromLabel}`,
      transfer_ref: outRow.id,
      created_by: ctx.id,
    } as never)
    .select("id")
    .single();

  if (inErr) {
    // Rollback outgoing entry
    await supabase.from("ledger").delete().eq("id", outRow.id);
    return { error: inErr.message };
  }

  // 3. Back-link: outgoing entry → incoming entry
  await supabase
    .from("ledger")
    .update({ transfer_ref: inRow.id } as never)
    .eq("id", outRow.id);

  revalidatePath("/owner/kas");
  return { success: true };
}

// ============================================================
// UPDATE  — edit category / amount / notes / date of an entry
//           (account_type and transaction_type are immutable)
// ============================================================
export async function updateKasEntry(
  id: string,
  data: { category?: string; amount?: number; notes?: string; transaction_date?: string }
): Promise<{ success: true } | { error: string }> {
  const ctx = await getOwnerCtx();
  if (!ctx) return { error: "Akses ditolak" };
  const supabase = await createClient();

  const { error } = await supabase
    .from("ledger")
    .update(data as never)
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId!);

  if (error) return { error: error.message };
  revalidatePath("/owner/kas");
  return { success: true };
}

// ============================================================
// DELETE  — removes an entry and its transfer pair (if any)
// ============================================================
export async function deleteKasEntry(
  id: string
): Promise<{ success: true } | { error: string }> {
  const ctx = await getOwnerCtx();
  if (!ctx) return { error: "Akses ditolak" };
  const supabase = await createClient();

  // Fetch the transfer_ref before deleting
  const { data: entry } = await supabase
    .from("ledger")
    .select("transfer_ref")
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId!)
    .single();

  // Delete the paired transfer entry first (to avoid FK constraint issues)
  if (entry?.transfer_ref) {
    await supabase
      .from("ledger")
      .delete()
      .eq("id", entry.transfer_ref as string)
      .eq("tenant_id", ctx.tenantId!);
  }

  const { error } = await supabase
    .from("ledger")
    .delete()
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId!);

  if (error) return { error: error.message };
  revalidatePath("/owner/kas");
  return { success: true };
}
