"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getUserContext } from "@/lib/get-user-context";
import { revalidatePath } from "next/cache";
import { summarizeEmployeePointsByProfile, type PointTransactionSummaryRow } from "@/lib/employee-point-summary";
import type { FeatureToggles } from "@/types/database";

export type SettingsActionState = { error?: string; success?: string };

const NOTA_CONFIG_MARKER = "__KATALARA_NOTA_CONFIG__";

async function ensureSettingsRow(tenantId: string): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const { data: existing, error: selectErr } = await admin
    .from("settings")
    .select("id")
    .eq("tenant_id", tenantId)
    .limit(1);

  if (selectErr) return { error: selectErr.message };
  if ((existing ?? []).length > 0) return {};

  const { error: insertErr } = await admin
    .from("settings")
    .insert({ tenant_id: tenantId });

  // Safe to ignore duplicate insert race.
  if (insertErr && insertErr.code !== "23505") {
    return { error: insertErr.message };
  }

  return {};
}

function encodeNotaHeader(header: string, config: Record<string, unknown>) {
  const cleanHeader = header.trim();
  return cleanHeader ? `${cleanHeader}\n${NOTA_CONFIG_MARKER}${JSON.stringify(config)}` : `${NOTA_CONFIG_MARKER}${JSON.stringify(config)}`;
}

// ── Helper: ensure caller is owner ──────────────────────────
async function ownerGuard(): Promise<{ tenantId: string; id: string; role: string | null }> {
  const ctx = await getUserContext();
  if (!ctx.tenantId || ctx.role !== "owner")
    throw new Error("Hanya owner yang dapat mengubah pengaturan");
  return { ...ctx, tenantId: ctx.tenantId };
}

