"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserContext } from "@/lib/get-user-context";
import { revalidatePath } from "next/cache";

export type SettingsActionState = { error?: string; success?: string };

const NOTA_CONFIG_MARKER = "__KATALARA_NOTA_CONFIG__";

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
    const supabase = await createClient();
    const { error } = await supabase
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
    const supabase = await createClient();
    const { error } = await supabase
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
    const supabase = await createClient();
    const { error } = await supabase
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
        const legacyUpdate = await supabase
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
    const supabase = await createClient();
    const payload = {
      reward_employee_enabled: data.enabled,
      reward_spend_per_point: data.spendPerPoint,
      reward_point_value: data.pointValue,
      reward_min_redeem: data.minRedeem,
      reward_point_validity_days: data.validityDays,
      reward_lead_multiplier: data.leadMultiplier,
      reward_helper_multiplier: data.helperMultiplier,
    };

    const { data: updatedRows, error } = await supabase
      .from("settings")
      .update(payload)
      .eq("tenant_id", ctx.tenantId)
      .select("id")
      .limit(1);
    if (error) return { error: error.message };

    // Some tenants can miss the settings row (legacy data), so create it once.
    if (!updatedRows || updatedRows.length === 0) {
      const admin = createAdminClient();
      const { error: insertErr } = await admin.from("settings").insert({
        tenant_id: ctx.tenantId,
        ...payload,
      });
      if (insertErr) return { error: insertErr.message };
    }

    revalidatePath("/owner/settings");
    revalidatePath("/owner/mechanics");
    return { success: "Pengaturan reward disimpan" };
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
