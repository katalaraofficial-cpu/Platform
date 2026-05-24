import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import { notFound } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/invoices/status-badge";
import { AddItemForm } from "@/components/invoices/add-item-form";
import {
  updateInvoiceStatus,
} from "@/lib/actions/invoice";
import { PrintOptionsModal } from "@/components/invoices/print-options-modal";
import { TaxSettings } from "@/components/invoices/tax-settings";
import { InvoiceItemsTable } from "@/components/invoices/invoice-items-table";
import { DiscountSettings } from "@/components/invoices/discount-settings";
import { UpdateInvoiceForm } from "@/components/invoices/update-invoice-form";
import type { InvoiceStatus } from "@/types/database";

const BASE_PATH = "/admin";

function formatRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const NEXT_STATUS: Record<
  InvoiceStatus,
  { label: string; next: "in_progress" | "completed" | "paid" | "cancelled"; color: string }[]
> = {
  draft: [
    { label: "Mulai Kerjakan", next: "in_progress", color: "bg-blue-600 hover:bg-blue-500 text-white" },
    { label: "Batalkan Invoice", next: "cancelled", color: "border border-red-300 text-red-600 hover:bg-red-50" },
  ],
  in_progress: [
    { label: "Tandai Selesai", next: "completed", color: "bg-yellow-500 hover:bg-yellow-400 text-white" },
    { label: "Batalkan Invoice", next: "cancelled", color: "border border-red-300 text-red-600 hover:bg-red-50" },
  ],
  completed: [
    { label: "Tandai Lunas", next: "paid", color: "bg-green-600 hover:bg-green-500 text-white" },
    { label: "Batalkan Invoice", next: "cancelled", color: "border border-red-300 text-red-600 hover:bg-red-50" },
  ],
  paid: [],
  cancelled: [],
};

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

  const [{ data: customer }, { data: items }] = await Promise.all([
    invoice.customer_id
      ? supabase
          .from("customers")
          .select("name, phone, vehicle_info")
          .eq("id", invoice.customer_id)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const status = invoice.status as InvoiceStatus;
  const canEdit = status === "draft" || status === "in_progress";
  const actions = NEXT_STATUS[status] ?? [];

  return (
    <div className="space-y-6">
      {/* Breadcrumb + back */}
      <div className="flex items-center gap-3">
        <Link
          href={`${BASE_PATH}/invoices`}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          &#8592; Kembali ke Invoice
        </Link>
        <span className="text-gray-300">/</span>
        <span className="font-mono text-sm text-gray-900">{invoice.invoice_number}</span>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-2xl font-bold text-gray-900">
                {invoice.invoice_number}
              </h1>
              <StatusBadge status={status} />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Dibuat: {formatDateTime(invoice.created_at)}
            </p>
          </div>
          <PrintOptionsModal
            invoiceId={invoice.id}
            invoiceNumber={invoice.invoice_number}
            customerPhone={customer?.phone}
            grandTotal={Number(invoice.grand_total)}
          />
        </div>

        {/* Customer info only (no Kendaraan) */}
        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Pelanggan
              </p>
              <p className="mt-1 font-medium text-gray-900">
                {customer?.name ?? "-"}
              </p>
              {customer?.phone && (
                <p className="text-sm text-gray-500">{customer.phone}</p>
              )}
            </div>
            {invoice.notes && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  Catatan
                </p>
                <p className="mt-1 text-sm text-gray-700">{invoice.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Item Pekerjaan</h2>
        </div>

        <InvoiceItemsTable
          items={items ?? []}
          invoiceId={invoice.id}
          canEdit={canEdit}
          basePath={BASE_PATH}
        />

        <div className="border-t border-gray-200 px-6 py-4">
          <div className="ml-auto max-w-xs space-y-2">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal (sebelum pajak)</span>
              <span>{formatRupiah(Number(invoice.subtotal) + Number(invoice.total_markup))}</span>
            </div>
            <TaxSettings
              invoiceId={invoice.id}
              basePath={BASE_PATH}
              preTax={Number(invoice.subtotal) + Number(invoice.total_markup)}
              ppnPct={Number(invoice.ppn_pct ?? 0)}
              pphPct={Number(invoice.pph_pct ?? 0)}
              canEdit={canEdit}
            />
            <DiscountSettings
              invoiceId={invoice.id}
              basePath={BASE_PATH}
              preTax={Number(invoice.subtotal) + Number(invoice.total_markup)}
              discountAmount={Number(invoice.discount_amount ?? 0)}
              canEdit={canEdit}
            />
            <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
              <span>Grand Total</span>
              <span>{formatRupiah(Number(invoice.grand_total))}</span>
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="border-t border-dashed border-gray-200 bg-gray-50 px-6 py-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">
              Tambah Item
            </h3>
            <AddItemForm
              invoiceId={invoice.id}
              tenantId={invoice.tenant_id}
              basePath={BASE_PATH}
              role="admin"
            />
          </div>
        )}
      </div>

      {/* Update Invoice (notes) card */}
      {canEdit && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Perbarui Catatan Invoice</h2>
          </div>
          <div className="px-6 py-4">
            <UpdateInvoiceForm
              invoiceId={invoice.id}
              basePath={BASE_PATH}
              currentNotes={invoice.notes ?? null}
            />
          </div>
        </div>
      )}

      {actions.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-900">Ubah Status</h2>
          <div className="flex flex-wrap gap-3">
            {actions.map(({ label, next, color }) => (
              <form
                key={next}
                action={updateInvoiceStatus.bind(
                  null,
                  invoice.id,
                  next,
                  BASE_PATH
                )}
              >
                <button
                  type="submit"
                  className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${color}`}
                >
                  {label}
                </button>
              </form>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
