"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import { createTenantAdminClient } from "@/lib/supabase/tenant-admin";
import { revalidatePath } from "next/cache";

export type PointActionState = { error?: string; success?: string };

export type PointClaimActionState = PointActionState;

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
    reference_id: null,
    expires_at: null,
    notes: notes || `Redeem ${points} point → Rp ${bonusAmount.toLocaleString("id-ID")}`,
  });

  // Record kas_keluar in ledger (tenant-scoped admin: auto-inject tenant_id).
  const adminClient = createTenantAdminClient(tenantId);
  await adminClient.from("ledger").insert({
    transaction_type: "kas_keluar",
    account_type: "kas_tunai",
    category: "Bonus Karyawan",
    amount: bonusAmount,
    reference_id: profileId,
    transfer_ref: null,
    notes: notes || `Redeem point karyawan: ${points} point (Rp ${bonusAmount.toLocaleString("id-ID")})`,
    created_by: ctx.id,
  });

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

// ── Submit point redemption claim (mechanic only) ─────────────────────
export async function submitPointRedemptionClaim(
  points: number,
  notes: string
): Promise<PointClaimActionState> {
  if (points <= 0) return { error: "Jumlah point tidak valid" };

  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx.tenantId || ctx.role !== "mechanic") {
    return { error: "Hanya engineer yang dapat mengajukan klaim point" };
  }

  const tenantId = ctx.tenantId;

  const [{ data: settings }, { data: ep }, { data: pending }] = await Promise.all([
    supabase
      .from("settings")
      .select("reward_employee_enabled, reward_point_value, reward_min_redeem")
      .eq("tenant_id", tenantId)
      .single(),
    supabase
      .from("employee_points")
      .select("points_balance")
      .eq("tenant_id", tenantId)
      .eq("profile_id", ctx.id)
      .single(),
    supabase
      .from("point_redemption_requests")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("profile_id", ctx.id)
      .eq("status", "pending")
      .limit(1),
  ]);

  if (!settings?.reward_employee_enabled) {
    return { error: "Program reward belum diaktifkan" };
  }
  if (points < Number(settings.reward_min_redeem ?? 1)) {
    return { error: `Minimal redeem ${settings.reward_min_redeem} point` };
  }
  if (!ep || Number(ep.points_balance ?? 0) < points) {
    return { error: "Saldo point tidak mencukupi" };
  }
  if ((pending ?? []).length > 0) {
    return { error: "Masih ada pengajuan point yang belum diproses owner" };
  }

  const pointValue = Number(settings.reward_point_value ?? 0);
  const payoutAmount = points * pointValue;

  const { error: insertErr } = await supabase.from("point_redemption_requests").insert({
    tenant_id: tenantId,
    profile_id: ctx.id,
    requested_by: ctx.id,
    points,
    point_value: pointValue,
    payout_amount: payoutAmount,
    notes: notes?.trim() || null,
    status: "pending",
  });

  if (insertErr) return { error: "Gagal membuat pengajuan: " + insertErr.message };

  revalidatePath("/mechanic/dashboard");
  revalidatePath("/owner/mechanics");
  return { success: "Pengajuan klaim point berhasil dikirim dan menunggu persetujuan owner" };
}

