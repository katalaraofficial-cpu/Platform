import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import { notFound } from "next/navigation";
import { InvoiceEditor } from "@/components/invoices/invoice-editor";

const BASE_PATH = "/owner";

export default async function NewOwnerInvoicePage() {
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
      isOwner={true}
      mechanics={(mechanics ?? []).map((m) => ({
        id: m.id,
        name: m.full_name ?? "?",
      }))}
    />
  );
}

