import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import { notFound } from "next/navigation";
import { InvoiceEditor } from "@/components/invoices/invoice-editor";
import type { InvoiceStatus, MechanicRoleInInvoice } from "@/types/database";

const BASE_PATH = "/admin";

export default async function AdminInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUserContext();
  const supabase = await createClient();

  if (!user.tenantId) notFound();

  const { data: invoiceData } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", user.tenantId ?? "")
    .single();

  if (!invoiceData) notFound();
  const invoice = invoiceData!;

  const [
    { data: customer },
    { data: items },
    { data: assignedMechanics },
    { data: allMechanics },
  ] = await Promise.all([
    invoice.customer_id
      ? supabase
          .from("customers")
          .select("id, name, phone")
          .eq("id", invoice.customer_id)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from("invoice_items")
      .select("id, description, quantity, unit_price, markup_pct, final_price, item_type, payment_source")
      .eq("invoice_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("invoice_mechanics")
      .select("id, mechanic_id, mechanic_role, is_complaint")
      .eq("invoice_id", id)
      .order("assigned_at", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("tenant_id", user.tenantId ?? "")
      .eq("role", "mechanic")
      .eq("is_active", true)
      .order("full_name"),
  ]);

  const mechanicNameMap = Object.fromEntries(
    (allMechanics ?? []).map((m) => [m.id, m.full_name ?? "?"])
  );

  return (
    <InvoiceEditor
      mode="edit"
      basePath={BASE_PATH}
      dpEnabled={user.featureToggles?.module_invoice_dp === true}
      ppnModuleEnabled={user.featureToggles?.module_invoice_ppn !== false}
      pphModuleEnabled={user.featureToggles?.module_invoice_pph !== false}
      mechanics={(allMechanics ?? []).map((m) => ({
        id: m.id,
        name: m.full_name ?? "?",
      }))}
      invoice={{
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        status: invoice.status as InvoiceStatus,
        invoiceDate: (invoice as Record<string, unknown>)["invoice_date"] as string ?? null,
        notes: invoice.notes ?? null,
        ppnPct: Number(invoice.ppn_pct ?? 0),
        pphPct: Number(invoice.pph_pct ?? 0),
        discountAmount: Number(invoice.discount_amount ?? 0),
        dpAmount: Number((invoice as Record<string, unknown>)["dp_amount"] ?? 0),
        grandTotal: Number(invoice.grand_total),
        createdAt: invoice.created_at,
        paidAt: invoice.paid_at ?? null,
        paymentMethod: (invoice as Record<string, unknown>)["payment_method"] as string ?? null,
        tenantId: invoice.tenant_id,
        jobTitle: (invoice as Record<string, unknown>)["job_title"] as string ?? null,
      }}
      customer={
        customer
          ? { id: customer.id, name: customer.name, phone: customer.phone ?? null }
          : null
      }
      initialItems={(items ?? []).map((i) => ({
        id: i.id,
        description: i.description,
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
        markup_pct: Number(i.markup_pct ?? 0),
        final_price: Number(i.final_price),
        item_type: i.item_type,
        payment_source: i.payment_source ?? null,
      }))}
      assignedMechanics={(assignedMechanics ?? []).map((am) => ({
        assignmentId: am.id,
        mechanicId: am.mechanic_id,
        name: mechanicNameMap[am.mechanic_id] ?? am.mechanic_id,
        role: am.mechanic_role as MechanicRoleInInvoice,
        hasComplaint: Boolean((am as Record<string, unknown>)["is_complaint"]),
      }))}
    />
  );
}
