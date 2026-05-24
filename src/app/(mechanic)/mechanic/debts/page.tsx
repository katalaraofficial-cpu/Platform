import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import type { MechanicDebtLedger, Invoice } from "@/types/database";
import { Wallet } from "lucide-react";

function formatRp(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default async function PiutangSayaPage() {
  const supabase = await createClient();
  const ctx = await getUserContext();

  // Fetch all debt records for this mechanic
  const { data: ledger } = await supabase
    .from("mechanic_debt_ledger")
    .select("*")
    .eq("mechanic_id", ctx.id)
    .order("created_at", { ascending: false });

  const entries = (ledger ?? []) as MechanicDebtLedger[];

  // Collect invoice item IDs to look up invoice numbers
  const itemIds = entries
    .map((e) => e.invoice_item_id)
    .filter(Boolean) as string[];

  const invoiceMap = new Map<string, string>(); // invoice_item_id → invoice_number

  if (itemIds.length > 0) {
    const { data: items } = await supabase
      .from("invoice_items")
      .select("id, invoice_id")
      .in("id", itemIds);

    const invoiceIds = [...new Set((items ?? []).map((it) => it.invoice_id))];

    if (invoiceIds.length > 0) {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, invoice_number")
        .in("id", invoiceIds);

      const invByIdMap = new Map(
        (invoices ?? []).map((inv) => [inv.id, (inv as Invoice).invoice_number])
      );

      (items ?? []).forEach((it) => {
        const num = invByIdMap.get(it.invoice_id);
        if (num) invoiceMap.set(it.id, num);
      });
    }
  }

  const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);
  const paidAmount = entries
    .filter((e) => e.is_paid)
    .reduce((sum, e) => sum + e.amount, 0);
  const unpaidAmount = totalAmount - paidAmount;

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100">
          <Wallet className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Piutang Saya</h1>
          <p className="text-xs text-gray-400">Riwayat pembelian yang Anda tanggung</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-600">Belum Dibayar</p>
          <p className="mt-1 text-lg font-bold text-amber-700">{formatRp(unpaidAmount)}</p>
        </div>
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <p className="text-xs font-medium text-green-600">Sudah Dibayar</p>
          <p className="mt-1 text-lg font-bold text-green-700">{formatRp(paidAmount)}</p>
        </div>
      </div>

      {/* List */}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Wallet className="h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-400">Belum ada piutang tercatat.</p>
          <p className="text-xs text-gray-400">
            Upload struk pembelian part untuk mulai mencatat.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Semua Catatan
            </span>
          </div>
          <ul className="divide-y divide-gray-100">
            {entries.map((entry) => {
              const invoiceNum = entry.invoice_item_id
                ? invoiceMap.get(entry.invoice_item_id)
                : null;
              const isPaid = entry.is_paid;

              return (
                <li key={entry.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-gray-800">
                          {entry.notes ?? "—"}
                        </p>
                        {isPaid ? (
                          <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                            Lunas
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            Belum Dibayar
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {invoiceNum && (
                          <span className="mr-2 font-mono">{invoiceNum}</span>
                        )}
                        {new Date(entry.created_at).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <p
                      className={`shrink-0 text-sm font-bold ${
                        isPaid ? "text-gray-400 line-through" : "text-gray-900"
                      }`}
                    >
                      {formatRp(entry.amount)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Info note about is_paid */}
      {entries.some((e) => !(e.is_paid)) && (
        <p className="text-center text-xs text-gray-400">
          Status lunas/belum dibayar ditentukan oleh admin bengkel.
        </p>
      )}
    </div>
  );
}
