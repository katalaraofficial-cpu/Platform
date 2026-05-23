import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import { notFound } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/invoices/status-badge";
import { AddItemForm } from "@/components/invoices/add-item-form";
import {
  removeInvoiceItem,
  updateInvoiceStatus,
} from "@/lib/actions/invoice";
import { PrintButton } from "@/components/invoices/print-button";
import type { InvoiceStatus, ItemType } from "@/types/database";

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

const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  service: "Jasa",
  part_internal: "Part (stok)",
  part_external: "Part (beli)",
};

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

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, customers(name, phone, vehicle_info)")
    .eq("id", id)
    .eq("tenant_id", user.tenantId)
    .single();

  if (!invoice) notFound();

  const { data: items } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", id)
    .order("created_at", { ascending: true });

  const customer = Array.isArray(invoice.customers)
    ? invoice.customers[0]
    : invoice.customers;
  const vehicleInfo = customer?.vehicle_info as {
    plate?: string;
    brand?: string;
    model?: string;
    year?: number;
  } | null;

  const status = invoice.status as InvoiceStatus;
  const canEdit = status === "draft" || status === "in_progress";
  const actions = NEXT_STATUS[status] ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href={`${BASE_PATH}/invoices`} className="hover:text-gray-700">
          Invoice
        </Link>
        <span>/</span>
        <span className="font-mono text-gray-900">{invoice.invoice_number}</span>
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
          <PrintButton />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
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
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Kendaraan
            </p>
            <p className="mt-1 font-medium text-gray-900">
              {vehicleInfo?.plate ?? "-"}
            </p>
            <p className="text-sm text-gray-500">
              {[vehicleInfo?.year, vehicleInfo?.brand, vehicleInfo?.model]
                .filter(Boolean)
                .join(" ")}
            </p>
          </div>
          {invoice.notes && (
            <div className="sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Catatan
              </p>
              <p className="mt-1 text-sm text-gray-700">{invoice.notes}</p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Item Pekerjaan</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Tipe
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Deskripsi
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Qty
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Harga Satuan
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Markup
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Total
                </th>
                {canEdit && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {!items || items.length === 0 ? (
                <tr>
                  <td
                    colSpan={canEdit ? 7 : 6}
                    className="py-8 text-center text-sm text-gray-400"
                  >
                    Belum ada item. Tambahkan item di bawah.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                      {ITEM_TYPE_LABELS[item.item_type as ItemType]}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {item.description}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">
                      {Number(item.quantity)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">
                      {formatRupiah(Number(item.unit_price))}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-500">
                      {Number(item.markup_pct) > 0
                        ? `${Number(item.markup_pct)}%`
                        : "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-900">
                      {formatRupiah(Number(item.final_price))}
                    </td>
                    {canEdit && (
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <form
                          action={removeInvoiceItem.bind(
                            null,
                            item.id,
                            invoice.id,
                            BASE_PATH
                          )}
                        >
                          <button
                            type="submit"
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Hapus
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-gray-200 px-6 py-4">
          <div className="ml-auto max-w-xs space-y-1">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span>{formatRupiah(Number(invoice.subtotal))}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Markup</span>
              <span>{formatRupiah(Number(invoice.total_markup))}</span>
            </div>
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
