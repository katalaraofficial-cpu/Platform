import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import Link from "next/link";
import { ChevronRight, ClipboardList, Gift, TrendingUp, ArrowDownLeft, Clock3, MessageSquareWarning, CalendarCheck2, Wallet } from "lucide-react";
import { SubmitPointClaimCard } from "@/components/mechanics/submit-point-claim-card";
import type {
  Invoice,
  Customer,
  InvoiceStatus,
  MechanicRoleInInvoice,
  EmployeePoints,
  EmployeePointTransaction,
  PointRedemptionRequest,
} from "@/types/database";

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Menunggu",
  in_progress: "Dikerjakan",
  completed: "Selesai",
  paid: "Lunas",
  cancelled: "Batal",
};

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  paid: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-600",
};

type WorkOrderRow = {
  assignmentId: string;
  mechanicRole: MechanicRoleInInvoice;
  isComplaint: boolean;
  complaintAt: string | null;
  invoice: Invoice;
  customer: Customer | null;
};

export default async function MechanicDashboard({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const tabParam = (tab ?? "").toLowerCase();
  const activeTab =
    tabParam === "attendance"
      ? "attendance"
      : tabParam === "insentif" || tabParam === "point"
        ? "insentif"
        : tabParam === "payroll"
          ? "payroll"
          : "activity";
  const activityFilter = tabParam === "all" ? "all" : "active";

  const supabase = await createClient();
  const ctx = await getUserContext();

  // 1. Fetch assignments for this mechanic
  const { data: assignments } = await supabase
    .from("invoice_mechanics")
    .select("id, mechanic_role, invoice_id, is_complaint, complaint_at")
    .eq("mechanic_id", ctx.id)
    .order("assigned_at", { ascending: false });

  let workOrders: WorkOrderRow[] = [];

  if (assignments?.length) {
    const invoiceIds = assignments.map((a) => a.invoice_id);

    // 2. Fetch invoices
    const { data: invoices } = await supabase
      .from("invoices")
      .select("*")
      .in("id", invoiceIds);

    // 3. Fetch relevant customers
    const customerIds = [
      ...new Set(
        (invoices ?? []).map((i) => i.customer_id).filter(Boolean) as string[]
      ),
    ];
    const { data: customers } = customerIds.length
      ? await supabase.from("customers").select("*").in("id", customerIds)
      : { data: [] };

    // 4. Build lookup maps
    const invoiceMap = Object.fromEntries((invoices ?? []).map((i) => [i.id, i]));
    const customerMap = Object.fromEntries((customers ?? []).map((c) => [c.id, c]));

    // 5. Compose work order rows
    workOrders = assignments
      .map((a) => {
        const invoice = invoiceMap[a.invoice_id] as Invoice | undefined;
        if (!invoice) return null;
        return {
          assignmentId: a.id,
          mechanicRole: a.mechanic_role as MechanicRoleInInvoice,
          isComplaint: Boolean((a as { is_complaint?: boolean }).is_complaint),
          complaintAt: (a as { complaint_at?: string | null }).complaint_at ?? null,
          invoice,
          customer: invoice.customer_id
            ? ((customerMap[invoice.customer_id] as Customer) ?? null)
            : null,
        };
      })
      .filter(Boolean) as WorkOrderRow[];
  }

  // 6. Filter by tab
  const activeStatuses: InvoiceStatus[] = ["draft", "in_progress"];
  const filtered =
    activityFilter === "active"
      ? workOrders.filter((wo) =>
          activeStatuses.includes(wo.invoice.status as InvoiceStatus)
        )
      : workOrders;

  const activeCount = workOrders.filter((wo) =>
    activeStatuses.includes(wo.invoice.status as InvoiceStatus)
  ).length;

  const complaintCount = workOrders.filter((wo) => wo.isComplaint).length;
  const totalWorkHours = workOrders.reduce((sum, wo) => {
    const completedAt = wo.invoice.completed_at;
    if (!completedAt) return sum;
    const start = new Date(wo.invoice.created_at).getTime();
    const end = new Date(completedAt).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return sum;
    return sum + (end - start) / 3_600_000;
  }, 0);

  // 7. Fetch employee points data if Incentive tab is active
  let employeePoints: EmployeePoints | null = null;
  let pointTransactions: EmployeePointTransaction[] = [];
  let claimRequests: PointRedemptionRequest[] = [];
  let rewardMinRedeem = 50;
  let rewardPointValue = 1000;
  if (activeTab === "insentif" && ctx.id && ctx.tenantId) {
    const [{ data: epData }, { data: txData }, { data: claimData }, { data: settingsData }] = await Promise.all([
      supabase
        .from("employee_points")
        .select("*")
        .eq("tenant_id", ctx.tenantId)
        .eq("profile_id", ctx.id)
        .single(),
      supabase
        .from("employee_point_transactions")
        .select("*")
        .eq("tenant_id", ctx.tenantId)
        .eq("profile_id", ctx.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("point_redemption_requests")
        .select("*")
        .eq("tenant_id", ctx.tenantId)
        .eq("profile_id", ctx.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("settings")
        .select("reward_point_value, reward_min_redeem")
        .eq("tenant_id", ctx.tenantId)
        .single(),
    ]);
    employeePoints = epData as EmployeePoints | null;
    pointTransactions = (txData as EmployeePointTransaction[] | null) ?? [];
    claimRequests = (claimData as PointRedemptionRequest[] | null) ?? [];
    rewardMinRedeem = Number(settingsData?.reward_min_redeem ?? 50);
    rewardPointValue = Number(settingsData?.reward_point_value ?? 1000);
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Work Order Saya</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Daftar pekerjaan yang ditugaskan
        </p>
      </div>

      {/* Tab filter */}
      <div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1">
        <Link
          href="/mechanic/dashboard?tab=activity"
          className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold transition-colors ${
            activeTab === "activity"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500"
          }`}
        >
          Log Aktivitas
          {activeCount > 0 && (
            <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </Link>
        <Link
          href="/mechanic/dashboard?tab=attendance"
          className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold transition-colors ${
            activeTab === "attendance"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500"
          }`}
        >
          Kehadiran
        </Link>
        <Link
          href="/mechanic/dashboard?tab=insentif"
          className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold transition-colors ${
            activeTab === "insentif"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500"
          }`}
        >
          Insentif
        </Link>
        <Link
          href="/mechanic/dashboard?tab=payroll"
          className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold transition-colors ${
            activeTab === "payroll"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500"
          }`}
        >
          Payroll
        </Link>
      </div>

      {activeTab === "activity" && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <Clock3 className="h-4 w-4 text-blue-500" /> Waktu Kerja
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalWorkHours.toFixed(1)} jam</p>
            <p className="mt-1 text-xs text-gray-400">Akumulasi dari pekerjaan selesai</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <MessageSquareWarning className="h-4 w-4 text-red-500" /> Komplain
            </div>
            <p className="text-2xl font-bold text-gray-900">{complaintCount}</p>
            <p className="mt-1 text-xs text-gray-400">Total komplain pada assignment kamu</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <ClipboardList className="h-4 w-4 text-emerald-500" /> Ringkasan Tugas
            </div>
            <p className="text-2xl font-bold text-gray-900">{workOrders.length}</p>
            <p className="mt-1 text-xs text-gray-400">Total assignment masuk</p>
          </div>
        </div>
      )}

      {/* Work order list only for Active/All tabs */}
      {activeTab === "activity" && (
        <>
          <div className="mb-3 flex gap-1 rounded-xl bg-gray-100 p-1">
            <Link
              href="/mechanic/dashboard?tab=activity"
              className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold transition-colors ${
                activityFilter === "active" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              Aktif
            </Link>
            <Link
              href="/mechanic/dashboard?tab=all"
              className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold transition-colors ${
                activityFilter === "all" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              Semua
            </Link>
          </div>

          {/* Empty state */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <ClipboardList className="h-6 w-6 text-gray-400" />
              </div>
              <p className="font-semibold text-gray-600">
                {activityFilter === "active"
                  ? "Tidak ada pekerjaan aktif"
                  : "Belum ada pekerjaan"}
              </p>
              <p className="mt-1 text-sm text-gray-400">
                {activityFilter === "active" ? (
                  <>
                    Semua pekerjaan sudah selesai.{" "}
                    <Link
                      href="/mechanic/dashboard?tab=all"
                      className="text-blue-600 underline"
                    >
                      Lihat riwayat
                    </Link>
                  </>
                ) : (
                  "Belum ada invoice yang ditugaskan ke kamu."
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((wo) => {
                const v = wo.customer?.vehicle_info;
                const vehicleStr = [v?.brand, v?.model, v?.plate]
                  .filter(Boolean)
                  .join(" · ");
                const status = wo.invoice.status as InvoiceStatus;
                const isActive = activeStatuses.includes(status);
                const showComplaint = wo.isComplaint && status === "completed";

                return (
                  <Link
                    key={wo.assignmentId}
                    href={`/mechanic/dashboard/${wo.invoice.id}`}
                    className="block rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all active:scale-[0.99] active:bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold text-gray-900">
                            {wo.invoice.invoice_number}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[status]}`}
                          >
                            {STATUS_LABELS[status]}
                          </span>
                          {showComplaint && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                              Komplain
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-base font-semibold text-gray-800">
                          {wo.customer?.name ?? "–"}
                        </p>
                        {vehicleStr && (
                          <p className="mt-0.5 truncate text-sm text-gray-500">
                            {vehicleStr}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-gray-400">
                          {new Date(wo.invoice.created_at).toLocaleDateString(
                            "id-ID",
                            { day: "numeric", month: "short", year: "numeric" }
                          )}
                        </p>
                        {showComplaint && (
                          <p className="mt-1 text-xs font-medium text-red-600">
                            Ada komplain dari owner untuk pekerjaan ini.
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2 pt-0.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            wo.mechanicRole === "lead"
                              ? "bg-violet-100 text-violet-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {wo.mechanicRole === "lead" ? "Lead" : "Helper"}
                        </span>
                        <ChevronRight
                          className={`h-4 w-4 ${isActive ? "text-blue-400" : "text-gray-300"}`}
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "attendance" && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center shadow-sm">
          <CalendarCheck2 className="mx-auto mb-3 h-8 w-8 text-gray-300" />
          <p className="text-base font-semibold text-gray-700">Tab Kehadiran disiapkan</p>
          <p className="mt-1 text-sm text-gray-400">Data absensi akan dihubungkan di fase berikutnya.</p>
        </div>
      )}

      {activeTab === "payroll" && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center shadow-sm">
          <Wallet className="mx-auto mb-3 h-8 w-8 text-gray-300" />
          <p className="text-base font-semibold text-gray-700">Tab Payroll disiapkan</p>
          <p className="mt-1 text-sm text-gray-400">Rencana sinkron gaji dan slip akan ditambahkan bertahap.</p>
        </div>
      )}

      {/* ── TAB: Insentif ───────────────────────────────────── */}
      {activeTab === "insentif" && (
        <div className="space-y-4">
          {/* Balance card */}
          <div className="rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 p-6 text-white shadow">
            <div className="flex items-center gap-2 mb-1">
              <Gift className="h-5 w-5 opacity-80" />
              <span className="text-sm font-semibold opacity-80">Saldo Point Kamu</span>
            </div>
            <p className="text-4xl font-bold">{employeePoints?.points_balance ?? 0} pt</p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Diperoleh</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600">{employeePoints?.total_earned ?? 0} pt</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownLeft className="h-4 w-4 text-violet-400" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Ditukar</span>
              </div>
              <p className="text-2xl font-bold text-violet-600">{employeePoints?.total_redeemed ?? 0} pt</p>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-700">
            <p className="font-semibold">Info Point</p>
            <ul className="mt-1 space-y-1 text-xs text-amber-600">
              <li>Point dihitung dari pekerjaan yang sudah ditagihkan.</li>
              <li>Point bisa ditukar saat melakukan pengajuan klaim/redeem.</li>
              <li>Approval pencairan dilakukan oleh Owner.</li>
            </ul>
          </div>

          <SubmitPointClaimCard
            currentBalance={Number(employeePoints?.points_balance ?? 0)}
            minRedeem={rewardMinRedeem}
            pointValue={rewardPointValue}
          />

          <div>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-700">
              Status Pengajuan Klaim
            </h2>
            {claimRequests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-5 text-center text-xs text-gray-400">
                Belum ada pengajuan klaim point.
              </div>
            ) : (
              <div className="space-y-2">
                {claimRequests.map((req) => {
                  const statusClass =
                    req.status === "approved"
                      ? "bg-emerald-100 text-emerald-700"
                      : req.status === "rejected"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700";

                  return (
                    <div
                      key={req.id}
                      className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-800">
                          {req.points} point · Rp {Math.round(Number(req.payout_amount)).toLocaleString("id-ID")}
                        </p>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${statusClass}`}>
                          {req.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {new Date(req.created_at).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                      {req.notes && <p className="mt-1 text-xs text-gray-500">{req.notes}</p>}
                      {req.review_note && (
                        <p className="mt-1 text-xs text-gray-500">Catatan owner: {req.review_note}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Transaction history */}
          <div>
            <h2 className="mb-3 text-sm font-bold text-gray-700 uppercase tracking-wider">Riwayat Point</h2>
            {pointTransactions.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Gift className="mb-3 h-10 w-10 text-gray-200" />
                <p className="text-sm font-semibold text-gray-400">Belum ada riwayat point</p>
                <p className="text-xs text-gray-300 mt-1">Point diperoleh saat invoice lunas dibayar</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pointTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-800">{tx.notes ?? tx.transaction_type}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(tx.created_at).toLocaleDateString("id-ID", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                        {tx.expires_at && (
                          <span className="ml-2 text-amber-400">· berlaku s/d {new Date(tx.expires_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                        )}
                      </p>
                    </div>
                    <span className={`ml-3 text-base font-bold ${tx.points > 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {tx.points > 0 ? "+" : ""}{tx.points} pt
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

