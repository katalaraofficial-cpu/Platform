"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createTenantAdminClient } from "@/lib/supabase/tenant-admin";
import { getUserContext } from "@/lib/get-user-context";
import { revalidatePath } from "next/cache";
import { summarizeEmployeePointsByProfile, type PointTransactionSummaryRow } from "@/lib/employee-point-summary";
import type { FeatureToggles } from "@/types/database";

export type SettingsActionState = { error?: string; success?: string };

const NOTA_CONFIG_MARKER = "__KATALARA_NOTA_CONFIG__";

async function ensureSettingsRow(tenantId: string): Promise<{ error?: string }> {
  const admin = createTenantAdminClient(tenantId);
  const { data: existing, error: selectErr } = await admin
    .from("settings")
    .select("id")
    .limit(1);

  if (selectErr) return { error: selectErr.message };
  if ((existing ?? []).length > 0) return {};

  const { error: insertErr } = await admin
    .from("settings")
    .insert({});

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

    const admin = createTenantAdminClient(ctx.tenantId);
    const { error } = await admin
      .from("settings")
      .update({
        store_name: data.storeName.trim(),
        store_address: data.storeAddress.trim(),
        store_phone: data.storePhone.trim(),
        store_email: data.storeEmail.trim(),
        store_logo_url: data.storeLogoUrl.trim(),
      });
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
  featureCatalogEnabled: boolean;
  priceTierLabels: { HET: string; HG1: string; HG2: string; HG3: string };
}): Promise<SettingsActionState> {
  try {
    const ctx = await ownerGuard();
    const ensured = await ensureSettingsRow(ctx.tenantId);
    if (ensured.error) return { error: ensured.error };

    const admin = createTenantAdminClient(ctx.tenantId);
    const { error } = await admin
      .from("settings")
      .update({
        default_markup_pct: data.defaultMarkupPct,
        petty_cash_limit: data.pettyCashLimit,
        qty_decimal: data.qtyDecimal,
        feature_catalog_enabled: data.featureCatalogEnabled,
        price_tier_labels: data.priceTierLabels,
      });
    if (error) return { error: error.message };
    revalidatePath("/owner/settings");
    revalidatePath("/owner", "layout");
    revalidatePath("/owner/katalog");
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
    // Tabel `tenants` di-keyed by `id` (bukan tenant_id), jadi pakai admin
    // mentah dengan filter eksplisit `.eq("id", ctx.tenantId)`.
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
  notaActiveFormat: "A4" | "A5" | "thermal";  waMessageTemplate?: string;}): Promise<SettingsActionState> {
  const allowed = ["A4", "A5", "thermal"];
  if (!allowed.includes(data.notaActiveFormat))
    return { error: "Format nota tidak valid" };
  try {
    const ctx = await ownerGuard();
    const ensured = await ensureSettingsRow(ctx.tenantId);
    if (ensured.error) return { error: ensured.error };

    const admin = createTenantAdminClient(ctx.tenantId);
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
        ...(data.waMessageTemplate !== undefined
          ? { wa_message_template: data.waMessageTemplate.trim() || null }
          : {}),
      });
    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("wa_message_template")) {
        // Kolom wa_message_template belum ada (migration 038 belum jalan).
        // Coba ulang tanpa kolom tersebut agar setting lain tetap tersimpan.
        const retry = await admin
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
          });
        if (retry.error) return { error: retry.error.message };
        revalidatePath("/owner/settings");
        return { success: "Pengaturan nota tersimpan. Jalankan migration 038_settings_wa_template.sql untuk mengaktifkan kustom pesan WhatsApp." };
      }
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
          });

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

    const admin = createTenantAdminClient(ctx.tenantId);
    const payload = {
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
      .update(payload);
    if (error) return { error: error.message };

    const { data: verify } = await admin
      .from("settings")
      .select("reward_employee_enabled")
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
    const admin = createTenantAdminClient(tenantId);

    const [{ data: mechanics }, { data: transactions }, { data: existingRows }, { data: invoices }, { data: settings }, { data: assignments }] = await Promise.all([
      admin
        .from("profiles")
        .select("id")
        .eq("role", "mechanic"),
      admin
        .from("employee_point_transactions")
        .select("profile_id, transaction_type, points, reference_id"),
      admin
        .from("employee_points")
        .select("id, profile_id"),
      admin
        .from("invoices")
        .select("id, status, grand_total"),
      admin
        .from("settings")
        .select("reward_employee_enabled, reward_spend_per_point, reward_lead_multiplier, reward_helper_multiplier")
        .single(),
      admin
        .from("invoice_mechanics")
        .select("invoice_id, mechanic_id, mechanic_role"),
    ]);

    const invoiceStatusById = new Map<string, string>();
    const invoiceAmountById = new Map<string, number>();
    for (const invoice of invoices ?? []) {
      invoiceStatusById.set(invoice.id, invoice.status);
      invoiceAmountById.set(invoice.id, Number(invoice.grand_total ?? 0));
    }

    const invoiceNetByProfile = new Map<string, number>();
    const orphanNetByProfile = new Map<string, number>(); // reference_id terisi tapi invoice tidak ada lagi
    for (const tx of transactions ?? []) {
      if (!["earn", "adjust"].includes(tx.transaction_type)) continue;
      const referenceId = tx.reference_id ?? "";
      if (!referenceId) continue; // skip transaksi manual tanpa reference
      const key = `${referenceId}:${tx.profile_id}`;
      const points = Number(tx.points ?? 0);
      if (invoiceStatusById.has(referenceId)) {
        invoiceNetByProfile.set(key, (invoiceNetByProfile.get(key) ?? 0) + points);
      } else {
        orphanNetByProfile.set(key, (orphanNetByProfile.get(key) ?? 0) + points);
      }
    }

    const expectedByKey = new Map<string, number>();
    const canAward =
      Boolean(settings?.reward_employee_enabled) &&
      Number(settings?.reward_spend_per_point ?? 0) > 0;

    if (canAward) {
      const assignmentsByInvoice = new Map<string, { mechanic_id: string; mechanic_role: string | null }[]>();
      for (const row of assignments ?? []) {
        const list = assignmentsByInvoice.get(row.invoice_id) ?? [];
        list.push({ mechanic_id: row.mechanic_id, mechanic_role: row.mechanic_role ?? null });
        assignmentsByInvoice.set(row.invoice_id, list);
      }

      const spendPerPoint = Number(settings?.reward_spend_per_point ?? 0);
      for (const [invoiceId, status] of invoiceStatusById.entries()) {
        if (status !== "paid") continue;
        const amount = Number(invoiceAmountById.get(invoiceId) ?? 0);
        if (amount <= 0) continue;

        for (const m of assignmentsByInvoice.get(invoiceId) ?? []) {
          const multiplier = m.mechanic_role === "lead"
            ? Number(settings?.reward_lead_multiplier ?? 1)
            : Number(settings?.reward_helper_multiplier ?? 0.5);
          // Floor sekali pada (amount * multiplier) / spendPerPoint agar fraksi point
          // helper (multiplier < 1) tidak hilang karena pembulatan ganda.
          const expected = Math.floor((amount * multiplier) / spendPerPoint);
          if (expected <= 0) continue;
          const key = `${invoiceId}:${m.mechanic_id}`;
          expectedByKey.set(key, expected);
        }
      }
    }

    const reconciliationKeys = new Set<string>([
      ...invoiceNetByProfile.keys(),
      ...expectedByKey.keys(),
    ]);

    for (const key of reconciliationKeys) {
      const [invoiceId, profileId] = key.split(":");
      const status = invoiceStatusById.get(invoiceId);
      if (!status) continue;

      const currentNet = Number(invoiceNetByProfile.get(key) ?? 0);
      const expected = status === "paid" ? Number(expectedByKey.get(key) ?? 0) : 0;
      const delta = expected - currentNet;
      if (delta === 0) continue;

      const txType = status === "paid" && delta > 0 ? "earn" : "adjust";
      const notes =
        txType === "earn"
          ? "Sinkronisasi point: menyesuaikan reward invoice lunas berdasarkan assignment engineer saat ini."
          : "Sinkronisasi point: menormalkan histori agar konsisten dengan status invoice dan assignment engineer saat ini.";

      const { error: adjustErr } = await admin.from("employee_point_transactions").insert({
        profile_id: profileId,
        transaction_type: txType,
        points: delta,
        reference_id: invoiceId,
        notes,
        expires_at: null,
      });
      if (adjustErr) {
        return { error: `Gagal menormalkan histori point invoice: ${adjustErr.message}` };
      }
    }

    // Bersihkan saldo dari transaksi yang reference_id-nya sudah tidak terhubung ke invoice manapun
    // (mis. invoice telah dihapus). Jika tidak dibalik, saldo karyawan akan tetap mencantumkan point
    // dari invoice yang tidak relevan.
    for (const [key, currentNet] of orphanNetByProfile.entries()) {
      if (currentNet === 0) continue;
      const [referenceId, profileId] = key.split(":");
      const { error: orphanErr } = await admin.from("employee_point_transactions").insert({
        profile_id: profileId,
        transaction_type: "adjust",
        points: -currentNet,
        reference_id: referenceId,
        notes: "Sinkronisasi point: membatalkan reward dari invoice yang tidak ditemukan lagi.",
        expires_at: null,
      });
      if (orphanErr) {
        return { error: `Gagal menormalkan histori point orphan: ${orphanErr.message}` };
      }
    }

    const refreshedTransactions = await admin
      .from("employee_point_transactions")
      .select("profile_id, transaction_type, points");
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
      const existing = (existingRows ?? []).find((row: { id: string; profile_id: string }) => row.profile_id === mechanic.id);
      const payload = {
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
    const admin = createTenantAdminClient(tenantId);

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
        .delete();
      if (error) return { error: `Gagal hapus ${table}: ${error.message}` };
    }

    revalidatePath("/owner");
    return { success: "Semua data bisnis berhasil dihapus. Akun dan pengaturan tetap ada." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ── Public share context (no auth) ──────────────────────────
// Dipakai oleh modal share WA agar template + nama bisnis
// di-resolve dari settings tenant pemilik invoice.
export type InvoiceShareContext = {
  businessName: string;
  template: string;
  items: Array<{ description: string; quantity: number; final_price: number; unit_label: string | null }>;
  /** Default format cetak yang dipilih owner di Pengaturan → Nota & Printer. */
  defaultPrintFormat: "struk" | "nota" | "invoice" | null;
  totals: {
    subtotal: number;
    discount: number;
    ppnPct: number;
    ppnAmount: number;
    pphPct: number;
    pphAmount: number;
    shipping: number;
    dp: number;
    grandTotal: number;
  };
};

export async function getInvoiceShareContext(
  invoiceId: string,
): Promise<{ data?: InvoiceShareContext; error?: string }> {
  if (!invoiceId) return { error: "invoiceId kosong" };
  try {
    const admin = createAdminClient();
    const { data: inv, error: invErr } = await admin
      .from("invoices")
      .select("tenant_id, subtotal, discount_amount, ppn_pct, ppn_amount, pph_pct, pph_amount, shipping_cost, dp_amount, grand_total")
      .eq("id", invoiceId)
      .single();
    if (invErr || !inv) return { error: invErr?.message ?? "Invoice tidak ditemukan" };

    const [{ data: settings }, { data: tenant }, { data: itemsRaw }] = await Promise.all([
      admin
        .from("settings")
        .select("store_name, wa_message_template, nota_active_format")
        .eq("tenant_id", inv.tenant_id)
        .single(),
      admin.from("tenants").select("name").eq("id", inv.tenant_id).single(),
      admin
        .from("invoice_items")
        .select("description, quantity, final_price, unit_label")
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: true }),
    ]);

    const businessName =
      (settings as { store_name?: string | null } | null)?.store_name?.trim() ||
      (tenant as { name?: string | null } | null)?.name ||
      "Bengkel";
    const template =
      (settings as { wa_message_template?: string | null } | null)?.wa_message_template?.trim() ||
      "";
    const formatRaw = (settings as { nota_active_format?: string | null } | null)?.nota_active_format ?? null;
    const defaultPrintFormat: "struk" | "nota" | "invoice" | null =
      formatRaw === "thermal" ? "struk" :
      formatRaw === "A5" ? "nota" :
      formatRaw === "A4" ? "invoice" :
      null;
    const totals = {
      subtotal: Number(inv.subtotal ?? 0),
      discount: Number(inv.discount_amount ?? 0),
      ppnPct: Number(inv.ppn_pct ?? 0),
      ppnAmount: Number(inv.ppn_amount ?? 0),
      pphPct: Number(inv.pph_pct ?? 0),
      pphAmount: Number(inv.pph_amount ?? 0),
      shipping: Number(inv.shipping_cost ?? 0),
      dp: Number(inv.dp_amount ?? 0),
      grandTotal: Number(inv.grand_total ?? 0),
    };
    const items = ((itemsRaw ?? []) as Array<{ description: string; quantity: number | string; final_price: number | string | null; unit_label: string | null }>).map(
      (it) => ({
        description: it.description,
        quantity: Number(it.quantity ?? 1),
        final_price: Number(it.final_price ?? 0),
        unit_label: it.unit_label ?? null,
      }),
    );

    return { data: { businessName, template, items, defaultPrintFormat, totals } };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

