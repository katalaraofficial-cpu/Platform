import { createAdminClient } from "@/lib/supabase/admin";
import { getUserContext } from "@/lib/get-user-context";
import { redirect } from "next/navigation";
import type { Settings } from "@/types/database";
import { SettingsTabs } from "./settings-tabs";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab =
    tab === "platform"
      ? "platform"
      : tab === "nota"
        ? "nota"
        : tab === "reward"
          ? "reward"
          : tab === "reset"
            ? "reset"
            : "toko";

  const ctx = await getUserContext();
  if (!ctx.tenantId || ctx.role !== "owner") redirect("/owner/dashboard");

  const admin = createAdminClient();
  const { data: settingsRows } = await admin
    .from("settings")
    .select(
      "id, tenant_id, default_markup_pct, petty_cash_limit, qty_decimal, price_tier_labels, store_name, store_address, store_phone, store_email, store_logo_url, nota_title, nota_title_size, nota_subtitle, nota_customer_layout, nota_signature_layout, nota_jabatan, nota_show_watermark, nota_header, nota_footer, nota_signature_url, nota_stamp_url, nota_active_format, reward_employee_enabled, reward_spend_per_point, reward_point_value, reward_min_redeem, reward_point_validity_days, reward_lead_multiplier, reward_helper_multiplier, created_at, updated_at"
    )
    .eq("tenant_id", ctx.tenantId)
    .order("updated_at", { ascending: false })
    .limit(1);

  let settings = ((settingsRows ?? [])[0] ?? null) as Settings | null;

  if (!settings) {
    await admin.from("settings").insert({ tenant_id: ctx.tenantId });
    const { data: refetchedRows } = await admin
      .from("settings")
      .select(
        "id, tenant_id, default_markup_pct, petty_cash_limit, qty_decimal, price_tier_labels, store_name, store_address, store_phone, store_email, store_logo_url, nota_title, nota_title_size, nota_subtitle, nota_customer_layout, nota_signature_layout, nota_jabatan, nota_show_watermark, nota_header, nota_footer, nota_signature_url, nota_stamp_url, nota_active_format, reward_employee_enabled, reward_spend_per_point, reward_point_value, reward_min_redeem, reward_point_validity_days, reward_lead_multiplier, reward_helper_multiplier, created_at, updated_at"
      )
      .eq("tenant_id", ctx.tenantId)
      .order("updated_at", { ascending: false })
      .limit(1);
    settings = ((refetchedRows ?? [])[0] ?? null) as Settings | null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pengaturan</h1>
        <p className="text-sm text-gray-500">Kelola konfigurasi platform dan toko</p>
      </div>
      <SettingsTabs activeTab={activeTab} settings={settings} tenantId={ctx.tenantId} />
    </div>
  );
}
