import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import Link from "next/link";
import { StatusBadge } from "@/components/invoices/status-badge";
import { InvoiceRowActions } from "@/components/invoices/invoice-row-actions";
import type { InvoiceStatus } from "@/types/database";

const BASE_PATH = "/owner";
const DEFAULT_PAGE_SIZE = 15;
const PAGE_SIZE_OPTIONS = [15, 25, 50] as const;

const KPI_CARDS = [
  { label: "Semua", value: "all", numClass: "text-gray-800" },
  { label: "Draft", value: "draft", numClass: "text-yellow-700" },
  { label: "Dikerjakan", value: "in_progress", numClass: "text-blue-700" },
  { label: "Selesai", value: "completed", numClass: "text-green-700" },
];

const STATUS_FILTER_OPTIONS = [
  { label: "Semua Status", value: "" },
  { label: "Draft", value: "draft" },
  { label: "Dikerjakan", value: "in_progress" },
  { label: "Selesai", value: "completed" },
  { label: "Lunas", value: "paid" },
  { label: "Komplain", value: "complaint" },
  { label: "Dibatalkan", value: "cancelled" },
] as const;

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

function lamaKerja(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return "-";
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "-";
  // Hitung selisih hari kalender (inklusif hari mulai)
  const startDay = Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
  const endDay = Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate());
  const days = Math.max(1, Math.round((endDay - startDay) / 86400000) + 1);
  return `${days} hari`;
}

