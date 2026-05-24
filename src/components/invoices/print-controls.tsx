"use client";

import { useEffect } from "react";

interface PrintControlsProps {
  waLink: string | null;
  invoiceNumber: string;
  format: string;
}

const FORMAT_LABELS: Record<string, string> = {
  struk: "📄 Struk Thermal",
  nota: "🧾 Nota Kontan",
  invoice: "📋 Invoice Profesional",
};

export function PrintControls({ waLink, invoiceNumber, format }: PrintControlsProps) {
  // Auto-focus so keyboard shortcut Ctrl+P works immediately
  useEffect(() => {
    window.focus();
  }, []);

  return (
    <div className="print-controls">
      <span style={{ fontWeight: "bold", fontSize: "14px" }}>{invoiceNumber}</span>
      <span className="format-badge">{FORMAT_LABELS[format] ?? format}</span>

      <div style={{ marginLeft: "auto", display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button className="btn-primary" onClick={() => window.print()}>
          ⬇ Download PDF / Cetak
        </button>

        {waLink && (
          <a className="btn-green" href={waLink} target="_blank" rel="noopener noreferrer">
            📲 Kirim via WhatsApp
          </a>
        )}

        <button className="btn-secondary" onClick={() => window.close()}>
          ✕ Tutup
        </button>
      </div>
    </div>
  );
}
