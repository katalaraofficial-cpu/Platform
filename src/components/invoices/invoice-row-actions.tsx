"use client";

import { createPortal } from "react-dom";
import { useRef, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { MoreHorizontal, Eye, Trash2, Printer, RotateCcw } from "lucide-react";
import { deleteInvoice, rollbackInvoiceStatus } from "@/lib/actions/invoice";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<"delete" | "rollback" | null>(null);
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

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen((o) => !o);
  }

  const canDelete = isOwner ? status !== "" : (status === "draft" || status === "cancelled");
  const canRollback = isOwner && status !== "draft" && status !== "cancelled";

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

  const deleteMessage =
    status === "paid" || status === "completed"
      ? `PERHATIAN: Invoice ${invoiceNumber} sudah ${status === "paid" ? "lunas" : "selesai"}. Menghapus akan menghilangkan data kas terkait.\n\nLanjutkan hapus?`
      : `Hapus invoice ${invoiceNumber}? Tindakan ini tidak dapat dibatalkan.`;

  const rollbackLabel = ROLLBACK_LABEL[status] ?? "Kembalikan status";

  return (
    <>
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
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400
                   hover:bg-gray-100 hover:text-gray-600 transition-colors"
        title="Aksi"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && mounted && menuPos &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: menuPos.top,
              right: menuPos.right,
              zIndex: 9999,
            }}
            className="w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
            onMouseDown={(e) => e.stopPropagation()}
          >
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
              onClick={() => { setOpen(false); window.open(`/print/invoices/${invoiceId}?format=invoice`, "_blank"); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-700
                         hover:bg-gray-50"
            >
              <Printer className="h-3.5 w-3.5 text-gray-400" />
              Cetak Invoice
            </button>

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
