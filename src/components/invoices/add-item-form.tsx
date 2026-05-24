"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addInvoiceItem, type ActionState } from "@/lib/actions/invoice";
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
  /** Owner can select any payment source; admin is limited */
  role: "owner" | "admin";
  /** If provided, pre-fill markup_pct from settings */
  defaultMarkupPct?: number;
}

export function AddItemForm({
  invoiceId,
  tenantId,
  basePath,
  role,
  defaultMarkupPct = 0,
}: Props) {
  const [state, action, isPending] = useActionState<ActionState, FormData>(
    addInvoiceItem,
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [itemType, setItemType] = useState("service");

  // Reset form on success
  useEffect(() => {
    if (!state.error && !isPending && formRef.current) {
      formRef.current.reset();
      setItemType("service");
    }
  }, [state, isPending]);

  const isExternal = itemType === "part_external";

  const paymentSources =
    role === "owner"
      ? PAYMENT_SOURCES
      : PAYMENT_SOURCES.filter((s) => s.value !== "mechanic");

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="base_path" value={basePath} />

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {state.error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Item type */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Tipe
          </label>
          <select
            name="item_type"
            value={itemType}
            onChange={(e) => setItemType(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {ITEM_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Deskripsi <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="description"
            required
            placeholder="contoh: Ganti oli mesin"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Quantity */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Qty
          </label>
          <input
            type="number"
            name="quantity"
            defaultValue="1"
            min="0.01"
            step="0.01"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Unit price */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Harga Satuan (Rp)
          </label>
          <input
            type="number"
            name="unit_price"
            defaultValue="0"
            min="0"
            step="1000"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Markup % — only for part_external */}
        {isExternal && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Markup (%)
            </label>
            <input
              type="number"
              name="markup_pct"
              defaultValue={defaultMarkupPct}
              min="0"
              max="1000"
              step="0.5"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Payment source — only for part_external */}
        {isExternal && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Sumber Dana
            </label>
            <select
              name="payment_source"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {paymentSources.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Submit */}
        <div className={cn("flex items-end", !isExternal && "lg:col-span-3")}>
          <button
            type="submit"
            disabled={isPending}
            className={cn(
              "w-full rounded-md px-4 py-2 text-sm font-medium text-white transition-colors",
              isPending
                ? "cursor-not-allowed bg-gray-400"
                : "bg-gray-900 hover:bg-gray-700"
            )}
          >
            {isPending ? "Menambah..." : "Tambah Item"}
          </button>
        </div>
      </div>
    </form>
  );
}
