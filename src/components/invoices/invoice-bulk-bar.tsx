"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { BadgeCheck, Trash2, X } from "lucide-react";
import { bulkMarkInvoicesPaid, bulkDeleteInvoices } from "@/lib/actions/invoice";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type SelectedRow = { id: string; status: string; number: string };

export function InvoiceBulkBar({ basePath }: { basePath: string }) {
  const [selected, setSelected] = useState<SelectedRow[]>([]);
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showPay, setShowPay] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [payMethod, setPayMethod] = useState<"cash" | "transfer">("cash");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => setMounted(true), []);

  // Read selection from DOM checkboxes (data-bulk-id) on every change.
  useEffect(() => {
    function refresh() {
      const nodes = document.querySelectorAll<HTMLInputElement>("input[data-bulk-id]");
      const rows: SelectedRow[] = [];
      nodes.forEach((n) => {
        if (n.checked) {
          rows.push({
            id: n.dataset.bulkId ?? "",
            status: n.dataset.bulkStatus ?? "",
            number: n.dataset.bulkNumber ?? "",
          });
        }
      });
      setSelected(rows);
      // Sync master state(s)
      const masters = document.querySelectorAll<HTMLInputElement>("input[data-bulk-master]");
      const total = nodes.length;
      const checked = rows.length;
      masters.forEach((m) => {
        m.checked = total > 0 && checked === total;
        m.indeterminate = checked > 0 && checked < total;
      });
    }
    function onChange(e: Event) {
      const t = e.target as HTMLInputElement | null;
      if (!t) return;
      if (t.matches("input[data-bulk-master]")) {
        const all = document.querySelectorAll<HTMLInputElement>("input[data-bulk-id]");
        all.forEach((n) => {
          n.checked = t.checked;
        });
        refresh();
        return;
      }
      if (t.matches("input[data-bulk-id]")) {
        refresh();
      }
    }
    document.addEventListener("change", onChange);
    refresh();
    return () => document.removeEventListener("change", onChange);
  }, []);

  function clearSelection() {
    document
      .querySelectorAll<HTMLInputElement>("input[data-bulk-id], input[data-bulk-master]")
      .forEach((n) => {
        n.checked = false;
        n.indeterminate = false;
      });
    setSelected([]);
  }

  const eligiblePayIds = selected.filter((r) => r.status === "completed").map((r) => r.id);
  const skippedPay = selected.length - eligiblePayIds.length;

  function confirmMarkPaid() {
    if (eligiblePayIds.length === 0) return;
    startTransition(async () => {
      await bulkMarkInvoicesPaid(eligiblePayIds, payMethod, paymentDate, basePath);
      setShowPay(false);
      clearSelection();
    });
  }

  function confirmDelete() {
    const ids = selected.map((r) => r.id);
    startTransition(async () => {
      await bulkDeleteInvoices(ids, basePath);
      setShowDelete(false);
      clearSelection();
    });
  }

  if (selected.length === 0) return null;
  if (!mounted) return null;

  return createPortal(
    <>
      <div className="fixed inset-x-0 bottom-0 z-[60] flex items-center justify-between gap-3 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur sm:bottom-4 sm:left-1/2 sm:inset-x-auto sm:-translate-x-1/2 sm:rounded-full sm:border sm:px-5">
        <div className="flex items-center gap-3">
          <button
            onClick={clearSelection}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            title="Bersihkan pilihan"
          >
            <X className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-gray-700">
            {selected.length} invoice dipilih
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setPaymentDate(new Date().toISOString().slice(0, 10));
              setPayMethod("cash");
              setShowPay(true);
            }}
            disabled={isPending || eligiblePayIds.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
            title={
              eligiblePayIds.length === 0
                ? "Hanya invoice berstatus Selesai yang bisa ditandai lunas"
                : "Tandai lunas semua yang dipilih"
            }
          >
            <BadgeCheck className="h-4 w-4" />
            Tandai Lunas
            {eligiblePayIds.length !== selected.length && eligiblePayIds.length > 0 && (
              <span className="ml-1 rounded-full bg-white/20 px-1.5 text-xs">
                {eligiblePayIds.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowDelete(true)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
            Hapus
          </button>
        </div>
      </div>

      {showPay && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">Tandai Lunas Massal</h3>
            <p className="mt-1 text-sm text-gray-500">
              {eligiblePayIds.length} dari {selected.length} invoice akan ditandai lunas dengan
              metode &amp; tanggal sama.
              {skippedPay > 0 && (
                <span className="mt-1 block text-xs text-amber-600">
                  {skippedPay} invoice dilewati (status bukan &ldquo;Selesai&rdquo;).
                </span>
              )}
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Metode Pembayaran
                </label>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPayMethod("cash")}
                    className={`rounded-md border px-3 py-2 text-sm font-medium ${
                      payMethod === "cash"
                        ? "border-green-300 bg-green-50 text-green-700"
                        : "border-gray-200 text-gray-600"
                    }`}
                  >
                    Tunai
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayMethod("transfer")}
                    className={`rounded-md border px-3 py-2 text-sm font-medium ${
                      payMethod === "transfer"
                        ? "border-green-300 bg-green-50 text-green-700"
                        : "border-gray-200 text-gray-600"
                    }`}
                  >
                    Transfer
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Tanggal Pembayaran
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPay(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmMarkPaid}
                disabled={isPending || !paymentDate || eligiblePayIds.length === 0}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
              >
                {isPending ? "Memproses..." : `Tandai Lunas (${eligiblePayIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showDelete}
        title="Hapus Invoice Massal"
        message={`Hapus ${selected.length} invoice terpilih? Data kas/point terkait akan ikut dibersihkan dan tindakan ini tidak dapat dibatalkan.`}
        confirmLabel={isPending ? "Menghapus..." : `Ya, Hapus ${selected.length}`}
        danger
        onConfirm={confirmDelete}
        onCancel={() => setShowDelete(false)}
      />
    </>,
    document.body
  );
}
