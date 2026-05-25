import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import { redirect } from "next/navigation";
import {
  Users,
  Wallet,
  AlertCircle,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Wrench,
} from "lucide-react";
import {
  LunasiButton,
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

// Deterministic color per mechanic id
const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-pink-500",
  "bg-teal-500",
];
function avatarColor(id: string) {
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

// ── Page ───────────────────────────────────────────────────────
type SearchParams = Promise<{ tab?: string }>;

export default async function MechanicsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = await getUserContext();
  if (!ctx.tenantId || ctx.role !== "owner") redirect("/owner/dashboard");

  const sp = await searchParams;
  const tab = sp.tab === "reimburse" ? "reimburse" : "mekanik";

  const supabase = await createClient();
  const tenantId = ctx.tenantId;

  // ── Parallel data fetch ──────────────────────────────────────
  const [
    { data: mechanicsRaw },
    { data: debtSummaryRaw },
    { data: activeInvoicesRaw },
    { data: debtHistoryRaw },
  ] = await Promise.all([
    // All mechanics for this tenant
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("tenant_id", tenantId)
      .eq("role", "mechanic")
      .order("full_name"),

    // Debt summary view
    supabase
      .from("v_mechanic_debt_summary")
      .select("mechanic_id, total_advanced, total_reimbursed, outstanding_balance")
      .eq("tenant_id", tenantId),

    // Active invoices per mechanic (in_progress or completed)
    supabase
      .from("invoice_mechanics")
      .select("mechanic_id, invoices!inner(status)")
      .eq("tenant_id", tenantId)
      .in("invoices.status" as never, ["in_progress", "completed"]),

    // Full debt history (latest 100)
    supabase
      .from("mechanic_debt_ledger")
      .select("id, mechanic_id, transaction_type, amount, notes, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  // ── Derived data ─────────────────────────────────────────────
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
  const debtMap = new Map<string, DebtSummaryRow>();
  for (const row of (debtSummaryRaw as DebtSummaryRow[] | null) ?? []) {
    debtMap.set(row.mechanic_id, row);
  }

  // Active invoice count per mechanic
  const activeCountMap = new Map<string, number>();
  for (const row of (activeInvoicesRaw as { mechanic_id: string }[] | null) ?? []) {
    activeCountMap.set(row.mechanic_id, (activeCountMap.get(row.mechanic_id) ?? 0) + 1);
  }

  // KPIs
  const totalOutstanding = [...debtMap.values()].reduce(
    (s, r) => s + Math.max(0, Number(r.outstanding_balance)),
    0
  );
  const mechanicsWithDebt = [...debtMap.values()].filter(
    (r) => Number(r.outstanding_balance) > 0
  ).length;

  const debtHistory = (
    debtHistoryRaw as {
      id: string;
      mechanic_id: string;
      transaction_type: string;
      amount: number;
      notes: string | null;
      created_at: string;
    }[] | null
  ) ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mekanik &amp; Hutang</h1>
          <p className="text-sm text-gray-500">
            Daftar mekanik &amp; pengelolaan reimburse sparepart
          </p>
        </div>
      </div>

      {/* ── KPI row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total Mekanik
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{mechanics.length}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-red-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total Belum Dibayar
            </span>
          </div>
          <p className="text-3xl font-bold text-red-600">{fmt(totalOutstanding)}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Mekanik Belum Lunas
            </span>
          </div>
          <p className="text-3xl font-bold text-amber-600">{mechanicsWithDebt}</p>
          <p className="mt-1 text-xs text-gray-400">dari {mechanics.length} mekanik</p>
        </div>
      </div>

      {/* ── Tab bar ────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {(
          [
            ["mekanik", "Daftar Mekanik"],
            ["reimburse", "Reimburse & Kasbon"],
          ] as const
        ).map(([val, label]) => (
          <a
            key={val}
            href={`/owner/mechanics?tab=${val}`}
            className={`rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${
              tab === val
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      {/* ── TAB: Daftar Mekanik ───────────────────────────────── */}
      {tab === "mekanik" && (
        <div>
          {mechanics.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
              <Wrench className="mb-3 h-10 w-10 text-gray-300" />
              <p className="font-semibold text-gray-500">Belum ada mekanik</p>
              <p className="mt-1 text-sm text-gray-400">
                Tambahkan mekanik melalui menu Kelola Pengguna
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mechanics.map((mechanic) => {
                const debt = debtMap.get(mechanic.id);
                const outstanding = Math.max(0, Number(debt?.outstanding_balance ?? 0));
                const totalAdv = Number(debt?.total_advanced ?? 0);
                const totalReimb = Number(debt?.total_reimbursed ?? 0);
                const activeJobs = activeCountMap.get(mechanic.id) ?? 0;
                const hasDebt = outstanding > 0;

                return (
                  <div
                    key={mechanic.id}
                    className="flex flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
                  >
                    {/* Avatar + name */}
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(mechanic.id)}`}
                      >
                        {initials(mechanic.full_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900">
                          {mechanic.full_name}
                        </p>
                        <p className="text-xs text-gray-400">Mekanik</p>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="mt-4 flex gap-3">
                      <div className="flex-1 rounded-xl bg-gray-50 p-3">
                        <p className="text-xs text-gray-400">Invoice Aktif</p>
                        <p className="mt-0.5 text-lg font-bold text-gray-800">
                          {activeJobs}
                        </p>
                      </div>
                      <div
                        className={`flex-1 rounded-xl p-3 ${
                          hasDebt ? "bg-red-50" : "bg-emerald-50"
                        }`}
                      >
                        <p className={`text-xs ${hasDebt ? "text-red-400" : "text-emerald-500"}`}>
                          Outstanding
                        </p>
                        <p
                          className={`mt-0.5 text-sm font-bold ${
                            hasDebt ? "text-red-600" : "text-emerald-600"
                          }`}
                        >
                          {hasDebt ? fmt(outstanding) : "Lunas"}
                        </p>
                      </div>
                    </div>

                    {/* Advance / reimbursed mini-row */}
                    {(totalAdv > 0 || totalReimb > 0) && (
                      <div className="mt-3 flex gap-4 rounded-xl bg-gray-50 px-3 py-2">
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <ArrowUp className="h-3 w-3 text-orange-400" />
                          Advance: {fmt(totalAdv)}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <ArrowDown className="h-3 w-3 text-emerald-400" />
                          Bayar: {fmt(totalReimb)}
                        </span>
                      </div>
                    )}

                    {/* Status badge */}
                    <div className="mt-3 flex items-center gap-2">
                      {hasDebt ? (
                        <span className="flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
                          <AlertCircle className="h-3 w-3" />
                          Perlu Reimburse
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" />
                          Semua Lunas
                        </span>
                      )}
                    </div>

                    {/* Lunasi button — only if has outstanding */}
                    {hasDebt && (
                      <div className="mt-3">
                        <LunasiButton mechanic={mechanic} allMechanics={mechanics} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Reimburse & Kasbon ───────────────────────────── */}
      {tab === "reimburse" && (
        <div className="flex flex-col gap-4">
          {/* Action bar */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Riwayat advance sparepart &amp; pembayaran reimburse
            </p>
            <QuickReimburseButton mechanics={mechanics} />
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Tanggal
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Mekanik
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Tipe
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Jumlah
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Keterangan
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {debtHistory.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-12 text-center text-sm text-gray-400"
                      >
                        Belum ada riwayat kasbon atau reimburse
                      </td>
                    </tr>
                  ) : (
                    debtHistory.map((row) => {
                      const isAdvance = row.transaction_type === "advance";
                      return (
                        <tr key={row.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">
                            {fmtDate(row.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColor(row.mechanic_id)}`}
                              >
                                {initials(
                                  mechanicNameMap.get(row.mechanic_id) ?? "?"
                                )}
                              </div>
                              <span className="text-sm text-gray-800">
                                {mechanicNameMap.get(row.mechanic_id) ?? "—"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                isAdvance
                                  ? "bg-orange-50 text-orange-700"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {isAdvance ? "Advance" : "Reimburse"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">
                            <span className={isAdvance ? "text-orange-600" : "text-emerald-600"}>
                              {isAdvance ? "+" : "-"}{fmt(Number(row.amount))}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">
                            {row.notes ?? "—"}
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
      )}
    </div>
  );
}
