"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type PointActionState = { error?: string; success?: string };

// ── Redeem employee points (owner/admin only) ────────────────
// Deducts points from balance, logs the transaction, and creates
// a ledger kas_keluar entry for the bonus amount.
export async function redeemEmployeePoints(
  profileId: string,
  points: number,
  notes: string
): Promise<PointActionState> {
  if (!profileId || points <= 0) return { error: "Data tidak valid" };

  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx.tenantId || !["owner", "admin"].includes(ctx.role ?? ""))
    return { error: "Tidak memiliki akses" };

  const tenantId = ctx.tenantId;

  // Load settings for reward config
  const { data: settings } = await supabase
    .from("settings")
    .select("reward_employee_enabled, reward_point_value, reward_min_redeem")
    .eq("tenant_id", tenantId)
    .single();

  if (!settings?.reward_employee_enabled)
    return { error: "Program reward belum diaktifkan" };
  if (points < (settings.reward_min_redeem ?? 1))
    return { error: `Minimal redeem ${settings.reward_min_redeem} point` };

  // Get current balance
  const { data: ep } = await supabase
    .from("employee_points")
    .select("id, points_balance, total_redeemed")
    .eq("tenant_id", tenantId)
    .eq("profile_id", profileId)
    .single();

  if (!ep) return { error: "Mekanik belum memiliki saldo point" };
  if (ep.points_balance < points)
    return { error: `Saldo tidak cukup (tersisa ${ep.points_balance} point)` };

  const bonusAmount = points * Number(settings.reward_point_value);

  // Deduct points balance
  const { error: updateErr } = await supabase
    .from("employee_points")
    .update({
      points_balance: ep.points_balance - points,
      total_redeemed: ep.total_redeemed + points,
    })
    .eq("id", ep.id);
  if (updateErr) return { error: "Gagal memperbarui saldo: " + updateErr.message };

  // Log point transaction
  await supabase.from("employee_point_transactions").insert({
    tenant_id: tenantId,
    profile_id: profileId,
    transaction_type: "redeem",
    points: -points,
    notes: notes || `Redeem ${points} point → Rp ${bonusAmount.toLocaleString("id-ID")}`,
  });

  // Record kas_keluar in ledger (admin client — same pattern as processPayment)
  const adminClient = createAdminClient();
  await adminClient.from("ledger").insert({
    tenant_id: tenantId,
    transaction_type: "kas_keluar",
    account_type: "kas_tunai",
    category: "Bonus Karyawan",
    amount: bonusAmount,
    reference_id: profileId,
    transfer_ref: null,
    notes: notes || `Redeem point karyawan: ${points} point (Rp ${bonusAmount.toLocaleString("id-ID")})`,
    created_by: ctx.id,
  } as never);

  revalidatePath("/owner/mechanics");
  revalidatePath("/admin/reimburse");
  return { success: `${points} point berhasil ditukar (Rp ${bonusAmount.toLocaleString("id-ID")})` };
}

// ── Update reward settings (owner only) ─────────────────────
export async function updateRewardSettings(data: {
  enabled: boolean;
  spendPerPoint: number;
  pointValue: number;
  minRedeem: number;
  validityDays: number;
  leadMultiplier: number;
  helperMultiplier: number;
}): Promise<PointActionState> {
  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx.tenantId || ctx.role !== "owner")
    return { error: "Hanya owner yang dapat mengubah pengaturan reward" };

  const { error } = await supabase
    .from("settings")
    .update({
      reward_employee_enabled: data.enabled,
      reward_spend_per_point: data.spendPerPoint,
      reward_point_value: data.pointValue,
      reward_min_redeem: data.minRedeem,
      reward_point_validity_days: data.validityDays,
      reward_lead_multiplier: data.leadMultiplier,
      reward_helper_multiplier: data.helperMultiplier,
    })
    .eq("tenant_id", ctx.tenantId);

  if (error) return { error: "Gagal menyimpan: " + error.message };
  revalidatePath("/owner/settings");
  return { success: "Pengaturan reward disimpan" };
}
