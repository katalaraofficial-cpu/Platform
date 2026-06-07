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
  Gift,
  MessageSquareWarning,
  CalendarCheck2,
} from "lucide-react";
import {
  LunasiButton,
  type MechanicOption,
} from "@/components/mechanics/reimburse-modal";
import {
  DebtHistoryTable,
  type MechanicInfo,
} from "@/components/mechanics/debt-history-table";
import { PointClaimReviewList } from "@/components/mechanics/point-claim-review-list";
import { summarizeEmployeePointsByProfile, type PointTransactionSummaryRow } from "@/lib/employee-point-summary";

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
type SearchParams = Promise<{ tab?: string; view?: string }>;

export default async function MechanicsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = await getUserContext();
  if (!ctx.tenantId || ctx.role !== "owner") redirect("/owner/dashboard");

  const sp = await searchParams;
  const tab = sp.tab === "reimburse" ? "reimburse" : "performa";
  const ownerView =
    sp.view === "attendance"
      ? "attendance"
      : sp.view === "insentif"
        ? "insentif"
        : sp.view === "payroll"
          ? "payroll"
          : "activity";

  const supabase = await createClient();
  const tenantId = ctx.tenantId;

  // ── Parallel data fetch ──────────────────────────────────────
  const [
    { data: mechanicsRaw },
    { data: debtSummaryRaw },
    { data: invoiceMechanicsRaw },
    { data: debtHistoryRaw },
    { data: employeePointTransactionsRaw },
    { data: settingsRaw },
    { data: pendingClaimsRaw },
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
      .select("invoice_id, mechanic_id, mechanic_role, is_complaint, invoices(status, grand_total, created_at, completed_at)")
      .eq("tenant_id", tenantId),

    supabase
      .from("mechanic_debt_ledger")
      .select("id, mechanic_id, transaction_type, invoice_item_id, amount, notes, is_paid, created_at, receipt_image_url, invoice_items(receipt_image_url)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(500),

    supabase
      .from("employee_point_transactions")
      .select("profile_id, points, transaction_type")
      .eq("tenant_id", tenantId),

    supabase
      .from("settings")
      .select("reward_employee_enabled, reward_point_value, reward_min_redeem, reward_spend_per_point, reward_lead_multiplier, reward_helper_multiplier")
      .eq("tenant_id", tenantId)
      .single(),

    supabase
      .from("point_redemption_requests")
      .select("id, profile_id, points, payout_amount, notes, created_at")
      .eq("tenant_id", tenantId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(100),
  ]);

  // ── Derived data ─────────────────────────────────────────────
  const mechanics: MechanicOption[] = (mechanicsRaw ?? []).map((m) => ({
    id: m.id,
    full_name: m.full_name ?? "—",
  }));
  const mechanicNameMap = new Map(mechanics.map((m) => [m.id, m.full_name]));

  const pendingClaims = ((pendingClaimsRaw as {
    id: string;
    profile_id: string;
    points: number;
    payout_amount: number;
    notes: string | null;
    created_at: string;
  }[] | null) ?? []).map((c) => ({
    id: c.id,
    profileId: c.profile_id,
    mechanicName: mechanicNameMap.get(c.profile_id) ?? "Engineer",
    points: Number(c.points ?? 0),
    payoutAmount: Number(c.payout_amount ?? 0),
    notes: c.notes,
    createdAt: c.created_at,
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
  type InvRow = {
    invoice_id: string;
    mechanic_id: string;
    mechanic_role: string;
    is_complaint?: boolean;
    invoices: { status: string; grand_total: number; created_at: string; completed_at: string | null } | null;
  };
  const allAssignments = (invoiceMechanicsRaw as InvRow[] | null) ?? [];

  const paidInvoiceIds = [
    ...new Set(
      allAssignments
        .filter((row) => row.invoices?.status === "paid")
        .map((row) => row.invoice_id)
        .filter(Boolean)
    ),
  ];

  const pointTxRows = (employeePointTransactionsRaw as PointTransactionSummaryRow[] | null) ?? [];

  // Global point summary remains available in the incentive tab.
  const pointsMap = summarizeEmployeePointsByProfile(pointTxRows);
  const rewardEnabled = settingsRaw?.reward_employee_enabled ?? false;

  const { data: paidItemsRaw } = paidInvoiceIds.length
    ? await supabase
        .from("invoice_items")
        .select("invoice_id, item_type, final_price")
        .eq("tenant_id", tenantId)
        .in("invoice_id", paidInvoiceIds)
    : { data: [] as { invoice_id: string; item_type: string; final_price: number }[] };

  const revenueByInvoice = new Map<string, { service: number; material: number }>();
  for (const item of paidItemsRaw ?? []) {
    const prev = revenueByInvoice.get(item.invoice_id) ?? { service: 0, material: 0 };
    const lineTotal = Number(item.final_price ?? 0);
    if (item.item_type === "service") prev.service += lineTotal;
    else prev.material += lineTotal;
    revenueByInvoice.set(item.invoice_id, prev);
  }

  type PerfData = {
    total: number;
    inProgress: number;
    completed: number;
    paid: number;
    leadCount: number;
    helperCount: number;
    revenueService: number;
    revenueMaterial: number;
    complaintCount: number;
    workHours: number;
    attendancePct: number | null;
  };
  const perfMap = new Map<string, PerfData>();
  for (const row of allAssignments) {
    const inv = row.invoices;
    if (!inv) continue;
    const prev = perfMap.get(row.mechanic_id) ?? {
      total: 0,
      inProgress: 0,
      completed: 0,
      paid: 0,
      leadCount: 0,
      helperCount: 0,
      revenueService: 0,
      revenueMaterial: 0,
      complaintCount: 0,
      workHours: 0,
      attendancePct: null,
    };
    prev.total++;
    if (inv.status === "in_progress") prev.inProgress++;
    if (inv.status === "completed") prev.completed++;
    if (inv.status === "paid") {
      prev.paid++;
      const rev = revenueByInvoice.get(row.invoice_id);
      prev.revenueService += rev?.service ?? 0;
      prev.revenueMaterial += rev?.material ?? 0;
    }
    if (row.mechanic_role === "lead") prev.leadCount++;
    if (row.mechanic_role === "helper") prev.helperCount++;
    if (row.is_complaint) prev.complaintCount++;
    if (inv.completed_at) {
      const startedAt = new Date(inv.created_at).getTime();
      const completedAt = new Date(inv.completed_at).getTime();
      if (!Number.isNaN(startedAt) && !Number.isNaN(completedAt) && completedAt > startedAt) {
        prev.workHours += (completedAt - startedAt) / 3_600_000;
      }
    }
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
  const totalRevenueAll = [...perfMap.values()].reduce(
    (s, p) => s + p.revenueService + p.revenueMaterial,
    0
  );

  const debtHistory = (
    debtHistoryRaw as {
      id: string;
      mechanic_id: string;
      transaction_type: string;
      invoice_item_id: string | null;
      amount: number;
      notes: string | null;
      is_paid: boolean;
      created_at: string;
      receipt_image_url: string | null;
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

      {tab === "performa" && (
        <>
          <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 w-fit">
            {(
              [
                ["activity", "Log Aktivitas"],
                ["attendance", "Kehadiran"],
                ["insentif", "Insentif"],
                ["payroll", "Payroll"],
              ] as const
            ).map(([val, label]) => (
              <a
                key={val}
                href={`/owner/mechanics?tab=performa&view=${val}`}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  ownerView === val
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
              </a>
            ))}
          </div>

          {ownerView === "insentif" && <PointClaimReviewList claims={pendingClaims} />}
        </>
      )}

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
                  total: 0,
                  inProgress: 0,
                  completed: 0,
                  paid: 0,
                  leadCount: 0,
                  helperCount: 0,
                  revenueService: 0,
                  revenueMaterial: 0,
                  complaintCount: 0,
                  workHours: 0,
                  attendancePct: null,
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
                      <div className="flex flex-col items-end gap-1">
                        {perf.leadCount > 0 && (
                          <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                            <Star className="h-3 w-3" />
                            Lead ×{perf.leadCount}
                          </span>
                        )}
                        {perf.helperCount > 0 && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            Helper ×{perf.helperCount}
                          </span>
                        )}
                      </div>
                    </div>

                    {ownerView === "activity" && (
                      <div className="mt-4 space-y-3">
                        <div className="rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 px-4 py-3">
                          <p className="text-xs font-medium text-violet-500">Revenue Invoice Lunas</p>
                          <div className="mt-1 grid grid-cols-2 gap-2">
                            <div className="rounded-lg bg-white/60 px-2.5 py-2">
                              <p className="text-[10px] uppercase tracking-wider text-violet-400">Jasa</p>
                              <p className="text-sm font-bold text-violet-700">{fmt(perf.revenueService)}</p>
                            </div>
                            <div className="rounded-lg bg-white/60 px-2.5 py-2">
                              <p className="text-[10px] uppercase tracking-wider text-violet-400">Barang/Material</p>
                              <p className="text-sm font-bold text-violet-700">{fmt(perf.revenueMaterial)}</p>
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-violet-500">
                            Total: <span className="font-semibold">{fmt(perf.revenueService + perf.revenueMaterial)}</span>
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-xl bg-blue-50 p-3">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-blue-400">Estimasi Durasi Invoice</p>
                            <p className="mt-1 text-lg font-bold text-blue-700">-</p>
                          </div>
                          <div className="rounded-xl bg-rose-50 p-3">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-rose-400">Komplain</p>
                            <p className="mt-1 text-lg font-bold text-rose-600">{perf.complaintCount}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {ownerView === "attendance" && (
                      <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3">
                        <p className="text-xs font-medium text-amber-500">Kehadiran</p>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <div className="rounded-lg bg-white/70 px-2.5 py-2 text-center">
                            <p className="text-lg font-bold text-amber-700">{perf.total}</p>
                            <p className="text-[10px] text-amber-500">Assignment</p>
                          </div>
                          <div className="rounded-lg bg-white/70 px-2.5 py-2 text-center">
                            <p className="text-lg font-bold text-amber-700">-</p>
                            <p className="text-[10px] text-amber-500">Estimasi Jam Invoice</p>
                          </div>
                          <div className="rounded-lg bg-white/70 px-2.5 py-2 text-center">
                            <p className="text-lg font-bold text-amber-700">-</p>
                            <p className="text-[10px] text-amber-500">Absensi</p>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-amber-500">Sinkron absensi belum dihubungkan. Nilai jam di atas adalah estimasi dari selisih waktu invoice dibuat hingga selesai.</p>
                      </div>
                    )}

                    {ownerView === "insentif" && (
                      <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3">
                        <p className="text-xs font-medium text-amber-600">Insentif & Point</p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <div className="rounded-lg bg-white/70 px-2.5 py-2">
                            <p className="text-[10px] uppercase tracking-wider text-amber-400">Saldo Point Global</p>
                            <p className="text-sm font-bold text-amber-700">{pointsMap.get(mechanic.id)?.points_balance ?? 0} pt</p>
                          </div>
                          <div className="rounded-lg bg-white/70 px-2.5 py-2">
                            <p className="text-[10px] uppercase tracking-wider text-amber-400">Total Earned Global</p>
                            <p className="text-sm font-bold text-amber-700">{pointsMap.get(mechanic.id)?.total_earned ?? 0} pt</p>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-amber-500">Review klaim point tersedia di panel approval owner.</p>
                      </div>
                    )}

                    {ownerView === "payroll" && (
                      <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
                        <p className="text-xs font-medium text-slate-500">Payroll Draft</p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <div className="rounded-lg bg-white px-2.5 py-2">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400">Revenue Basis</p>
                            <p className="text-sm font-bold text-slate-700">{fmt(perf.revenueService + perf.revenueMaterial)}</p>
                          </div>
                          <div className="rounded-lg bg-white px-2.5 py-2">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400">Status</p>
                            <p className="text-sm font-bold text-slate-700">Draft</p>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-slate-400">Tab payroll masih tahap persiapan, belum tersinkron ke slip gaji.</p>
                      </div>
                    )}

                    {/* Job stats grid */}
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
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
                      <div className="rounded-xl bg-rose-50 p-2.5 text-center">
                        <p className="text-lg font-bold text-rose-600">{perf.complaintCount}</p>
                        <p className="inline-flex items-center gap-1 text-[10px] font-medium text-rose-400">
                          <MessageSquareWarning className="h-3 w-3" />
                          Komplain
                        </p>
                      </div>
                      <div className="rounded-xl bg-amber-50 p-2.5 text-center">
                        <p className="text-lg font-bold text-amber-600">
                          {perf.attendancePct === null ? "-" : `${perf.attendancePct}%`}
                        </p>
                        <p className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-500">
                          <CalendarCheck2 className="h-3 w-3" />
                          Kehadiran
                        </p>
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

                    {/* Point reward section */}
                    {rewardEnabled && ownerView !== "insentif" && (() => {
                      const ep = pointsMap.get(mechanic.id);
                      return (
                        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Gift className="h-4 w-4 text-amber-500" />
                            <div>
                              <p className="text-xs font-semibold text-amber-700">- Point Invoice Lunas</p>
                              <p className="text-[10px] text-amber-400">
                                Saldo global: {ep?.points_balance ?? 0} · Redeemed: {ep?.total_redeemed ?? 0} · menunggu aktivasi KPI
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
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
                        <LunasiButton mechanic={mechanic} allMechanics={mechanics} tenantId={tenantId} outstanding={outstanding} />
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
