import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import { redirect } from "next/navigation";
import { AlertCircle, ArrowUp, ArrowDown } from "lucide-react";
import {
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
      .select("id, mechanic_id, transaction_type, amount, notes, is_paid, created_at, invoice_items(receipt_image_url)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const mechanics: MechanicOption[] = (mechanicsRaw ?? []).map((m) => ({
    id: m.id,
    full_name: m.full_name ?? "—",
  }));
  const mechanicNameMap = new Map(mechanics.map((m) => [m.id, m.full_name]));
  const mechanicInfos: MechanicInfo[] = mechanics.map((m) => ({
    id: m.id,
    name: m.full_name,
    color: avatarColor(m.id),
  }));

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
      is_paid: boolean;
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
        <QuickReimburseButton mechanics={mechanics} tenantId={tenantId} />
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

      <DebtHistoryTable initialRows={debtHistory} mechanicInfos={mechanicInfos} />
    </div>
  );
}
