import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/get-user-context";
import { createClient } from "@/lib/supabase/server";
import { getItemCatalog } from "@/lib/actions/catalog";
import { KatalogClient } from "./katalog-client";

export default async function KatalogPage() {
  const ctx = await getUserContext();
  if (!ctx.tenantId || ctx.role !== "owner") redirect("/owner/dashboard");

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("settings")
    .select("feature_catalog_enabled")
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();

  if (!settings?.feature_catalog_enabled) {
    redirect("/owner/dashboard");
  }

  const res = await getItemCatalog();
  const items = res.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Katalog Item</h1>
        <p className="text-sm text-gray-500">
          Daftar nama item dan jasa yang pernah diinput. Gunakan halaman ini untuk
          memperbaiki klasifikasi (Jasa vs Barang) jika ada data yang salah masuk.
        </p>
      </div>
      <KatalogClient items={items} error={res.error} />
    </div>
  );
}