// ── Approve point redemption claim (owner only) ────────────────────────
export async function approvePointRedemptionClaim(
  requestId: string
): Promise<PointClaimActionState> {
  if (!requestId) return { error: "Request tidak valid" };

  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx.tenantId || ctx.role !== "owner") {
    return { error: "Hanya owner yang dapat menyetujui pengajuan" };
  }

  const tenantId = ctx.tenantId;
  const admin = createTenantAdminClient(tenantId);

  const { data: request } = await supabase
    .from("point_redemption_requests")
    .select("id, tenant_id, profile_id, points, payout_amount, notes, status")
    .eq("id", requestId)
    .eq("tenant_id", tenantId)
    .single();

  if (!request) return { error: "Pengajuan tidak ditemukan" };
  if (request.status !== "pending") return { error: "Pengajuan sudah diproses sebelumnya" };

  const { data: ep } = await admin
    .from("employee_points")
    .select("id, points_balance, total_redeemed")
    .eq("profile_id", request.profile_id)
    .single();

  if (!ep) return { error: "Data point engineer tidak ditemukan" };
  if (Number(ep.points_balance) < Number(request.points)) {
    return { error: "Saldo point engineer tidak mencukupi saat approval" };
  }

  const { error: updateBalanceErr } = await admin
    .from("employee_points")
    .update({
      points_balance: Number(ep.points_balance) - Number(request.points),
      total_redeemed: Number(ep.total_redeemed) + Number(request.points),
    })
    .eq("id", ep.id);
  if (updateBalanceErr) return { error: "Gagal memperbarui saldo point" };

  const { data: tx, error: txErr } = await admin
    .from("employee_point_transactions")
    .insert({
      profile_id: request.profile_id,
      transaction_type: "redeem",
      points: -Number(request.points),
      reference_id: request.id,
      notes:
        request.notes ||
        `Approved redeem ${request.points} point (Rp ${Number(request.payout_amount).toLocaleString("id-ID")})`,
      expires_at: null,
    })
    .select("id")
    .single();
  if (txErr) {
    await admin
      .from("employee_points")
      .update({
        points_balance: Number(ep.points_balance),
        total_redeemed: Number(ep.total_redeemed),
      })
      .eq("id", ep.id);
    return { error: "Gagal mencatat transaksi point" };
  }

  const { data: ledger, error: ledgerErr } = await admin
    .from("ledger")
    .insert({
      transaction_type: "kas_keluar",
      account_type: "kas_tunai",
      category: "Bonus Karyawan",
      amount: Number(request.payout_amount),
      reference_id: request.profile_id,
      transfer_ref: null,
      notes:
        request.notes ||
        `Payout redeem point: ${request.points} point (Rp ${Number(request.payout_amount).toLocaleString("id-ID")})`,
      created_by: ctx.id,
    })
    .select("id")
    .single();
  if (ledgerErr) {
    await admin.from("employee_point_transactions").delete().eq("id", tx.id);
    await admin
      .from("employee_points")
      .update({
        points_balance: Number(ep.points_balance),
        total_redeemed: Number(ep.total_redeemed),
      })
      .eq("id", ep.id);
    return { error: "Gagal membuat catatan kas keluar" };
  }

  const { error: requestErr } = await admin
    .from("point_redemption_requests")
    .update({
      status: "approved",
      reviewed_by: ctx.id,
      reviewed_at: new Date().toISOString(),
      review_note: null,
      point_transaction_id: tx.id,
      ledger_id: ledger.id,
    })
    .eq("id", request.id)
    .eq("status", "pending");

  if (requestErr) {
    await admin.from("ledger").delete().eq("id", ledger.id);
    await admin.from("employee_point_transactions").delete().eq("id", tx.id);
    await admin
      .from("employee_points")
      .update({
        points_balance: Number(ep.points_balance),
        total_redeemed: Number(ep.total_redeemed),
      })
      .eq("id", ep.id);
    return { error: "Gagal memperbarui status pengajuan" };
  }

  revalidatePath("/owner/mechanics");
  revalidatePath("/mechanic/dashboard");
  return { success: "Pengajuan berhasil disetujui dan bonus kas sudah dicatat" };
}

// ── Reject point redemption claim (owner only) ─────────────────────────
export async function rejectPointRedemptionClaim(
  requestId: string,
  reason?: string
): Promise<PointClaimActionState> {
  if (!requestId) return { error: "Request tidak valid" };

  const ctx = await getUserContext();
  if (!ctx.tenantId || ctx.role !== "owner") {
    return { error: "Hanya owner yang dapat menolak pengajuan" };
  }

  const admin = createTenantAdminClient(ctx.tenantId);
  const { error } = await admin
    .from("point_redemption_requests")
    .update({
      status: "rejected",
      reviewed_by: ctx.id,
      reviewed_at: new Date().toISOString(),
      review_note: reason?.trim() || null,
    })
    .eq("id", requestId)
    .eq("status", "pending");

  if (error) return { error: "Gagal menolak pengajuan: " + error.message };

  revalidatePath("/owner/mechanics");
  revalidatePath("/mechanic/dashboard");
  return { success: "Pengajuan klaim point ditolak" };
}
