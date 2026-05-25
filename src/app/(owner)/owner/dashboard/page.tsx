import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import Link from "next/link";
import { DollarSign, TrendingUp, FileText, Clock, Wallet, Users } from "lucide-react";

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
        <span className="text-xs text-gray-400">-</span>
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

export default async function OwnerDashboard({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    top?: string;
    donut_type?: string;
    donut_period?: string;
  }>;
}) {
  const sp = await searchParams;

  // bar chart period: 3m | 6m (default) | 12m
  const period = ["3m", "12m"].includes(sp.period ?? "") ? sp.period! : "6m";
  // top customers period: 1m (default) | 3m | 6m
  const top = ["3m", "6m"].includes(sp.top ?? "") ? sp.top! : "1m";
  // donut type: all (default) | jasa | barang
  const donutType = ["jasa", "barang"].includes(sp.donut_type ?? "") ? sp.donut_type! : "all";
  // donut period: 1m (default) | 3m | 6m
  const donutPeriod = ["3m", "6m"].includes(sp.donut_period ?? "") ? sp.donut_period! : "1m";

  const supabase = await createClient();
  const ctx = await getUserContext();
  const tenantId = ctx.tenantId!;

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const barMonths = period === "12m" ? 12 : period === "3m" ? 3 : 6;
  const barStart = new Date(now.getFullYear(), now.getMonth() - (barMonths - 1), 1).toISOString();

  const topMonths = top === "6m" ? 6 : top === "3m" ? 3 : 1;
  const topStart =
    topMonths === 1
      ? firstOfMonth
      : new Date(now.getFullYear(), now.getMonth() - (topMonths - 1), 1).toISOString();

  const donutMonths = donutPeriod === "6m" ? 6 : donutPeriod === "3m" ? 3 : 1;
  const donutStart =
    donutMonths === 1
      ? firstOfMonth
      : new Date(now.getFullYear(), now.getMonth() - (donutMonths - 1), 1).toISOString();

  let itemsQuery = supabase
    .from("invoice_items")
    .select("item_type")
    .eq("tenant_id", tenantId)
    .gte("created_at", donutStart);
  if (donutType === "jasa") itemsQuery = itemsQuery.eq("item_type", "service");
  else if (donutType === "barang")
    itemsQuery = itemsQuery.in("item_type", ["part_internal", "part_external"]);

  const [
    { data: invoicesMonth },
    { data: recentRaw },
    { data: paidHistory },
    { data: ledgerMonth },
    { data: debtUnpaid },
    { data: itemsRaw },
    { data: invoicesPeriod },
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
      .gte("paid_at", barStart)
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
    itemsQuery,
    supabase
      .from("invoices")
      .select("customer_id, grand_total")
      .eq("tenant_id", tenantId)
      .gte("created_at", topStart),
  ]);

  // Customer names
  const allCustomerIds = [
    ...new Set([
      ...(invoicesMonth ?? []).map((i) => i.customer_id).filter(Boolean),
      ...(recentRaw ?? []).map((i) => i.customer_id).filter(Boolean),
      ...(invoicesPeriod ?? []).map((i) => i.customer_id).filter(Boolean),
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

  // Stat cards (always current month)
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

  // Kas (current month)
  const kas = (ledgerMonth ?? []).reduce(
    (acc, e) => {
      if (e.transaction_type === "kas_masuk") acc.masuk += e.amount;
      else acc.keluar += e.amount;
      return acc;
    },
    { masuk: 0, keluar: 0 }
  );

  // Mechanic debt
  const totalDebt = (debtUnpaid ?? []).reduce((s, e) => s + e.amount, 0);

  // Bar chart data
  const chartMonths = Array.from({ length: barMonths }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (barMonths - 1 - i), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("id-ID", { month: "short" }),
    };
  });
  const revenueByMonth = chartMonths.map((m) => ({
    label: m.label,
    value: (paidHistory ?? [])
      .filter((inv) => inv.paid_at?.startsWith(m.key))
      .reduce((s, inv) => s + (inv.grand_total ?? 0), 0),
  }));

  // Donut segments: Jasa + Barang grouping
  const itemTypeCounts = (itemsRaw ?? []).reduce<Record<string, number>>((acc, i) => {
    acc[i.item_type] = (acc[i.item_type] ?? 0) + 1;
    return acc;
  }, {});

  let donutSegments: { label: string; value: number; color: string }[];
  if (donutType === "jasa") {
    donutSegments = [
      { label: "Jasa", value: itemTypeCounts["service"] ?? 0, color: "#3B82F6" },
    ];
  } else if (donutType === "barang") {
    donutSegments = [
      { label: "Part Internal", value: itemTypeCounts["part_internal"] ?? 0, color: "#10B981" },
      { label: "Part External", value: itemTypeCounts["part_external"] ?? 0, color: "#F59E0B" },
    ];
  } else {
    donutSegments = [
      { label: "Jasa", value: itemTypeCounts["service"] ?? 0, color: "#3B82F6" },
      {
        label: "Barang",
        value: (itemTypeCounts["part_internal"] ?? 0) + (itemTypeCounts["part_external"] ?? 0),
        color: "#10B981",
      },
    ];
  }

  // Top customers
  const custCount = (invoicesPeriod ?? []).reduce<
    Record<string, { count: number; revenue: number }>
  >((acc, inv) => {
    if (!inv.customer_id) return acc;
    if (!acc[inv.customer_id]) acc[inv.customer_id] = { count: 0, revenue: 0 };
    acc[inv.customer_id].count += 1;
    acc[inv.customer_id].revenue += inv.grand_total ?? 0;
    return acc;
  }, {});
  const topCustomers = Object.entries(custCount)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 5)
    .map(([id, data]) => ({
      id,
      name: customerMap.get(id) ?? "-",
      count: data.count,
      revenue: data.revenue,
    }));

  // URL builder (preserves all params)
  function buildUrl(overrides: {
    period?: string;
    top?: string;
    donut_type?: string;
    donut_period?: string;
  }) {
    const p = new URLSearchParams();
    const vals = {
      period,
      top,
      donut_type: donutType,
      donut_period: donutPeriod,
      ...overrides,
    };
    if (vals.period !== "6m") p.set("period", vals.period);
    if (vals.top !== "1m") p.set("top", vals.top);
    if (vals.donut_type !== "all") p.set("donut_type", vals.donut_type);
    if (vals.donut_period !== "1m") p.set("donut_period", vals.donut_period);
    const qs = p.toString();
    return `/owner/dashboard${qs ? "?" + qs : ""}`;
  }

  // Period labels
  const periodLabel =
    period === "3m" ? "3 Bulan Terakhir" : period === "12m" ? "12 Bulan Terakhir" : "6 Bulan Terakhir";
  const topLabel =
    top === "3m" ? "3 Bulan Terakhir" : top === "6m" ? "6 Bulan Terakhir" : "Bulan Ini";
  const donutPeriodLabel =
    donutPeriod === "3m" ? "3 Bulan Terakhir" : donutPeriod === "6m" ? "6 Bulan Terakhir" : "Bulan Ini";

  const pill = (active: boolean) =>
    `rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
      active
        ? "bg-blue-100 text-blue-700"
        : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
    }`;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Pemilik</h1>
        <p className="mt-1 text-sm text-gray-500">
          Ringkasan keuangan dan operasional bengkel &mdash;{" "}
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
            Lihat detail &rarr;
          </Link>
        </div>
      </div>

      {/* Bar chart + Top customers */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Bar chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-700">
              Pendapatan {periodLabel}
            </h2>
            <div className="flex gap-1">
              <Link href={buildUrl({ period: "3m" })} className={pill(period === "3m")}>
                3 bln
              </Link>
              <Link href={buildUrl({ period: "6m" })} className={pill(period === "6m")}>
                6 bln
              </Link>
              <Link href={buildUrl({ period: "12m" })} className={pill(period === "12m")}>
                12 bln
              </Link>
            </div>
          </div>
          <BarChart data={revenueByMonth} />
        </div>

        {/* Top customers */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-700">
              Top Pelanggan {topLabel}
            </h2>
            <div className="flex gap-1">
              <Link href={buildUrl({ top: "1m" })} className={pill(top === "1m")}>
                Bln ini
              </Link>
              <Link href={buildUrl({ top: "3m" })} className={pill(top === "3m")}>
                3 bln
              </Link>
              <Link href={buildUrl({ top: "6m" })} className={pill(top === "6m")}>
                6 bln
              </Link>
            </div>
          </div>
          {topCustomers.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              Belum ada data pelanggan.
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">
              Komposisi Item Pekerjaan
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{donutPeriodLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Type filter */}
            <div className="flex gap-1 rounded-lg border border-gray-100 bg-gray-50 p-0.5">
              <Link href={buildUrl({ donut_type: "all" })} className={pill(donutType === "all")}>
                Semua
              </Link>
              <Link href={buildUrl({ donut_type: "jasa" })} className={pill(donutType === "jasa")}>
                Jasa
              </Link>
              <Link href={buildUrl({ donut_type: "barang" })} className={pill(donutType === "barang")}>
                Barang
              </Link>
            </div>
            {/* Period filter */}
            <div className="flex gap-1 rounded-lg border border-gray-100 bg-gray-50 p-0.5">
              <Link href={buildUrl({ donut_period: "1m" })} className={pill(donutPeriod === "1m")}>
                Bln ini
              </Link>
              <Link href={buildUrl({ donut_period: "3m" })} className={pill(donutPeriod === "3m")}>
                3 bln
              </Link>
              <Link href={buildUrl({ donut_period: "6m" })} className={pill(donutPeriod === "6m")}>
                6 bln
              </Link>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <DonutChart segments={donutSegments} />
          <ul className="space-y-3">
            {donutSegments.map((seg) => (
              <li key={seg.label} className="flex items-center gap-2.5">
                <span
                  className="h-3 w-3 rounded-full flex-shrink-0"
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
          <Link href="/owner/invoices" className="text-sm text-blue-600 hover:text-blue-500">
            Lihat semua &rarr;
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
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/owner/invoices/${inv.id}`}
                        className="font-mono text-xs text-blue-600 hover:underline"
                      >
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-900">
                      {customerMap.get(inv.customer_id ?? "") ?? "-"}
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
