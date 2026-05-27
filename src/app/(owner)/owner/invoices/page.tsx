import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import Link from "next/link";
import { StatusBadge } from "@/components/invoices/status-badge";
import { InvoiceRowActions } from "@/components/invoices/invoice-row-actions";
import { InvoiceDateFilter } from "@/components/invoices/invoice-date-filter";
import type { InvoiceStatus } from "@/types/database";
import { Suspense } from "react";

const BASE_PATH = "/owner";
const PAGE_SIZE = 20;

const KPI_STATUSES = [
  { label: "Semua",      value: "",            numClass: "text-gray-800",    activeClass: "bg-gray-900 text-white border-gray-900" },
  { label: "Draft",      value: "draft",       numClass: "text-yellow-700",  activeClass: "bg-yellow-50 border-yellow-300 text-yellow-900" },
  { label: "Dikerjakan", value: "in_progress", numClass: "text-blue-700",    activeClass: "bg-blue-50 border-blue-300 text-blue-900" },
  { label: "Selesai",    value: "completed",   numClass: "text-green-700",   activeClass: "bg-green-50 border-green-300 text-green-900" },
  { label: "Lunas",      value: "paid",        numClass: "text-emerald-700", activeClass: "bg-emerald-50 border-emerald-300 text-emerald-900" },
  { label: "Dibatalkan", value: "cancelled",   numClass: "text-red-600",     activeClass: "bg-red-50 border-red-300 text-red-900" },
];

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function OwnerInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; from?: string; to?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? "";
  const dateFrom = params.from ?? "";
  const dateTo = params.to ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1") || 1);

  const user = await getUserContext();
  if (!user.tenantId) return null;
  const tenantId = user.tenantId;

  const supabase = await createClient();
  const offset = (page - 1) * PAGE_SIZE;

  // KPI counts (respects date range)
  let kpiQuery = supabase.from("invoices").select("status").eq("tenant_id", tenantId);
  if (dateFrom) kpiQuery = kpiQuery.gte("created_at", dateFrom);
  if (dateTo) kpiQuery = kpiQuery.lte("created_at", dateTo + "T23:59:59");

  // Paginated table query (respects status + date + pagination)
  let tableQuery = supabase
    .from("invoices")
    .select(
      "id, invoice_number, status, grand_total, invoice_date, created_at, completed_at, notes, customer_id",
      { count: "exact" }
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);
  if (status) tableQuery = tableQuery.eq("status", status as InvoiceStatus);
  if (dateFrom) tableQuery = tableQuery.gte("created_at", dateFrom);
  if (dateTo) tableQuery = tableQuery.lte("created_at", dateTo + "T23:59:59");

  const [{ data: kpiData }, { data: invoices, count: totalCount }] = await Promise.all([
    kpiQuery,
    tableQuery,
  ]);

  // Compute per-status counts
  const kpiCounts: Record<string, number> = {};
  for (const row of kpiData ?? []) {
    kpiCounts[row.status] = (kpiCounts[row.status] ?? 0) + 1;
  }
  const kpiTotal = kpiData?.length ?? 0;

  // Fetch customers + mechanics for current page
  const invoiceIds = (invoices ?? []).map((i) => i.id);
  const customerIds = [
    ...new Set(
      (invoices ?? []).map((i) => i.customer_id).filter((x): x is string => x != null)
    ),
  ];

  const [{ data: customers }, { data: invMechanics }] =
    invoiceIds.length > 0
      ? await Promise.all([
          customerIds.length > 0
            ? supabase
                .from("customers")
                .select("id, name, vehicle_info")
                .in("id", customerIds)
            : Promise.resolve({
                data: [] as { id: string; name: string; vehicle_info: unknown }[],
              }),
          supabase
            .from("invoice_mechanics")
            .select("invoice_id, mechanic_id")
            .in("invoice_id", invoiceIds),
        ])
      : [
          { data: [] as { id: string; name: string; vehicle_info: unknown }[] },
          { data: [] as { invoice_id: string; mechanic_id: string }[] },
        ];

  const mechanicIds = [...new Set((invMechanics ?? []).map((m) => m.mechanic_id))];
  const { data: mechanicProfiles } =
    mechanicIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", mechanicIds)
      : { data: [] as { id: string; full_name: string | null }[] };

  const customerMap = Object.fromEntries((customers ?? []).map((c) => [c.id, c]));
  const mechanicNameMap = Object.fromEntries(
    (mechanicProfiles ?? []).map((p) => [p.id, p.full_name ?? "?"])
  );
  const invMechanicsMap: Record<string, string[]> = {};
  for (const im of invMechanics ?? []) {
    invMechanicsMap[im.invoice_id] = [
      ...(invMechanicsMap[im.invoice_id] ?? []),
      mechanicNameMap[im.mechanic_id] ?? "?",
    ];
  }

  const total = totalCount ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function buildUrl(overrides: { status?: string; page?: number }) {
    const p = new URLSearchParams();
    const s = "status" in overrides ? (overrides.status ?? "") : status;
    if (s) p.set("status", s);
    if (dateFrom) p.set("from", dateFrom);
    if (dateTo) p.set("to", dateTo);
    const pg = "page" in overrides ? (overrides.page ?? 1) : page;
    if (pg > 1) p.set("page", String(pg));
    const qs = p.toString();
    return `${BASE_PATH}/invoices${qs ? "?" + qs : ""}`;
  }

  const TH =
    "px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 whitespace-nowrap";
  const TD = "px-3 py-3 text-sm";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoice</h1>
          <p className="mt-1 text-sm text-gray-500">Kelola semua transaksi jasa &amp; barang</p>
        </div>
        <Link
          href={`${BASE_PATH}/invoices/new`}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          + Buat Invoice
        </Link>
      </div>

      {/* KPI Boxes */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {KPI_STATUSES.map((k) => {
          const count = k.value === "" ? kpiTotal : (kpiCounts[k.value] ?? 0);
          const isActive = status === k.value;
          return (
            <Link
              key={k.value}
              href={buildUrl({ status: k.value, page: 1 })}
              className={`rounded-xl border p-3 text-center transition-all ${
                isActive
                  ? k.activeClass + " shadow-sm"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <p className={`text-2xl font-bold ${isActive ? "" : k.numClass}`}>{count}</p>
              <p className={`mt-0.5 text-xs font-medium ${isActive ? "opacity-80" : "text-gray-500"}`}>
                {k.label}
              </p>
            </Link>
          );
        })}
      </div>

      {/* Table Card */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Date Filter */}
        <div className="border-b border-gray-100 px-4 py-3">
          <Suspense fallback={null}>
            <InvoiceDateFilter basePath={BASE_PATH} />
          </Suspense>
        </div>

        {/* Table */}
        {!invoices || invoices.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="text-lg font-medium">Belum ada invoice</p>
            <p className="mt-1 text-sm">
              Klik &ldquo;Buat Invoice&rdquo; untuk membuat invoice baru
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100 md:hidden">
              {invoices.map((inv) => {
                const customer = inv.customer_id ? customerMap[inv.customer_id] : null;
                const mechanics = invMechanicsMap[inv.id] ?? [];
                const invTotal = Number(inv.grand_total);
                const isPaid = inv.status === "paid";
                return (
                  <div key={inv.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`${BASE_PATH}/invoices/${inv.id}`}
                          className="font-mono text-sm font-semibold text-gray-900 hover:text-blue-600"
                        >
                          {inv.invoice_number}
                        </Link>
                        <p className="mt-1 text-xs text-gray-500">
                          {fmtDate((inv as { invoice_date?: string }).invoice_date ?? inv.created_at)}
                        </p>
                      </div>
                      <StatusBadge status={inv.status as InvoiceStatus} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-gray-400">Pelanggan</p>
                        <p className="truncate font-medium text-gray-700">{customer?.name ?? "-"}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Mekanik</p>
                        <p className="truncate font-medium text-gray-700">
                          {mechanics.length > 0 ? mechanics.join(", ") : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Total</p>
                        <p className="font-semibold text-gray-900">{fmt(invTotal)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Sisa</p>
                        <p className={`font-semibold ${isPaid ? "text-gray-400" : "text-red-500"}`}>
                          {fmt(isPaid ? 0 : invTotal)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="max-w-[75%] truncate text-xs text-gray-500">{inv.notes || "-"}</p>
                      <InvoiceRowActions
                        invoiceId={inv.id}
                        invoiceNumber={inv.invoice_number}
                        status={inv.status}
                        basePath={BASE_PATH}
                        isOwner={true}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className={TH}>No. Nota</th>
                  <th className={TH}>Tanggal</th>
                  <th className={TH}>Pelanggan</th>
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
                  const mechanics = invMechanicsMap[inv.id] ?? [];
                  const invTotal = Number(inv.grand_total);
                  const isPaid = inv.status === "paid";
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                      <td className={`${TD} font-mono font-medium text-gray-900 whitespace-nowrap`}>
                        <Link
                          href={`${BASE_PATH}/invoices/${inv.id}`}
                          className="hover:text-blue-600 hover:underline"
                        >
                          {inv.invoice_number}
                        </Link>
                      </td>
                      <td className={`${TD} whitespace-nowrap text-gray-500`}>
                        {fmtDate((inv as { invoice_date?: string }).invoice_date ?? inv.created_at)}
                      </td>
                      <td className={`${TD} text-gray-900 max-w-[140px] truncate`}>
                        {customer?.name ?? "-"}
                      </td>
                      <td className={TD}>
                        <StatusBadge status={inv.status as InvoiceStatus} />
                      </td>
                      <td className={`${TD} text-right font-medium text-gray-900 whitespace-nowrap`}>
                        {fmt(invTotal)}
                      </td>
                      <td
                        className={`${TD} text-right whitespace-nowrap ${
                          isPaid ? "text-green-600 font-medium" : "text-gray-400"
                        }`}
                      >
                        {fmt(isPaid ? invTotal : 0)}
                      </td>
                      <td
                        className={`${TD} text-right whitespace-nowrap ${
                          !isPaid ? "text-red-500 font-medium" : "text-gray-400"
                        }`}
                      >
                        {fmt(isPaid ? 0 : invTotal)}
                      </td>
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
                    </div>
                      </td>
                      <td className={`${TD} whitespace-nowrap text-gray-500`}>
                        {fmtDate(inv.completed_at)}
                      </td>
                <div className="flex flex-col gap-2 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        {inv.notes ? (
                          <span className="truncate block" title={inv.notes}>
                            {inv.notes}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <InvoiceRowActions
                          invoiceId={inv.id}
                          invoiceNumber={inv.invoice_number}
                          status={inv.status}
                          basePath={BASE_PATH}
                          isOwner={true}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer: count + pagination */}
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
          <p className="text-sm text-gray-400">
            {total === 0
              ? "Tidak ada invoice"
              : `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} dari ${total} invoice`}
          </p>
          {totalPages > 1 && (
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={buildUrl({ page: page - 1 })}
                  className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  ← Sebelumnya
                </Link>
              ) : (
                <span className="rounded-md border border-gray-100 px-3 py-1.5 text-sm text-gray-300 cursor-not-allowed">
                  ← Sebelumnya
                </span>
              )}
              <span className="rounded-md border border-gray-100 px-3 py-1.5 text-sm text-gray-400">
                {page} / {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  href={buildUrl({ page: page + 1 })}
                  className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Selanjutnya →
                </Link>
              ) : (
                <span className="rounded-md border border-gray-100 px-3 py-1.5 text-sm text-gray-300 cursor-not-allowed">
                  Selanjutnya →
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
