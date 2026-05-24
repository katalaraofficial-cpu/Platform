"use client";

import { useState, useTransition } from "react";
import { updateInvoiceDiscount } from "@/lib/actions/invoice";

interface Props {
  invoiceId: string;
  basePath: string;
  preTax: number;
  discountAmount: number;
  canEdit: boolean;
}

function fmtRp(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function DiscountSettings({ invoiceId, basePath, preTax, discountAmount, canEdit }: Props) {
  const [mode, setMode] = useState<"rp" | "pct">("rp");
  const [inputVal, setInputVal] = useState(discountAmount > 0 ? String(discountAmount) : "");
  const [isPending, startTransition] = useTransition();

  const computed =
    mode === "pct"
      ? (preTax * Math.max(0, Number(inputVal) || 0)) / 100
      : Math.max(0, Number(inputVal) || 0);

  function applyDiscount() {
    startTransition(async () => {
      await updateInvoiceDiscount(invoiceId, computed, basePath);
    });
  }

  if (!canEdit) {
    if (discountAmount <= 0) return null;
    return (
      <div className="flex items-center justify-between text-sm text-green-700">
        <span>Diskon / Potongan</span>
        <span className="font-medium">- {fmtRp(discountAmount)}</span>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Diskon / Potongan
      </p>

      {/* Mode toggle */}
      <div className="mb-3 flex rounded-md overflow-hidden border border-gray-300 w-fit">
        <button
          type="button"
          onClick={() => setMode("rp")}
          className={`px-3 py-1 text-xs font-medium transition-colors ${
            mode === "rp" ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-100"
          }`}
        >
          Rp
        </button>
        <button
          type="button"
          onClick={() => setMode("pct")}
          className={`px-3 py-1 text-xs font-medium transition-colors ${
            mode === "pct" ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-100"
          }`}
        >
          %
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-3 flex items-center text-xs text-gray-500">
            {mode === "rp" ? "Rp" : "%"}
          </span>
          <input
            type="number"
            value={inputVal}
            min="0"
            step={mode === "rp" ? "1000" : "0.5"}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder={mode === "rp" ? "0" : "0.0"}
            className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {mode === "pct" && Number(inputVal) > 0 && (
          <span className="text-xs text-gray-500 whitespace-nowrap">= {fmtRp(computed)}</span>
        )}

        <button
          type="button"
          onClick={applyDiscount}
          disabled={isPending}
          className="whitespace-nowrap rounded-md bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {isPending ? "Menyimpan..." : "Terapkan"}
        </button>
      </div>

      {discountAmount > 0 && (
        <p className="mt-2 text-xs text-green-700">
          Diskon aktif: <span className="font-medium">- {fmtRp(discountAmount)}</span>
        </p>
      )}
    </div>
  );
}
