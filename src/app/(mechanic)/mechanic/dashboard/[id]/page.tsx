import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Wrench, Package } from "lucide-react";
import type { Invoice, Customer, InvoiceItem, InvoiceStatus } from "@/types/database";
import { WorkOrderStatusButton } from "@/components/mechanic/work-order-status-button";
import { AddMechanicItemButton } from "@/components/mechanic/add-item-modal";

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Menunggu Dikerjakan",
  in_progress: "Sedang Dikerjakan",
  completed: "Selesai",
  paid: "Lunas",
  cancelled: "Dibatalkan",
};

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  paid: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-600",
};

const ITEM_TYPE_LABELS: Record<string, string> = {
  service: "Jasa",
  part_internal: "Part Internal",
  part_external: "Part External",
};

export default async function WorkOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const ctx = await getUserContext();

  // Verify the mechanic is assigned to this invoice
  const { data: assignment } = await supabase
    .from("invoice_mechanics")
    .select("id, mechanic_role")
    .eq("invoice_id", id)
    .eq("mechanic_id", ctx.id)
    .single();

  if (!assignment) notFound();

  // Fetch invoice + items in parallel
  const [{ data: invoiceRaw }, { data: itemsRaw }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).single(),
    supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", id)
      .order("created_at"),
  ]);

  if (!invoiceRaw) notFound();

  const invoice = invoiceRaw as Invoice;
  const items = (itemsRaw ?? []) as InvoiceItem[];

  // Fetch customer
  let customer: Customer | null = null;
  if (invoice.customer_id) {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("id", invoice.customer_id)
      .single();
    customer = data as Customer | null;
  }

  const v = customer?.vehicle_info;
  const vehicleStr = [v?.brand, v?.model, v?.year && String(v.year), v?.plate]
    .filter(Boolean)
    .join(" · ");
  const status = invoice.status as InvoiceStatus;

  // Mechanic can only transition: draft → in_progress → completed
  const nextAction: { label: string; next: "in_progress" | "completed" } | null =
    status === "draft"
      ? { label: "▶  Mulai Kerjakan", next: "in_progress" }
      : status === "in_progress"
      ? { label: "✓  Selesai Dikerjakan", next: "completed" }
      : null;

  return (
    <div className="space-y-4 pb-32">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <Link
          href="/mechanic/dashboard"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 active:bg-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-base font-bold text-gray-900">
              {invoice.invoice_number}
            </h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[status]}`}
            >
              {STATUS_LABELS[status]}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-gray-400">
            {new Date(invoice.created_at).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {" · "}
            <span
              className={
                assignment.mechanic_role === "lead"
                  ? "font-semibold text-violet-600"
                  : "text-gray-400"
              }
            >
              {assignment.mechanic_role === "lead" ? "Lead" : "Helper"}
            </span>
          </p>
        </div>
      </div>

      {/* Customer card */}
      {customer && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            <User className="h-3.5 w-3.5" />
            Customer
          </div>
          <p className="text-base font-semibold text-gray-900">{customer.name}</p>
          {customer.phone && (
            <a
              href={`tel:${customer.phone}`}
              className="mt-0.5 block text-sm text-blue-600"
            >
              {customer.phone}
            </a>
          )}
          {vehicleStr && (
            <p className="mt-1 text-sm text-gray-500">{vehicleStr}</p>
          )}
        </div>
      )}

      {/* Items list */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-3">
          <Wrench className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Item Pekerjaan
          </span>
          <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
            {items.length}
          </span>
          {(status === "draft" || status === "in_progress") && (
            <AddMechanicItemButton invoiceId={invoice.id} />
          )}
        </div>
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            Belum ada item ditambahkan.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100">
                  {item.item_type === "service" ? (
                    <Wrench className="h-3.5 w-3.5 text-gray-500" />
                  ) : (
                    <Package className="h-3.5 w-3.5 text-gray-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-800">{item.description}</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {ITEM_TYPE_LABELS[item.item_type] ?? item.item_type}
                    {" · Qty "}
                    {item.quantity}
                    {item.payment_source === "mechanic" && (
                      <span className="ml-1 rounded bg-amber-100 px-1 text-amber-700">
                        Dibeli mekanik
                      </span>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Catatan */}
      {invoice.notes && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Catatan
          </p>
          <p className="text-sm leading-relaxed text-gray-700">{invoice.notes}</p>
        </div>
      )}

      {/* Sticky action button */}
      {nextAction && (
        <div className="fixed bottom-20 left-0 right-0 px-4">
          <div className="mx-auto max-w-lg">
            <WorkOrderStatusButton
              invoiceId={invoice.id}
              nextStatus={nextAction.next}
              label={nextAction.label}
            />
          </div>
        </div>
      )}

      {/* Completed / Paid info */}
      {(status === "completed" || status === "paid") && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-center">
          <p className="font-semibold text-green-700">
            {status === "paid" ? "✓ Invoice sudah lunas" : "✓ Pekerjaan selesai"}
          </p>
          <p className="mt-1 text-sm text-green-600">
            {status === "paid"
              ? "Terima kasih, pekerjaan telah selesai dan dibayar."
              : "Menunggu konfirmasi pembayaran dari admin."}
          </p>
        </div>
      )}
    </div>
  );
}
