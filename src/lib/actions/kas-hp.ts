"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import { revalidatePath } from "next/cache";
import type { AccountType } from "@/types/database";

// ── Auth helper ─────────────────────────────────────────────
async function getOwnerCtx() {
  const ctx = await getUserContext();
  if (!ctx.tenantId || ctx.role !== "owner") return null;
  return ctx;
}

// ── Types ────────────────────────────────────────────────────
export type KasHpRow = {
  id: string;
  hp_type: "hutang" | "piutang";
  counterparty: string;
  description: string | null;
  amount: number;
  paid_amount: number;
  transaction_date: string;
  due_date: string | null;
  created_at: string;
};

// ============================================================
// LIST — fetch all hutang or piutang for the tenant
// ============================================================
export async function listKasHp(
  hp_type: "hutang" | "piutang"
): Promise<KasHpRow[]> {
  const ctx = await getOwnerCtx();
  if (!ctx) return [];
  const supabase = await createClient();

  const { data } = await supabase
    .from("kas_hp")
    .select("id, hp_type, counterparty, description, amount, paid_amount, transaction_date, due_date, created_at")
    .eq("tenant_id", ctx.tenantId!)
    .eq("hp_type", hp_type)
    .order("transaction_date", { ascending: false });

  return (data as KasHpRow[] | null) ?? [];
}

// ============================================================
// ADD — create a new hutang or piutang record
// ============================================================
export async function addKasHp(data: {
  hp_type: "hutang" | "piutang";
  counterparty: string;
  description?: string;
  amount: number;
  transaction_date?: string;
  due_date?: string;
}): Promise<{ success: true } | { error: string }> {
  const ctx = await getOwnerCtx();
  if (!ctx) return { error: "Akses ditolak" };
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from("kas_hp").insert({
    tenant_id: ctx.tenantId!,
    hp_type: data.hp_type,
    counterparty: data.counterparty,
    description: data.description || null,
    amount: data.amount,
    transaction_date: data.transaction_date || today,
    due_date: data.due_date || null,
    created_by: ctx.id,
  } as never);

  if (error) return { error: error.message };
  revalidatePath("/owner/kas");
  return { success: true };
}

// ============================================================
// RECORD PAYMENT — pay/receive against a HP entry
// Creates a ledger entry and updates paid_amount
// ============================================================
export async function recordKasHpPayment(data: {
  hp_id: string;
  hp_type: "hutang" | "piutang";
  counterparty: string;
  pay_amount: number;
  account_type: AccountType;
  paid_at?: string;
  notes?: string;
}): Promise<{ success: true } | { error: string }> {
  const ctx = await getOwnerCtx();
  if (!ctx) return { error: "Akses ditolak" };
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);
  const paidAt = data.paid_at || today;

  // Fetch current HP record
  const { data: hp, error: fetchErr } = await supabase
    .from("kas_hp")
    .select("amount, paid_amount")
    .eq("id", data.hp_id)
    .eq("tenant_id", ctx.tenantId!)
    .single();

  if (fetchErr || !hp) return { error: "Data tidak ditemukan" };

  const remaining = Number(hp.amount) - Number(hp.paid_amount);
  if (data.pay_amount > remaining) {
    return { error: `Maksimal pembayaran tersisa: Rp ${remaining.toLocaleString("id-ID")}` };
  }

  // Create ledger entry
  const transaction_type = data.hp_type === "hutang" ? "kas_keluar" : "kas_masuk";
  const category =
    data.hp_type === "hutang"
      ? `210 - Hutang Usaha`
      : `103 - Piutang Usaha`;
  const noteText =
    data.notes ||
    (data.hp_type === "hutang"
      ? `Bayar hutang ke ${data.counterparty}`
      : `Terima piutang dari ${data.counterparty}`);

  const { data: ledgerRow, error: ledgerErr } = await supabase
    .from("ledger")
    .insert({
      tenant_id: ctx.tenantId!,
      transaction_type,
      account_type: data.account_type,
      category,
      amount: data.pay_amount,
      notes: noteText,
      transaction_date: paidAt,
      created_by: ctx.id,
    } as never)
    .select("id")
    .single();

  if (ledgerErr) return { error: ledgerErr.message };

  // Record payment
  const { error: payErr } = await supabase.from("kas_hp_payment").insert({
    hp_id: data.hp_id,
    ledger_id: ledgerRow.id,
    amount: data.pay_amount,
    paid_at: paidAt,
    notes: data.notes || null,
  } as never);

  if (payErr) return { error: payErr.message };

  // Update paid_amount on HP record
  const newPaid = Number(hp.paid_amount) + data.pay_amount;
  const { error: updateErr } = await supabase
    .from("kas_hp")
    .update({ paid_amount: newPaid } as never)
    .eq("id", data.hp_id)
    .eq("tenant_id", ctx.tenantId!);

  if (updateErr) return { error: updateErr.message };

  revalidatePath("/owner/kas");
  return { success: true };
}

// ============================================================
// DELETE — remove a HP record (only if not yet paid)
// ============================================================
export async function deleteKasHp(
  id: string
): Promise<{ success: true } | { error: string }> {
  const ctx = await getOwnerCtx();
  if (!ctx) return { error: "Akses ditolak" };
  const supabase = await createClient();

  const { data: hp } = await supabase
    .from("kas_hp")
    .select("paid_amount")
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId!)
    .single();

  if (hp && Number(hp.paid_amount) > 0) {
    return { error: "Tidak dapat dihapus karena sudah ada pembayaran tercatat" };
  }

  const { error } = await supabase
    .from("kas_hp")
    .delete()
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId!);

  if (error) return { error: error.message };
  revalidatePath("/owner/kas");
  return { success: true };
}