// ── Tab 1: Informasi Toko ───────────────────────────────────
export async function saveStoreInfo(data: {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeEmail: string;
  storeLogoUrl: string;
}): Promise<SettingsActionState> {
  try {
    const ctx = await ownerGuard();
    const ensured = await ensureSettingsRow(ctx.tenantId);
    if (ensured.error) return { error: ensured.error };

    const admin = createAdminClient();
    const { error } = await admin
      .from("settings")
      .update({
        store_name: data.storeName.trim(),
        store_address: data.storeAddress.trim(),
        store_phone: data.storePhone.trim(),
        store_email: data.storeEmail.trim(),
        store_logo_url: data.storeLogoUrl.trim(),
      })
      .eq("tenant_id", ctx.tenantId);
    if (error) return { error: error.message };
    revalidatePath("/owner/settings");
    return { success: "Informasi toko disimpan" };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ── Tab 2: Platform ─────────────────────────────────────────
export async function savePlatformSettings(data: {
  defaultMarkupPct: number;
  pettyCashLimit: number;
  qtyDecimal: boolean;
  priceTierLabels: { HET: string; HG1: string; HG2: string; HG3: string };
}): Promise<SettingsActionState> {
  try {
    const ctx = await ownerGuard();
    const ensured = await ensureSettingsRow(ctx.tenantId);
    if (ensured.error) return { error: ensured.error };

    const admin = createAdminClient();
    const { error } = await admin
      .from("settings")
      .update({
        default_markup_pct: data.defaultMarkupPct,
        petty_cash_limit: data.pettyCashLimit,
        qty_decimal: data.qtyDecimal,
        price_tier_labels: data.priceTierLabels,
      })
      .eq("tenant_id", ctx.tenantId);
    if (error) return { error: error.message };
    revalidatePath("/owner/settings");
    return { success: "Pengaturan platform disimpan" };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ── Tab 2b: Modul Invoice (feature toggle untuk DP) ─────────
export async function saveInvoiceFeatures(data: {
  moduleInvoiceDp?: boolean;
  moduleInvoicePpn?: boolean;
  moduleInvoicePph?: boolean;
}): Promise<SettingsActionState> {
  try {
    const ctx = await ownerGuard();
    const admin = createAdminClient();

    const { data: tenant, error: fetchErr } = await admin
      .from("tenants")
      .select("feature_toggles")
      .eq("id", ctx.tenantId)
      .single();
    if (fetchErr) return { error: fetchErr.message };

    const toggles: Record<string, unknown> = { ...(tenant?.feature_toggles ?? {}) };
    if (typeof data.moduleInvoiceDp === "boolean") toggles.module_invoice_dp = data.moduleInvoiceDp;
    if (typeof data.moduleInvoicePpn === "boolean") toggles.module_invoice_ppn = data.moduleInvoicePpn;
    if (typeof data.moduleInvoicePph === "boolean") toggles.module_invoice_pph = data.moduleInvoicePph;

    const { error } = await admin
      .from("tenants")
      .update({ feature_toggles: toggles as unknown as FeatureToggles })
      .eq("id", ctx.tenantId);
    if (error) return { error: error.message };

    revalidatePath("/owner/settings");
    revalidatePath("/owner/invoices", "layout");
    revalidatePath("/admin/invoices", "layout");
    return { success: "Modul invoice diperbarui" };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ── Tab 3: Nota & Printer ───────────────────────────────────
export async function saveNotaSettings(data: {
  notaTitle: string;
  notaTitleSize: number;
  notaSubtitle: string;
  notaCustomerLayout: "stacked" | "split";
  notaSignatureLayout: "double" | "single";
  notaJabatan: string;
  notaShowWatermark: boolean;
  notaHeader: string;
  notaFooter: string;
  notaSignatureUrl: string;
  notaStampUrl: string;
  notaActiveFormat: "A4" | "A5" | "thermal";
}): Promise<SettingsActionState> {
  const allowed = ["A4", "A5", "thermal"];
  if (!allowed.includes(data.notaActiveFormat))
    return { error: "Format nota tidak valid" };
  try {
    const ctx = await ownerGuard();
    const ensured = await ensureSettingsRow(ctx.tenantId);
    if (ensured.error) return { error: ensured.error };

    const admin = createAdminClient();
    const { error } = await admin
      .from("settings")
      .update({
        nota_title: data.notaTitle.trim() || null,
        nota_title_size: Math.max(16, Math.min(42, Math.round(data.notaTitleSize || 28))),
        nota_subtitle: data.notaSubtitle.trim() || null,
        nota_customer_layout: data.notaCustomerLayout,
        nota_signature_layout: data.notaSignatureLayout,
        nota_jabatan: data.notaJabatan.trim() || null,
        nota_show_watermark: data.notaShowWatermark,
        nota_header: data.notaHeader.trim(),
        nota_footer: data.notaFooter.trim(),
        nota_signature_url: data.notaSignatureUrl.trim(),
        nota_stamp_url: data.notaStampUrl.trim(),
        nota_active_format: data.notaActiveFormat,
      })
      .eq("tenant_id", ctx.tenantId);
    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("schema cache") || message.includes("nota_customer_layout") || message.includes("nota_signature_layout") || message.includes("nota_title_size")) {
        const legacyUpdate = await admin
          .from("settings")
          .update({
            nota_header: encodeNotaHeader(data.notaHeader, {
              nota_title: data.notaTitle.trim() || null,
              nota_title_size: Math.max(16, Math.min(42, Math.round(data.notaTitleSize || 28))),
              nota_subtitle: data.notaSubtitle.trim() || null,
              nota_customer_layout: data.notaCustomerLayout,
              nota_signature_layout: data.notaSignatureLayout,
              nota_jabatan: data.notaJabatan.trim() || null,
              nota_show_watermark: data.notaShowWatermark,
            }),
            nota_footer: data.notaFooter.trim(),
            nota_signature_url: data.notaSignatureUrl.trim(),
            nota_stamp_url: data.notaStampUrl.trim(),
            nota_active_format: data.notaActiveFormat,
          })
          .eq("tenant_id", ctx.tenantId);

        if (legacyUpdate.error) {
          return { error: "Database belum sinkron dengan konfigurasi Nota & Printer. Jalankan migration 024_settings_nota_config.sql di Supabase, lalu simpan ulang." };
        }

        revalidatePath("/owner/settings");
        return { success: "Pengaturan nota berhasil disimpan." };
      }
      return { error: error.message };
    }
    revalidatePath("/owner/settings");
    return { success: "Pengaturan nota berhasil disimpan." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ── Tab 4: Reward ───────────────────────────────────────────
export async function saveRewardSettings(data: {
  enabled: boolean;
  spendPerPoint: number;
  pointValue: number;
  minRedeem: number;
  validityDays: number;
  leadMultiplier: number;
  helperMultiplier: number;
}): Promise<SettingsActionState> {
  try {
    const ctx = await ownerGuard();
    const ensured = await ensureSettingsRow(ctx.tenantId);
    if (ensured.error) return { error: ensured.error };

    const admin = createAdminClient();
    const payload = {
      tenant_id: ctx.tenantId,
      reward_employee_enabled: data.enabled,
      reward_spend_per_point: data.spendPerPoint,
      reward_point_value: data.pointValue,
      reward_min_redeem: data.minRedeem,
      reward_point_validity_days: data.validityDays,
      reward_lead_multiplier: data.leadMultiplier,
      reward_helper_multiplier: data.helperMultiplier,
    };

    const { error } = await admin
      .from("settings")
      .update(payload)
      .eq("tenant_id", ctx.tenantId);
    if (error) return { error: error.message };

    const { data: verify } = await admin
      .from("settings")
      .select("reward_employee_enabled")
      .eq("tenant_id", ctx.tenantId)
      .single();
    if (!verify || Boolean(verify.reward_employee_enabled) !== Boolean(data.enabled)) {
      return { error: "Pengaturan reward belum tersimpan konsisten. Coba simpan ulang." };
    }

    revalidatePath("/owner/settings");
    revalidatePath("/owner/mechanics");
    return { success: "Pengaturan reward disimpan" };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function syncEngineerPoints(): Promise<SettingsActionState> {
  try {
    const ctx = await ownerGuard();
    const tenantId = ctx.tenantId;
    const admin = createAdminClient();

    const [{ data: mechanics }, { data: transactions }, { data: existingRows }, { data: invoices }] = await Promise.all([
      admin
        .from("profiles")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("role", "mechanic"),
      admin
        .from("employee_point_transactions")
        .select("profile_id, transaction_type, points, reference_id")
        .eq("tenant_id", tenantId),
      admin
        .from("employee_points")
        .select("id, profile_id")
        .eq("tenant_id", tenantId),
      admin
        .from("invoices")
        .select("id, status")
        .eq("tenant_id", tenantId),
    ]);

    const invoiceStatusById = new Map<string, string>();
    for (const invoice of invoices ?? []) {
      invoiceStatusById.set(invoice.id, invoice.status);
    }

    const invoiceNetByProfile = new Map<string, number>();
    for (const tx of transactions ?? []) {
      const referenceId = tx.reference_id ?? "";
      if (!invoiceStatusById.has(referenceId)) continue;
      if (!["earn", "adjust"].includes(tx.transaction_type)) continue;
      const key = `${referenceId}:${tx.profile_id}`;
      invoiceNetByProfile.set(key, (invoiceNetByProfile.get(key) ?? 0) + Number(tx.points ?? 0));
    }

    for (const [key, netPoints] of invoiceNetByProfile.entries()) {
      if (netPoints === 0) continue;
      const [invoiceId, profileId] = key.split(":");
      if (invoiceStatusById.get(invoiceId) === "paid") continue;

      const { error: adjustErr } = await admin.from("employee_point_transactions").insert({
        tenant_id: tenantId,
        profile_id: profileId,
        transaction_type: "adjust",
        points: -netPoints,
        reference_id: invoiceId,
        notes: "Penyesuaian point: nota tidak berstatus lunas, maka point dibatalkan saat sinkronisasi.",
        expires_at: null,
      });
      if (adjustErr) {
        return { error: `Gagal menormalkan histori point invoice: ${adjustErr.message}` };
      }
    }

    const refreshedTransactions = await admin
      .from("employee_point_transactions")
      .select("profile_id, transaction_type, points")
      .eq("tenant_id", tenantId);
    if (refreshedTransactions.error) {
      return { error: `Gagal memuat ulang histori point: ${refreshedTransactions.error.message}` };
    }

    const summary = summarizeEmployeePointsByProfile(
      ((refreshedTransactions.data as PointTransactionSummaryRow[] | null) ?? [])
    );
    for (const mechanic of mechanics ?? []) {
      if (!summary.has(mechanic.id)) {
        summary.set(mechanic.id, {
          points_balance: 0,
          total_earned: 0,
          total_redeemed: 0,
        });
      }
    }

    for (const mechanic of mechanics ?? []) {
      const totals = summary.get(mechanic.id) ?? {
        points_balance: 0,
        total_earned: 0,
        total_redeemed: 0,
      };
      const existing = (existingRows ?? []).find((row) => row.profile_id === mechanic.id);
      const payload = {
        tenant_id: tenantId,
        profile_id: mechanic.id,
        points_balance: Math.max(0, totals.points_balance),
        total_earned: Math.max(0, totals.total_earned),
        total_redeemed: Math.max(0, totals.total_redeemed),
      };

      if (existing) {
        const { error } = await admin.from("employee_points").update(payload).eq("id", existing.id);
        if (error) return { error: `Gagal sinkron point engineer: ${error.message}` };
      } else {
        const { error } = await admin.from("employee_points").insert(payload);
        if (error) return { error: `Gagal membuat saldo point engineer: ${error.message}` };
      }
    }

    revalidatePath("/owner/settings");
    revalidatePath("/owner/mechanics");
    revalidatePath("/mechanic/dashboard");
    return { success: "Saldo point engineer berhasil disinkron ulang dari histori transaksi" };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ── Tab 5: Reset Data ────────────────────────────────────────
// Deletes all business data for the tenant (invoices, customers, ledger,
// etc.) but keeps tenant/profile/settings rows intact.
// Uses adminClient to bypass RLS on all affected tables.
export async function resetAllData(
  confirmationPhrase: string
): Promise<SettingsActionState> {
  if (confirmationPhrase !== "HAPUS SEMUA")
    return { error: "Frasa konfirmasi salah" };

  try {
    const ctx = await ownerGuard();
    const tenantId = ctx.tenantId!;
    const admin = createAdminClient();

    // Delete in dependency order (children first)
    const tables = [
      "employee_point_transactions",
      "employee_points",
      "mechanic_debt_ledger",
      "ledger",
      "invoice_mechanics",
      "invoice_items",
      "invoices",
      "customers",
    ] as const;

    for (const table of tables) {
      const { error } = await admin
        .from(table)
        .delete()
        .eq("tenant_id", tenantId);
      if (error) return { error: `Gagal hapus ${table}: ${error.message}` };
    }

    revalidatePath("/owner");
    return { success: "Semua data bisnis berhasil dihapus. Akun dan pengaturan tetap ada." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
