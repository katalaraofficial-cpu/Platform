import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import { Wallet, BadgeDollarSign, ReceiptText } from "lucide-react";

function formatRp(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default async function MechanicWalletPage() {
  const supabase = await createClient();
  const ctx = await getUserContext();

  const [{ data: summaryRaw }, { data: reimbursements }] = await Promise.all([
    supabase
      .from("v_mechanic_debt_summary")
      .select("total_advanced, total_reimbursed, outstanding_balance")
      .eq("mechanic_id", ctx.id)
      .maybeSingle(),
    supabase
      .from("mechanic_debt_ledger")
      .select("id, amount, notes, created_at")
      .eq("mechanic_id", ctx.id)
      .eq("transaction_type", "reimbursement")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const saldoKasbon = Math.max(0, Number(summaryRaw?.outstanding_balance ?? 0));
  const totalCicilan = Number(summaryRaw?.total_reimbursed ?? 0);

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
          <Wallet className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Dompet Karyawan</h1>
          <p className="text-xs text-gray-400">Ringkasan kasbon dan cicilan</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-700">Saldo Kasbon</p>
          <p className="mt-1 text-lg font-bold text-amber-800">{formatRp(saldoKasbon)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-medium text-emerald-700">Total Cicilan</p>
          <p className="mt-1 text-lg font-bold text-emerald-800">{formatRp(totalCicilan)}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Riwayat Cicilan Kasbon
          </span>
          <BadgeDollarSign className="h-4 w-4 text-gray-300" />
        </div>
        {!reimbursements || reimbursements.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-400">Belum ada cicilan tercatat.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {reimbursements.map((row) => (
              <li key={row.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Pembayaran cicilan</p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {new Date(row.created_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                    {row.notes && <p className="mt-1 text-xs text-gray-500">{row.notes}</p>}
                  </div>
                  <p className="text-sm font-bold text-emerald-600">{formatRp(Number(row.amount ?? 0))}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Daftar Slip Gaji
          </span>
          <ReceiptText className="h-4 w-4 text-gray-300" />
        </div>
        <div className="px-4 py-6 text-sm text-gray-500">
          <p>Belum ada slip gaji yang dibagikan perusahaan.</p>
          <Link href="/mechanic/payslips" className="mt-2 inline-block text-xs font-semibold text-blue-600 hover:underline">
            Buka halaman Slip Gaji
          </Link>
        </div>
      </div>
    </div>
  );
}