export default async function OwnerInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; from?: string; to?: string; q?: string; item?: string; size?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? "";
  const dateFrom = params.from ?? "";
  const dateTo = params.to ?? "";
  const customerQuery = (params.q ?? "").trim();
  const itemQuery = (params.item ?? "").trim();
  const requestedSize = parseInt(params.size ?? String(DEFAULT_PAGE_SIZE), 10);
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedSize as (typeof PAGE_SIZE_OPTIONS)[number])
    ? requestedSize
    : DEFAULT_PAGE_SIZE;
  const page = Math.max(1, parseInt(params.page ?? "1") || 1);

  const user = await getUserContext();
  if (!user.tenantId) return null;
  const tenantId = user.tenantId;

  const supabase = await createClient();
  const offset = (page - 1) * pageSize;

  let matchedCustomerIds: string[] | null = null;
  if (customerQuery) {
    const { data: matchedCustomers } = await supabase
      .from("customers")
      .select("id")
      .eq("tenant_id", tenantId)
      .ilike("name", `%${customerQuery}%`)
      .limit(2000);
    matchedCustomerIds = (matchedCustomers ?? []).map((row) => row.id);
  }

  let matchedItemInvoiceIds: string[] | null = null;
  if (itemQuery) {
    const { data: matchedItems } = await supabase
      .from("invoice_items")
      .select("invoice_id")
      .eq("tenant_id", tenantId)
      .ilike("description", `%${itemQuery}%`)
      .limit(5000);
    matchedItemInvoiceIds = [
      ...new Set((matchedItems ?? []).map((row) => row.invoice_id).filter((x): x is string => x != null)),
    ];
  }

  // KPI counts (respects date range)
  let kpiQuery = supabase
    .from("invoices")
    .select("id, status, grand_total")
    .eq("tenant_id", tenantId);
  if (dateFrom) kpiQuery = kpiQuery.gte("created_at", dateFrom);
  if (dateTo) kpiQuery = kpiQuery.lte("created_at", dateTo + "T23:59:59");
  if (matchedCustomerIds) {
    if (matchedCustomerIds.length === 0) {
      kpiQuery = kpiQuery.eq("customer_id", "00000000-0000-0000-0000-000000000000");
    } else {
      kpiQuery = kpiQuery.in("customer_id", matchedCustomerIds);
    }
  }
  if (matchedItemInvoiceIds) {
    if (matchedItemInvoiceIds.length === 0) {
      kpiQuery = kpiQuery.eq("id", "00000000-0000-0000-0000-000000000000");
    } else {
      kpiQuery = kpiQuery.in("id", matchedItemInvoiceIds);
    }
  }

  // Paginated table query (respects status + date + pagination)
  let tableQuery = supabase
    .from("invoices")
    .select(
      "id, invoice_number, status, grand_total, invoice_date, created_at, completed_at, notes, customer_id",
      { count: "exact" }
    )
    .eq("tenant_id", tenantId)
    .order("invoice_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("invoice_number", { ascending: false })
    .range(offset, offset + pageSize - 1);
  if (status && status !== "complaint") {
    tableQuery = tableQuery.eq("status", status as InvoiceStatus);
  }
  if (dateFrom) tableQuery = tableQuery.gte("created_at", dateFrom);
  if (dateTo) tableQuery = tableQuery.lte("created_at", dateTo + "T23:59:59");
  if (matchedCustomerIds) {
    if (matchedCustomerIds.length === 0) {
      tableQuery = tableQuery.eq("customer_id", "00000000-0000-0000-0000-000000000000");
    } else {
      tableQuery = tableQuery.in("customer_id", matchedCustomerIds);
    }
  }
  if (matchedItemInvoiceIds) {
    if (matchedItemInvoiceIds.length === 0) {
      tableQuery = tableQuery.eq("id", "00000000-0000-0000-0000-000000000000");
    } else {
      tableQuery = tableQuery.in("id", matchedItemInvoiceIds);
    }
  }

  const { data: kpiData } = await kpiQuery;

  const filteredInvoiceIds = (kpiData ?? []).map((row) => row.id);
  const { data: complaintRows } = filteredInvoiceIds.length
    ? await supabase
        .from("invoice_mechanics")
        .select("invoice_id")
        .in("invoice_id", filteredInvoiceIds)
        .eq("is_complaint", true)
    : { data: [] as { invoice_id: string }[] };
  const complaintInvoiceIds = [...new Set((complaintRows ?? []).map((row) => row.invoice_id))];

  if (status === "complaint") {
    if (complaintInvoiceIds.length === 0) {
      tableQuery = tableQuery.eq("id", "00000000-0000-0000-0000-000000000000");
    } else {
      tableQuery = tableQuery.in("id", complaintInvoiceIds);
    }
  }

  const { data: invoices, count: totalCount } = await tableQuery;

  // Compute per-status counts
  const kpiCounts: Record<string, number> = {};
  let totalPaidAmount = 0;
  let totalUnpaidAmount = 0;
  for (const row of kpiData ?? []) {
    kpiCounts[row.status] = (kpiCounts[row.status] ?? 0) + 1;
    const amount = Number(row.grand_total ?? 0);
    if (row.status === "paid") totalPaidAmount += amount;
    else if (row.status !== "cancelled") totalUnpaidAmount += amount;
  }
  kpiCounts.complaint = complaintInvoiceIds.length;
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

  const { data: complaintAssignments } = invoiceIds.length
    ? await supabase
        .from("invoice_mechanics")
        .select("invoice_id, is_complaint")
        .in("invoice_id", invoiceIds)
    : { data: [] as { invoice_id: string; is_complaint: boolean }[] };

  const complaintMap: Record<string, boolean> = {};
  for (const row of complaintAssignments ?? []) {
    complaintMap[row.invoice_id] = complaintMap[row.invoice_id] || Boolean(row.is_complaint);
  }
  const invMechanicsMap: Record<string, string[]> = {};
  for (const im of invMechanics ?? []) {
    invMechanicsMap[im.invoice_id] = [
      ...(invMechanicsMap[im.invoice_id] ?? []),
      mechanicNameMap[im.mechanic_id] ?? "?",
    ];
  }

  const total = totalCount ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  function buildUrl(overrides: { status?: string; page?: number; size?: number; q?: string; item?: string }) {
    const p = new URLSearchParams();
    const s = "status" in overrides ? (overrides.status ?? "") : status;
    if (s) p.set("status", s);
    if (dateFrom) p.set("from", dateFrom);
    if (dateTo) p.set("to", dateTo);
    const q = "q" in overrides ? (overrides.q ?? "") : customerQuery;
    if (q) p.set("q", q);
    const it = "item" in overrides ? (overrides.item ?? "") : itemQuery;
    if (it) p.set("item", it);
    const sz = "size" in overrides ? (overrides.size ?? pageSize) : pageSize;
    if (sz !== DEFAULT_PAGE_SIZE) p.set("size", String(sz));
    const pg = "page" in overrides ? (overrides.page ?? 1) : page;
    if (pg > 1) p.set("page", String(pg));
    const qs = p.toString();
    return `${BASE_PATH}/invoices${qs ? "?" + qs : ""}`;
  }

  const kpiCardCount: Record<string, number> = {
    all: kpiTotal,
    draft: kpiCounts.draft ?? 0,
    in_progress: kpiCounts.in_progress ?? 0,
    completed: kpiCounts.completed ?? 0,
  };

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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {KPI_CARDS.map((k) => {
          const count = kpiCardCount[k.value] ?? 0;
          return (
            <div key={k.value} className="rounded-xl border border-gray-200 bg-white p-3 text-center">
              <p className={`text-2xl font-bold ${k.numClass}`}>{count}</p>
              <p className="mt-0.5 text-xs font-medium text-gray-500">{k.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Total Terbayar</p>
          <p className="mt-1 text-xl font-bold text-emerald-700">{fmt(totalPaidAmount)}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Total Belum Terbayar</p>
          <p className="mt-1 text-xl font-bold text-red-700">{fmt(totalUnpaidAmount)}</p>
        </div>
      </div>

      {/* Table Card */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-3">
          <form method="get" action={`${BASE_PATH}/invoices`} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Dari</label>
              <input
                type="date"
                name="from"
                defaultValue={dateFrom}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Sampai</label>
              <input
                type="date"
                name="to"
                defaultValue={dateTo}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div className="w-[180px]">
              <label className="mb-1 block text-xs text-gray-500">Status</label>
              <select
                name="status"
                defaultValue={status}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                {STATUS_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-[180px]">
              <label className="mb-1 block text-xs text-gray-500">Cari Pelanggan</label>
              <input
                type="text"
                name="q"
                defaultValue={customerQuery}
                placeholder="Nama pelanggan"
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-xs text-gray-500">Cari Item</label>
              <input
                type="text"
                name="item"
                defaultValue={itemQuery}
                placeholder="Nama jasa / barang dalam invoice"
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Baris</label>
              <select
                name="size"
                defaultValue={String(pageSize)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
            >
              Terapkan
            </button>
            {(dateFrom || dateTo || customerQuery || itemQuery || pageSize !== DEFAULT_PAGE_SIZE) && (
              <Link
                href={buildUrl({ page: 1, q: "", item: "", size: DEFAULT_PAGE_SIZE })}
                className="text-sm text-gray-400 hover:text-gray-600 underline"
              >
                Reset
              </Link>
            )}
          </form>
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
                      <StatusBadge status={inv.status as InvoiceStatus} complaint={Boolean(complaintMap[inv.id])} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-gray-400">Pelanggan</p>
                        <p className="font-medium text-gray-700 break-words">{customer?.name ?? "-"}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Engineer</p>
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
                      <div>
                        <p className="text-gray-400">Tgl Selesai</p>
                        <p className="font-medium text-gray-700">{fmtDate(inv.completed_at)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Lama Kerja</p>
                        <p className="font-medium text-gray-700">
                          {lamaKerja(
                            (inv as { invoice_date?: string }).invoice_date ?? inv.created_at,
                            inv.completed_at
                          )}
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
                    <th className={`${TH} w-[240px]`}>Pelanggan</th>
                    <th className={TH}>Status</th>
                    <th className={`${TH} text-right`}>Total</th>
                    <th className={`${TH} text-right`}>Bayar</th>
                    <th className={`${TH} text-right`}>Kurang</th>
                    <th className={TH}>Engineer</th>
                    <th className={TH}>Tgl Selesai</th>
                    <th className={TH}>Lama Kerja</th>
                    <th className={TH}>Catatan</th>
                    <th className="w-10 px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {invoices.map((inv) => {
                    const customer = inv.customer_id ? customerMap[inv.customer_id] : null;
                    const mechanics = invMechanicsMap[inv.id] ?? [];
                    const invTotal = Number(inv.grand_total);
                    const isPaid = inv.status === "paid";
                    return (
                      <tr key={inv.id} className="transition-colors hover:bg-gray-50">
                        <td className={`${TD} whitespace-nowrap font-mono font-medium text-gray-900`}>
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
                        <td className={`${TD} max-w-[240px] whitespace-normal break-words text-gray-900`}>
                          <span className="line-clamp-2" title={customer?.name ?? "-"}>
                            {customer?.name ?? "-"}
                          </span>
                        </td>
                        <td className={TD}>
                          <StatusBadge status={inv.status as InvoiceStatus} complaint={Boolean(complaintMap[inv.id])} />
                        </td>
                        <td className={`${TD} whitespace-nowrap text-right font-medium text-gray-900`}>
                          {fmt(invTotal)}
                        </td>
                        <td
                          className={`${TD} whitespace-nowrap text-right ${
                            isPaid ? "font-medium text-green-600" : "text-gray-400"
                          }`}
                        >
                          {fmt(isPaid ? invTotal : 0)}
                        </td>
                        <td
                          className={`${TD} whitespace-nowrap text-right ${
                            !isPaid ? "font-medium text-red-500" : "text-gray-400"
                          }`}
                        >
                          {fmt(isPaid ? 0 : invTotal)}
                        </td>
                        <td className={`${TD} max-w-[120px] text-gray-600`}>
                          {mechanics.length > 0 ? (
                            <span className="block truncate" title={mechanics.join(", ")}>
                              {mechanics.slice(0, 2).join(", ")}
                              {mechanics.length > 2 && (
                                <span className="text-gray-400"> +{mechanics.length - 2}</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className={`${TD} whitespace-nowrap text-gray-500`}>
                          {fmtDate(inv.completed_at)}
                        </td>
                        <td className={`${TD} whitespace-nowrap text-gray-500`}>
                          {lamaKerja(
                            (inv as { invoice_date?: string }).invoice_date ?? inv.created_at,
                            inv.completed_at
                          )}
                        </td>
                        <td className={`${TD} max-w-[120px] text-gray-500`}>
                          {inv.notes ? (
                            <span className="block truncate" title={inv.notes}>
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
          </>
        )}

        {/* Footer: count + pagination */}
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
          <p className="text-sm text-gray-400">
            {total === 0
              ? "Tidak ada invoice"
              : `${offset + 1}–${Math.min(offset + pageSize, total)} dari ${total} invoice`}
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
