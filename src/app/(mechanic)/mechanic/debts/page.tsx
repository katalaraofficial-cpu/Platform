import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import type { MechanicDebtLedger } from "@/types/database";
import { Wallet, ImageIcon } from "lucide-react";

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

  // Fetch debt ledger + outstanding summary in parallel
  const [{ data: ledger }, { data: summaryRaw }] = await Promise.all([
    supabase
      .from("mechanic_debt_ledger")
      .select("*, invoice_items(receipt_image_url)")
      .eq("mechanic_id", ctx.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("v_mechanic_debt_summary")
      .select("total_advanced, total_reimbursed, outstanding_balance")
      .eq("mechanic_id", ctx.id)
      .maybeSingle(),
  ]);

  type EntryWithReceipt = MechanicDebtLedger & {
    invoice_items: { receipt_image_url: string | null } | null;
  };

  const allEntries = (ledger ?? []) as unknown as EntryWithReceipt[];
  const advanceEntries = allEntries.filter((e) => e.transaction_type === "advance");
  const reimbursementEntries = allEntries.filter((e) => e.transaction_type === "reimbursement");

  // ── FIFO paid status: oldest advance is settled first ─────────
  // This auto-reflects any reimbursement changes without touching is_paid flags.
  const totalReimbursed = Number(summaryRaw?.total_reimbursed ?? 0);
  const outstandingBalance = Math.max(0, Number(summaryRaw?.outstanding_balance ?? 0));

  // Sort oldest → newest for FIFO calculation
  const sortedOldest = [...advanceEntries].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  let remainingPaid = totalReimbursed;
  const paidStatus = new Map<string, boolean>();
  for (const e of sortedOldest) {
    if (remainingPaid >= e.amount) {
      paidStatus.set(e.id, true);
      remainingPaid -= e.amount;
    } else {
      paidStatus.set(e.id, false);
    }
  }

  const unpaidAmount = outstandingBalance;
  const paidAmount = Number(summaryRaw?.total_advanced ?? 0) - outstandingBalance;
  const itemIds = advanceEntries
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
        (invoices ?? []).map((inv) => [inv.id, inv.invoice_number as string])
      );

      (items ?? []).forEach((it) => {
        const num = invByIdMap.get(it.invoice_id);
        if (num) invoiceMap.set(it.id, num);
      });
    }
  }

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
          <p className="text-xs font-medium text-amber-600">Saldo Kasbon</p>
          <p className="mt-1 text-lg font-bold text-amber-700">{formatRp(unpaidAmount)}</p>
        </div>
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <p className="text-xs font-medium text-green-600">Total Cicilan Diterima</p>
          <p className="mt-1 text-lg font-bold text-green-700">{formatRp(paidAmount)}</p>
        </div>
      </div>

      {/* Kasbon / Advance list */}
      {advanceEntries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Wallet className="h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-400">Belum ada kasbon tercatat.</p>
          <p className="text-xs text-gray-400">
            Upload struk pembelian part untuk mulai mencatat.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Riwayat Kasbon
            </span>
          </div>
          <ul className="divide-y divide-gray-100">
            {advanceEntries.map((entry) => {
              const invoiceNum = entry.invoice_item_id
                ? invoiceMap.get(entry.invoice_item_id)
                : null;
              const isPaid = paidStatus.get(entry.id) ?? false;
              const receiptUrl =
                entry.invoice_items?.receipt_image_url ?? entry.receipt_image_url ?? null;
              const categoryLabel = entry.claim_category
                ? entry.claim_category.charAt(0).toUpperCase() + entry.claim_category.slice(1)
                : null;

              return (
                <li key={entry.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    {/* Receipt thumbnail */}
                    {receiptUrl ? (
                      <a
                        href={receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={receiptUrl}
                          alt="Struk"
                          className="h-12 w-12 rounded-xl border border-gray-200 object-cover"
                        />
                      </a>
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50">
                        <ImageIcon className="h-5 w-5 text-gray-300" />
                      </div>
                    )}

                    <div className="flex flex-1 items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
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
                          {categoryLabel && (
                            <span className="mr-2 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
                              Klaim {categoryLabel}
                            </span>
                          )}
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
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Cicilan / reimbursement list */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Riwayat Cicilan Dibayarkan Perusahaan
          </span>
        </div>
        {reimbursementEntries.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-400">
            Belum ada cicilan kasbon yang diterima.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {reimbursementEntries.map((entry) => {
              const reimbursementProof =
                entry.invoice_items?.receipt_image_url ?? entry.receipt_image_url ?? null;

              return (
                <li key={entry.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    {reimbursementProof ? (
                      <a
                        href={reimbursementProof}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={reimbursementProof}
                          alt="Bukti transfer"
                          className="h-12 w-12 rounded-xl border border-gray-200 object-cover"
                        />
                      </a>
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50">
                        <ImageIcon className="h-5 w-5 text-gray-300" />
                      </div>
                    )}

                    <div className="flex flex-1 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">
                          Cicilan kasbon diterima
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {new Date(entry.created_at).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        {entry.notes && (
                          <p className="mt-1 text-xs text-gray-500">{entry.notes}</p>
                        )}
                      </div>
                      <p className="shrink-0 text-sm font-bold text-green-600">
                        {formatRp(entry.amount)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Info note */}
      {unpaidAmount > 0 && (
        <p className="text-center text-xs text-gray-400">
          Saldo kasbon dihitung otomatis: total kasbon dikurangi total cicilan reimbursement.
        </p>
      )}
    </div>
  );
}
