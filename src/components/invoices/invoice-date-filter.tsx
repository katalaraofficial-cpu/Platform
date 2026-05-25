"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export function InvoiceDateFilter({ basePath }: { basePath: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const status = searchParams.get("status") ?? "";

  const [fromVal, setFromVal] = useState(from);
  const [toVal, setToVal] = useState(to);

  useEffect(() => {
    setFromVal(from);
    setToVal(to);
  }, [from, to]);

  function navigate(f: string, t: string) {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (f) p.set("from", f);
    if (t) p.set("to", t);
    const qs = p.toString();
    router.push(`${basePath}/invoices${qs ? "?" + qs : ""}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Dari</label>
        <input
          type="date"
          value={fromVal}
          onChange={(e) => setFromVal(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Sampai</label>
        <input
          type="date"
          value={toVal}
          onChange={(e) => setToVal(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>
      <button
        onClick={() => navigate(fromVal, toVal)}
        className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
      >
        Terapkan
      </button>
      {(from || to) && (
        <button
          onClick={() => navigate("", "")}
          className="text-sm text-gray-400 hover:text-gray-600 underline"
        >
          Reset
        </button>
      )}
    </div>
  );
}
