import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import { notFound } from "next/navigation";
import { InvoiceEditor } from "@/components/invoices/invoice-editor";

const BASE_PATH = "/admin";

export default async function NewAdminInvoicePage() {
  const ctx = await getUserContext();
  if (!ctx.tenantId) notFound();

  const supabase = await createClient();
  const { data: mechanics } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("tenant_id", ctx.tenantId)
    .eq("role", "mechanic")
    .eq("is_active", true)
    .order("full_name");

  return (
    <InvoiceEditor
      mode="create"
      basePath={BASE_PATH}
      dpEnabled={ctx.featureToggles?.module_invoice_dp === true}
      ppnModuleEnabled={ctx.featureToggles?.module_invoice_ppn !== false}
      pphModuleEnabled={ctx.featureToggles?.module_invoice_pph !== false}
      mechanics={(mechanics ?? []).map((m) => ({
        id: m.id,
        name: m.full_name ?? "?",
      }))}
    />
  );
}

