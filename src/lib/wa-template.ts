// ============================================================
// WhatsApp share template helpers
// ============================================================
// Dipakai oleh print-options-modal (client) dan halaman print
// invoice (server) supaya format pesan konsisten dan bisa
// di-override per-tenant lewat settings.wa_message_template.
// ============================================================

import type { InvoiceStatus } from "@/types/database";

export type WAFormat = "struk" | "nota" | "invoice";

export const DEFAULT_WA_TEMPLATE = [
  "*{bisnis}*",
  "------------------------------",
  "{format}",
  "No   : {no}",
  "Tgl  : {tgl}",
  "Cust : {pelanggan}",
  "------------------------------",
  "{items}",
  "------------------------------",
  "Total : {total}",
  "Status: {status}",
  "",
  "{link}",
  "",
  "Terima kasih atas kepercayaan Anda.",
].join("\n");

export const WA_FORMAT_LABEL: Record<WAFormat, string> = {
  struk: "STRUK THERMAL",
  nota: "NOTA KONTAN",
  invoice: "INVOICE",
};

/**
 * Map status invoice + paid_at ke label bisnis Bahasa Indonesia
 * yang dipakai di pesan WA dan halaman preview publik.
 */
export function formatInvoiceStatusID(
  status: InvoiceStatus | string | null | undefined,
  paidAt: string | null | undefined,
): string {
  const s = String(status ?? "draft").toLowerCase();
  if (s === "paid") return "Selesai - Lunas";
  if (s === "completed") return paidAt ? "Selesai - Lunas" : "Selesai - Belum Bayar";
  if (s === "in_progress") return "Sedang Dikerjakan";
  if (s === "cancelled") return "Dibatalkan";
  if (s === "draft") return "Draft";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateID(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Bangun blok daftar item untuk pesan WA (placeholder {items}).
 * Format per baris: `1. Nama Item — qty x Rp harga = Rp subtotal`.
 */
export function buildItemsBlock(
  items: Array<{ description: string; quantity: number | string; final_price?: number | string | null; unit_label?: string | null }>,
): string {
  if (!items || items.length === 0) return "(Tidak ada item)";
  return items
    .map((it, idx) => {
      const qty = Number(it.quantity ?? 1);
      const final = Number(it.final_price ?? 0);
      const unitLabel = it.unit_label ? ` ${it.unit_label}` : "";
      const unitPrice = qty > 0 ? final / qty : final;
      return `${idx + 1}. ${it.description} — ${qty}${unitLabel} x ${formatRupiah(unitPrice)} = ${formatRupiah(final)}`;
    })
    .join("\n");
}

export interface WATemplateVars {
  bisnis: string;
  format: WAFormat;
  no: string;
  tgl: string;
  pelanggan: string;
  total: string;
  status: string;
  link: string;
  items: string;
}

/**
 * Render template menjadi pesan WA siap kirim.
 * - Placeholder yang tidak diisi (string kosong) akan menghapus
 *   barisnya jika berdiri sendiri agar tidak ada baris kosong
 *   menyisa (mis. `{link}` saat format = struk).
 */
export function renderWATemplate(
  template: string,
  vars: WATemplateVars,
): string {
  const map: Record<string, string> = {
    "{bisnis}": vars.bisnis,
    "{format}": WA_FORMAT_LABEL[vars.format] ?? String(vars.format).toUpperCase(),
    "{no}": vars.no,
    "{tgl}": vars.tgl,
    "{pelanggan}": vars.pelanggan,
    "{total}": vars.total,
    "{status}": vars.status,
    "{link}": vars.link,
    "{items}": vars.items,
  };

  // Replace placeholder pertama lalu pecah jadi baris (penting untuk
  // {items} yang nilainya bisa multi-baris).
  let replaced = template;
  for (const [key, value] of Object.entries(map)) {
    replaced = replaced.split(key).join(value);
  }
  const lines = replaced.split("\n");

  // Buang baris yang hanya berisi placeholder kosong (mis. {link} tanpa nilai)
  const cleaned: string[] = [];
  for (const line of lines) {
    if (line.trim() === "") {
      // collapse multi-empty lines
      if (cleaned.length > 0 && cleaned[cleaned.length - 1] === "") continue;
      cleaned.push("");
    } else {
      cleaned.push(line);
    }
  }
  // trim trailing empty
  while (cleaned.length && cleaned[cleaned.length - 1] === "") cleaned.pop();
  return cleaned.join("\n");
}
