"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import { revalidatePath } from "next/cache";
import type { AccountType } from "@/types/database";

// ── Auth helper: allow both owner and admin ──────────────────
async function getAdminCtx() {
  const ctx = await getUserContext();
  if (!ctx.tenantId) return null;
  if (ctx.role !== "owner" && ctx.role !== "admin") return null;
  return ctx;
}

export type AddKasKeluarInput = {
  account_type: AccountType;
  category: string;
  amount: number;
  notes?: string;
  transaction_date?: string;
};

// ============================================================
// ADD PENGELUARAN — admin & owner only
// ============================================================
export async function addKasKeluar(
  data: AddKasKeluarInput
): Promise<{ success: true } | { error: string }> {
  const ctx = await getAdminCtx();
  if (!ctx) return { error: "Akses ditolak" };
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from("ledger").insert({
    tenant_id: ctx.tenantId!,
    transaction_type: "kas_keluar",
    account_type: data.account_type,
    category: data.category,
    amount: data.amount,
    notes: data.notes || null,
    transaction_date: data.transaction_date || today,
    created_by: ctx.id,
  } as never);

  if (error) return { error: error.message };
  revalidatePath("/admin/kas");
  revalidatePath("/owner/kas");
  return { success: true };
}
