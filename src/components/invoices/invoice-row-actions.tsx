"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Eye, Trash2, Printer } from "lucide-react";
import { deleteInvoice } from "@/lib/actions/invoice";

interface Props {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  basePath: string;
}

export function InvoiceRowActions({
  invoiceId,
  invoiceNumber,
  status,
  basePath,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const canDelete = status === "draft" || status === "cancelled";

  async function handleDelete() {
    if (!confirm(`Hapus invoice ${invoiceNumber}? Tindakan ini tidak dapat dibatalkan.`))
      return;
    await deleteInvoice(invoiceId, basePath);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400
                   hover:bg-gray-100 hover:text-gray-600 transition-colors"
        title="Aksi"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-8 z-20 w-44 rounded-lg border border-gray-200
                     bg-white py-1 shadow-lg"
        >
          {/* Detail / Edit */}
          <Link
            href={`${basePath}/invoices/${invoiceId}`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700
                       hover:bg-gray-50"
          >
            <Eye className="h-3.5 w-3.5 text-gray-400" />
            Detail / Edit
          </Link>

          {/* Print — placeholder */}
          <button
            onClick={() => { setOpen(false); window.print(); }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-700
                       hover:bg-gray-50"
          >
            <Printer className="h-3.5 w-3.5 text-gray-400" />
            Cetak Invoice
          </button>

          {/* Delete — only for draft/cancelled */}
          {canDelete && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <button
                onClick={() => { setOpen(false); handleDelete(); }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm
                           text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Hapus Invoice
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
