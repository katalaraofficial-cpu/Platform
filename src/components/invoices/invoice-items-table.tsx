"use client";

import { useState, useTransition } from "react";
import { updateInvoiceItem, removeInvoiceItem } from "@/lib/actions/invoice";
import type { InvoiceItem } from "@/types/database";

const TYPE_LABEL: Record<string, string> = {
  service: "Jasa",
  part_internal: "Part (stok)",
  part_external: "Part (beli)",
};

function fmtRp(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

interface Props {
  items: InvoiceItem[];
  invoiceId: string;
  canEdit: boolean;
  basePath: string;
}

export function InvoiceItemsTable({ items, invoiceId, canEdit, basePath }: Props) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editQty, setEditQty] = useState(1);
  const [editPrice, setEditPrice] = useState(0);
  const [isPending, startTransition] = useTransition();

  function startEdit(item: InvoiceItem) {
    setEditId(item.id);
    setEditDesc(item.description);
    setEditQty(Number(item.quantity));
    setEditPrice(Number(item.unit_price));
  }

  function cancelEdit() {
    setEditId(null);
  }

  function saveEdit() {
    if (!editId) return;
    startTransition(async () => {
      await updateInvoiceItem(editId, invoiceId, basePath, {
        description: editDesc,
        quantity: editQty,
        unitPrice: editPrice,
      });
      setEditId(null);
    });
  }

  function deleteItem(itemId: string) {
    startTransition(async () => {
      await removeInvoiceItem(itemId, invoiceId, basePath);
    });
  }

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-400">
        Belum ada item. Tambahkan item di bawah.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Tipe
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Deskripsi
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Qty
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Harga Satuan
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              % Diskon Sat.
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Subtotal
            </th>
            {canEdit && (
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Aksi
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {items.map((item) =>
            editId === item.id ? (
              /* ── Edit row ── */
              <tr key={item.id} className="bg-blue-50">
                <td className="px-4 py-2 text-xs text-gray-500">
                  {TYPE_LABEL[item.item_type] ?? item.item_type}
                </td>
                <td className="px-4 py-2">
                  <input
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full rounded border border-blue-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    value={editQty}
                    min="0.01"
                    step="0.01"
                    onChange={(e) => setEditQty(Math.max(0.01, Number(e.target.value)))}
                    className="w-20 rounded border border-blue-300 px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    value={editPrice}
                    min="0"
                    step="1000"
                    onChange={(e) => setEditPrice(Math.max(0, Number(e.target.value)))}
                    className="w-28 rounded border border-blue-300 px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-2 text-right text-xs text-gray-400">
                  {Number(item.markup_pct) > 0 ? `${Number(item.markup_pct).toFixed(1)}%` : "—"}
                </td>
                <td className="px-4 py-2 text-right text-xs text-gray-500">
                  {fmtRp(editPrice * editQty * (1 + Number(item.markup_pct) / 100))}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={saveEdit}
                      disabled={isPending}
                      className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Simpan
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={isPending}
                      className="rounded bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300"
                    >
                      Batal
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              /* ── Normal row ── */
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                  {TYPE_LABEL[item.item_type] ?? item.item_type}
                </td>
                <td className="px-4 py-3 text-gray-900">{item.description}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-gray-700">
                  {Number(item.quantity)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-gray-700">
                  {fmtRp(Number(item.unit_price))}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-gray-500">
                  {Number(item.markup_pct) > 0 ? `${Number(item.markup_pct).toFixed(1)}%` : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-gray-900">
                  {fmtRp(Number(item.final_price))}
                </td>
                {canEdit && (
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => startEdit(item)}
                        disabled={isPending}
                        className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        disabled={isPending}
                        className="text-xs text-red-500 hover:underline disabled:opacity-50"
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
