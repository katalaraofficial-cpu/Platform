import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import { redirect } from "next/navigation";
import { Users, Trophy } from "lucide-react";

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  vehicle_info: { plate?: string; brand?: string; model?: string } | null;
  created_at: string;
};

type InvoiceRow = {
  customer_id: string | null;
  grand_total: number;
  status: string;
};

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function plateRegion(plate?: string) {
  if (!plate) return "Tidak diketahui";
  const prefix = plate.trim().toUpperCase().match(/^[A-Z]{1,2}/)?.[0];
  return prefix ?? "Tidak diketahui";
}

function DonutChart({
  segments,
}: {
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((sum, seg) => sum + seg.value, 0);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;

  if (total === 0) {
    return (
      <div className="flex h-[96px] w-[96px] items-center justify-center rounded-full bg-gray-100 text-xs text-gray-400">
        No data
      </div>
    );
  }

  let accumulated = 0;
  const arcs = segments.map((seg) => {
    const dash = (seg.value / total) * circumference;
    const offset = -accumulated;
    accumulated += dash;
    return { ...seg, dash, offset };
  });

  return (
    <svg viewBox="0 0 100 100" width="96" height="96" aria-label="Lokasi pelanggan">
      {arcs.map((arc) => (
        <circle
          key={arc.label}
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={arc.color}
          strokeWidth="18"
          strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
          strokeDashoffset={arc.offset}
          transform="rotate(-90 50 50)"
        />
      ))}
      <circle cx="50" cy="50" r="24" fill="white" />
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="12"
        fontWeight="700"
        fill="#111827"
      >
        {total}
      </text>
    </svg>
  );
}

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6"];

export default async function OwnerCustomersPage() {
  const ctx = await getUserContext();
  if (!ctx.tenantId || ctx.role !== "owner") redirect("/owner/dashboard");

  const supabase = await createClient();

  const [{ data: customersRaw }, { data: invoicesRaw }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, phone, vehicle_info, created_at")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("customer_id, grand_total, status")
      .eq("tenant_id", ctx.tenantId)
      .neq("status", "cancelled"),
  ]);

  const customers = (customersRaw as CustomerRow[] | null) ?? [];
  const invoices = (invoicesRaw as InvoiceRow[] | null) ?? [];

  const revenueByCustomer = new Map<string, number>();
  for (const inv of invoices) {
    if (!inv.customer_id) continue;
    const prev = revenueByCustomer.get(inv.customer_id) ?? 0;
    revenueByCustomer.set(inv.customer_id, prev + Number(inv.grand_total ?? 0));
  }

  let topCustomerName = "-";
  let topCustomerRevenue = 0;
  for (const c of customers) {
    const revenue = revenueByCustomer.get(c.id) ?? 0;
    if (revenue > topCustomerRevenue) {
      topCustomerRevenue = revenue;
      topCustomerName = c.name;
    }
  }

  const locationMap = new Map<string, number>();
  for (const c of customers) {
    const region = plateRegion(c.vehicle_info?.plate);
    locationMap.set(region, (locationMap.get(region) ?? 0) + 1);
  }

  const locationSegments = [...locationMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value], idx) => ({
      label,
      value,
      color: PIE_COLORS[idx % PIE_COLORS.length],
    }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pelanggan</h1>
        <p className="mt-1 text-sm text-gray-500">Daftar pelanggan dan ringkasan distribusi lokasi</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <Trophy className="h-4 w-4 text-amber-500" /> Transaksi Omzet Terbanyak
          </div>
          <p className="text-lg font-bold text-gray-900">{topCustomerName}</p>
          <p className="text-sm text-emerald-600">{fmt(topCustomerRevenue)}</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <Users className="h-4 w-4 text-blue-500" /> Total Pelanggan Terdaftar
          </div>
          <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
          <p className="text-xs text-gray-400">Berdasarkan data pelanggan yang sudah diinput</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-800">Sebaran Lokasi Pelanggan (berdasarkan prefix plat)</h2>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <DonutChart segments={locationSegments} />
          <div className="flex-1 space-y-2">
            {locationSegments.length === 0 ? (
              <p className="text-sm text-gray-400">Belum ada data lokasi pelanggan.</p>
            ) : (
              locationSegments.map((seg) => (
                <div key={seg.label} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-700">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
                    {seg.label}
                  </div>
                  <span className="font-semibold text-gray-900">{seg.value}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-3">
          <p className="text-sm font-semibold text-gray-800">List Pelanggan</p>
        </div>
        {customers.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-400">Belum ada pelanggan terdaftar.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Nama</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Telepon</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Kendaraan</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Omzet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {customers.map((c) => {
                  const vehicle = [c.vehicle_info?.brand, c.vehicle_info?.model, c.vehicle_info?.plate]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.phone ?? "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{vehicle || "-"}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-600">
                        {fmt(revenueByCustomer.get(c.id) ?? 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
