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
import { AttendanceRecapTable } from "@/components/mechanics/attendance-recap-table";
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
type SearchParams = Promise<{
  tab?: string;
  view?: string;
  week?: string;
  period?: string;
  date?: string;
  month?: string;
  year?: string;
}>;

export default async function MechanicsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = await getUserContext();
  if (!ctx.tenantId || ctx.role !== "owner") redirect("/owner/dashboard");

  const sp = await searchParams;
  const tab = sp.tab === "reimburse" ? "reimburse" : "performa";
  const attendanceEnabled = ctx.featureToggles?.module_attendance === true;
  const ownerView =
    sp.view === "attendance"
      ? "attendance"
      : sp.view === "rekap" && attendanceEnabled
        ? "rekap"
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

  // ── Attendance (bulan berjalan, WIB) ─────────────────────────
  const jakartaNow = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const todayStr = jakartaNow; // YYYY-MM-DD
  const monthStartStr = todayStr.slice(0, 8) + "01";
  const elapsedDays = Number(todayStr.slice(8, 10)) || 1;

  const { data: attendanceRaw } = await supabase
    .from("attendance_records")
    .select("profile_id, attendance_date, check_in_at, check_out_at, mode, status")
    .eq("tenant_id", tenantId)
    .gte("attendance_date", monthStartStr)
    .lte("attendance_date", todayStr);

  type AttRow = {
    profile_id: string;
    attendance_date: string;
    check_in_at: string;
    check_out_at: string;
    mode: string;
    status: string;
  };
  const attRows = (attendanceRaw as AttRow[] | null) ?? [];
  type AttStat = { presentDays: number; today: AttRow | null };
  const attendanceMap = new Map<string, AttStat>();
  for (const r of attRows) {
    const prev = attendanceMap.get(r.profile_id) ?? { presentDays: 0, today: null };
    if (r.status === "present") prev.presentDays++;
    if (r.attendance_date === todayStr) prev.today = r;
    attendanceMap.set(r.profile_id, prev);
  }
  // Isi attendancePct ke perfMap.
  for (const m of mechanics) {
    const stat = attendanceMap.get(m.id);
    const perf = perfMap.get(m.id);
    if (perf) {
      perf.attendancePct =
        stat && elapsedDays > 0
          ? Math.min(100, Math.round((stat.presentDays / elapsedDays) * 100))
          : 0;
    }
  }

  // ── Rekap kehadiran (week/date/month/year) ───────────────────
  type RecapRec = {
    id: string;
    profile_id: string;
    attendance_date: string;
    check_in_at: string;
    check_out_at: string;
    status: string;
    mode: string;
  };
  let recapRecords: RecapRec[] = [];
  let weekDays: { date: string; dayLabel: string; dateLabel: string }[] = [];
  let prevWeekStr = "";
  let nextWeekStr = "";
  let weekRangeLabel = "";
  const periodMode: "week" | "date" | "month" | "year" =
    sp.period === "date" || sp.period === "month" || sp.period === "year"
      ? sp.period
      : "week";
  const periodDate = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : todayStr;
  const periodMonth = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : todayStr.slice(0, 7);
  const periodYear = /^\d{4}$/.test(sp.year ?? "") ? sp.year! : todayStr.slice(0, 4);
  if (ownerView === "rekap") {
    const dayNames = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
    const isoDate = (d: Date) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);

    let rangeStart = todayStr;
    let rangeEnd = todayStr;
    if (periodMode === "week") {
      const baseStr = /^\d{4}-\d{2}-\d{2}$/.test(sp.week ?? "") ? sp.week! : todayStr;
      const base = new Date(`${baseStr}T00:00:00+07:00`);
      const dow = (base.getUTCDay() + 6) % 7; // 0 = Senin
      const monday = new Date(base.getTime() - dow * 86_400_000);
      weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday.getTime() + i * 86_400_000);
        return {
          date: isoDate(d),
          dayLabel: dayNames[i],
          dateLabel: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`,
        };
      });
      prevWeekStr = isoDate(new Date(monday.getTime() - 7 * 86_400_000));
      nextWeekStr = isoDate(new Date(monday.getTime() + 7 * 86_400_000));
      weekRangeLabel = `${weekDays[0].dateLabel} – ${weekDays[6].dateLabel}`;
      rangeStart = weekDays[0].date;
      rangeEnd = weekDays[6].date;
    } else if (periodMode === "date") {
      weekDays = [{ date: periodDate, dayLabel: "Hari", dateLabel: periodDate }];
      weekRangeLabel = `Tanggal ${periodDate}`;
      prevWeekStr = isoDate(new Date(new Date(`${periodDate}T00:00:00+07:00`).getTime() - 86_400_000));
      nextWeekStr = isoDate(new Date(new Date(`${periodDate}T00:00:00+07:00`).getTime() + 86_400_000));
      rangeStart = periodDate;
      rangeEnd = periodDate;
    } else if (periodMode === "month") {
      const [y, m] = periodMonth.split("-").map(Number);
      const start = `${periodMonth}-01`;
      const end = isoDate(new Date(Date.UTC(y, m, 0))); // hari terakhir bulan
      weekRangeLabel = `Bulan ${periodMonth}`;
      const prevM = new Date(Date.UTC(y, m - 2, 1));
      const nextM = new Date(Date.UTC(y, m, 1));
      prevWeekStr = `${prevM.getUTCFullYear()}-${String(prevM.getUTCMonth() + 1).padStart(2, "0")}`;
      nextWeekStr = `${nextM.getUTCFullYear()}-${String(nextM.getUTCMonth() + 1).padStart(2, "0")}`;
      rangeStart = start;
      rangeEnd = end;
    } else {
      const start = `${periodYear}-01-01`;
      const end = `${periodYear}-12-31`;
      weekRangeLabel = `Tahun ${periodYear}`;
      prevWeekStr = String(Number(periodYear) - 1);
      nextWeekStr = String(Number(periodYear) + 1);
      rangeStart = start;
      rangeEnd = end;
    }

    const { data: recapRaw } = await supabase
      .from("attendance_records")
      .select("id, profile_id, attendance_date, check_in_at, check_out_at, status, mode")
      .eq("tenant_id", tenantId)
      .gte("attendance_date", rangeStart)
      .lte("attendance_date", rangeEnd);
    recapRecords = (recapRaw as RecapRec[] | null) ?? [];
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="min-w-0 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Users className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-wider text-gray-500">Total Engineer</span>
          </div>
          <p className="truncate text-3xl font-bold text-gray-900 tabular-nums">{mechanics.length}</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 shrink-0 text-violet-400" />
            <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-wider text-gray-500">Total Revenue</span>
          </div>
          <p className="truncate text-xl font-bold text-violet-600 tabular-nums sm:text-2xl" title={fmt(totalRevenueAll)}>{fmt(totalRevenueAll)}</p>
          <p className="mt-1 truncate text-xs text-gray-400">dari invoice lunas</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Wallet className="h-4 w-4 shrink-0 text-red-400" />
            <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-wider text-gray-500">Hutang Belum Bayar</span>
          </div>
          <p className="truncate text-xl font-bold text-red-600 tabular-nums sm:text-2xl" title={fmt(totalOutstanding)}>{fmt(totalOutstanding)}</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
            <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-wider text-gray-500">Belum Lunas</span>
          </div>
          <p className="truncate text-3xl font-bold text-amber-600 tabular-nums">{mechanicsWithDebt}</p>
          <p className="mt-1 truncate text-xs text-gray-400">dari {mechanics.length} engineer</p>
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
                ...(attendanceEnabled ? [["rekap", "Rekap Kehadiran"]] : []),
                ["insentif", "Insentif"],
                ["payroll", "Payroll"],
              ] as [string, string][]
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
          {ownerView === "rekap" && (
            <AttendanceRecapTable
              engineers={mechanics.map((m) => ({ id: m.id, name: m.full_name }))}
              records={recapRecords}
              weekDays={weekDays}
              periodMode={periodMode}
              periodDate={periodDate}
              periodMonth={periodMonth}
              periodYear={periodYear}
              prevWeek={prevWeekStr}
              nextWeek={nextWeekStr}
              weekRangeLabel={weekRangeLabel}
            />
          )}
        </>
      )}

      {/* ── TAB: Performa Mekanik ─────────────────────────────── */}
      {tab === "performa" && ownerView !== "rekap" && (
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
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {perf.leadCount > 0 && (
                          <span className="flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                            <Star className="h-3 w-3 shrink-0" />
                            Lead ×{perf.leadCount}
                          </span>
                        )}
                        {perf.helperCount > 0 && (
                          <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
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

                    {ownerView === "attendance" && (() => {
                      const att = attendanceMap.get(mechanic.id);
                      const today = att?.today ?? null;
                      const fmtT = (iso: string) =>
                        new Date(iso).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Asia/Jakarta",
                        });
                      return (
                        <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-amber-600">Kehadiran Bulan Ini</p>
                            {today ? (
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                today.mode === "field"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}>
                                {today.mode === "field" ? "Lapangan" : "Hadir"}
                              </span>
                            ) : (
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                                Belum absen
                              </span>
                            )}
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            <div className="rounded-lg bg-white/70 px-2.5 py-2 text-center">
                              <p className="text-lg font-bold text-amber-700">{att?.presentDays ?? 0}</p>
                              <p className="text-[10px] text-amber-500">Hari Hadir</p>
                            </div>
                            <div className="rounded-lg bg-white/70 px-2.5 py-2 text-center">
                              <p className="text-lg font-bold text-amber-700">
                                {perf.attendancePct === null ? "-" : `${perf.attendancePct}%`}
                              </p>
                              <p className="text-[10px] text-amber-500">Persentase</p>
                            </div>
                            <div className="rounded-lg bg-white/70 px-2.5 py-2 text-center">
                              <p className="text-sm font-bold text-amber-700 tabular-nums">
                                {today ? fmtT(today.check_in_at) : "—"}
                              </p>
                              <p className="text-[10px] text-amber-500">Masuk Hari Ini</p>
                            </div>
                          </div>
                          {today && (
                            <p className="mt-2 text-xs text-amber-500">
                              Keluar otomatis: {fmtT(today.check_out_at)} · dari {elapsedDays} hari berjalan
                            </p>
                          )}
                        </div>
                      );
                    })()}

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
                    <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                      <div className="min-w-0 rounded-xl bg-blue-50 p-2 text-center">
                        <p className="text-lg font-bold text-blue-700 tabular-nums">{perf.inProgress}</p>
                        <p className="truncate text-[10px] font-medium text-blue-400">Aktif</p>
                      </div>
                      <div className="min-w-0 rounded-xl bg-emerald-50 p-2 text-center">
                        <p className="text-lg font-bold text-emerald-700 tabular-nums">{perf.completed + perf.paid}</p>
                        <p className="truncate text-[10px] font-medium text-emerald-400">Selesai</p>
                      </div>
                      <div className="min-w-0 rounded-xl bg-gray-50 p-2 text-center">
                        <p className="text-lg font-bold text-gray-700 tabular-nums">{perf.total}</p>
                        <p className="truncate text-[10px] font-medium text-gray-400">Total</p>
                      </div>
                      <div className="min-w-0 rounded-xl bg-rose-50 p-2 text-center">
                        <p className="text-lg font-bold text-rose-600 tabular-nums">{perf.complaintCount}</p>
                        <p className="flex items-center justify-center gap-0.5 text-[10px] font-medium text-rose-400">
                          <MessageSquareWarning className="h-3 w-3 shrink-0" />
                          <span className="truncate">Komplain</span>
                        </p>
                      </div>
                      <div className="min-w-0 rounded-xl bg-amber-50 p-2 text-center">
                        <p className="text-lg font-bold text-amber-600 tabular-nums">
                          {perf.attendancePct === null ? "-" : `${perf.attendancePct}%`}
                        </p>
                        <p className="flex items-center justify-center gap-0.5 text-[10px] font-medium text-amber-500">
                          <CalendarCheck2 className="h-3 w-3 shrink-0" />
                          <span className="truncate">Kehadiran</span>
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
