"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 transition-colors active:scale-95"
    >
      <Printer className="h-4 w-4" />
      Cetak / Simpan PDF
    </button>
  );
}
