import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import Link from "next/link";
import { DollarSign, TrendingUp, FileText, Clock, Wallet, Users } from "lucide-react";

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

function fmtShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}rb`;
  return String(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

// â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex h-28 items-end gap-1.5">
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[9px] font-medium text-gray-500">
            {d.value > 0 ? fmtShort(d.value) : ""}
          </span>
          <div
            className="w-full rounded-t bg-blue-400 transition-all"
            style={{ height: `${Math.max((d.value / max) * 100, d.value > 0 ? 4 : 0)}%` }}
          />
          <span className="text-[9px] text-gray-400">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({
  segments,
}: {
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((s, d) => s + d.value, 0);
  const r = 40;
  const cx = 50;
  const cy = 50;
  const circ = 2 * Math.PI * r;

  if (total === 0) {
    return (
      <div className="flex h-[100px] w-[100px] items-center justify-center rounded-full bg-gray-100">
        <span className="text-xs text-gray-400">â€”</span>
      </div>
    );
  }

  let cumulative = 0;
  const arcs = segments.map((seg) => {
    const dash = (seg.value / total) * circ;
    const offset = -cumulative;
    cumulative += dash;
    return { ...seg, dash, offset };
  });

  return (
    <svg viewBox="0 0 100 100" width="100" height="100">
      {arcs.map((arc) => (
        <circle
          key={arc.label}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={arc.color}
          strokeWidth="18"
          strokeDasharray={`${arc.dash} ${circ - arc.dash}`}
          strokeDashoffset={arc.offset}
          transform="rotate(-90 50 50)"
        />
      ))}
      <circle cx={cx} cy={cy} r="28" fill="white" />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="11"
        fontWeight="bold"
        fill="#374151"
      >
        {total}
      </text>
    </svg>
  );
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_progress: "Proses",
  completed: "Selesai",
  paid: "Lunas",
};
const STATUS_CLASS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  paid: "bg-emerald-100 text-emerald-700",
};

// â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default async function OwnerDashboard() {
  const supabase = await createClient();
  const ctx = await getUserContext();
  const tenantId = ctx.tenantId!;

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

  const [
    { data: invoicesMonth },
    { data: recentRaw },
    { data: paidHistory },
    { data: ledgerMonth },
    { data: debtUnpaid },
    { data: itemsMonth },
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, status, grand_total, paid_at, customer_id")
      .eq("tenant_id", tenantId)
      .gte("created_at", firstOfMonth),
    supabase
      .from("invoices")
      .select("id, invoice_number, customer_id, status, grand_total, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(7),
    supabase
      .from("invoices")
      .select("grand_total, paid_at")
      .eq("tenant_id", tenantId)
      .eq("status", "paid")
      .gte("paid_at", sixMonthsAgo)
      .not("paid_at", "is", null),
    supabase
      .from("ledger")
      .select("transaction_type, amount")
      .eq("tenant_id", tenantId)
      .gte("created_at", firstOfMonth),
    supabase
      .from("mechanic_debt_ledger")
      .select("amount")
      .eq("tenant_id", tenantId)
      .eq("is_paid", false),
    supabase
      .from("invoice_items")
      .select("item_type")
      .eq("tenant_id", tenantId)
      .gte("created_at", firstOfMonth),
  ]);

  // â”€â”€ Fetch customer names â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const allCustomerIds = [
    ...new Set([
      ...(invoicesMonth ?? []).map((i) => i.customer_id).filter(Boolean),
      ...(recentRaw ?? []).map((i) => i.customer_id).filter(Boolean),
    ]),
  ] as string[];

  const customerMap = new Map<string, string>();
  if (allCustomerIds.length > 0) {
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name")
      .in("id", allCustomerIds);
    (customers ?? []).forEach((c) => customerMap.set(c.id, c.name));
  }

  // â”€â”€ Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const all = invoicesMonth ?? [];

  const monthRevenue = all
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + (i.grand_total ?? 0), 0);

  const todayRevenue = all
    .filter((i) => i.status === "paid" && i.paid_at && i.paid_at >= todayStart)
    .reduce((s, i) => s + (i.grand_total ?? 0), 0);

  const countByStatus = ["draft", "in_progress", "completed", "paid"].reduce<
    Record<string, number>
  >((acc, s) => {
    acc[s] = all.filter((i) => i.status === s).length;
    return acc;
  }, {});

  // â”€â”€ Kas summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const kas = (ledgerMonth ?? []).reduce(
    (acc, e) => {
      if (e.transaction_type === "kas_masuk") acc.masuk += e.amount;
      else acc.keluar += e.amount;
      return acc;
    },
    { masuk: 0, keluar: 0 }
  );

  // â”€â”€ Mechanic debt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const totalDebt = (debtUnpaid ?? []).reduce((s, e) => s + e.amount, 0);

  // â”€â”€ Monthly revenue bar chart (last 6 months) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("id-ID", { month: "short" }),
    };
  });
  const revenueByMonth = months.map((m) => ({
    label: m.label,
    value: (paidHistory ?? [])
      .filter((inv) => inv.paid_at?.startsWith(m.key))
      .reduce((s, inv) => s + (inv.grand_total ?? 0), 0),
  }));

  // â”€â”€ Donut: job type breakdown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const itemTypeCounts = (itemsMonth ?? []).reduce<Record<string, number>>(
    (acc, i) => {
      acc[i.item_type] = (acc[i.item_type] ?? 0) + 1;
      return acc;
    },
    {}
  );
  const donutSegments = [
    { label: "Jasa", value: itemTypeCounts.service ?? 0, color: "#3B82F6" },
    { label: "Part Internal", value: itemTypeCounts.part_internal ?? 0, color: "#10B981" },
    { label: "Part External", value: itemTypeCounts.part_external ?? 0, color: "#F59E0B" },
  ];

  // â”€â”€ Top 5 customers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const custCount = all.reduce<Record<string, { count: number; revenue: number }>>(
    (acc, inv) => {
      if (!inv.customer_id) return acc;
      if (!acc[inv.customer_id]) acc[inv.customer_id] = { count: 0, revenue: 0 };
      acc[inv.customer_id].count += 1;
      acc[inv.customer_id].revenue += inv.grand_total ?? 0;
      return acc;
    },
    {}
  );
  const topCustomers = Object.entries(custCount)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 5)
    .map(([id, data]) => ({
      id,
      name: customerMap.get(id) ?? "â€”",
      count: data.count,
      revenue: data.revenue,
    }));

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Pemilik</h1>
        <p className="mt-1 text-sm text-gray-500">
          Ringkasan keuangan dan operasional bengkel â€”{" "}
          {now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "Pendapatan Hari Ini",
            value: fmt(todayRevenue),
            icon: <DollarSign className="h-5 w-5 text-green-400" />,
            color: "text-green-700",
          },
          {
            label: "Pendapatan Bulan Ini",
            value: fmt(monthRevenue),
            icon: <TrendingUp className="h-5 w-5 text-blue-400" />,
            color: "text-blue-700",
          },
          {
            label: "Invoice Aktif",
            value: (countByStatus.draft ?? 0) + (countByStatus.in_progress ?? 0),
            icon: <Clock className="h-5 w-5 text-yellow-400" />,
            color: "text-yellow-700",
          },
          {
            label: "Total Invoice Bulan Ini",
            value: all.length,
            icon: <FileText className="h-5 w-5 text-slate-400" />,
            color: "text-slate-700",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs text-gray-500">{s.label}</p>
              {s.icon}
            </div>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-4 gap-3">
        {(["draft", "in_progress", "completed", "paid"] as const).map((s) => (
          <div
            key={s}
            className="rounded-lg border border-gray-200 bg-white p-4 text-center"
          >
            <span
              className={`mb-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[s]}`}
            >
              {STATUS_LABEL[s]}
            </span>
            <p className="text-2xl font-bold text-gray-900">{countByStatus[s] ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Kas + Piutang */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Kas bulan ini */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Kas Bulan Ini</h2>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Kas Masuk</span>
              <span className="font-semibold text-green-700">{fmt(kas.masuk)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Kas Keluar</span>
              <span className="font-semibold text-red-600">{fmt(kas.keluar)}</span>
            </div>
            <div className="mt-2 border-t border-gray-100 pt-2 flex justify-between text-sm font-bold">
              <span className="text-gray-700">Selisih Bersih</span>
              <span className={kas.masuk - kas.keluar >= 0 ? "text-green-700" : "text-red-600"}>
                {fmt(kas.masuk - kas.keluar)}
              </span>
            </div>
          </div>
        </div>

        {/* Piutang mekanik */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Piutang Mekanik</h2>
          </div>
          <p className="text-3xl font-bold text-amber-600">{fmt(totalDebt)}</p>
          <p className="mt-1 text-xs text-gray-400">Total belum dibayar ke mekanik</p>
          <Link
            href="/owner/mechanics"
            className="mt-3 inline-block text-xs text-blue-600 hover:text-blue-500"
          >
            Lihat detail â†’
          </Link>
        </div>
      </div>

      {/* Bar chart + Top customers */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Monthly revenue bar chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">
            Pendapatan 6 Bulan Terakhir
          </h2>
          <BarChart data={revenueByMonth} />
        </div>

        {/* Top customers */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">
            Top Pelanggan Bulan Ini
          </h2>
          {topCustomers.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              Belum ada data pelanggan bulan ini.
            </p>
          ) : (
            <ul className="space-y-2">
              {topCustomers.map((c, i) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-800">{c.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-gray-700">{c.count} order</p>
                    <p className="text-[10px] text-gray-400">{fmt(c.revenue)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Donut chart */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">
          Komposisi Item Pekerjaan Bulan Ini
        </h2>
        <div className="flex items-center gap-8">
          <DonutChart segments={donutSegments} />
          <ul className="space-y-3">
            {donutSegments.map((seg) => (
              <li key={seg.label} className="flex items-center gap-2.5">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-sm text-gray-600">{seg.label}</span>
                <span className="ml-auto pl-4 text-sm font-bold text-gray-800">
                  {seg.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Recent invoices */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Invoice Terbaru</h2>
          <Link
            href="/owner/invoices"
            className="text-sm text-blue-600 hover:text-blue-500"
          >
            Lihat semua â†’
          </Link>
        </div>
        {!recentRaw || recentRaw.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">Belum ada invoice</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3 text-left">No. Invoice</th>
                  <th className="px-5 py-3 text-left">Pelanggan</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-left">Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {recentRaw.map((inv) => (
                  <tr
                    key={inv.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={undefined}
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/owner/invoices/${inv.id}`}
                        className="font-mono text-xs text-blue-600 hover:underline"
                      >
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-900">
                      {customerMap.get(inv.customer_id ?? "") ?? "â€”"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[inv.status] ?? ""}`}
                      >
                        {STATUS_LABEL[inv.status] ?? inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-700">
                      {fmt(inv.grand_total ?? 0)}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400">
                      {fmtDate(inv.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

