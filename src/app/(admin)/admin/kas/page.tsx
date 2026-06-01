import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import { redirect } from "next/navigation";
import { ArrowDown, Minus } from "lucide-react";
import { KasAdminActions } from "@/components/kas/kas-admin-actions";

const PAGE_SIZE = 20;

function fmt(n: number) {
  return "Rp " + Math.abs(n).toLocaleString("id-ID");
}
function fmtDate(dateStr: string) {
  const d = dateStr.length === 10 ? new Date(dateStr + "T00:00:00") : new Date(dateStr);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

type SearchParams = Promise<{ page?: string }>;

export default async function AdminKasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = await getUserContext();
  if (!ctx.tenantId || (ctx.role !== "admin" && ctx.role !== "owner")) {
    redirect("/admin/dashboard");
  }

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  const [{ data: entries, count }, { data: totalRaw }] = await Promise.all([
    supabase
      .from("ledger")
      .select("id, account_type, transaction_type, category, amount, notes, transaction_date, created_at", { count: "exact" })
      .eq("tenant_id", ctx.tenantId!)
      .eq("transaction_type", "kas_keluar")
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to),

    supabase
      .from("ledger")
      .select("amount")
      .eq("tenant_id", ctx.tenantId!)
      .eq("transaction_type", "kas_keluar"),
  ]);

  const totalKeluar = (totalRaw ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  function pageUrl(p: number) {
    return `/admin/kas?page=${p}`;
  }

  const rows = entries ?? [];

  return (
    <div className="flex flex-col gap-6 pb-24 sm:pb-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pencatatan Pengeluaran</h1>
          <p className="text-sm text-gray-500">Catat biaya operasional harian</p>
        </div>
        {/* Desktop CTA */}
        <div className="hidden sm:block">
          <KasAdminActions />
        </div>
      </div>

      {/* KPI Card */}
      <div className="rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 p-5 text-white shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <div className="rounded-lg bg-white/20 p-1.5">
            <ArrowDown className="h-4 w-4" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
            Total Pengeluaran
          </span>
        </div>
        <p className="text-2xl font-bold">{fmt(totalKeluar)}</p>
        <p className="mt-1 text-xs text-red-100">Semua waktu</p>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">#</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Tanggal</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Kategori</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Akun</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Keterangan</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-red-500">Keluar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-400">
                    Belum ada pengeluaran tercatat
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-400">{from + idx + 1}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {fmtDate((row as { transaction_date?: string }).transaction_date ?? row.created_at)}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{row.category}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.account_type === "kas_tunai"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-blue-50 text-blue-700"
                      }`}>
                        {row.account_type === "kas_tunai" ? "Kas Tunai" : "Bank"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px] truncate">
                      {row.notes ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-500">
                      -{fmt(Number(row.amount))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col items-center gap-3 border-t border-gray-100 px-5 py-3 sm:flex-row sm:justify-between">
          <p className="text-xs text-gray-500">{count ?? 0} pengeluaran</p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              {page > 1 && (
                <a href={pageUrl(page - 1)} className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                  ← Prev
                </a>
              )}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const p = start + i;
                return (
                  <a key={p} href={pageUrl(p)} className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                    p === page ? "bg-primary text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}>{p}</a>
                );
              })}
              {page < totalPages && (
                <a href={pageUrl(page + 1)} className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                  Next →
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile sticky FAB */}
      <div className="fixed bottom-20 right-4 z-40 sm:hidden">
        <KasAdminActions fab />
      </div>
    </div>
  );
}
