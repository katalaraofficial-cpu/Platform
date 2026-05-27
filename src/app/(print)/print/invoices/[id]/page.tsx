import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import { notFound } from "next/navigation";
import { PrintControls } from "@/components/invoices/print-controls";
import type { InvoiceItem, VehicleInfo } from "@/types/database";

type Format = "struk" | "nota" | "invoice";

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
    <div style={{ fontFamily: "monospace", fontSize: "12px", width: "72mm", margin: "0 auto", padding: "4mm", lineHeight: "1.4" }}>
      <div style={{ textAlign: "center", borderBottom: "1px dashed #000", paddingBottom: "6px", marginBottom: "6px" }}>
        <div style={{ fontWeight: "bold", fontSize: "14px" }}>{tenantName}</div>
        {storeAddress && <div style={{ fontSize: "10px", marginTop: "1px" }}>{storeAddress}</div>}
        {storePhone && <div style={{ fontSize: "10px" }}>{storePhone}</div>}
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
        <div style={{ textAlign: "center", border: "2px solid #000", padding: "3px", marginBottom: "4px", fontWeight: "bold" }}>
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

  return (
    <div style={{ fontFamily: "Arial, sans-serif", fontSize: "11px", width: "148mm", margin: "0 auto", padding: "8mm", border: "1px solid #ccc" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #000", paddingBottom: "6px", marginBottom: "8px" }}>
        <div>
          <div style={{ fontWeight: "bold", fontSize: "16px" }}>{tenantName}</div>
          {storeAddress && <div style={{ fontSize: "9px", color: "#555", marginTop: "1px" }}>{storeAddress}</div>}
          {storePhone && <div style={{ fontSize: "9px", color: "#555" }}>{storePhone}</div>}
          <div style={{ fontSize: "10px", color: "#555", marginTop: "2px" }}>NOTA SERVIS KENDARAAN</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: "bold" }}>NOTA KONTAN</div>
          <div>{invoiceNumber}</div>
          <div>{fmtDate(createdAt)}</div>
        </div>
      </div>

      {/* Custom header text */}
      {notaHeader && (
        <div style={{ fontSize: "10px", color: "#555", fontStyle: "italic", marginBottom: "6px" }}>{notaHeader}</div>
      )}

      {/* Customer info */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", marginBottom: "8px", fontSize: "10px" }}>
        <div><span style={{ color: "#666" }}>Nama  : </span>{customerName}</div>
        {customerPhone && <div><span style={{ color: "#666" }}>HP    : </span>{customerPhone}</div>}
        {plate && <div><span style={{ color: "#666" }}>Plat  : </span>{plate}</div>}
        {vehicle && <div><span style={{ color: "#666" }}>Kend. : </span>{vehicle}</div>}
      </div>

      {/* Items table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "8px", fontSize: "10px" }}>
        <thead>
          <tr style={{ background: "#f0f0f0", borderBottom: "1px solid #999" }}>
            <th style={{ padding: "4px", textAlign: "left", width: "24px" }}>No</th>
            <th style={{ padding: "4px", textAlign: "left" }}>Uraian</th>
            <th style={{ padding: "4px", textAlign: "center", width: "32px" }}>Qty</th>
            <th style={{ padding: "4px", textAlign: "right", width: "72px" }}>Harga</th>
            <th style={{ padding: "4px", textAlign: "right", width: "72px" }}>Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "3px 4px" }}>{i + 1}</td>
              <td style={{ padding: "3px 4px" }}>{item.description}</td>
              <td style={{ padding: "3px 4px", textAlign: "center" }}>{item.quantity}</td>
              <td style={{ padding: "3px 4px", textAlign: "right" }}>{fmt(item.final_price)}</td>
              <td style={{ padding: "3px 4px", textAlign: "right" }}>{fmt(item.final_price * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ marginLeft: "auto", width: "140px", fontSize: "10px" }}>
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

      {/* Status & notes */}
      {status === "paid" && (
        <div style={{ textAlign: "center", border: "2px solid #22c55e", color: "#16a34a", padding: "4px", marginTop: "8px", fontWeight: "bold" }}>
          ✓ LUNAS
        </div>
      )}
      {notes && (
        <div style={{ marginTop: "8px", fontSize: "10px", color: "#555" }}>
          Catatan: {notes}
        </div>
      )}
      {notaFooter && (
        <div style={{ marginTop: "8px", fontSize: "10px", color: "#555", fontStyle: "italic", borderTop: "1px solid #ddd", paddingTop: "6px" }}>{notaFooter}</div>
      )}

      {/* Signatures */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "16px", fontSize: "10px" }}>
        <div style={{ textAlign: "center" }}>
          <div>Hormat Kami,</div>
          {signatureUrl
            ? <img src={signatureUrl} alt="Tanda Tangan" style={{ height: "40px", margin: "4px auto", display: "block", objectFit: "contain" }} />
            : <div style={{ height: "40px" }} />
          }
          {stampUrl && <img src={stampUrl} alt="Stempel" style={{ height: "32px", margin: "0 auto 4px", display: "block", objectFit: "contain" }} />}
          <div style={{ borderTop: "1px solid #000", paddingTop: "3px" }}>{tenantName}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div>Penerima,</div>
          <div style={{ height: "40px" }} />
          <div style={{ borderTop: "1px solid #000", paddingTop: "3px" }}>{customerName}</div>
        </div>
      </div>
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
  const methodLabel = paymentMethod === "cash" ? "Tunai" : paymentMethod === "transfer" ? "Transfer Bank" : paymentMethod === "other" ? "Lainnya" : "-";
  const sisaTagihan = status === "paid" ? 0 : grandTotal;

  return (
    <div style={{ fontFamily: "Arial, sans-serif", fontSize: "12px", maxWidth: "190mm", margin: "0 auto", padding: "10mm 12mm", color: "#1a1a1a" }}>

      {/* ── TOP: Logo left + Invoice title center + company right ── */}
      <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr", gap: "8px", alignItems: "flex-start", marginBottom: "10px" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          {storeLogoUrl
            ? <img src={storeLogoUrl} alt="Logo" style={{ width: "52px", height: "52px", objectFit: "contain", borderRadius: "50%" }} />
            : <div style={{ width: "52px", height: "52px", borderRadius: "50%", border: "2px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: "bold", color: "#94a3b8" }}>{tenantName.charAt(0)}</div>
          }
        </div>

        {/* Center: INVOICE title + nomor + tanggal */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: "bold", fontSize: "22px", letterSpacing: "3px", color: "#1e3a5f" }}>INVOICE</div>
          <div style={{ fontSize: "11px", marginTop: "2px" }}>Nomor : {invoiceNumber}</div>
          <div style={{ fontSize: "10px", color: "#64748b", marginTop: "6px", textAlign: "left", paddingLeft: "10px" }}>
            <div>Tanggal &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {fmtDate(createdAt)}</div>
            {dueDate && <div style={{ color: "#dc2626" }}>Tgl. Jatuh Tempo : {fmtDate(dueDate)}</div>}
          </div>
        </div>

        {/* Right: company info */}
        <div style={{ textAlign: "right", fontSize: "10px" }}>
          <div style={{ fontWeight: "bold", fontSize: "13px", color: "#1e3a5f" }}>{tenantName}</div>
          {storeAddress && <div style={{ color: "#555", marginTop: "2px" }}>{storeAddress}</div>}
          {storePhone && <div style={{ color: "#555" }}>Telp: {storePhone}</div>}
          {storeEmail && <div style={{ color: "#555" }}>Email: {storeEmail}</div>}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: "2px", background: "#1e3a5f", marginBottom: "8px" }} />

      {/* ── Tagihan Kepada label + Informasi Perusahaan label ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "4px" }}>
        <div style={{ fontSize: "10px", fontWeight: "bold", color: "#64748b" }}>Tagihan Kepada</div>
        <div style={{ fontSize: "10px", fontWeight: "bold", color: "#64748b", textAlign: "right" }}>Status Pembayaran</div>
      </div>

      {/* ── Two boxes: customer left, payment info right ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "14px" }}>
        <div style={{ border: "1px solid #cbd5e1", borderRadius: "4px", padding: "8px 10px", fontSize: "10px", minHeight: "54px" }}>
          <div style={{ fontWeight: "bold", fontSize: "12px" }}>{customerName}</div>
          {customerPhone && <div style={{ color: "#555", marginTop: "2px" }}>{customerPhone}</div>}
          {plate && <div style={{ color: "#555", marginTop: "1px" }}>{plate}{vehicle ? ` · ${vehicle}` : ""}</div>}
        </div>
        <div style={{ border: "1px solid #cbd5e1", borderRadius: "4px", padding: "8px 10px", fontSize: "10px", minHeight: "54px" }}>
          <div style={{
            display: "inline-block", padding: "2px 10px", borderRadius: "12px", fontWeight: "bold", fontSize: "10px", marginBottom: "4px",
            background: status === "paid" ? "#dcfce7" : status === "cancelled" ? "#fee2e2" : "#fef9c3",
            color: status === "paid" ? "#16a34a" : status === "cancelled" ? "#dc2626" : "#854d0e",
          }}>
            {status === "paid" ? "✓ LUNAS" : status === "cancelled" ? "DIBATALKAN" : status === "completed" ? "SELESAI" : status === "in_progress" ? "DIKERJAKAN" : "DRAFT"}
          </div>
          {status === "paid" && paidAt && (
            <div style={{ color: "#555" }}>Dibayar: {fmtDate(paidAt)}<br />Metode: {methodLabel}</div>
          )}
        </div>
      </div>

      {/* ── Items table ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "0" }}>
        <thead>
          <tr style={{ background: "#1e3a5f", color: "#fff" }}>
            <th style={{ padding: "6px 8px", textAlign: "center", fontWeight: "600", fontSize: "10px", width: "24px" }}>No.</th>
            <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: "600", fontSize: "10px" }}>Deskripsi</th>
            <th style={{ padding: "6px 8px", textAlign: "center", fontWeight: "600", fontSize: "10px", width: "54px" }}>Kuantitas</th>
            <th style={{ padding: "6px 8px", textAlign: "center", fontWeight: "600", fontSize: "10px", width: "44px" }}>Satuan</th>
            <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: "600", fontSize: "10px", width: "90px" }}>Harga / Unit</th>
            <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: "600", fontSize: "10px", width: "90px" }}>Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const unitPrice = item.quantity > 0 ? item.final_price / item.quantity : item.final_price;
            return (
              <tr key={item.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "6px 8px", textAlign: "center", fontSize: "10px" }}>{i + 1}</td>
                <td style={{ padding: "6px 8px", fontSize: "11px" }}>
                  <div>{item.description}</div>
                  <div style={{ fontSize: "8px", marginTop: "1px",
                    color: item.item_type === "service" ? "#1d4ed8" : "#92400e" }}>
                    {item.item_type === "service" ? "Jasa" : "Part"}
                  </div>
                </td>
                <td style={{ padding: "6px 8px", textAlign: "center", fontSize: "11px" }}>{item.quantity}</td>
                <td style={{ padding: "6px 8px", textAlign: "center", fontSize: "10px", color: "#555" }}>{item.unit_label || "-"}</td>
                <td style={{ padding: "6px 8px", textAlign: "right", fontSize: "10px" }}>{fmt(unitPrice)}</td>
                <td style={{ padding: "6px 8px", textAlign: "right", fontSize: "11px", fontWeight: "500" }}>{fmt(item.final_price)}</td>
              </tr>
            );
          })}
          {/* Empty rows to reach at least 5 lines */}
          {Array.from({ length: Math.max(0, 5 - items.length) }).map((_, i) => (
            <tr key={`empty-${i}`} style={{ borderBottom: "1px solid #e2e8f0" }}>
              <td style={{ padding: "6px 8px", fontSize: "10px" }}>&nbsp;</td>
              <td style={{ padding: "6px 8px" }} />
              <td style={{ padding: "6px 8px" }} />
              <td style={{ padding: "6px 8px" }} />
              <td style={{ padding: "6px 8px" }} />
              <td style={{ padding: "6px 8px" }} />
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Terbilang ── */}
      <div style={{ border: "1px solid #e2e8f0", borderTop: "none", padding: "6px 10px", marginBottom: "14px", fontSize: "10px" }}>
        <span style={{ fontStyle: "italic", color: "#64748b" }}>Terbilang: </span>
        <span style={{ fontWeight: "500" }}>{terbilangRupiah(grandTotal)}</span>
      </div>

      {/* ── Bottom: notes left + totals right ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: "16px", marginBottom: "14px" }}>
        {/* Notes / Pesan */}
        <div>
          {(notes || notaHeader || notaFooter) && (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "4px", padding: "8px 10px", fontSize: "10px" }}>
              <div style={{ fontWeight: "bold", marginBottom: "4px", color: "#1e3a5f" }}>Pesan:</div>
              {notaHeader && <div style={{ color: "#555", marginBottom: "2px" }}>{notaHeader}</div>}
              {notes && <div style={{ color: "#555" }}>{notes}</div>}
              {notaFooter && <div style={{ color: "#888", fontStyle: "italic", marginTop: "4px" }}>{notaFooter}</div>}
            </div>
          )}
        </div>

        {/* Totals */}
        <div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", border: "1px solid #e2e8f0" }}>
            <tbody>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "4px 8px", color: "#555" }}>Subtotal</td>
                <td style={{ padding: "4px 8px", textAlign: "right" }}>Rp {subtotal.toLocaleString("id-ID")}</td>
              </tr>
              {discountAmount > 0 && (
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "4px 8px", color: "#555" }}>Diskon</td>
                  <td style={{ padding: "4px 8px", textAlign: "right", color: "#dc2626" }}>-Rp {discountAmount.toLocaleString("id-ID")}</td>
                </tr>
              )}
              {ppnAmount > 0 && (
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "4px 8px", color: "#555" }}>PPN ({ppnPct}%)</td>
                  <td style={{ padding: "4px 8px", textAlign: "right" }}>Rp {ppnAmount.toLocaleString("id-ID")}</td>
                </tr>
              )}
              {pphAmount > 0 && (
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "4px 8px", color: "#555" }}>PPh ({pphPct}%)</td>
                  <td style={{ padding: "4px 8px", textAlign: "right", color: "#dc2626" }}>-Rp {pphAmount.toLocaleString("id-ID")}</td>
                </tr>
              )}
              {(shippingCost ?? 0) > 0 && (
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "4px 8px", color: "#555" }}>Biaya Kirim</td>
                  <td style={{ padding: "4px 8px", textAlign: "right" }}>Rp {(shippingCost ?? 0).toLocaleString("id-ID")}</td>
                </tr>
              )}
              <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                <td style={{ padding: "4px 8px", fontWeight: "bold" }}>Total</td>
                <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: "bold" }}>Rp {grandTotal.toLocaleString("id-ID")}</td>
              </tr>
              <tr style={{ background: sisaTagihan === 0 ? "#dcfce7" : "#fef9c3" }}>
                <td style={{ padding: "4px 8px", fontWeight: "bold", color: sisaTagihan === 0 ? "#16a34a" : "#854d0e" }}>Sisa Tagihan</td>
                <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: "bold", color: sisaTagihan === 0 ? "#16a34a" : "#854d0e" }}>Rp {sisaTagihan.toLocaleString("id-ID")}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Signatures ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "8px", fontSize: "10px" }}>
        <div />
        <div style={{ textAlign: "center" }}>
          <div style={{ marginBottom: "4px" }}>Dengan Hormat,</div>
          {signatureUrl
            ? <img src={signatureUrl} alt="Tanda Tangan" style={{ height: "48px", marginBottom: "4px", objectFit: "contain" }} />
            : <div style={{ height: "48px" }} />
          }
          {stampUrl && <img src={stampUrl} alt="Stempel" style={{ height: "36px", position: "absolute", opacity: 0.8, objectFit: "contain" }} />}
          <div style={{ borderTop: "1px solid #ccc", paddingTop: "4px" }}>{tenantName}</div>
          <div style={{ color: "#64748b" }}>Jabatan</div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default async function PrintInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ format?: string }>;
}) {
  const { id } = await params;
  const { format: rawFormat } = await searchParams;
  const format: Format = (rawFormat === "struk" || rawFormat === "nota" || rawFormat === "invoice") ? rawFormat : "invoice";

  const ctx = await getUserContext();
  if (!ctx.tenantId) notFound();

  const supabase = await createClient();
  const { data: invoiceData } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (!invoiceData) notFound();

  const [{ data: customer }, { data: items }, { data: settings }] = await Promise.all([
    invoiceData.customer_id
      ? supabase.from("customers").select("name, phone, vehicle_info").eq("id", invoiceData.customer_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("invoice_items").select("*").eq("invoice_id", id).order("created_at", { ascending: true }),
    supabase
      .from("settings")
      .select("store_name, store_address, store_phone, store_email, store_logo_url, nota_header, nota_footer, nota_signature_url, nota_stamp_url")
      .eq("tenant_id", ctx.tenantId)
      .single(),
  ]);

  const tenantName = (settings as { store_name?: string } | null)?.store_name || ctx.tenantName || "Bengkel";
  const storeAddress = (settings as { store_address?: string } | null)?.store_address ?? "";
  const storePhone = (settings as { store_phone?: string } | null)?.store_phone ?? "";
  const storeEmail = (settings as { store_email?: string } | null)?.store_email ?? "";
  const storeLogoUrl = (settings as { store_logo_url?: string } | null)?.store_logo_url ?? null;
  const notaHeader = (settings as { nota_header?: string } | null)?.nota_header ?? "";
  const notaFooter = (settings as { nota_footer?: string } | null)?.nota_footer ?? "";
  const signatureUrl = (settings as { nota_signature_url?: string } | null)?.nota_signature_url ?? null;
  const stampUrl = (settings as { nota_stamp_url?: string } | null)?.nota_stamp_url ?? null;
  const customerName = customer?.name ?? "-";
  const customerPhone = customer?.phone ?? null;
  const vehicleInfo = (customer?.vehicle_info as VehicleInfo | null) ?? null;
  const inv = invoiceData;
  const subtotalDisplay = Number(inv.subtotal) + Number(inv.total_markup);

  const commonProps = {
    tenantName,
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

  const waMessage = encodeURIComponent(
    `Halo, berikut adalah invoice ${inv.invoice_number} dengan total ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(inv.grand_total))}. Terima kasih atas kepercayaan Anda!`
  );
  const waLink = customerPhone
    ? `https://wa.me/${customerPhone.replace(/[^0-9]/g, "").replace(/^0/, "62")}?text=${waMessage}`
    : null;

  return (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{inv.invoice_number} — {format === "struk" ? "Struk" : format === "nota" ? "Nota Kontan" : "Invoice"}</title>
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
          @media print {
            .print-controls { display: none !important; }
            body { background: white; }
            .invoice-wrap { padding: 0; }
            .invoice-paper { box-shadow: none; }
          }
        `}</style>
      </head>
      <body>
        <PrintControls waLink={waLink} invoiceNumber={inv.invoice_number} format={format} />

        <div className="invoice-wrap">
          <div className="invoice-paper" style={{ maxWidth: format === "struk" ? "96mm" : "210mm" }}>
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
