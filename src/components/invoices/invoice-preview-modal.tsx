"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X, Pencil } from "lucide-react";
import { getInvoicePreview, type InvoicePreviewData } from "@/lib/actions/invoice";

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function lamaKerja(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return "-";
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "-";
  const startDay = Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
  const endDay = Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate());
  const days = Math.max(1, Math.round((endDay - startDay) / 86400000) + 1);
  return `${days} hari`;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_progress: "Dikerjakan",
  completed: "Selesai",
  paid: "Lunas",
  cancelled: "Dibatalkan",
};

interface Props {
  invoiceId: string;
  basePath: string;
  onClose: () => void;
}

export function InvoicePreviewModal({ invoiceId, basePath, onClose }: Props) {
  const [data, setData] = useState<InvoicePreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getInvoicePreview(invoiceId).then((d) => {
      if (cancelled) return;
      setData(d);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Preview Invoice
            </p>
            <h3 className="font-mono text-lg font-semibold text-gray-900">
              {data?.invoice_number ?? "..."}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            title="Tutup"
            aria-label="Tutup preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-400">Memuat data invoice...</div>
          ) : !data ? (
            <div className="py-16 text-center text-sm text-red-500">
              Invoice tidak ditemukan atau Anda tidak berwenang melihat.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs text-gray-400">Status</p>
                  <p className="font-medium text-gray-800">
                    {STATUS_LABEL[data.status] ?? data.status}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Tanggal</p>
                  <p className="font-medium text-gray-800">{fmtDate(data.invoice_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Tgl Selesai</p>
                  <p className="font-medium text-gray-800">{fmtDate(data.completed_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Waktu Pengerjaan</p>
                  <p className="font-medium text-gray-800">
                    {lamaKerja(data.invoice_date, data.completed_at)}
                  </p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-xs text-gray-400">Pelanggan</p>
                  <p className="font-medium text-gray-800 break-words">
                    {data.customer_name ?? "-"}
                  </p>
                  {data.customer_phone && (
                    <p className="text-xs text-gray-500">{data.customer_phone}</p>
                  )}
                </div>
                <div className="col-span-2 sm:col-span-2">
                  <p className="text-xs text-gray-400">Engineer</p>
                  <p className="font-medium text-gray-800">
                    {data.mechanics.length > 0 ? data.mechanics.join(", ") : "-"}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200">
                <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Item ({data.items.length})
                </div>
                {data.items.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-gray-400">
                    Belum ada item.
                  </p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {data.items.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-start justify-between gap-3 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-800 break-words">
                            {it.description}
                          </p>
                          <p className="text-xs text-gray-500">
                            {it.quantity} {it.unit_label ?? ""} · {fmt(it.unit_price)} /{" "}
                            {it.unit_label ?? "satuan"}
                            <span className="ml-1 text-gray-300">·</span>{" "}
                            <span className="text-gray-400">{it.item_type}</span>
                          </p>
                        </div>
                        <p className="whitespace-nowrap text-sm font-semibold text-gray-900">
                          {fmt(it.final_price)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
                <Row label="Subtotal" value={fmt(data.subtotal)} />
                {data.discount_amount > 0 && (
                  <Row label="Diskon" value={`- ${fmt(data.discount_amount)}`} />
                )}
                {data.ppn_amount > 0 && (
                  <Row label={`PPN ${data.ppn_pct}%`} value={fmt(data.ppn_amount)} />
                )}
                {data.pph_amount > 0 && (
                  <Row label={`PPh ${data.pph_pct}%`} value={`- ${fmt(data.pph_amount)}`} />
                )}
                {data.shipping_cost > 0 && (
                  <Row label="Ongkos Kirim" value={fmt(data.shipping_cost)} />
                )}
                {data.dp_amount > 0 && (
                  <Row label="DP" value={`- ${fmt(data.dp_amount)}`} />
                )}
                <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 text-base font-semibold text-gray-900">
                  <span>Total</span>
                  <span>{fmt(data.grand_total)}</span>
                </div>
              </div>

              {data.notes && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Catatan
                  </p>
                  <p className="whitespace-pre-wrap">{data.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Tutup
          </button>
          <Link
            href={`${basePath}/invoices/${invoiceId}`}
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-gray-600">
      <span>{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}
