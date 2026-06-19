"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getInvoiceShareContext } from "@/lib/actions/settings";
import {
  DEFAULT_WA_TEMPLATE,
  buildItemsBlock,
  buildRincianBlock,
  formatDateID,
  formatInvoiceStatusID,
  formatRupiah,
  renderWATemplate,
  type WAFormat,
} from "@/lib/wa-template";

interface PrintOptionsModalProps {
  invoiceId: string;
  invoiceNumber: string;
  customerPhone?: string | null;
  customerName?: string | null;
  invoiceDate?: string | null;
  status?: string | null;
  paidAt?: string | null;
  grandTotal: number;
}

const FORMATS = [
  {
    id: "struk",
    label: "Struk Thermal",
    icon: "🧾",
    desc: "Cocok untuk printer thermal 80mm. Compact dan cepat.",
  },
  {
    id: "nota",
    label: "Nota Kontan",
    icon: "📄",
    desc: "Format A5 dengan tabel item dan kolom tanda tangan.",
  },
  {
    id: "invoice",
    label: "Invoice Profesional",
    icon: "📋",
    desc: "Format A4 lengkap dengan header, detail pajak, dan tanda tangan.",
    recommended: true,
  },
];

export function PrintOptionsModal({
  invoiceId,
  invoiceNumber,
  customerPhone,
  customerName,
  invoiceDate,
  status,
  paidAt,
  grandTotal,
}: PrintOptionsModalProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("invoice");
  const [sending, setSending] = useState(false);
  const [defaultFormat, setDefaultFormat] = useState<"struk" | "nota" | "invoice" | null>(null);

  // Ambil format default dari Pengaturan (Nota & Printer). Bila sudah
  // ditetapkan owner, modal langsung pakai format itu tanpa minta pilih.
  useEffect(() => {
    let cancelled = false;
    getInvoiceShareContext(invoiceId).then((res) => {
      if (cancelled) return;
      const fmt = res.data?.defaultPrintFormat ?? null;
      if (fmt) {
        setDefaultFormat(fmt);
        setSelected(fmt);
      }
    });
    return () => { cancelled = true; };
  }, [invoiceId]);

  function openPreview() {
    window.open(`/print/invoices/${invoiceId}?format=${selected}`, "_blank");
    setOpen(false);
  }

  async function sendWhatsApp() {
    if (!customerPhone || sending) return;
    setSending(true);
    try {
      const phone = customerPhone.replace(/[^0-9]/g, "").replace(/^0/, "62");
      const previewUrl = `${window.location.origin}/print/invoices/${invoiceId}?format=${selected}`;
      const format = selected as WAFormat;

      const ctxRes = await getInvoiceShareContext(invoiceId);
      const businessName = ctxRes.data?.businessName ?? "Bengkel";
      const template = ctxRes.data?.template?.trim() ? ctxRes.data.template : DEFAULT_WA_TEMPLATE;
      const itemsBlock = buildItemsBlock(ctxRes.data?.items ?? []);
      const totals = ctxRes.data?.totals;
      const rincian = totals
        ? buildRincianBlock({
            subtotal: totals.subtotal,
            discount: totals.discount,
            ppnPct: totals.ppnPct,
            ppnAmount: totals.ppnAmount,
            pphPct: totals.pphPct,
            pphAmount: totals.pphAmount,
            shipping: totals.shipping,
            dp: totals.dp,
          })
        : "";

      const body = renderWATemplate(template, {
        bisnis: businessName,
        format,
        no: invoiceNumber,
        tgl: formatDateID(invoiceDate ?? null),
        pelanggan: (customerName ?? "Pelanggan").toUpperCase(),
        total: formatRupiah(grandTotal),
        status: formatInvoiceStatusID(status ?? null, paidAt ?? null),
        link: previewUrl,
        items: itemsBlock,
        rincian,
        subtotal: totals ? formatRupiah(totals.subtotal) : "",
      });

      const message = encodeURIComponent(body);
      window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:inline-flex items-center gap-2"
      >
        🖨️ Cetak
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h3 className="font-semibold text-gray-900">Cetak Invoice</h3>
                <p className="text-xs text-gray-400 mt-0.5">{invoiceNumber}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Format selection */}
            {!defaultFormat && (
            <div className="p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Pilih Format
              </p>
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelected(f.id)}
                  className={`w-full flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-all ${
                    selected === f.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-2xl">{f.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 text-sm">{f.label}</span>
                      {f.recommended && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                          Rekomendasi
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
                  </div>
                  <div className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
                    selected === f.id ? "border-blue-500 bg-blue-500" : "border-gray-300"
                  }`}>
                    {selected === f.id && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                </button>
              ))}
            </div>
            )}
            {defaultFormat && (
              <div className="px-5 pt-5">
                <p className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  Format default: <span className="font-semibold">{FORMATS.find((f) => f.id === defaultFormat)?.label ?? defaultFormat}</span>. Ubah di Pengaturan → Nota &amp; Printer.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 border-t border-gray-100 px-5 py-4">
              <button
                onClick={openPreview}
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Preview &amp; Cetak / Unduh PDF
              </button>
              {customerPhone && (
                <button
                  onClick={sendWhatsApp}
                  disabled={sending}
                  className="rounded-xl border border-green-500 px-4 py-2.5 text-sm font-semibold text-green-600 hover:bg-green-50 transition-colors disabled:opacity-60"
                  title="Kirim via WhatsApp"
                >
                  {sending ? "..." : "📲 WA"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
