"use client";

import { useActionState, useEffect, useRef, useState, useTransition, useCallback } from "react";
import { addInvoiceItem, searchItemDescriptions, type ActionState } from "@/lib/actions/invoice";
import { cn } from "@/lib/utils";

const ITEM_TYPES = [
  { value: "service", label: "Jasa" },
  { value: "part_internal", label: "Part (stok)" },
  { value: "part_external", label: "Part (beli)" },
];

const PAYMENT_SOURCES = [
  { value: "owner", label: "Kas Bengkel" },
  { value: "petty_cash", label: "Kas Kecil" },
  { value: "mechanic", label: "Mekanik (titipan)" },
];

interface Props {
  invoiceId: string;
  tenantId: string;
  basePath: string;
  role: "owner" | "admin";
  defaultMarkupPct?: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function AddItemForm({ invoiceId, tenantId, basePath, role }: Props) {
  const [state, action, isPending] = useActionState<ActionState, FormData>(addInvoiceItem, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [itemType, setItemType] = useState("service");
  const [buyPrice, setBuyPrice] = useState(0);
  const [sellPrice, setSellPrice] = useState(0);

  // Autocomplete for description
  const [description, setDescription] = useState("");
  const [suggestions, setSuggestions] = useState<{ description: string; item_type: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [, startSuggest] = useTransition();
  const descRef = useRef<HTMLDivElement>(null);

  const searchSuggestions = useCallback((q: string) => {
    if (q.length < 1) { setSuggestions([]); setShowSuggestions(false); return; }
    startSuggest(async () => {
      const res = await searchItemDescriptions(q);
      setSuggestions(res);
      setShowSuggestions(res.length > 0);
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchSuggestions(description), 250);
    return () => clearTimeout(timer);
  }, [description, searchSuggestions]);

  // Close dropdown on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (descRef.current && !descRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const isPartType = itemType === "part_internal" || itemType === "part_external";
  const isExternal = itemType === "part_external";
  const marginPct = isPartType && buyPrice > 0 ? ((sellPrice - buyPrice) / buyPrice) * 100 : 0;

  useEffect(() => {
    if (!state.error && !isPending && formRef.current) {
      formRef.current.reset();
      setItemType("service");
      setBuyPrice(0);
      setSellPrice(0);
      setDescription("");
      setSuggestions([]);
    }
  }, [state, isPending]);

  const paymentSources =
    role === "owner" ? PAYMENT_SOURCES : PAYMENT_SOURCES.filter((s) => s.value !== "mechanic");

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="base_path" value={basePath} />

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}

      {/* Row 1: Tipe | Deskripsi | Qty */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Tipe</label>
          <select
            name="item_type"
            value={itemType}
            onChange={(e) => { setItemType(e.target.value); setBuyPrice(0); setSellPrice(0); }}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {ITEM_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Deskripsi <span className="text-red-500">*</span>
          </label>
          <div ref={descRef} className="relative">
            <input
              type="text" name="description" required
              value={description}
              onChange={(e) => { setDescription(e.target.value); }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="contoh: Ganti oli mesin"
              autoComplete="off"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {showSuggestions && (
              <div className="absolute left-0 top-full z-30 mt-1 w-full overflow-hidden rounded-lg bg-white shadow-xl ring-1 ring-black/5">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={() => {
                      setDescription(s.description);
                      setShowSuggestions(false);
                      if (s.item_type && s.item_type !== itemType) setItemType(s.item_type);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-blue-50"
                  >
                    <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                      s.item_type === "service" ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-700"
                    )}>
                      {s.item_type === "service" ? "Jasa" : "Part"}
                    </span>
                    <span className="text-sm text-gray-800">{s.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Qty</label>
          <input
            type="number" name="quantity" defaultValue="1" min="0.01" step="0.01"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Row 2: Price fields */}
      {isPartType ? (
        <>
          <input type="hidden" name="unit_price" value={buyPrice} />
          <input type="hidden" name="markup_pct" value={Math.max(0, marginPct).toFixed(4)} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Harga Beli Satuan (Rp)</label>
              <input
                type="number" value={buyPrice} min="0" step="1000"
                onChange={(e) => setBuyPrice(Math.max(0, Number(e.target.value)))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Harga Jual Satuan (Rp)</label>
              <input
                type="number" value={sellPrice} min="0" step="1000"
                onChange={(e) => setSellPrice(Math.max(0, Number(e.target.value)))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">% Margin (otomatis)</label>
              <div className={cn(
                "flex h-[38px] items-center rounded-md border px-3 text-sm",
                marginPct >= 0 ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"
              )}>
                {buyPrice > 0 ? `${marginPct.toFixed(1)}%` : "-"}
                {buyPrice > 0 && sellPrice > 0 && (
                  <span className="ml-2 text-xs text-gray-400">({fmt(sellPrice - buyPrice)}/unit)</span>
                )}
              </div>
            </div>

            {isExternal ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Sumber Dana</label>
                <select
                  name="payment_source"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {paymentSources.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-end">
                <button
                  type="submit" disabled={isPending}
                  className={cn("w-full rounded-md px-4 py-2 text-sm font-medium text-white transition-colors",
                    isPending ? "cursor-not-allowed bg-gray-400" : "bg-gray-900 hover:bg-gray-700")}
                >
                  {isPending ? "Menambah..." : "Tambah Item"}
                </button>
              </div>
            )}
          </div>

          {isExternal && (
            <div>
              <button
                type="submit" disabled={isPending}
                className={cn("w-full rounded-md px-4 py-2 text-sm font-medium text-white transition-colors",
                  isPending ? "cursor-not-allowed bg-gray-400" : "bg-gray-900 hover:bg-gray-700")}
              >
                {isPending ? "Menambah..." : "Tambah Item"}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Harga Satuan (Rp)</label>
            <input
              type="number" name="unit_price" defaultValue="0" min="0" step="1000"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end lg:col-span-3">
            <button
              type="submit" disabled={isPending}
              className={cn("w-full rounded-md px-4 py-2 text-sm font-medium text-white transition-colors",
                isPending ? "cursor-not-allowed bg-gray-400" : "bg-gray-900 hover:bg-gray-700")}
            >
              {isPending ? "Menambah..." : "Tambah Item"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
