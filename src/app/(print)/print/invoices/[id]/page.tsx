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
}) {
  const line = "================================";
  const plate = vehicleInfo?.plate;
  const vehicle = [vehicleInfo?.brand, vehicleInfo?.model].filter(Boolean).join(" ");

  return (
    <div style={{ fontFamily: "monospace", fontSize: "12px", width: "72mm", margin: "0 auto", padding: "4mm", lineHeight: "1.4" }}>
      <div style={{ textAlign: "center", borderBottom: "1px dashed #000", paddingBottom: "6px", marginBottom: "6px" }}>
        <div style={{ fontWeight: "bold", fontSize: "14px" }}>{tenantName}</div>
        <div style={{ fontSize: "11px", marginTop: "2px" }}>Bengkel Otomotif</div>
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
        <div>Terima kasih atas kepercayaan Anda</div>
        <div style={{ marginTop: "2px" }}>Simpan struk ini sebagai bukti servis</div>
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
}) {
  const plate = vehicleInfo?.plate;
  const vehicle = [vehicleInfo?.brand, vehicleInfo?.model].filter(Boolean).join(" ");

  return (
    <div style={{ fontFamily: "Arial, sans-serif", fontSize: "11px", width: "148mm", margin: "0 auto", padding: "8mm", border: "1px solid #ccc" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #000", paddingBottom: "6px", marginBottom: "8px" }}>
        <div>
          <div style={{ fontWeight: "bold", fontSize: "16px" }}>{tenantName}</div>
          <div style={{ fontSize: "10px", color: "#555" }}>NOTA SERVIS KENDARAAN</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: "bold" }}>NOTA KONTAN</div>
          <div>{invoiceNumber}</div>
          <div>{fmtDate(createdAt)}</div>
        </div>
      </div>

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

      {/* Signatures */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "16px", fontSize: "10px" }}>
        <div style={{ textAlign: "center" }}>
          <div>Hormat Kami,</div>
          <div style={{ height: "32px" }} />
          <div style={{ borderTop: "1px solid #000" }}>{tenantName}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div>Penerima,</div>
          <div style={{ height: "32px" }} />
          <div style={{ borderTop: "1px solid #000" }}>{customerName}</div>
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
  grandTotal,
  notes,
  status,
  paidAt,
  paymentMethod,
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
  ppnPct: number;
  ppnAmount: number;
  pphPct: number;
  pphAmount: number;
  grandTotal: number;
  notes: string | null;
  status: string;
  paidAt: string | null;
  paymentMethod: string | null;
}) {
  const plate = vehicleInfo?.plate;
  const vehicle = [vehicleInfo?.brand, vehicleInfo?.model, vehicleInfo?.year ? String(vehicleInfo.year) : null].filter(Boolean).join(" ");
  const methodLabel = paymentMethod === "cash" ? "Tunai" : paymentMethod === "transfer" ? "Transfer Bank" : paymentMethod === "other" ? "Lainnya" : "-";

  return (
    <div style={{ fontFamily: "Arial, sans-serif", fontSize: "12px", maxWidth: "190mm", margin: "0 auto", padding: "10mm", color: "#1a1a1a" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
        <div>
          <div style={{ fontWeight: "bold", fontSize: "22px", letterSpacing: "0.5px" }}>{tenantName}</div>
          <div style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}>Bengkel Otomotif & Servis Kendaraan</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: "bold", fontSize: "18px", color: "#2563eb" }}>INVOICE</div>
          <div style={{ fontSize: "11px", marginTop: "4px" }}><span style={{ color: "#666" }}>No. </span><strong>{invoiceNumber}</strong></div>
          <div style={{ fontSize: "11px" }}><span style={{ color: "#666" }}>Tanggal: </span>{fmtDate(createdAt)}</div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: "3px", background: "linear-gradient(to right, #2563eb, #93c5fd)", marginBottom: "16px" }} />

      {/* Customer info */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        <div style={{ background: "#f8fafc", borderRadius: "6px", padding: "10px" }}>
          <div style={{ fontWeight: "bold", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#64748b", marginBottom: "6px" }}>Tagihan Kepada</div>
          <div style={{ fontWeight: "bold", fontSize: "13px" }}>{customerName}</div>
          {customerPhone && <div style={{ color: "#555", fontSize: "11px", marginTop: "2px" }}>{customerPhone}</div>}
          {plate && <div style={{ color: "#555", fontSize: "11px", marginTop: "2px" }}>Kendaraan: {plate}{vehicle ? ` — ${vehicle}` : ""}</div>}
        </div>
        <div style={{ background: "#f8fafc", borderRadius: "6px", padding: "10px" }}>
          <div style={{ fontWeight: "bold", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#64748b", marginBottom: "6px" }}>Status Pembayaran</div>
          <div style={{
            display: "inline-block",
            padding: "3px 10px",
            borderRadius: "20px",
            fontSize: "11px",
            fontWeight: "bold",
            background: status === "paid" ? "#dcfce7" : status === "cancelled" ? "#fee2e2" : "#fef9c3",
            color: status === "paid" ? "#16a34a" : status === "cancelled" ? "#dc2626" : "#854d0e",
          }}>
            {status === "paid" ? "✓ LUNAS" : status === "cancelled" ? "DIBATALKAN" : status === "completed" ? "SELESAI" : status === "in_progress" ? "DIKERJAKAN" : "DRAFT"}
          </div>
          {status === "paid" && paidAt && (
            <div style={{ fontSize: "11px", color: "#555", marginTop: "4px" }}>
              Dibayar: {fmtDate(paidAt)} · {methodLabel}
            </div>
          )}
        </div>
      </div>

      {/* Items table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px" }}>
        <thead>
          <tr style={{ background: "#1e3a5f", color: "#fff" }}>
            <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: "600", fontSize: "11px", width: "28px" }}>#</th>
            <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: "600", fontSize: "11px" }}>Uraian Pekerjaan / Item</th>
            <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: "600", fontSize: "11px", width: "40px" }}>Qty</th>
            <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: "600", fontSize: "11px", width: "88px" }}>Harga Satuan</th>
            <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: "600", fontSize: "11px", width: "88px" }}>Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.id} style={{ borderBottom: "1px solid #e2e8f0", background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
              <td style={{ padding: "7px 10px", color: "#94a3b8", fontSize: "11px" }}>{i + 1}</td>
              <td style={{ padding: "7px 10px", fontSize: "11px" }}>
                <span>{item.description}</span>
                <span style={{ marginLeft: "6px", fontSize: "9px", padding: "1px 5px", borderRadius: "10px",
                  background: item.item_type === "service" ? "#dbeafe" : "#fef3c7",
                  color: item.item_type === "service" ? "#1d4ed8" : "#92400e" }}>
                  {item.item_type === "service" ? "Jasa" : "Part"}
                </span>
              </td>
              <td style={{ padding: "7px 10px", textAlign: "center", fontSize: "11px" }}>{item.quantity}</td>
              <td style={{ padding: "7px 10px", textAlign: "right", fontSize: "11px" }}>{fmt(item.final_price)}</td>
              <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: "500", fontSize: "11px" }}>{fmt(item.final_price * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
        <div style={{ width: "220px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "11px" }}>
            <span style={{ color: "#64748b" }}>Subtotal</span>
            <span>{fmt(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "11px" }}>
              <span style={{ color: "#64748b" }}>Diskon</span>
              <span style={{ color: "#dc2626" }}>-{fmt(discountAmount)}</span>
            </div>
          )}
          {ppnAmount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "11px" }}>
              <span style={{ color: "#64748b" }}>PPN ({ppnPct}%)</span>
              <span>{fmt(ppnAmount)}</span>
            </div>
          )}
          {pphAmount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "11px" }}>
              <span style={{ color: "#64748b" }}>PPh ({pphPct}%)</span>
              <span style={{ color: "#dc2626" }}>-{fmt(pphAmount)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: "#1e3a5f", color: "#fff", borderRadius: "6px", marginTop: "6px" }}>
            <span style={{ fontWeight: "bold" }}>GRAND TOTAL</span>
            <span style={{ fontWeight: "bold", fontSize: "13px" }}>{fmt(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {notes && (
        <div style={{ background: "#fef9c3", borderLeft: "4px solid #fbbf24", padding: "8px 12px", marginBottom: "16px", fontSize: "11px" }}>
          <strong>Catatan:</strong> {notes}
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", fontSize: "10px", color: "#64748b" }}>
        <div>
          <div style={{ fontWeight: "bold", color: "#1a1a1a", marginBottom: "4px" }}>Hormat Kami,</div>
          <div style={{ height: "40px" }} />
          <div style={{ borderTop: "1px solid #ccc", paddingTop: "4px" }}>{tenantName}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: "bold", color: "#1a1a1a", marginBottom: "4px" }}>Penerima,</div>
          <div style={{ height: "40px" }} />
          <div style={{ borderTop: "1px solid #ccc", paddingTop: "4px" }}>{customerName}</div>
        </div>
      </div>

      <div style={{ marginTop: "12px", textAlign: "center", fontSize: "10px", color: "#94a3b8" }}>
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

  const [{ data: customer }, { data: items }] = await Promise.all([
    invoiceData.customer_id
      ? supabase.from("customers").select("name, phone, vehicle_info").eq("id", invoiceData.customer_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("invoice_items").select("*").eq("invoice_id", id).order("created_at", { ascending: true }),
  ]);

  const tenantName = ctx.tenantName ?? "Bengkel";
  const customerName = customer?.name ?? "-";
  const customerPhone = customer?.phone ?? null;
  const vehicleInfo = (customer?.vehicle_info as VehicleInfo | null) ?? null;
  const inv = invoiceData;
  const subtotalDisplay = Number(inv.subtotal) + Number(inv.total_markup);

  const commonProps = {
    tenantName,
    invoiceNumber: inv.invoice_number,
    createdAt: (inv as { invoice_date?: string }).invoice_date ?? inv.created_at,
    customerName,
    customerPhone,
    vehicleInfo,
    items: (items ?? []) as InvoiceItem[],
    subtotal: subtotalDisplay,
    discountAmount: Number(inv.discount_amount ?? 0),
    ppnAmount: Number(inv.ppn_amount ?? 0),
    pphAmount: Number(inv.pph_amount ?? 0),
    grandTotal: Number(inv.grand_total),
    notes: inv.notes,
    status: inv.status,
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
