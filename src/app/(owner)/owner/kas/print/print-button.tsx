"use client";

import { useState } from "react";
import { Printer, Download, X, Loader2 } from "lucide-react";

export function PrintButton() {
  const [printing, setPrinting] = useState(false);

  function handlePrint() {
    setPrinting(true);
    // Allow state to render, then trigger print
    setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 120);
  }

  return (
    <button
      onClick={handlePrint}
      disabled={printing}
      className={
        "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all active:scale-95 " +
        "bg-gray-900 hover:bg-gray-800 disabled:opacity-70"
      }
    >
      {printing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Printer className="h-4 w-4" />
      )}
      <span>{printing ? "Memproses..." : "Cetak / Simpan PDF"}</span>
    </button>
  );
}
