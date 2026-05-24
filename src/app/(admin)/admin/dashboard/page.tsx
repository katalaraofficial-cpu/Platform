import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import Link from "next/link";
import { FileText, Clock, CheckCircle2, Plus } from "lucide-react";

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
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

export default async function AdminDashboard() {
  const supabase = await createClient();
  const ctx = await getUserContext();
  const tenantId = ctx.tenantId!;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const [{ data: activeInvoices }, { data: recentInvoices }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, status, grand_total, completed_at")
      .eq("tenant_id", tenantId)
      .in("status", ["draft", "in_progress", "completed"]),
    supabase
      .from("invoices")
      .select("id, invoice_number, customer_name, status, grand_total, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const all = activeInvoices ?? [];
  const draftCount = all.filter((i) => i.status === "draft").length;
  const inProgressCount = all.filter((i) => i.status === "in_progress").length;
  const completedToday = all.filter(
    (i) => i.status === "completed" && i.completed_at && i.completed_at >= todayStart
  ).length;
  const totalActive = draftCount + inProgressCount;

  const stats = [
    { label: "Invoice Aktif", value: totalActive, icon: <FileText className="h-5 w-5 text-blue-400" />, color: "text-blue-700" },
    { label: "Dalam Proses", value: inProgressCount, icon: <Clock className="h-5 w-5 text-yellow-400" />, color: "text-yellow-700" },
    { label: "Selesai Hari Ini", value: completedToday, icon: <CheckCircle2 className="h-5 w-5 text-green-400" />, color: "text-green-700" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Kasir</h1>
          <p className="text-sm text-gray-500 mt-1">Invoice aktif dan petty cash.</p>
        </div>
        <Link
          href="/admin/invoices/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" />
          Invoice Baru
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500">{s.label}</p>
              {s.icon}
            </div>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Invoice table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Invoice Terkini</h2>
          <Link href="/admin/invoices" className="text-sm text-blue-600 hover:text-blue-500">
            Semua invoice →
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
                  <th className="px-5 py-3 text-left">Dibuat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {recentInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-5 py-3 font-mono text-xs text-gray-600">{inv.invoice_number}</td>
                    <td className="px-5 py-3 text-gray-900">{String(inv.customer_name ?? "")}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[inv.status]}`}>
                        {STATUS_LABEL[inv.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-700">{formatRupiah(inv.grand_total ?? 0)}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDate(inv.created_at)}</td>
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

