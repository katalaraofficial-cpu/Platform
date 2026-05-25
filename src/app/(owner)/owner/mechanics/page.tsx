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
  TrendingUp,
  Star,
} from "lucide-react";
import {
  LunasiButton,
  QuickReimburseButton,
  type MechanicOption,
} from "@/components/mechanics/reimburse-modal";
import {
  DebtHistoryTable,
  type MechanicInfo,
} from "@/components/mechanics/debt-history-table";

// ── Helpers ────────────────────────────────────────────────────
function fmt(n: number) {
  return "Rp " + Math.abs(n).toLocaleString("id-ID");
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
  const tab = sp.tab === "reimburse" ? "reimburse" : "performa";

  const supabase = await createClient();
  const tenantId = ctx.tenantId;

  // ── Parallel data fetch ──────────────────────────────────────
  const [
    { data: mechanicsRaw },
    { data: debtSummaryRaw },
    { data: invoiceMechanicsRaw },
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

    // All invoice assignments with invoice status + value for performance
    supabase
      .from("invoice_mechanics")
      .select("mechanic_id, mechanic_role, invoices(status, grand_total)")
      .eq("tenant_id", tenantId),

    supabase
      .from("mechanic_debt_ledger")
      .select("id, mechanic_id, transaction_type, amount, notes, is_paid, created_at, invoice_items(receipt_image_url)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  // ── Derived data ─────────────────────────────────────────────
  const mechanics: MechanicOption[] = (mechanicsRaw ?? []).map((m) => ({
    id: m.id,
    full_name: m.full_name ?? "—",
  }));
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

  // Performance data per mechanic
  type InvRow = { mechanic_id: string; mechanic_role: string; invoices: { status: string; grand_total: number } | null };
  const allAssignments = (invoiceMechanicsRaw as InvRow[] | null) ?? [];

  type PerfData = {
    total: number;
    inProgress: number;
    completed: number;
    paid: number;
    leadCount: number;
    totalRevenue: number; // sum grand_total of paid invoices
  };
  const perfMap = new Map<string, PerfData>();
  for (const row of allAssignments) {
    const inv = row.invoices;
    if (!inv) continue;
    const prev = perfMap.get(row.mechanic_id) ?? {
      total: 0, inProgress: 0, completed: 0, paid: 0, leadCount: 0, totalRevenue: 0,
    };
    prev.total++;
    if (inv.status === "in_progress") prev.inProgress++;
    if (inv.status === "completed") prev.completed++;
    if (inv.status === "paid") { prev.paid++; prev.totalRevenue += Number(inv.grand_total ?? 0); }
    if (row.mechanic_role === "lead") prev.leadCount++;
    perfMap.set(row.mechanic_id, prev);
  }

  // KPIs
  const totalOutstanding = [...debtMap.values()].reduce(
    (s, r) => s + Math.max(0, Number(r.outstanding_balance)),
    0
  );
  const mechanicsWithDebt = [...debtMap.values()].filter(
    (r) => Number(r.outstanding_balance) > 0
  ).length;
  const totalRevenueAll = [...perfMap.values()].reduce((s, p) => s + p.totalRevenue, 0);

  const debtHistory = (
    debtHistoryRaw as {
      id: string;
      mechanic_id: string;
      transaction_type: string;
      amount: number;
      notes: string | null;
      is_paid: boolean;
      created_at: string;
      invoice_items: { receipt_image_url: string | null } | null;
    }[] | null
  ) ?? [];

  const mechanicInfos: MechanicInfo[] = mechanics.map((m) => ({
    id: m.id,
    name: m.full_name,
    color: avatarColor(m.id),
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Engineer</h1>
        <p className="text-sm text-gray-500">
          Performa kerja &amp; pengelolaan reimburse sparepart
        </p>
      </div>

      {/* ── KPI row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Engineer</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{mechanics.length}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-violet-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Revenue</span>
          </div>
          <p className="text-2xl font-bold text-violet-600">{fmt(totalRevenueAll)}</p>
          <p className="mt-1 text-xs text-gray-400">dari invoice lunas</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-red-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Hutang Belum Bayar</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{fmt(totalOutstanding)}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Belum Lunas</span>
          </div>
          <p className="text-3xl font-bold text-amber-600">{mechanicsWithDebt}</p>
          <p className="mt-1 text-xs text-gray-400">dari {mechanics.length} engineer</p>
        </div>
      </div>

      {/* ── Tab bar ────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {(
          [
            ["performa", "Performa Mekanik"],
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

      {/* ── TAB: Performa Mekanik ─────────────────────────────── */}
      {tab === "performa" && (
        <div>
          {mechanics.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
              <Wrench className="mb-3 h-10 w-10 text-gray-300" />
              <p className="font-semibold text-gray-500">Belum ada engineer</p>
              <p className="mt-1 text-sm text-gray-400">
                Tambahkan melalui menu Kelola Pengguna
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mechanics.map((mechanic) => {
                const perf = perfMap.get(mechanic.id) ?? {
                  total: 0, inProgress: 0, completed: 0, paid: 0, leadCount: 0, totalRevenue: 0,
                };
                const completionRate = perf.total > 0
                  ? Math.round(((perf.completed + perf.paid) / perf.total) * 100)
                  : 0;

                return (
                  <div
                    key={mechanic.id}
                    className="flex flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
                  >
                    {/* Avatar + name */}
                    <div className="flex items-center gap-3">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(mechanic.id)}`}>
                        {initials(mechanic.full_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-gray-900">{mechanic.full_name}</p>
                        <p className="text-xs text-gray-400">Engineer</p>
                      </div>
                      {perf.leadCount > 0 && (
                        <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          <Star className="h-3 w-3" />
                          Lead ×{perf.leadCount}
                        </span>
                      )}
                    </div>

                    {/* Revenue highlight */}
                    <div className="mt-4 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 px-4 py-3">
                      <p className="text-xs text-violet-500 font-medium">Total Revenue Invoice Lunas</p>
                      <p className="mt-0.5 text-xl font-bold text-violet-700">{fmt(perf.totalRevenue)}</p>
                    </div>

                    {/* Job stats grid */}
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-blue-50 p-2.5 text-center">
                        <p className="text-lg font-bold text-blue-700">{perf.inProgress}</p>
                        <p className="text-[10px] text-blue-400 font-medium">Aktif</p>
                      </div>
                      <div className="rounded-xl bg-emerald-50 p-2.5 text-center">
                        <p className="text-lg font-bold text-emerald-700">{perf.completed + perf.paid}</p>
                        <p className="text-[10px] text-emerald-400 font-medium">Selesai</p>
                      </div>
                      <div className="rounded-xl bg-gray-50 p-2.5 text-center">
                        <p className="text-lg font-bold text-gray-700">{perf.total}</p>
                        <p className="text-[10px] text-gray-400 font-medium">Total</p>
                      </div>
                    </div>

                    {/* Completion rate bar */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400">Tingkat Penyelesaian</span>
                        <span className="text-xs font-semibold text-gray-600">{completionRate}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-gray-100">
                        <div
                          className="h-1.5 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all"
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Reimburse & Kasbon ───────────────────────────── */}
      {tab === "reimburse" && (
        <div className="flex flex-col gap-6">
          {/* Action bar */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Pencatatan hutang piutang sparepart &amp; kasbon per engineer
            </p>
            <QuickReimburseButton mechanics={mechanics} tenantId={tenantId} />
          </div>

          {/* Cards per mechanic */}
          {mechanics.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
              <Wrench className="mb-3 h-10 w-10 text-gray-300" />
              <p className="font-semibold text-gray-500">Belum ada engineer</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mechanics.map((mechanic) => {
                const debt = debtMap.get(mechanic.id);
                const outstanding = Math.max(0, Number(debt?.outstanding_balance ?? 0));
                const totalAdv = Number(debt?.total_advanced ?? 0);
                const totalReimb = Number(debt?.total_reimbursed ?? 0);
                const hasDebt = outstanding > 0;

                return (
                  <div
                    key={mechanic.id}
                    className={`flex flex-col rounded-2xl border bg-white p-5 shadow-sm ${
                      hasDebt ? "border-red-100" : "border-gray-100"
                    }`}
                  >
                    {/* Avatar + name */}
                    <div className="flex items-center gap-3">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(mechanic.id)}`}>
                        {initials(mechanic.full_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-gray-900">{mechanic.full_name}</p>
                        <p className="text-xs text-gray-400">Engineer</p>
                      </div>
                      {hasDebt ? (
                        <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                          <AlertCircle className="h-3 w-3" />
                          Hutang
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" />
                          Lunas
                        </span>
                      )}
                    </div>

                    {/* Outstanding balance */}
                    <div className={`mt-4 rounded-xl px-4 py-3 ${hasDebt ? "bg-red-50" : "bg-emerald-50"}`}>
                      <p className={`text-xs font-medium ${hasDebt ? "text-red-400" : "text-emerald-500"}`}>
                        Saldo Outstanding
                      </p>
                      <p className={`mt-0.5 text-xl font-bold ${hasDebt ? "text-red-600" : "text-emerald-600"}`}>
                        {hasDebt ? fmt(outstanding) : "Lunas"}
                      </p>
                    </div>

                    {/* Advance / reimbursed row */}
                    <div className="mt-3 flex gap-3">
                      <div className="flex-1 rounded-xl bg-gray-50 p-3">
                        <div className="flex items-center gap-1 mb-0.5">
                          <ArrowUp className="h-3 w-3 text-orange-400" />
                          <p className="text-xs text-gray-400">Total Advance</p>
                        </div>
                        <p className="text-sm font-bold text-orange-600">{fmt(totalAdv)}</p>
                      </div>
                      <div className="flex-1 rounded-xl bg-gray-50 p-3">
                        <div className="flex items-center gap-1 mb-0.5">
                          <ArrowDown className="h-3 w-3 text-emerald-400" />
                          <p className="text-xs text-gray-400">Sudah Dibayar</p>
                        </div>
                        <p className="text-sm font-bold text-emerald-600">{fmt(totalReimb)}</p>
                      </div>
                    </div>

                    {/* Lunasi button */}
                    {hasDebt && (
                      <div className="mt-3">
                        <LunasiButton mechanic={mechanic} allMechanics={mechanics} tenantId={tenantId} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <DebtHistoryTable initialRows={debtHistory} mechanicInfos={mechanicInfos} />
        </div>
      )}
    </div>
  );
}
