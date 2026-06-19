"use client";

import { createPortal } from "react-dom";
import { useRef, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, Eye, Trash2, Printer, RotateCcw, BadgeCheck, FileSearch } from "lucide-react";
import { deleteInvoice, processPayment, rollbackInvoiceStatus } from "@/lib/actions/invoice";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InvoicePreviewModal } from "@/components/invoices/invoice-preview-modal";

interface Props {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  basePath: string;
  isOwner?: boolean;
}

export function InvoiceRowActions({
  invoiceId,
  invoiceNumber,
  status,
  basePath,
  isOwner = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isPayPending, startPayTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<"delete" | "rollback" | null>(null);
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [payMethod, setPayMethod] = useState<"cash" | "transfer">("cash");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  // Close on outside click or scroll
  useEffect(() => {
    function close() { setOpen(false); }
    if (open) {
      document.addEventListener("mousedown", close);
      window.addEventListener("scroll", close, true);
    }
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  const canDelete = isOwner ? status !== "" : (status === "draft" || status === "cancelled");
  const canRollback = isOwner && status !== "draft" && status !== "cancelled";
  const canMarkPaid = status === "completed";

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      // Estimasi tinggi menu: ~40px per item + ~8px padding/separator
      const itemCount = 3 + (canMarkPaid ? 1 : 0) + (canRollback ? 1 : 0) + (canDelete ? 1 : 0);
      const estimatedHeight = itemCount * 40 + 16;
      const spaceBelow = window.innerHeight - rect.bottom;
      const right = window.innerWidth - rect.right;
      if (spaceBelow < estimatedHeight && rect.top > spaceBelow) {
        setMenuPos({ bottom: window.innerHeight - rect.top + 4, right });
      } else {
        setMenuPos({ top: rect.bottom + 4, right });
      }
    }
    setOpen((o) => !o);
  }

  const ROLLBACK_LABEL: Record<string, string> = {
    paid: "Kembalikan ke Selesai",
    completed: "Kembalikan ke Dikerjakan",
    in_progress: "Kembalikan ke Draft",
    cancelled: "Kembalikan ke Draft",
  };

  async function handleDelete() {
    setOpen(false);
    setPendingAction("delete");
  }

  async function executeDelete() {
    setPendingAction(null);
    await deleteInvoice(invoiceId, basePath);
  }

  function handleRollback() {
    setOpen(false);
    setPendingAction("rollback");
  }

  function executeRollback() {
    setPendingAction(null);
    startTransition(async () => {
      await rollbackInvoiceStatus(invoiceId, basePath);
    });
  }

  function openMarkPaidModal() {
    setOpen(false);
    setPayMethod("cash");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setShowMarkPaidModal(true);
  }

  function confirmMarkPaid() {
    startPayTransition(async () => {
      await processPayment(invoiceId, payMethod, paymentDate, basePath);
      setShowMarkPaidModal(false);
    });
  }

  const deleteMessage =
    status === "paid" || status === "completed"
      ? `PERHATIAN: Invoice ${invoiceNumber} sudah ${status === "paid" ? "lunas" : "selesai"}. Menghapus akan menghilangkan data kas terkait.\n\nLanjutkan hapus?`
      : `Hapus invoice ${invoiceNumber}? Tindakan ini tidak dapat dibatalkan.`;

  const rollbackLabel = ROLLBACK_LABEL[status] ?? "Kembalikan status";

  return (
    <>
      {showPreview && (
        <InvoicePreviewModal
          invoiceId={invoiceId}
          basePath={basePath}
          onClose={() => setShowPreview(false)}
        />
      )}
      <ConfirmDialog
        open={pendingAction === "delete"}
        title="Hapus Invoice"
        message={deleteMessage}
        confirmLabel="Ya, Hapus"
        danger
        onConfirm={executeDelete}
        onCancel={() => setPendingAction(null)}
      />
      <ConfirmDialog
        open={pendingAction === "rollback"}
        title="Kembalikan Status"
        message={`${rollbackLabel} untuk invoice ${invoiceNumber}?`}
        confirmLabel="Ya, Kembalikan"
        onConfirm={executeRollback}
        onCancel={() => setPendingAction(null)}
      />

      {showMarkPaidModal && mounted &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
              <h3 className="text-base font-semibold text-gray-900">Tandai Lunas</h3>
              <p className="mt-1 text-sm text-gray-500">
                Tetapkan pembayaran invoice {invoiceNumber} sebagai lunas.
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
                  onClick={() => setShowMarkPaidModal(false)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmMarkPaid}
                  disabled={isPayPending || !paymentDate}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                >
                  {isPayPending ? "Memproses..." : "Tandai Lunas"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      <button
        ref={btnRef}
        onClick={handleOpen}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 shadow-sm transition-colors hover:border-gray-400 hover:bg-gray-50 hover:text-gray-700"
        title="Aksi"
        aria-label="Buka aksi invoice"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open && mounted && menuPos &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: menuPos.top,
              bottom: menuPos.bottom,
              right: menuPos.right,
              zIndex: 9999,
            }}
            className="w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { setOpen(false); setShowPreview(true); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-700
                         hover:bg-gray-50"
            >
              <FileSearch className="h-3.5 w-3.5 text-gray-400" />
              Preview Invoice
            </button>
            <Link
              href={`${basePath}/invoices/${invoiceId}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700
                         hover:bg-gray-50"
            >
              <Eye className="h-3.5 w-3.5 text-gray-400" />
              Detail / Edit
            </Link>

            <button
              onClick={() => { setOpen(false); window.open(`/print/invoices/${invoiceId}`, "_blank"); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-700
                         hover:bg-gray-50"
            >
              <Printer className="h-3.5 w-3.5 text-gray-400" />
              Cetak Invoice
            </button>

            {canMarkPaid && (
              <button
                onClick={openMarkPaidModal}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50"
              >
                <BadgeCheck className="h-3.5 w-3.5" />
                Tandai Lunas
              </button>
            )}

            {canRollback && (
              <>
                <div className="my-1 border-t border-gray-100" />
                <button
                  onClick={handleRollback}
                  disabled={isPending}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm
                             text-amber-600 hover:bg-amber-50 disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {ROLLBACK_LABEL[status] ?? "Kembalikan Status"}
                </button>
              </>
            )}

            {canDelete && (
              <>
                <div className="my-1 border-t border-gray-100" />
                <button
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm
                             text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Hapus Invoice
                </button>
              </>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
