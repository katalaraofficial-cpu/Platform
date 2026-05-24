import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import Link from "next/link";
import { StatusBadge } from "@/components/invoices/status-badge";
import { InvoiceFilters } from "@/components/invoices/invoice-filters";
import type { InvoiceStatus } from "@/types/database";
import { Suspense } from "react";

const BASE_PATH = "/admin";

function formatRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function InvoiceTable({
  tenantId,
  status,
}: {
  tenantId: string;
  status?: string;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("invoices")
    .select("id, invoice_number, status, grand_total, created_at, customer_id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status as InvoiceStatus);

  const { data: invoices } = await query;

  // Batch-fetch customers to avoid N+1
  const customerIds = [
    ...new Set(
      (invoices ?? []).map((i) => i.customer_id).filter((x): x is string => x != null)
    ),
  ];
  const { data: customers } = customerIds.length > 0
    ? await supabase.from("customers").select("id, name, vehicle_info").in("id", customerIds)
    : { data: [] };
  const customerMap = Object.fromEntries((customers ?? []).map((c) => [c.id, c]));

  if (!invoices || invoices.length === 0) {
    return (
      <div className="py-16 text-center text-gray-400">
        <p className="text-lg font-medium">Belum ada invoice</p>
        <p className="mt-1 text-sm">
          Klik &ldquo;Buat Invoice&rdquo; untuk membuat invoice baru
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              No. Invoice
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Pelanggan
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Total
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Tanggal
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {invoices.map((inv) => {
            const customer = inv.customer_id ? customerMap[inv.customer_id] : null;

            return (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-mono font-medium text-gray-900">
                  {inv.invoice_number}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {customer?.name ?? "-"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={inv.status as InvoiceStatus} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-900">
                  {formatRupiah(Number(inv.grand_total))}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                  {formatDate(inv.created_at)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                  <Link
                    href={`${BASE_PATH}/invoices/${inv.id}`}
                    className="font-medium text-blue-600 hover:text-blue-500"
                  >
                    Lihat
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const user = await getUserContext();
  if (!user.tenantId) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoice</h1>
          <p className="mt-1 text-sm text-gray-500">
            Kelola semua transaksi jasa & barang
          </p>
        </div>
        <Link
          href={`${BASE_PATH}/invoices/new`}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          + Buat Invoice
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-3">
          <Suspense fallback={null}>
            <InvoiceFilters basePath={BASE_PATH} />
          </Suspense>
        </div>

        <Suspense
          fallback={
            <div className="py-12 text-center text-sm text-gray-400">
              Memuat invoice...
            </div>
          }
        >
          <InvoiceTable tenantId={user.tenantId} status={status} />
        </Suspense>
      </div>
    </div>
  );
}
