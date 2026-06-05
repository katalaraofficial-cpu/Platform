import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import { redirect } from "next/navigation";
import {
  Wallet,
  Building2,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  FileDown,
} from "lucide-react";
import { KasQuickActions, KasRowActions } from "@/components/kas/kas-actions";
import { KasFilterBar } from "@/components/kas/kas-filter-bar";
import type { Ledger } from "@/types/database";

// ── Helpers ────────────────────────────────────────────────────
function fmt(n: number) {
  return (n < 0 ? "-" : "") + "Rp " + Math.abs(n).toLocaleString("id-ID");
}

function fmtDate(dateStr: string) {
  const d = dateStr.length === 10 ? new Date(dateStr + "T00:00:00") : new Date(dateStr);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Props ──────────────────────────────────────────────────────
type SearchParams = Promise<{
  page?: string;
  account?: string;
  type?: string;
  from?: string;
  to?: string;
  search?: string;
  size?: string;
}>;

// ── Page ───────────────────────────────────────────────────────
export default async function KasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = await getUserContext();
  if (!ctx.tenantId || ctx.role !== "owner") redirect("/owner/dashboard");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const accountFilter = sp.account ?? "all";
  const typeFilter = sp.type ?? "all";
  const fromDate = sp.from ?? "";
  const toDate = sp.to ?? "";
  const search = sp.search ?? "";
  const pageSize = Math.min(50, Math.max(10, parseInt(sp.size ?? "20", 10)));

  const supabase = await createClient();

  // ── Table: build filtered + paginated query ─────────────────
  let query = supabase
    .from("ledger")
    .select("id, account_type, transaction_type, category, amount, reference_id, transfer_ref, notes, created_by, created_at, transaction_date", { count: "exact" })
    .eq("tenant_id", ctx.tenantId)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (accountFilter !== "all") {
    query = query.eq("account_type", accountFilter as import("@/types/database").AccountType);
  }
  if (typeFilter !== "all") {
    query = query.eq("transaction_type", typeFilter as import("@/types/database").LedgerType);
  }
  if (fromDate) {
    query = query.gte("transaction_date", fromDate);
  }
  if (toDate) {
    query = query.lte("transaction_date", toDate);
  }
  if (search) {
    query = query.or(`category.ilike.%${search}%,notes.ilike.%${search}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const [{ data: allEntries }, { data: entries, count }] = await Promise.all([
    supabase
      .from("ledger")
      .select("account_type, transaction_type, amount")
      .eq("tenant_id", ctx.tenantId),
    query.range(from, to),
  ]);

  let kasTunaiIn = 0,
    kasTunaiOut = 0,
    bankIn = 0,
    bankOut = 0;

  for (const row of (allEntries as Pick<Ledger, "account_type" | "transaction_type" | "amount">[] | null) ?? []) {
    const amt = Number(row.amount);
    if (row.account_type === "kas_tunai") {
      if (row.transaction_type === "kas_masuk") kasTunaiIn += amt;
      else kasTunaiOut += amt;
    } else {
      if (row.transaction_type === "kas_masuk") bankIn += amt;
      else bankOut += amt;
    }
  }
  const kasTunaiBalance = kasTunaiIn - kasTunaiOut;
  const bankBalance = bankIn - bankOut;
  const totalBalance = kasTunaiBalance + bankBalance;
  const totalIn = kasTunaiIn + bankIn;
  const totalOut = kasTunaiOut + bankOut;

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize));

  // ── URL builders ────────────────────────────────────────────
  function pageUrl(p: number) {
    const params = new URLSearchParams();
    params.set("page", String(p));
    if (accountFilter !== "all") params.set("account", accountFilter);
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (search) params.set("search", search);
    if (pageSize !== 20) params.set("size", String(pageSize));
    return `/owner/kas?${params.toString()}`;
  }

  function pageSizeUrl(s: number) {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("size", String(s));
    if (accountFilter !== "all") params.set("account", accountFilter);
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (search) params.set("search", search);
    return `/owner/kas?${params.toString()}`;
  }

  // ── Print URL (passes active filters to print page) ────────
  function printUrl() {
    const params = new URLSearchParams();
    if (accountFilter !== "all") params.set("account", accountFilter);
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (search) params.set("search", search);
    const qs = params.toString();
    return `/owner/kas/print${qs ? "?" + qs : ""}`;
  }

  const rows = (entries as Ledger[] | null) ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* ── Page header ──────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kas &amp; Keuangan</h1>
          <p className="text-sm text-gray-500">
            Kelola kas tunai dan rekening bank bisnis Anda
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={printUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
            title="Ekspor Jurnal & Buku Besar ke PDF"
          >
            <FileDown className="h-4 w-4 text-gray-500" />
            <span>Export PDF</span>
          </a>
          <KasQuickActions />
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Kas Tunai */}
        <div className={`rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-5 text-white shadow-sm ${kasTunaiBalance < 0 ? "ring-2 ring-red-400" : ""}`}>
          <div className="mb-3 flex items-center gap-2">
            <div className="rounded-lg bg-white/20 p-1.5">
              <Wallet className="h-4 w-4" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
              Kas Tunai
            </span>
          </div>
          <p className={`text-2xl font-bold ${kasTunaiBalance < 0 ? "text-red-200" : ""}`}>{fmt(kasTunaiBalance)}</p>
          <div className="mt-3 flex gap-4">
            <span className="flex items-center gap-1 text-xs text-emerald-100">
              <ArrowUp className="h-3 w-3" />
              {fmt(kasTunaiIn)}
            </span>
            <span className="flex items-center gap-1 text-xs text-red-200">
              <ArrowDown className="h-3 w-3" />
              {fmt(kasTunaiOut)}
            </span>
          </div>
        </div>

        {/* Bank */}
        <div className={`rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 p-5 text-white shadow-sm ${bankBalance < 0 ? "ring-2 ring-red-400" : ""}`}>
          <div className="mb-3 flex items-center gap-2">
            <div className="rounded-lg bg-white/20 p-1.5">
              <Building2 className="h-4 w-4" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
              Bank
            </span>
          </div>
          <p className={`text-2xl font-bold ${bankBalance < 0 ? "text-red-200" : ""}`}>{fmt(bankBalance)}</p>
          <div className="mt-3 flex gap-4">
            <span className="flex items-center gap-1 text-xs text-blue-100">
              <ArrowUp className="h-3 w-3" />
              {fmt(bankIn)}
            </span>
            <span className="flex items-center gap-1 text-xs text-red-200">
              <ArrowDown className="h-3 w-3" />
              {fmt(bankOut)}
            </span>
          </div>
        </div>

        {/* Saldo Total */}
        <div className={`rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 p-5 text-white shadow-sm ${totalBalance < 0 ? "ring-2 ring-red-400" : ""}`}>
          <div className="mb-3 flex items-center gap-2">
            <div className="rounded-lg bg-white/20 p-1.5">
              <TrendingUp className="h-4 w-4" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
              Saldo Total
            </span>
          </div>
          <p className={`text-2xl font-bold ${totalBalance < 0 ? "text-red-200" : ""}`}>{fmt(totalBalance)}</p>
          <div className="mt-3 flex gap-4">
            <span className="flex items-center gap-1 text-xs text-purple-100">
              <ArrowUp className="h-3 w-3" />
              {fmt(totalIn)}
            </span>
            <span className="flex items-center gap-1 text-xs text-red-200">
              <ArrowDown className="h-3 w-3" />
              {fmt(totalOut)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Table card ───────────────────────────────────────── */}
      <div className="rounded-2xl bg-white shadow-sm border border-gray-100">
        {/* Filter bar */}
        <KasFilterBar
          accountFilter={accountFilter}
          typeFilter={typeFilter}
          fromDate={fromDate}
          toDate={toDate}
          search={search}
          pageSize={String(pageSize)}
        />

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-10" />
              <col className="w-24" />
              <col className="w-52" />
              <col className="w-28" />
              <col />
              <col className="w-36" />
              <col className="w-36" />
              <col className="w-20" />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  #
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Tanggal
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Kategori
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Akun
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Keterangan
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-emerald-600">
                  Masuk
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-red-500">
                  Keluar
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-sm text-gray-400"
                  >
                    Belum ada transaksi{" "}
                    {accountFilter !== "all" || typeFilter !== "all"
                      ? "yang sesuai filter"
                      : "— mulai tambah dengan tombol di atas"}
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => {
                  const isMasuk = row.transaction_type === "kas_masuk";
                  const isTransfer = !!row.transfer_ref;

                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-gray-50/60 transition-colors"
                    >
                      <td className="px-5 py-3 text-xs text-gray-400">
                        {from + idx + 1}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {fmtDate((row as Ledger & { transaction_date?: string }).transaction_date ?? row.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {isTransfer && (
                            <ArrowLeftRight className="h-3 w-3 shrink-0 text-blue-400" />
                          )}
                          <span
                            className="truncate font-medium text-gray-800"
                            title={row.category}
                          >
                            {row.category}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                            row.account_type === "kas_tunai"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {row.account_type === "kas_tunai" ? "Kas Tunai" : "Bank"}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3 text-xs text-gray-500 truncate"
                        title={row.notes ?? undefined}
                      >
                        {row.notes ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                        {isMasuk ? (
                          <span className="text-emerald-600">
                            +{fmt(Number(row.amount))}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                        {!isMasuk ? (
                          <span className="text-red-500">
                            -{fmt(Number(row.amount))}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <KasRowActions
                          entry={{
                            id: row.id,
                            category: row.category,
                            amount: Number(row.amount),
                            notes: row.notes,
                            transfer_ref: row.transfer_ref,
                            transaction_date: (row as Ledger & { transaction_date?: string }).transaction_date ?? null,
                          }}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col items-center gap-3 border-t border-gray-100 px-5 py-3 sm:flex-row sm:justify-between">
          {/* Info + page size */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
            <p className="text-xs text-gray-500">
              {count ?? 0} transaksi &mdash; hal. {page}/{totalPages}
            </p>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">Tampil:</span>
              {[10, 15, 25, 50].map((s) => (
                <a
                  key={s}
                  href={pageSizeUrl(s)}
                  className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                    pageSize === s
                      ? "bg-primary text-white"
                      : "border border-gray-200 text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {s}
                </a>
              ))}
            </div>
          </div>
          {/* Nav */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              {page > 1 && (
                <a
                  href={pageUrl(page - 1)}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </a>
              )}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const p = start + i;
                return (
                  <a
                    key={p}
                    href={pageUrl(p)}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                      p === page
                        ? "bg-primary text-white"
                        : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </a>
                );
              })}
              {page < totalPages && (
                <a
                  href={pageUrl(page + 1)}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
