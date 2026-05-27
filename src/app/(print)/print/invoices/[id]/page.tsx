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
  signatureUrl?: string | null;
  stampUrl?: string | null;
  notaHeader?: string;
  notaFooter?: string;
}) {
  const plate = vehicleInfo?.plate;
  const vehicle = [vehicleInfo?.brand, vehicleInfo?.model, vehicleInfo?.year ? String(vehicleInfo.year) : null].filter(Boolean).join(" ");
  const methodLabel = paymentMethod === "cash" ? "Tunai" : paymentMethod === "transfer" ? "Transfer Bank" : paymentMethod === "other" ? "Lainnya" : "-";
  const statusLabel = status === "paid" ? "LUNAS" : status === "cancelled" ? "DIBATALKAN" : status === "completed" ? "SELESAI" : status === "in_progress" ? "DIKERJAKAN" : "DRAFT";
  const statusColor = status === "paid" ? "#16a34a" : status === "cancelled" ? "#dc2626" : "#854d0e";
  const statusBg = status === "paid" ? "#dcfce7" : status === "cancelled" ? "#fee2e2" : "#fef9c3";

  return (
    <div style={{ fontFamily: "Arial, sans-serif", fontSize: "12px", maxWidth: "190mm", margin: "0 auto", padding: "10mm", color: "#1a1a1a" }}>

      {/* ── Header: company left, invoice meta right ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
        {/* Left: company info */}
        <div style={{ maxWidth: "55%" }}>
          <div style={{ fontWeight: "bold", fontSize: "20px", color: "#1e3a5f", letterSpacing: "0.3px" }}>{tenantName}</div>
          {storeAddress && <div style={{ fontSize: "10px", color: "#64748b", marginTop: "2px" }}>{storeAddress}</div>}
          {storePhone && <div style={{ fontSize: "10px", color: "#64748b" }}>{storePhone}</div>}
          {notaHeader && <div style={{ fontSize: "10px", color: "#555", fontStyle: "italic", marginTop: "3px" }}>{notaHeader}</div>}
        </div>
        {/* Right: invoice badge + meta */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: "bold", fontSize: "24px", color: "#2563eb", letterSpacing: "1px" }}>INVOICE</div>
          <table style={{ marginLeft: "auto", borderCollapse: "collapse", marginTop: "4px" }}>
            <tbody>
              <tr>
                <td style={{ fontSize: "10px", color: "#64748b", paddingRight: "8px", paddingBottom: "2px" }}>Nomor</td>
                <td style={{ fontSize: "10px", fontWeight: "bold" }}>{invoiceNumber}</td>
              </tr>
              <tr>
                <td style={{ fontSize: "10px", color: "#64748b", paddingRight: "8px", paddingBottom: "2px" }}>Tanggal</td>
                <td style={{ fontSize: "10px" }}>{fmtDate(createdAt)}</td>
              </tr>
              {dueDate && (
                <tr>
                  <td style={{ fontSize: "10px", color: "#64748b", paddingRight: "8px", paddingBottom: "2px" }}>Jatuh Tempo</td>
                  <td style={{ fontSize: "10px", fontWeight: "500", color: "#dc2626" }}>{fmtDate(dueDate)}</td>
                </tr>
              )}
              <tr>
                <td style={{ fontSize: "10px", color: "#64748b", paddingRight: "8px" }}>Status</td>
                <td>
                  <span style={{ fontSize: "9px", fontWeight: "bold", padding: "2px 7px", borderRadius: "10px", background: statusBg, color: statusColor }}>
                    {statusLabel}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: "3px", background: "linear-gradient(to right, #1e3a5f, #93c5fd)", marginBottom: "12px" }} />

      {/* ── Bill To + Payment Info ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
        <div style={{ borderLeft: "3px solid #2563eb", paddingLeft: "10px" }}>
          <div style={{ fontSize: "9px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px", color: "#64748b", marginBottom: "4px" }}>Tagihan Kepada</div>
          <div style={{ fontWeight: "bold", fontSize: "12px" }}>{customerName}</div>
          {customerPhone && <div style={{ color: "#555", fontSize: "10px", marginTop: "2px" }}>{customerPhone}</div>}
          {plate && <div style={{ color: "#555", fontSize: "10px", marginTop: "2px" }}>Kendaraan: {plate}{vehicle ? ` — ${vehicle}` : ""}</div>}
        </div>
        {status === "paid" && paidAt && (
          <div style={{ borderLeft: "3px solid #16a34a", paddingLeft: "10px" }}>
            <div style={{ fontSize: "9px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px", color: "#64748b", marginBottom: "4px" }}>Info Pembayaran</div>
            <div style={{ fontSize: "10px" }}>Dibayar: <strong>{fmtDate(paidAt)}</strong></div>
            <div style={{ fontSize: "10px", marginTop: "2px" }}>Metode: {methodLabel}</div>
          </div>
        )}
      </div>

      {/* ── Items table ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px" }}>
        <thead>
          <tr style={{ background: "#1e3a5f", color: "#fff" }}>
            <th style={{ padding: "7px 8px", textAlign: "left", fontWeight: "600", fontSize: "10px", width: "24px" }}>#</th>
            <th style={{ padding: "7px 8px", textAlign: "left", fontWeight: "600", fontSize: "10px" }}>Uraian</th>
            <th style={{ padding: "7px 8px", textAlign: "center", fontWeight: "600", fontSize: "10px", width: "50px" }}>Satuan</th>
            <th style={{ padding: "7px 8px", textAlign: "center", fontWeight: "600", fontSize: "10px", width: "36px" }}>Qty</th>
            <th style={{ padding: "7px 8px", textAlign: "right", fontWeight: "600", fontSize: "10px", width: "90px" }}>Harga</th>
            <th style={{ padding: "7px 8px", textAlign: "right", fontWeight: "600", fontSize: "10px", width: "90px" }}>Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.id} style={{ borderBottom: "1px solid #e2e8f0", background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
              <td style={{ padding: "6px 8px", color: "#94a3b8", fontSize: "10px" }}>{i + 1}</td>
              <td style={{ padding: "6px 8px", fontSize: "11px" }}>
                {item.description}
                <span style={{ marginLeft: "5px", fontSize: "8px", padding: "1px 4px", borderRadius: "8px",
                  background: item.item_type === "service" ? "#dbeafe" : "#fef3c7",
                  color: item.item_type === "service" ? "#1d4ed8" : "#92400e" }}>
                  {item.item_type === "service" ? "Jasa" : "Part"}
                </span>
              </td>
              <td style={{ padding: "6px 8px", textAlign: "center", fontSize: "10px", color: "#64748b" }}>
                {item.unit_label || "—"}
              </td>
              <td style={{ padding: "6px 8px", textAlign: "center", fontSize: "11px" }}>{item.quantity}</td>
              <td style={{ padding: "6px 8px", textAlign: "right", fontSize: "10px" }}>{fmt(item.final_price)}</td>
              <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: "600", fontSize: "11px" }}>{fmt(item.final_price * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Bottom: notes left, totals right ── */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
        {/* Left: notes */}
        <div style={{ flex: 1 }}>
          {notes && (
            <div style={{ background: "#fef9c3", borderLeft: "3px solid #fbbf24", padding: "8px 10px", fontSize: "10px", marginBottom: "8px", borderRadius: "0 4px 4px 0" }}>
              <div style={{ fontWeight: "bold", marginBottom: "2px", color: "#92400e" }}>Catatan:</div>
              <div style={{ color: "#555" }}>{notes}</div>
            </div>
          )}
          {notaFooter && (
            <div style={{ fontSize: "10px", color: "#555", fontStyle: "italic", borderTop: "1px solid #e2e8f0", paddingTop: "6px" }}>{notaFooter}</div>
          )}
        </div>
        {/* Right: totals */}
        <div style={{ width: "210px", flexShrink: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
            <tbody>
              <tr>
                <td style={{ padding: "3px 0", color: "#64748b" }}>Subtotal</td>
                <td style={{ padding: "3px 0", textAlign: "right" }}>{fmt(subtotal)}</td>
              </tr>
              {discountAmount > 0 && (
                <tr>
                  <td style={{ padding: "3px 0", color: "#64748b" }}>Diskon</td>
                  <td style={{ padding: "3px 0", textAlign: "right", color: "#dc2626" }}>-{fmt(discountAmount)}</td>
                </tr>
              )}
              {ppnAmount > 0 && (
                <tr>
                  <td style={{ padding: "3px 0", color: "#64748b" }}>PPN ({ppnPct}%)</td>
                  <td style={{ padding: "3px 0", textAlign: "right" }}>+{fmt(ppnAmount)}</td>
                </tr>
              )}
              {pphAmount > 0 && (
                <tr>
                  <td style={{ padding: "3px 0", color: "#64748b" }}>PPh ({pphPct}%)</td>
                  <td style={{ padding: "3px 0", textAlign: "right", color: "#dc2626" }}>-{fmt(pphAmount)}</td>
                </tr>
              )}
              {(shippingCost ?? 0) > 0 && (
                <tr>
                  <td style={{ padding: "3px 0", color: "#64748b" }}>Biaya Kirim</td>
                  <td style={{ padding: "3px 0", textAlign: "right" }}>+{fmt(shippingCost ?? 0)}</td>
                </tr>
              )}
            </tbody>
          </table>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 10px", background: "#1e3a5f", color: "#fff", borderRadius: "5px", marginTop: "6px" }}>
            <span style={{ fontWeight: "bold", fontSize: "11px" }}>TOTAL</span>
            <span style={{ fontWeight: "bold", fontSize: "13px" }}>{fmt(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* ── Signatures ── */}
      <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", fontSize: "10px", color: "#64748b" }}>
        <div>
          <div style={{ fontWeight: "bold", color: "#1a1a1a", marginBottom: "4px" }}>Hormat Kami,</div>
          {signatureUrl
            ? <img src={signatureUrl} alt="Tanda Tangan" style={{ height: "48px", marginBottom: "4px", objectFit: "contain" }} />
            : <div style={{ height: "48px" }} />
          }
          {stampUrl && <img src={stampUrl} alt="Stempel" style={{ height: "36px", marginBottom: "4px", objectFit: "contain" }} />}
          <div style={{ borderTop: "1px solid #ccc", paddingTop: "4px" }}>{tenantName}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: "bold", color: "#1a1a1a", marginBottom: "4px" }}>Penerima,</div>
          <div style={{ height: "48px" }} />
          <div style={{ borderTop: "1px solid #ccc", paddingTop: "4px" }}>{customerName}</div>
        </div>
      </div>

      <div style={{ marginTop: "12px", textAlign: "center", fontSize: "9px", color: "#94a3b8" }}>
        Dokumen ini diterbitkan secara digital oleh sistem POS {tenantName}
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
      .select("store_name, store_address, store_phone, nota_header, nota_footer, nota_signature_url, nota_stamp_url")
      .eq("tenant_id", ctx.tenantId)
      .single(),
  ]);

  const tenantName = (settings as { store_name?: string } | null)?.store_name || ctx.tenantName || "Bengkel";
  const storeAddress = (settings as { store_address?: string } | null)?.store_address ?? "";
  const storePhone = (settings as { store_phone?: string } | null)?.store_phone ?? "";
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
