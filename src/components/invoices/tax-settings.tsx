"use client";

import { useState, useTransition } from "react";
import { updateInvoiceTax } from "@/lib/actions/invoice";

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

interface Props {
  invoiceId: string;
  basePath: string;
  preTax: number;       // subtotal + markup (base before tax)
  ppnPct: number;
  pphPct: number;
  canEdit: boolean;
}

export function TaxSettings({
  invoiceId,
  basePath,
  preTax,
  ppnPct: initPpn,
  pphPct: initPph,
  canEdit,
}: Props) {
  const [ppnEnabled, setPpnEnabled] = useState(initPpn > 0);
  const [ppnPct, setPpnPct] = useState(initPpn > 0 ? initPpn : 11);
  const [pphEnabled, setPphEnabled] = useState(initPph > 0);
  const [pphPct, setPphPct] = useState(initPph > 0 ? initPph : 2);
  const [isPending, startTransition] = useTransition();

  const ppnAmount = ppnEnabled ? preTax * ppnPct / 100 : 0;
  const pphAmount = pphEnabled ? preTax * pphPct / 100 : 0;

  function save() {
    startTransition(async () => {
      await updateInvoiceTax(
        invoiceId,
        ppnEnabled ? ppnPct : 0,
        pphEnabled ? pphPct : 0,
        basePath
      );
    });
  }

  // Read-only view when cannot edit
  if (!canEdit) {
    if (!ppnEnabled && !pphEnabled) return null;
    return (
      <>
        {ppnEnabled && (
          <div className="flex justify-between text-sm text-gray-500">
            <span>PPN {ppnPct}%</span>
            <span>{fmt(ppnAmount)}</span>
          </div>
        )}
        {pphEnabled && (
          <div className="flex justify-between text-sm text-gray-500">
            <span>PPh {pphPct}%</span>
            <span>{fmt(pphAmount)}</span>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="space-y-2 border-t border-dashed border-gray-200 pt-3">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
        Pajak
      </p>

      {/* PPN */}
      <div className="flex items-center justify-between gap-2 text-sm">
        <label className="flex items-center gap-2 text-gray-600">
          <input
            type="checkbox"
            checked={ppnEnabled}
            onChange={(e) => setPpnEnabled(e.target.checked)}
            className="h-3.5 w-3.5 accent-gray-800"
          />
          PPN
          <input
            type="number"
            value={ppnPct}
            min={0}
            max={100}
            step={0.1}
            disabled={!ppnEnabled}
            onChange={(e) => setPpnPct(Math.max(0, Number(e.target.value)))}
            className="w-14 rounded border border-gray-200 px-1.5 py-0.5 text-center
                       text-xs disabled:opacity-40 focus:outline-none focus:ring-1
                       focus:ring-gray-400"
          />
          <span className="text-gray-400 text-xs">%</span>
        </label>
        <span className={ppnEnabled ? "text-gray-700" : "text-gray-300"}>
          {fmt(ppnAmount)}
        </span>
      </div>

      {/* PPh */}
      <div className="flex items-center justify-between gap-2 text-sm">
        <label className="flex items-center gap-2 text-gray-600">
          <input
            type="checkbox"
            checked={pphEnabled}
            onChange={(e) => setPphEnabled(e.target.checked)}
            className="h-3.5 w-3.5 accent-gray-800"
          />
          PPh
          <input
            type="number"
            value={pphPct}
            min={0}
            max={100}
            step={0.1}
            disabled={!pphEnabled}
            onChange={(e) => setPphPct(Math.max(0, Number(e.target.value)))}
            className="w-14 rounded border border-gray-200 px-1.5 py-0.5 text-center
                       text-xs disabled:opacity-40 focus:outline-none focus:ring-1
                       focus:ring-gray-400"
          />
          <span className="text-gray-400 text-xs">%</span>
        </label>
        <span className={pphEnabled ? "text-gray-700" : "text-gray-300"}>
          {fmt(pphAmount)}
        </span>
      </div>

      <button
        onClick={save}
        disabled={isPending}
        className="mt-1 w-full rounded-md border border-gray-300 py-1.5 text-xs
                   font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50
                   transition-colors"
      >
        {isPending ? "Menyimpan..." : "Terapkan Pajak"}
      </button>
    </div>
  );
}
