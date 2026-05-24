import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import { notFound } from "next/navigation";
import { NewInvoicePos } from "@/components/invoices/new-invoice-pos";

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
    <NewInvoicePos
      basePath={BASE_PATH}
      mechanics={(mechanics ?? []).map((m) => ({
        id: m.id,
        name: m.full_name ?? "?",
      }))}
    />
  );
}
