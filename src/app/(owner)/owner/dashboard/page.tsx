import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import Link from "next/link";
import { DollarSign, TrendingUp, FileText, Clock } from "lucide-react";

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_progress: "Dalam Proses",
  completed: "Selesai",
  paid: "Lunas",
};

const STATUS_CLASS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  paid: "bg-emerald-100 text-emerald-700",
};

export default async function OwnerDashboard() {
  const supabase = await createClient();
  const ctx = await getUserContext();
  const tenantId = ctx.tenantId!;

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const [{ data: invoicesMonth }, { data: recentInvoices }] = await Promise.all([
    supabase
      .from("invoices")
      .select("status, grand_total, paid_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", firstOfMonth),
    supabase
      .from("invoices")
      .select("id, invoice_number, customer_name, status, grand_total, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(7),
  ]);

  const all = invoicesMonth ?? [];

  const monthRevenue = all
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + (i.grand_total ?? 0), 0);

  const todayRevenue = all
    .filter((i) => i.status === "paid" && i.paid_at && i.paid_at >= todayStart)
    .reduce((sum, i) => sum + (i.grand_total ?? 0), 0);

  const countByStatus = ["draft", "in_progress", "completed", "paid"].reduce<Record<string, number>>(
    (acc, s) => { acc[s] = all.filter((i) => i.status === s).length; return acc; },
    {}
  );

  const stats = [
    { label: "Pendapatan Hari Ini", value: formatRupiah(todayRevenue), icon: <DollarSign className="h-5 w-5 text-green-400" />, color: "text-green-700" },
    { label: "Pendapatan Bulan Ini", value: formatRupiah(monthRevenue), icon: <TrendingUp className="h-5 w-5 text-blue-400" />, color: "text-blue-700" },
    { label: "Invoice Aktif", value: (countByStatus.draft ?? 0) + (countByStatus.in_progress ?? 0), icon: <Clock className="h-5 w-5 text-yellow-400" />, color: "text-yellow-700" },
    { label: "Total Invoice Bulan Ini", value: all.length, icon: <FileText className="h-5 w-5 text-slate-400" />, color: "text-slate-700" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Pemilik</h1>
        <p className="text-sm text-gray-500 mt-1">Ringkasan keuangan dan operasional bengkel.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500">{s.label}</p>
              {s.icon}
            </div>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-4 gap-3">
        {["draft", "in_progress", "completed", "paid"].map((status) => (
          <div key={status} className="rounded-lg border border-gray-200 bg-white p-4 text-center">
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium mb-2 ${STATUS_CLASS[status]}`}>
              {STATUS_LABEL[status]}
            </span>
            <p className="text-2xl font-bold text-gray-900">{countByStatus[status] ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Recent invoices */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Invoice Terbaru</h2>
          <Link href="/owner/invoices" className="text-sm text-blue-600 hover:text-blue-500">
            Lihat semua →
          </Link>
        </div>
        {!recentInvoices || recentInvoices.length === 0 ? (
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
                {recentInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-mono text-xs text-gray-600">{inv.invoice_number}</td>
                    <td className="px-5 py-3 text-gray-900">{String(inv.customer_name ?? "")}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[inv.status]}`}>
                        {STATUS_LABEL[inv.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-700">{formatRupiah(inv.grand_total ?? 0)}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{formatDate(inv.created_at)}</td>
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

