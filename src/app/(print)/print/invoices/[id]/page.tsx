import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { PrintControls } from "@/components/invoices/print-controls";
import type { InvoiceItem, VehicleInfo } from "@/types/database";
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

type Format = "struk" | "nota" | "invoice";

const NOTA_CONFIG_MARKER = "__KATALARA_NOTA_CONFIG__";

function extractNotaConfig(value: string | null | undefined) {
  if (!value) return { visibleText: "", config: null as Record<string, unknown> | null };
  const markerIndex = value.indexOf(NOTA_CONFIG_MARKER);
  if (markerIndex === -1) return { visibleText: value, config: null as Record<string, unknown> | null };
  const visibleText = value.slice(0, markerIndex).trimEnd();
  const rawConfig = value.slice(markerIndex + NOTA_CONFIG_MARKER.length).trim();
  const normalizedConfig = rawConfig.startsWith("{") ? rawConfig : rawConfig.replace(/^_+/, "");
  try {
    return { visibleText, config: JSON.parse(normalizedConfig) as Record<string, unknown> };
  } catch {
    return { visibleText, config: null as Record<string, unknown> | null };
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Struk (thermal receipt ~80mm) ───────────────────────────
function StrukTemplate({
  tenantName,
  notaTitle,
  invoiceNumber,
  createdAt,
  customerName,
  customerPhone,
  vehicleInfo,
  items,
  subtotal,
  discountAmount,
  ppnAmount,
  pphAmount,
  grandTotal,
  notes,
  status,
  storeAddress,
  storePhone,
  notaHeader,
  notaFooter,
}: {
  tenantName: string;
  notaTitle?: string;
  invoiceNumber: string;
  createdAt: string;
  customerName: string;
  customerPhone: string | null;
  vehicleInfo: VehicleInfo | null;
  items: InvoiceItem[];
  subtotal: number;
  discountAmount: number;
  ppnAmount: number;
  pphAmount: number;
  grandTotal: number;
  notes: string | null;
  status: string;
  storeAddress?: string;
  storePhone?: string;
  notaHeader?: string;
  notaFooter?: string;
}) {
  const line = "================================";
  const plate = vehicleInfo?.plate;
  const vehicle = [vehicleInfo?.brand, vehicleInfo?.model].filter(Boolean).join(" ");

  return (
    <div style={{ fontFamily: "monospace", fontSize: "12px", width: "72mm", margin: "0 auto", padding: "4mm", lineHeight: "1.4", position: "relative" }}>
      <div style={{ textAlign: "center", borderBottom: "1px dashed #000", paddingBottom: "6px", marginBottom: "6px" }}>
        <div style={{ fontWeight: "bold", fontSize: "14px" }}>{tenantName}</div>
        {storeAddress && <div style={{ fontSize: "10px", marginTop: "1px" }}>{storeAddress}</div>}
        {storePhone && <div style={{ fontSize: "10px" }}>{storePhone}</div>}
        {notaTitle && <div style={{ fontSize: "10px", marginTop: "2px", fontWeight: "bold" }}>{notaTitle}</div>}
        {notaHeader && <div style={{ fontSize: "10px", marginTop: "3px", borderTop: "1px dashed #ccc", paddingTop: "3px" }}>{notaHeader}</div>}
      </div>

      <div style={{ marginBottom: "4px" }}>
        <div>No   : {invoiceNumber}</div>
        <div>Tgl  : {fmtDate(createdAt)}</div>
        <div>Nama : {customerName}</div>
        {customerPhone && <div>HP   : {customerPhone}</div>}
        {plate && <div>Plat : {plate}{vehicle ? ` (${vehicle})` : ""}</div>}
      </div>

      <div style={{ borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "4px 0", marginBottom: "4px" }}>
        {items.map((item, i) => {
          const total = item.final_price * item.quantity;
          return (
            <div key={item.id} style={{ marginBottom: "3px" }}>
              <div>{i + 1}. {item.description}</div>
              <div style={{ paddingLeft: "12px", display: "flex", justifyContent: "space-between" }}>
                <span>{item.quantity}x @ {fmt(item.final_price)}</span>
                <span>{fmt(total)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginBottom: "4px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Subtotal</span><span>{fmt(subtotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Diskon</span><span>-{fmt(discountAmount)}</span>
          </div>
        )}
        {ppnAmount > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>PPN</span><span>{fmt(ppnAmount)}</span>
          </div>
        )}
        {pphAmount > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>PPh</span><span>-{fmt(pphAmount)}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", borderTop: "1px dashed #000", paddingTop: "3px", marginTop: "3px" }}>
          <span>TOTAL</span><span>{fmt(grandTotal)}</span>
        </div>
      </div>

      {status === "paid" && (
        <div style={{ textAlign: "center", border: "2px dashed #22c55e", color: "#16a34a", padding: "3px", marginBottom: "4px", fontWeight: "bold", fontSize: "10px" }}>
          ✓ LUNAS
        </div>
      )}

      {notes && (
        <div style={{ borderTop: "1px dashed #000", paddingTop: "4px", marginTop: "4px", fontSize: "11px" }}>
          Catatan: {notes}
        </div>
      )}

      <div style={{ textAlign: "center", borderTop: "1px dashed #000", paddingTop: "6px", marginTop: "6px", fontSize: "11px" }}>
        {notaFooter ? (
          <div style={{ whiteSpace: "pre-wrap" }}>{notaFooter}</div>
        ) : (
          <>
            <div>Terima kasih atas kepercayaan Anda</div>
            <div style={{ marginTop: "2px" }}>Simpan struk ini sebagai bukti servis</div>
          </>
        )}
      </div>
      <div style={{ textAlign: "center", marginTop: "4px", fontSize: "10px", color: "#666" }}>{line}</div>
    </div>
  );
}

// ── Nota Kontan (A5) ─────────────────────────────────────────
function NotaTemplate({
  tenantName,
  notaTitle,
  notaTitleSize,
  notaSubtitle,
  notaCustomerLayout,
  notaSignatureLayout,
  showWatermark,
  invoiceNumber,
  createdAt,
  customerName,
  customerPhone,
  vehicleInfo,
  items,
  subtotal,
  discountAmount,
  ppnAmount,
  pphAmount,
  grandTotal,
  notes,
  status,
  storeAddress,
  storePhone,
  signatureUrl,
  stampUrl,
  notaHeader,
  notaFooter,
}: {
  tenantName: string;
  notaTitle?: string;
  notaTitleSize?: number;
  notaSubtitle?: string;
  notaCustomerLayout?: "stacked" | "split";
  notaSignatureLayout?: "double" | "single";
  showWatermark?: boolean;
  invoiceNumber: string;
  createdAt: string;
  customerName: string;
  customerPhone: string | null;
  vehicleInfo: VehicleInfo | null;
  items: InvoiceItem[];
  subtotal: number;
  discountAmount: number;
  ppnAmount: number;
  pphAmount: number;
  grandTotal: number;
  notes: string | null;
  status: string;
  storeAddress?: string;
  storePhone?: string;
  signatureUrl?: string | null;
  stampUrl?: string | null;
  notaHeader?: string;
  notaFooter?: string;
}) {
  const plate = vehicleInfo?.plate;
  const vehicle = [vehicleInfo?.brand, vehicleInfo?.model].filter(Boolean).join(" ");
  const A5_NO_COL = "7mm";
  const A5_QTY_COL = "12mm";
  const A5_PRICE_COL = "24mm";
  const A5_TOTAL_COL = "24mm";
  const A5_ROW_HEIGHT = "7mm";

  return (
    <div style={{ fontFamily: "Arial, sans-serif", fontSize: "11px", width: "148mm", margin: "0 auto", padding: "6mm", position: "relative" }}>
      {showWatermark && status === "paid" && <div className="watermark">LUNAS</div>}
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #000", paddingBottom: "6px", marginBottom: "8px" }}>
        <div>
          <div style={{ fontWeight: "bold", fontSize: "16px" }}>{tenantName}</div>
          {storeAddress && <div style={{ fontSize: "9px", color: "#555", marginTop: "1px" }}>{storeAddress}</div>}
          {storePhone && <div style={{ fontSize: "9px", color: "#555" }}>{storePhone}</div>}
          {notaSubtitle && <div style={{ fontSize: "10px", color: "#555", marginTop: "2px" }}>{notaSubtitle}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: "bold", fontSize: `${Math.max(14, Math.min(34, notaTitleSize ?? 18))}px` }}>{notaTitle || "NOTA KONTAN"}</div>
          <div>{invoiceNumber}</div>
          <div>{fmtDate(createdAt)}</div>
        </div>
      </div>

      {/* Custom header text */}
      {notaHeader && (
        <div style={{ fontSize: "10px", color: "#555", fontStyle: "italic", marginBottom: "6px" }}>{notaHeader}</div>
      )}

      {/* Customer info */}
      {notaCustomerLayout === "split" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "8px", fontSize: "10px" }}>
          <div><span style={{ color: "#666" }}>Nama  : </span>{customerName}</div>
          {customerPhone && <div><span style={{ color: "#666" }}>HP    : </span>{customerPhone}</div>}
          {plate && <div><span style={{ color: "#666" }}>Plat  : </span>{plate}</div>}
          {vehicle && <div><span style={{ color: "#666" }}>Kend. : </span>{vehicle}</div>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginBottom: "8px", fontSize: "10px" }}>
          <div><span style={{ color: "#666" }}>Nama  : </span>{customerName}</div>
          {customerPhone && <div><span style={{ color: "#666" }}>HP    : </span>{customerPhone}</div>}
          {plate && <div><span style={{ color: "#666" }}>Plat  : </span>{plate}</div>}
          {vehicle && <div><span style={{ color: "#666" }}>Kend. : </span>{vehicle}</div>}
        </div>
      )}

      {/* Items table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "8px", fontSize: "10px", borderTop: "1.5px solid #111", borderBottom: "1px solid #d1d5db", tableLayout: "fixed" }}>
        <thead>
          <tr style={{ background: "#f0f0f0", borderBottom: "1px solid #999" }}>
            <th style={{ padding: "4px", textAlign: "left", width: A5_NO_COL }}>No</th>
            <th style={{ padding: "4px", textAlign: "left" }}>Uraian</th>
            <th style={{ padding: "4px", textAlign: "center", width: A5_QTY_COL }}>Qty</th>
            <th style={{ padding: "4px", textAlign: "right", width: A5_PRICE_COL }}>Harga</th>
            <th style={{ padding: "4px", textAlign: "right", width: A5_TOTAL_COL }}>Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "5px 4px", height: A5_ROW_HEIGHT }}>{i + 1}</td>
              <td style={{ padding: "5px 4px", height: A5_ROW_HEIGHT }}>{item.description}</td>
              <td style={{ padding: "5px 4px", textAlign: "center", height: A5_ROW_HEIGHT }}>{item.quantity}</td>
              <td style={{ padding: "5px 4px", textAlign: "right", height: A5_ROW_HEIGHT }}>{fmt(item.final_price)}</td>
              <td style={{ padding: "5px 4px", textAlign: "right", height: A5_ROW_HEIGHT }}>{fmt(item.final_price * item.quantity)}</td>
            </tr>
          ))}
          {Array.from({ length: Math.max(0, 3 - items.length) }).map((_, i) => (
            <tr key={`nota-empty-${i}`} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "10px 4px", height: A5_ROW_HEIGHT }}>&nbsp;</td>
              <td style={{ height: A5_ROW_HEIGHT }} />
              <td style={{ height: A5_ROW_HEIGHT }} />
              <td style={{ height: A5_ROW_HEIGHT }} />
              <td style={{ height: A5_ROW_HEIGHT }} />
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ marginLeft: "auto", width: "148px", fontSize: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
          <span>Subtotal</span><span>{fmt(subtotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
            <span>Diskon</span><span>-{fmt(discountAmount)}</span>
          </div>
        )}
        {ppnAmount > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
            <span>PPN</span><span>{fmt(ppnAmount)}</span>
          </div>
        )}
        {pphAmount > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
            <span>PPh</span><span>-{fmt(pphAmount)}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", borderTop: "2px solid #000", paddingTop: "3px", marginTop: "3px" }}>
          <span>TOTAL</span><span>{fmt(grandTotal)}</span>
        </div>
      </div>

      {/* Status & notes — watermark handles paid indicator */}
      {notes && (
        <div style={{ marginTop: "8px", fontSize: "10px", color: "#555" }}>
          Catatan: {notes}
        </div>
      )}
      {notaFooter && (
        <div style={{ marginTop: "8px", fontSize: "10px", color: "#555", fontStyle: "italic", borderTop: "1px solid #ddd", paddingTop: "6px" }}>{notaFooter}</div>
      )}

      {/* Signatures */}
      {notaSignatureLayout === "single" ? (
        <div style={{ marginTop: "16px", fontSize: "10px", textAlign: "center" }}>
          <div>Hormat Kami,</div>
          {signatureUrl
            ? <img src={signatureUrl} alt="Tanda Tangan" style={{ height: "40px", margin: "4px auto", display: "block", objectFit: "contain" }} />
            : <div style={{ height: "40px" }} />
          }
          {stampUrl && <img src={stampUrl} alt="Stempel" style={{ height: "32px", margin: "0 auto 4px", display: "block", objectFit: "contain" }} />}
          <div style={{ borderTop: "1px solid #000", width: "138px", margin: "0 auto", paddingTop: "3px" }}>{tenantName}</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "16px", fontSize: "10px" }}>
          <div style={{ textAlign: "center" }}>
            <div>Hormat Kami,</div>
            {signatureUrl
              ? <img src={signatureUrl} alt="Tanda Tangan" style={{ height: "40px", margin: "4px auto", display: "block", objectFit: "contain" }} />
              : <div style={{ height: "40px" }} />
            }
            {stampUrl && <img src={stampUrl} alt="Stempel" style={{ height: "32px", margin: "0 auto 4px", display: "block", objectFit: "contain" }} />}
            <div style={{ borderTop: "1px solid #000", width: "138px", margin: "0 auto", paddingTop: "3px" }}>{tenantName}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div>Penerima,</div>
            <div style={{ height: "40px" }} />
            <div style={{ borderTop: "1px solid #000", width: "138px", margin: "0 auto", paddingTop: "3px" }}>{customerName}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Terbilang (Indonesian amount in words) ───────────────────
const SATUAN_KATA = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan"];
const BELASAN_KATA = ["Sepuluh", "Sebelas", "Dua Belas", "Tiga Belas", "Empat Belas", "Lima Belas", "Enam Belas", "Tujuh Belas", "Delapan Belas", "Sembilan Belas"];
function bilangan(n: number): string {
  if (n === 0) return "";
  if (n < 10) return SATUAN_KATA[n] + " ";
  if (n < 20) return BELASAN_KATA[n - 10] + " ";
  if (n < 100) return SATUAN_KATA[Math.floor(n / 10)] + " Puluh " + bilangan(n % 10);
  if (n < 1000) return (Math.floor(n / 100) === 1 ? "Seratus " : SATUAN_KATA[Math.floor(n / 100)] + " Ratus ") + bilangan(n % 100);
  if (n < 1000000) return (Math.floor(n / 1000) === 1 ? "Seribu " : bilangan(Math.floor(n / 1000)) + "Ribu ") + bilangan(n % 1000);
  if (n < 1000000000) return bilangan(Math.floor(n / 1000000)) + "Juta " + bilangan(n % 1000000);
  return bilangan(Math.floor(n / 1000000000)) + "Miliar " + bilangan(n % 1000000000);
}
function terbilangRupiah(n: number): string {
  const rounded = Math.round(n);
  if (rounded === 0) return "Nol Rupiah";
  return bilangan(rounded).trim() + " Rupiah";
}

// ── Invoice Profesional (A4) ─────────────────────────────────
function InvoiceTemplate({
  tenantName,
  notaTitle,
  notaTitleSize,
  notaJabatan,
  showWatermark,
  invoiceNumber,
  createdAt,
  dueDate,
  customerName,
  customerPhone,
  vehicleInfo,
  items,
  subtotal,
  discountAmount,
  ppnPct,
  ppnAmount,
  pphPct,
  pphAmount,
  shippingCost,
  grandTotal,
  notes,
  status,
  paidAt,
  paymentMethod,
  storeAddress,
  storePhone,
  storeEmail,
  storeLogoUrl,
  signatureUrl,
  stampUrl,
  notaHeader,
  notaFooter,
}: {
  tenantName: string;
  notaTitle?: string;
  notaTitleSize?: number;
  notaJabatan?: string;
  showWatermark?: boolean;
  invoiceNumber: string;
  createdAt: string;
  dueDate?: string | null;
  customerName: string;
  customerPhone: string | null;
  vehicleInfo: VehicleInfo | null;
  items: InvoiceItem[];
  subtotal: number;
  discountAmount: number;
  ppnPct: number;
  ppnAmount: number;
  pphPct: number;
  pphAmount: number;
  shippingCost?: number;
  grandTotal: number;
  notes: string | null;
  status: string;
  paidAt: string | null;
  paymentMethod: string | null;
  storeAddress?: string;
  storePhone?: string;
  storeEmail?: string;
  storeLogoUrl?: string | null;
  signatureUrl?: string | null;
  stampUrl?: string | null;
  notaHeader?: string;
  notaFooter?: string;
}) {
  const plate = vehicleInfo?.plate;
  const vehicle = [vehicleInfo?.brand, vehicleInfo?.model, vehicleInfo?.year ? String(vehicleInfo.year) : null].filter(Boolean).join(" ");
  const sisaTagihan = status === "paid" ? 0 : grandTotal;
  const A4_BOX_HEIGHT = "31mm";
  const A4_NO_COL = "8mm";
  const A4_QTY_COL = "16mm";
  const A4_UNIT_COL = "12mm";
  const A4_PRICE_COL = "24mm";
  const A4_TOTAL_COL = "26mm";
  const A4_ROW_HEIGHT = "8.2mm";

  return (
    <div style={{ fontFamily: "Arial, sans-serif", fontSize: "12px", maxWidth: "190mm", margin: "0 auto", padding: "10mm 12mm", color: "#1a1a1a", position: "relative" }}>
      {showWatermark && status === "paid" && <div className="watermark">LUNAS</div>}

      {/* ── TOP: Logo left + INVOICE title center ── */}
      <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: "10px", alignItems: "center", marginBottom: "4px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          {storeLogoUrl
            ? <img src={storeLogoUrl} alt="Logo" style={{ width: "80px", height: "80px", objectFit: "contain" }} />
            : <div style={{ width: "80px", height: "80px", borderRadius: "50%", border: "3px solid #b45309", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px", fontWeight: "bold", color: "#b45309" }}>{tenantName.charAt(0)}</div>
          }
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: "900", fontSize: `${Math.max(18, Math.min(42, notaTitleSize ?? 28))}px`, letterSpacing: "8px" }}>{(notaTitle || "INVOICE").toUpperCase()}</div>
          <div style={{ fontSize: "11px", marginTop: "3px" }}>Nomor : {invoiceNumber}</div>
        </div>
      </div>

      {/* ── Tanggal / Jatuh Tempo ── */}
      <div style={{ marginBottom: "8px", fontSize: "10px" }}>
        <div>Tanggal : {fmtDate(createdAt)}</div>
          {dueDate && <div>Tgl. Jatuh Tempo : {fmtDate(dueDate)}</div>}
      </div>

      {/* ── Labels ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "4px", fontSize: "10px", fontWeight: "bold" }}>
        <div>Tagihan Kepada</div>
        <div>Informasi Perusahaan</div>
      </div>

      {/* ── Two boxes: customer left, company info right ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "14px" }}>
        <div style={{ border: "1px solid #000", padding: "8px 10px", fontSize: "10px", minHeight: A4_BOX_HEIGHT }}>
          <div style={{ fontWeight: "bold", fontSize: "12px" }}>{customerName}</div>
          {customerPhone && <div style={{ marginTop: "3px" }}>{customerPhone}</div>}
          {plate && <div style={{ marginTop: "2px" }}>{plate}{vehicle ? ` - ${vehicle}` : ""}</div>}
        </div>
        <div style={{ border: "1px solid #000", padding: "8px 10px", fontSize: "10px", minHeight: A4_BOX_HEIGHT }}>
          <div style={{ fontWeight: "bold" }}>{tenantName}</div>
          {storeAddress && <div style={{ marginTop: "3px", color: "#444" }}>{storeAddress}</div>}
          {storePhone && <div style={{ color: "#444" }}>{storePhone}</div>}
          {storeEmail && <div style={{ color: "#444" }}>Email: {storeEmail}</div>}
        </div>
      </div>

      {/* ── Items table (double header row) ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", border: "1.5px solid #222", tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th rowSpan={2} style={{ border: "1px solid #222", padding: "6px 6px", textAlign: "center", width: A4_NO_COL, fontSize: "10px", verticalAlign: "middle", fontWeight: 700 }}>No.</th>
            <th rowSpan={2} style={{ border: "1px solid #222", padding: "6px 8px", textAlign: "left", fontSize: "10px", verticalAlign: "middle", fontWeight: 700 }}>Deskripsi</th>
            <th rowSpan={2} style={{ border: "1px solid #222", padding: "6px 6px", textAlign: "center", width: A4_QTY_COL, fontSize: "10px", verticalAlign: "middle", fontWeight: 700 }}>Kuantitas</th>
            <th rowSpan={2} style={{ border: "1px solid #222", padding: "6px 6px", textAlign: "center", width: A4_UNIT_COL, fontSize: "10px", verticalAlign: "middle", fontWeight: 700 }}>Satuan</th>
            <th colSpan={2} style={{ border: "1px solid #222", padding: "6px 6px", textAlign: "center", fontSize: "10px", fontWeight: 700 }}>Harga</th>
          </tr>
          <tr>
            <th style={{ border: "1px solid #222", padding: "4px 6px", textAlign: "right", width: A4_PRICE_COL, fontSize: "10px", fontWeight: 700 }}>/ Unit</th>
            <th style={{ border: "1px solid #222", padding: "4px 6px", textAlign: "right", width: A4_TOTAL_COL, fontSize: "10px", fontWeight: 700 }}>Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const unitPrice = item.quantity > 0 ? item.final_price / item.quantity : item.final_price;
            return (
              <tr key={item.id}>
                <td style={{ borderLeft: "1px solid #b3b3b3", borderRight: "1px solid #b3b3b3", padding: "8px 6px", textAlign: "center", fontSize: "10px", height: A4_ROW_HEIGHT }}>{i + 1}</td>
                <td style={{ borderLeft: "1px solid #b3b3b3", borderRight: "1px solid #b3b3b3", padding: "8px 8px", fontSize: "10px", height: A4_ROW_HEIGHT }}>
                  <div style={{ fontWeight: "500" }}>{item.description}</div>
                </td>
                <td style={{ borderLeft: "1px solid #b3b3b3", borderRight: "1px solid #b3b3b3", padding: "8px 6px", textAlign: "center", fontSize: "10px", height: A4_ROW_HEIGHT }}>{item.quantity}</td>
                <td style={{ borderLeft: "1px solid #b3b3b3", borderRight: "1px solid #b3b3b3", padding: "8px 6px", textAlign: "center", fontSize: "10px", height: A4_ROW_HEIGHT }}>{item.unit_label || "Unit"}</td>
                <td style={{ borderLeft: "1px solid #b3b3b3", borderRight: "1px solid #b3b3b3", padding: "8px 6px", textAlign: "right", fontSize: "10px", height: A4_ROW_HEIGHT }}>{unitPrice.toLocaleString("id-ID")}</td>
                <td style={{ borderLeft: "1px solid #b3b3b3", borderRight: "1px solid #b3b3b3", padding: "8px 6px", textAlign: "right", fontSize: "10px", height: A4_ROW_HEIGHT }}>{item.final_price.toLocaleString("id-ID")}</td>
              </tr>
            );
          })}
          {Array.from({ length: Math.max(0, 7 - items.length) }).map((_, i) => (
            <tr key={`empty-${i}`}>
              <td style={{ borderLeft: "1px solid #b3b3b3", borderRight: "1px solid #b3b3b3", padding: "18px 6px", height: A4_ROW_HEIGHT }}>&nbsp;</td>
              <td style={{ borderLeft: "1px solid #b3b3b3", borderRight: "1px solid #b3b3b3", height: A4_ROW_HEIGHT }} />
              <td style={{ borderLeft: "1px solid #b3b3b3", borderRight: "1px solid #b3b3b3", height: A4_ROW_HEIGHT }} />
              <td style={{ borderLeft: "1px solid #b3b3b3", borderRight: "1px solid #b3b3b3", height: A4_ROW_HEIGHT }} />
              <td style={{ borderLeft: "1px solid #b3b3b3", borderRight: "1px solid #b3b3b3", height: A4_ROW_HEIGHT }} />
              <td style={{ borderLeft: "1px solid #b3b3b3", borderRight: "1px solid #b3b3b3", height: A4_ROW_HEIGHT }} />
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Terbilang (left) + Totals (right) — same row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 230px", border: "1px solid #999", borderTop: "none" }}>
        <div style={{ padding: "8px 10px", fontSize: "10px", borderRight: "1px solid #999" }}>
          <div style={{ fontWeight: "bold", marginBottom: "3px" }}>Terbilang:</div>
          <div style={{ color: "#d97706", fontStyle: "italic" }}>{terbilangRupiah(grandTotal)}</div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
          <tbody>
            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
              <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0" }}>Subtotal</td>
              <td style={{ padding: "4px 8px", textAlign: "right" }}>{fmt(subtotal)}</td>
            </tr>
            {discountAmount > 0 && (
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0" }}>Diskon</td>
                <td style={{ padding: "4px 8px", textAlign: "right", color: "#dc2626" }}>-{fmt(discountAmount)}</td>
              </tr>
            )}
            {ppnAmount > 0 && (
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0" }}>PPN ({ppnPct}%)</td>
                <td style={{ padding: "4px 8px", textAlign: "right" }}>{fmt(ppnAmount)}</td>
              </tr>
            )}
            {pphAmount > 0 && (
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0" }}>PPh ({pphPct}%)</td>
                <td style={{ padding: "4px 8px", textAlign: "right", color: "#dc2626" }}>-{fmt(pphAmount)}</td>
              </tr>
            )}
            {(shippingCost ?? 0) > 0 && (
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0" }}>Biaya Kirim</td>
                <td style={{ padding: "4px 8px", textAlign: "right" }}>{fmt(shippingCost ?? 0)}</td>
              </tr>
            )}
            <tr style={{ borderBottom: "1px solid #ccc" }}>
              <td style={{ padding: "4px 8px", fontWeight: "bold", borderRight: "1px solid #e2e8f0" }}>Total</td>
              <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: "bold" }}>{fmt(grandTotal)}</td>
            </tr>
            <tr>
              <td style={{ padding: "4px 8px", fontWeight: "bold", borderRight: "1px solid #e2e8f0" }}>Sisa Tagihan</td>
              <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: "bold" }}>{fmt(sisaTagihan)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Pesan (left) + Signature (right) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "16px", fontSize: "10px" }}>
        <div>
          {(notes || notaHeader || notaFooter) && (
            <>
              <div style={{ fontWeight: "bold", marginBottom: "4px" }}>Pesan</div>
              {notaHeader && <div style={{ marginBottom: "2px" }}>{notaHeader}</div>}
              {notes && <div style={{ marginBottom: "2px" }}>{notes}</div>}
              {notaFooter && <div style={{ color: "#666" }}>{notaFooter}</div>}
            </>
          )}
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ marginBottom: "4px" }}>Dengan Hormat,</div>
          <div style={{ height: "30mm", width: "62mm", margin: "0 auto 2mm", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {signatureUrl
              ? <img src={signatureUrl} alt="Tanda Tangan" style={{ height: "16mm", maxWidth: "56mm", objectFit: "contain", zIndex: 2 }} />
              : null
            }
            {stampUrl
              ? <img src={stampUrl} alt="Stempel" style={{ height: "17mm", maxWidth: "24mm", position: "absolute", right: "8mm", top: "7mm", opacity: 0.78, objectFit: "contain", zIndex: 1 }} />
              : null
            }
          </div>
          <div style={{ borderTop: "1px solid #000", width: "58mm", margin: "0 auto", paddingTop: "4px" }}>{tenantName}</div>
          <div style={{ color: "#888" }}>{notaJabatan || "Jabatan"}</div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: inv } = await supabase
    .from("invoices")
    .select("invoice_number, grand_total, status, paid_at, tenant_id, customer_id")
    .eq("id", id)
    .single();
  if (!inv) {
    return { title: "Invoice tidak ditemukan", robots: { index: false, follow: false } };
  }
  const [{ data: settings }, { data: tenant }, { data: cust }] = await Promise.all([
    supabase.from("settings").select("store_name, store_logo_url").eq("tenant_id", inv.tenant_id).single(),
    supabase.from("tenants").select("name").eq("id", inv.tenant_id).single(),
    inv.customer_id
      ? supabase.from("customers").select("name").eq("id", inv.customer_id).single()
      : Promise.resolve({ data: null }),
  ]);
  const bisnis =
    (settings as { store_name?: string | null } | null)?.store_name?.trim() ||
    (tenant as { name?: string | null } | null)?.name ||
    "Bengkel";
  const logo = (settings as { store_logo_url?: string | null } | null)?.store_logo_url ?? undefined;
  const total = formatRupiah(Number(inv.grand_total ?? 0));
  const statusLabel = formatInvoiceStatusID(inv.status as string, inv.paid_at);
  const custName = (cust as { name?: string } | null)?.name ?? "Pelanggan";
  const title = `${inv.invoice_number} — ${bisnis}`;
  const description = `Invoice untuk ${custName} • Total ${total} • ${statusLabel}.`;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      type: "website",
      siteName: bisnis,
      title,
      description,
      ...(logo ? { images: [{ url: logo }] } : {}),
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function PrintInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ format?: string }>;
}) {
  const { id } = await params;
  const { format: rawFormat } = await searchParams;

  // Halaman ini publik (lihat middleware PUBLIC_PATHS). Pakai admin client
  // agar bisa fetch invoice tanpa session — tenant_id diambil dari row invoice
  // itu sendiri, lalu settings tenant dimuat berdasarkan tenant_id tersebut.
  const supabase = createAdminClient();
  const { data: invoiceData } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .single();
  if (!invoiceData) notFound();

  const tenantId = invoiceData.tenant_id;

  const [{ data: customer }, { data: items }, { data: settings }, { data: tenantRow }] = await Promise.all([
    invoiceData.customer_id
      ? supabase.from("customers").select("name, phone, vehicle_info").eq("id", invoiceData.customer_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("invoice_items").select("*").eq("invoice_id", id).order("created_at", { ascending: true }),
    supabase
      .from("settings")
      .select("store_name, store_address, store_phone, store_email, store_logo_url, nota_title, nota_title_size, nota_jabatan, nota_show_watermark, nota_header, nota_footer, nota_signature_url, nota_stamp_url, nota_active_format, wa_message_template")
      .eq("tenant_id", tenantId)
      .single(),
    supabase.from("tenants").select("name").eq("id", tenantId).single(),
  ]);

  const tenantName =
    (settings as { store_name?: string } | null)?.store_name ||
    (tenantRow as { name?: string } | null)?.name ||
    "Bengkel";
  const storeAddress = (settings as { store_address?: string } | null)?.store_address ?? "";
  const storePhone = (settings as { store_phone?: string } | null)?.store_phone ?? "";
  const storeEmail = (settings as { store_email?: string } | null)?.store_email ?? "";
  const storeLogoUrl = (settings as { store_logo_url?: string } | null)?.store_logo_url ?? null;
  const legacyHeader = extractNotaConfig((settings as { nota_header?: string } | null)?.nota_header ?? "");
  const legacyConfig = legacyHeader.config ?? {};
  const hasLegacyNotaConfig = Boolean(legacyHeader.config);
  const notaTitle = hasLegacyNotaConfig
    ? ((legacyConfig.nota_title as string | undefined) ?? (settings as { nota_title?: string } | null)?.nota_title ?? "")
    : ((settings as { nota_title?: string } | null)?.nota_title ?? (legacyConfig.nota_title as string | undefined) ?? "");
  const notaTitleSizeRaw = hasLegacyNotaConfig
    ? ((legacyConfig.nota_title_size as number | undefined) ?? (settings as { nota_title_size?: number } | null)?.nota_title_size ?? 28)
    : ((settings as { nota_title_size?: number } | null)?.nota_title_size ?? (legacyConfig.nota_title_size as number | undefined) ?? 28);
  const notaTitleSize = Number.isFinite(Number(notaTitleSizeRaw)) ? Number(notaTitleSizeRaw) : 28;
  const notaSubtitle = hasLegacyNotaConfig
    ? ((legacyConfig.nota_subtitle as string | undefined) ?? (settings as { nota_subtitle?: string } | null)?.nota_subtitle ?? "")
    : ((settings as { nota_subtitle?: string } | null)?.nota_subtitle ?? (legacyConfig.nota_subtitle as string | undefined) ?? "");
  const notaCustomerLayout = hasLegacyNotaConfig
    ? ((legacyConfig.nota_customer_layout as "stacked" | "split" | undefined) ?? (settings as { nota_customer_layout?: "stacked" | "split" } | null)?.nota_customer_layout ?? "stacked")
    : ((settings as { nota_customer_layout?: "stacked" | "split" } | null)?.nota_customer_layout ?? (legacyConfig.nota_customer_layout as "stacked" | "split" | undefined) ?? "stacked");
  const notaSignatureLayout = hasLegacyNotaConfig
    ? ((legacyConfig.nota_signature_layout as "double" | "single" | undefined) ?? (settings as { nota_signature_layout?: "double" | "single" } | null)?.nota_signature_layout ?? "double")
    : ((settings as { nota_signature_layout?: "double" | "single" } | null)?.nota_signature_layout ?? (legacyConfig.nota_signature_layout as "double" | "single" | undefined) ?? "double");
  const notaJabatan = hasLegacyNotaConfig
    ? ((legacyConfig.nota_jabatan as string | undefined) ?? (settings as { nota_jabatan?: string } | null)?.nota_jabatan ?? "")
    : ((settings as { nota_jabatan?: string } | null)?.nota_jabatan ?? (legacyConfig.nota_jabatan as string | undefined) ?? "");
  const notaShowWatermark = hasLegacyNotaConfig
    ? ((legacyConfig.nota_show_watermark as boolean | undefined) ?? (settings as { nota_show_watermark?: boolean } | null)?.nota_show_watermark ?? true)
    : ((settings as { nota_show_watermark?: boolean } | null)?.nota_show_watermark ?? (legacyConfig.nota_show_watermark as boolean | undefined) ?? true);
  const notaHeader = legacyHeader.visibleText;
  const notaFooter = (settings as { nota_footer?: string } | null)?.nota_footer ?? "";
  const signatureUrl = (settings as { nota_signature_url?: string } | null)?.nota_signature_url ?? null;
  const stampUrl = (settings as { nota_stamp_url?: string } | null)?.nota_stamp_url ?? null;
  const notaActiveFormat = (settings as { nota_active_format?: string } | null)?.nota_active_format;
  const defaultFormat: Format = notaActiveFormat === "A5" ? "nota" : notaActiveFormat === "thermal" ? "struk" : "invoice";
  const format: Format = (rawFormat === "struk" || rawFormat === "nota" || rawFormat === "invoice") ? rawFormat : defaultFormat;
  const customerName = customer?.name ?? "-";
  const customerPhone = customer?.phone ?? null;
  const vehicleInfo = (customer?.vehicle_info as VehicleInfo | null) ?? null;
  const inv = invoiceData;
  const subtotalDisplay = Number(inv.subtotal) + Number(inv.total_markup);

  const commonProps = {
    tenantName,
    notaTitle,
    notaTitleSize,
    notaSubtitle,
    notaCustomerLayout,
    notaSignatureLayout,
    notaJabatan,
    showWatermark: format === "struk" ? false : notaShowWatermark,
    invoiceNumber: inv.invoice_number,
    createdAt: (inv as { invoice_date?: string }).invoice_date ?? inv.created_at,
    dueDate: (inv as { due_date?: string }).due_date ?? null,
    customerName,
    customerPhone,
    vehicleInfo,
    items: (items ?? []) as InvoiceItem[],
    subtotal: subtotalDisplay,
    discountAmount: Number(inv.discount_amount ?? 0),
    ppnAmount: Number(inv.ppn_amount ?? 0),
    pphAmount: Number(inv.pph_amount ?? 0),
    shippingCost: Number((inv as { shipping_cost?: number }).shipping_cost ?? 0),
    grandTotal: Number(inv.grand_total),
    notes: inv.notes,
    status: inv.status,
    storeAddress,
    storePhone,
    storeEmail,
    storeLogoUrl,
    notaHeader,
    notaFooter,
    signatureUrl,
    stampUrl,
  };

  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "";
  const previewUrl = host
    ? `${proto}://${host}/print/invoices/${id}?format=${format}`
    : `/print/invoices/${id}?format=${format}`;

  const waTemplate =
    (settings as { wa_message_template?: string | null } | null)?.wa_message_template?.trim() ||
    DEFAULT_WA_TEMPLATE;
  const waBody = renderWATemplate(waTemplate, {
    bisnis: tenantName,
    format: format as WAFormat,
    no: inv.invoice_number,
    tgl: formatDateID((inv as { invoice_date?: string }).invoice_date ?? inv.created_at),
    pelanggan: (customerName ?? "Pelanggan").toUpperCase(),
    total: formatRupiah(Number(inv.grand_total)),
    status: formatInvoiceStatusID(inv.status as string, inv.paid_at),
    link: previewUrl,
    items: buildItemsBlock(
      ((items ?? []) as InvoiceItem[]).map((it) => ({
        description: it.description,
        quantity: Number(it.quantity ?? 1),
        final_price: Number(it.final_price ?? 0),
        unit_label: (it as { unit_label?: string | null }).unit_label ?? null,
      })),
    ),
    subtotal: formatRupiah(Number((inv as { subtotal?: number }).subtotal ?? 0)),
    rincian: buildRincianBlock({
      subtotal: Number((inv as { subtotal?: number }).subtotal ?? 0),
      discount: Number((inv as { discount_amount?: number }).discount_amount ?? 0),
      ppnPct: Number((inv as { ppn_pct?: number }).ppn_pct ?? 0),
      ppnAmount: Number((inv as { ppn_amount?: number }).ppn_amount ?? 0),
      pphPct: Number((inv as { pph_pct?: number }).pph_pct ?? 0),
      pphAmount: Number((inv as { pph_amount?: number }).pph_amount ?? 0),
      shipping: Number((inv as { shipping_cost?: number }).shipping_cost ?? 0),
      dp: Number((inv as { dp_amount?: number }).dp_amount ?? 0),
    }),
  });
  const waMessage = encodeURIComponent(waBody);
  const waLink = customerPhone
    ? `https://wa.me/${customerPhone.replace(/[^0-9]/g, "").replace(/^0/, "62")}?text=${waMessage}`
    : null;

  return (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`${tenantName} • ${inv.invoice_number}`}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #f3f4f6; font-family: Arial, sans-serif; }
          .print-controls { background: #1e293b; color: white; padding: 10px 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
          .print-controls button, .print-controls a { padding: 7px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
          .btn-primary { background: #2563eb; color: white; }
          .btn-primary:hover { background: #1d4ed8; }
          .btn-green { background: #16a34a; color: white; }
          .btn-green:hover { background: #15803d; }
          .btn-secondary { background: #334155; color: white; }
          .btn-secondary:hover { background: #475569; }
          .format-badge { font-size: 11px; padding: 3px 10px; border-radius: 12px; background: #334155; }
          .invoice-wrap { padding: 16px; }
          .invoice-paper { background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin: 0 auto; }
          .watermark {
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 110px; font-weight: 900;
            color: rgba(22,163,74,0.10); pointer-events: none;
            z-index: 9999; letter-spacing: 12px; white-space: nowrap;
            user-select: none;
          }
          @media print {
            .print-controls { display: none !important; }
            body { background: white; }
            .invoice-wrap { padding: 0; }
            .invoice-paper { box-shadow: none; }
            .watermark { color: rgba(22,163,74,0.13); }
            ${format === "nota" ? "@page { size: A5 portrait; margin: 8mm; }" :
              format === "struk" ? "@page { size: 80mm auto; margin: 2mm 0; }" :
              "@page { size: A4 portrait; margin: 12mm; }"}
          }
        `}</style>
      </head>
      <body>
        <PrintControls waLink={waLink} invoiceNumber={inv.invoice_number} format={format} />

        <div className="invoice-wrap">
          <div className="invoice-paper" style={{ maxWidth: format === "struk" ? "96mm" : format === "nota" ? "148mm" : "210mm" }}>
            {format === "struk" && <StrukTemplate {...commonProps} />}
            {format === "nota" && <NotaTemplate {...commonProps} />}
            {format === "invoice" && (
              <InvoiceTemplate
                {...commonProps}
                ppnPct={Number(inv.ppn_pct ?? 0)}
                pphPct={Number(inv.pph_pct ?? 0)}
                paidAt={inv.paid_at}
                paymentMethod={inv.payment_method}
              />
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
