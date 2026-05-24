import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import Link from "next/link";
import { StatusBadge } from "@/components/invoices/status-badge";
import { InvoiceFilters } from "@/components/invoices/invoice-filters";
import { InvoiceRowActions } from "@/components/invoices/invoice-row-actions";
import type { InvoiceStatus } from "@/types/database";
import { Suspense } from "react";

const BASE_PATH = "/owner";

function formatRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "-";
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
    .select(
      "id, invoice_number, status, grand_total, created_at, completed_at, paid_at, notes, customer_id"
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status as InvoiceStatus);

  const { data: invoices } = await query;

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

  const invoiceIds = invoices.map((i) => i.id);
  const customerIds = [
    ...new Set(invoices.map((i) => i.customer_id).filter((x): x is string => x != null)),
  ];

  // Parallel: customers + mechanics assignments
  const [{ data: customers }, { data: invMechanics }] = await Promise.all([
    customerIds.length > 0
      ? supabase.from("customers").select("id, name, vehicle_info").in("id", customerIds)
      : Promise.resolve({ data: [] as { id: string; name: string; vehicle_info: unknown }[] }),
    supabase
      .from("invoice_mechanics")
      .select("invoice_id, mechanic_id")
      .in("invoice_id", invoiceIds),
  ]);

  // Fetch mechanic profiles
  const mechanicIds = [
    ...new Set((invMechanics ?? []).map((m) => m.mechanic_id)),
  ];
  const { data: mechanicProfiles } =
    mechanicIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", mechanicIds)
      : { data: [] as { id: string; full_name: string | null }[] };

  // Build maps
  const customerMap = Object.fromEntries((customers ?? []).map((c) => [c.id, c]));
  const mechanicNameMap = Object.fromEntries(
    (mechanicProfiles ?? []).map((p) => [p.id, p.full_name ?? "?"])
  );
  const invoiceMechanicsMap: Record<string, string[]> = {};
  for (const im of invMechanics ?? []) {
    if (!invoiceMechanicsMap[im.invoice_id]) invoiceMechanicsMap[im.invoice_id] = [];
    invoiceMechanicsMap[im.invoice_id].push(mechanicNameMap[im.mechanic_id] ?? "?");
  }

  const TH = "px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 whitespace-nowrap";
  const TD = "px-3 py-3 text-sm";

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className={TH}>No. Nota</th>
            <th className={TH}>Tanggal</th>
            <th className={TH}>Pelanggan</th>
            <th className={TH}>Kendaraan</th>
            <th className={TH}>Status</th>
            <th className={`${TH} text-right`}>Total</th>
            <th className={`${TH} text-right`}>Bayar</th>
            <th className={`${TH} text-right`}>Kurang</th>
            <th className={TH}>Mekanik</th>
            <th className={TH}>Tgl Selesai</th>
            <th className={TH}>Catatan</th>
            <th className="px-3 py-3 w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {invoices.map((inv) => {
            const customer = inv.customer_id ? customerMap[inv.customer_id] : null;
            const vehicleInfo = customer?.vehicle_info as
              | { plate?: string; brand?: string; model?: string }
              | null;
            const plate = vehicleInfo?.plate ?? "-";
            const vehicle = [vehicleInfo?.brand, vehicleInfo?.model]
              .filter(Boolean)
              .join(" ");
            const mechanics = invoiceMechanicsMap[inv.id] ?? [];
            const total = Number(inv.grand_total);
            const isPaid = inv.status === "paid";
            const bayar = isPaid ? total : 0;
            const kurang = isPaid ? 0 : total;

            return (
              <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                {/* No. Nota */}
                <td className={`${TD} font-mono font-medium text-gray-900 whitespace-nowrap`}>
                  <Link
                    href={`${BASE_PATH}/invoices/${inv.id}`}
                    className="hover:text-blue-600 hover:underline"
                  >
                    {inv.invoice_number}
                  </Link>
                </td>

                {/* Tanggal */}
                <td className={`${TD} whitespace-nowrap text-gray-500`}>
                  {formatDate(inv.created_at)}
                </td>

                {/* Pelanggan */}
                <td className={`${TD} text-gray-900 max-w-[140px] truncate`}>
                  {customer?.name ?? "-"}
                </td>

                {/* Kendaraan */}
                <td className={`${TD} text-gray-500 whitespace-nowrap`}>
                  <span className="font-medium text-gray-700">{plate}</span>
                  {vehicle && (
                    <span className="ml-1 text-xs text-gray-400">({vehicle})</span>
                  )}
                </td>

                {/* Status */}
                <td className={TD}>
                  <StatusBadge status={inv.status as InvoiceStatus} />
                </td>

                {/* Total */}
                <td className={`${TD} text-right font-medium text-gray-900 whitespace-nowrap`}>
                  {formatRupiah(total)}
                </td>

                {/* Bayar */}
                <td className={`${TD} text-right whitespace-nowrap ${isPaid ? "text-green-600 font-medium" : "text-gray-400"}`}>
                  {formatRupiah(bayar)}
                </td>

                {/* Kurang */}
                <td className={`${TD} text-right whitespace-nowrap ${kurang > 0 ? "text-red-500 font-medium" : "text-gray-400"}`}>
                  {formatRupiah(kurang)}
                </td>

                {/* Mekanik */}
                <td className={`${TD} text-gray-600 max-w-[120px]`}>
                  {mechanics.length > 0 ? (
                    <span className="truncate block" title={mechanics.join(", ")}>
                      {mechanics.slice(0, 2).join(", ")}
                      {mechanics.length > 2 && (
                        <span className="text-gray-400"> +{mechanics.length - 2}</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>

                {/* Tgl Selesai */}
                <td className={`${TD} whitespace-nowrap text-gray-500`}>
                  {formatDate(inv.completed_at)}
                </td>

                {/* Catatan */}
                <td className={`${TD} text-gray-500 max-w-[140px]`}>
                  {inv.notes ? (
                    <span className="truncate block" title={inv.notes}>
                      {inv.notes}
                    </span>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>

                {/* Aksi */}
                <td className="px-3 py-3">
                  <InvoiceRowActions
                    invoiceId={inv.id}
                    invoiceNumber={inv.invoice_number}
                    status={inv.status}
                    basePath={BASE_PATH}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function OwnerInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const user = await getUserContext();
  if (!user.tenantId) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Card */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
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

