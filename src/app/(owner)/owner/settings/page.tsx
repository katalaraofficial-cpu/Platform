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
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .order("updated_at", { ascending: false })
    .limit(1);

  let settings = ((settingsRows ?? [])[0] ?? null) as Settings | null;

  if (!settings) {
    await admin.from("settings").insert({ tenant_id: ctx.tenantId });
    const { data: refetchedRows } = await admin
      .from("settings")
      .select("*")
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
