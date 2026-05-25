import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import { redirect } from "next/navigation";
import { AlertCircle, ArrowUp, ArrowDown } from "lucide-react";
import {
  QuickReimburseButton,
  type MechanicOption,
} from "@/components/mechanics/reimburse-modal";

// ── Helpers ────────────────────────────────────────────────────
function fmt(n: number) {
  return "Rp " + Math.abs(n).toLocaleString("id-ID");
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
const AVATAR_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-pink-500", "bg-teal-500",
];
function avatarColor(id: string) {
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

export default async function AdminReimbursePage() {
  const ctx = await getUserContext();
  if (!ctx.tenantId || ctx.role !== "admin") redirect("/admin/dashboard");

  const supabase = await createClient();
  const tenantId = ctx.tenantId;

  const [
    { data: mechanicsRaw },
    { data: debtSummaryRaw },
    { data: debtHistoryRaw },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("tenant_id", tenantId)
      .eq("role", "mechanic")
      .order("full_name"),

    supabase
      .from("v_mechanic_debt_summary")
      .select("mechanic_id, total_advanced, total_reimbursed, outstanding_balance")
      .eq("tenant_id", tenantId),

    supabase
      .from("mechanic_debt_ledger")
      .select("id, mechanic_id, transaction_type, amount, notes, created_at, invoice_items(receipt_image_url)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const mechanics: MechanicOption[] = (mechanicsRaw ?? []).map((m) => ({
    id: m.id,
    full_name: m.full_name ?? "—",
  }));
  const mechanicNameMap = new Map(mechanics.map((m) => [m.id, m.full_name]));

  type DebtSummaryRow = {
    mechanic_id: string;
    total_advanced: number;
    total_reimbursed: number;
    outstanding_balance: number;
  };
  const debtSummary = (debtSummaryRaw as DebtSummaryRow[] | null) ?? [];
  const totalOutstanding = debtSummary.reduce(
    (s, r) => s + Math.max(0, Number(r.outstanding_balance)),
    0
  );
  const totalAdvanced = debtSummary.reduce((s, r) => s + Number(r.total_advanced), 0);
  const totalReimbursed = debtSummary.reduce((s, r) => s + Number(r.total_reimbursed), 0);

  const debtHistory = (
    debtHistoryRaw as {
      id: string;
      mechanic_id: string;
      transaction_type: string;
      amount: number;
      notes: string | null;
      created_at: string;
      invoice_items: { receipt_image_url: string | null } | null;
    }[] | null
  ) ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reimburse Mekanik</h1>
          <p className="text-sm text-gray-500">
            Catat pembayaran reimburse advance sparepart mekanik
          </p>
        </div>
        <QuickReimburseButton mechanics={mechanics} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Belum Dibayar
            </span>
          </div>
          <p className="text-2xl font-bold text-red-600">{fmt(totalOutstanding)}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <ArrowUp className="h-4 w-4 text-orange-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total Advance
            </span>
          </div>
          <p className="text-2xl font-bold text-orange-600">{fmt(totalAdvanced)}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <ArrowDown className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total Sudah Dibayar
            </span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{fmt(totalReimbursed)}</p>
        </div>
      </div>

      {/* Per-mechanic outstanding summary */}
      {debtSummary.filter((r) => Number(r.outstanding_balance) > 0).length > 0 && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-amber-700">
            Mekanik Dengan Saldo Belum Lunas
          </p>
          <div className="flex flex-wrap gap-2">
            {debtSummary
              .filter((r) => Number(r.outstanding_balance) > 0)
              .map((r) => (
                <div
                  key={r.mechanic_id}
                  className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm"
                >
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColor(r.mechanic_id)}`}
                  >
                    {initials(mechanicNameMap.get(r.mechanic_id) ?? "?")}
                  </div>
                  <span className="text-xs font-medium text-gray-700">
                    {mechanicNameMap.get(r.mechanic_id) ?? "—"}
                  </span>
                  <span className="text-xs font-bold text-red-600">
                    {fmt(Number(r.outstanding_balance))}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* History table */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-3">
          <p className="text-sm font-semibold text-gray-700">Riwayat Transaksi</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Tanggal</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Mekanik</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Tipe</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Jumlah</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Keterangan</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Nota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {debtHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-400">
                    Belum ada riwayat kasbon atau reimburse
                  </td>
                </tr>
              ) : (
                debtHistory.map((row) => {
                  const isAdvance = row.transaction_type === "advance";
                  const receiptUrl = row.invoice_items?.receipt_image_url ?? null;
                  return (
                    <tr key={row.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {fmtDate(row.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColor(row.mechanic_id)}`}>
                            {initials(mechanicNameMap.get(row.mechanic_id) ?? "?")}
                          </div>
                          <span className="text-sm text-gray-800">
                            {mechanicNameMap.get(row.mechanic_id) ?? "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${isAdvance ? "bg-orange-50 text-orange-700" : "bg-emerald-50 text-emerald-700"}`}>
                          {isAdvance ? "Advance" : "Reimburse"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        <span className={isAdvance ? "text-orange-600" : "text-emerald-600"}>
                          {isAdvance ? "+" : "-"}{fmt(Number(row.amount))}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px] truncate">
                        {row.notes ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {receiptUrl ? (
                          <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="group relative inline-block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={receiptUrl}
                              alt="Nota"
                              className="h-10 w-10 rounded-lg object-cover border border-gray-200 group-hover:opacity-80 transition-opacity"
                            />
                            <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="rounded bg-black/60 px-1 py-0.5 text-[9px] text-white">Buka</span>
                            </span>
                          </a>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
