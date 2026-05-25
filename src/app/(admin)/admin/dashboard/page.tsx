import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import Link from "next/link";
import { Banknote, AlertCircle, Wrench, FileText, Plus } from "lucide-react";

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
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    { data: paidToday },
    { data: needPayment },
    { data: inProgress },
    { data: thisMonth },
    { data: recentInvoices },
  ] = await Promise.all([
    // Pemasukan hari ini
    supabase
      .from("invoices")
      .select("grand_total")
      .eq("tenant_id", tenantId)
      .eq("status", "paid")
      .gte("paid_at", todayStart),
    // Perlu dilunasi (completed, belum bayar)
    supabase
      .from("invoices")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("status", "completed"),
    // Sedang dikerjakan
    supabase
      .from("invoices")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("status", "in_progress"),
    // Invoice bulan ini
    supabase
      .from("invoices")
      .select("id")
      .eq("tenant_id", tenantId)
      .gte("created_at", monthStart),
    // Invoice terkini
    supabase
      .from("invoices")
      .select("id, invoice_number, status, grand_total, created_at, customers(name)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const pemasukanHariIni = (paidToday ?? []).reduce((s, i) => s + (i.grand_total ?? 0), 0);
  const perluDilunasi = (needPayment ?? []).length;
  const sedangDikerjakan = (inProgress ?? []).length;
  const invoiceBulanIni = (thisMonth ?? []).length;

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Pemasukan Hari Ini */}
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 shadow-sm lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-green-700">Pemasukan Hari Ini</p>
            <Banknote className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-800">{formatRupiah(pemasukanHariIni)}</p>
          <p className="mt-1 text-xs text-green-600">Pembayaran lunas hari ini</p>
        </div>

        {/* Perlu Dilunasi */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-amber-700">Perlu Dilunasi</p>
            <AlertCircle className="h-5 w-5 text-amber-500" />
          </div>
          <p className="text-3xl font-bold text-amber-700">{perluDilunasi}</p>
          <p className="mt-1 text-xs text-amber-600">Invoice selesai, belum bayar</p>
        </div>

        {/* Sedang Dikerjakan */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-blue-700">Sedang Dikerjakan</p>
            <Wrench className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-blue-700">{sedangDikerjakan}</p>
          <p className="mt-1 text-xs text-blue-600">Invoice dalam proses</p>
        </div>

        {/* Invoice Bulan Ini */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500">Invoice Bulan Ini</p>
            <FileText className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-3xl font-bold text-gray-700">{invoiceBulanIni}</p>
          <p className="mt-1 text-xs text-gray-400">Total invoice dibuat bulan ini</p>
        </div>
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
                    <td className="px-5 py-3 text-gray-900">{String((inv.customers as { name?: string } | null)?.name ?? "—")}</td>
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

