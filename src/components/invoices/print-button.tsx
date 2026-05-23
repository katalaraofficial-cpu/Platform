"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="hidden rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 print:hidden sm:inline-flex"
    >
      Cetak
    </button>
  );
}
