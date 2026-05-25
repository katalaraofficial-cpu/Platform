"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { addMechanicItem } from "@/lib/actions/mechanic-item";

export function AddMechanicItemButton({ invoiceId }: { invoiceId: string }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState(1);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setDescription("");
    setQty(1);
    setError("");
  }

  function handleClose() {
    reset();
    setOpen(false);
  }

  function handleSubmit() {
    if (!description.trim()) {
      setError("Nama item wajib diisi");
      return;
    }
    setError("");
    startTransition(async () => {
      const res = await addMechanicItem({
        invoiceId,
        description: description.trim(),
        qty,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      reset();
      setOpen(false);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm active:bg-blue-600"
        aria-label="Tambah item pekerjaan"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={handleClose}
          />

          {/* Bottom sheet */}
          <div className="relative w-full rounded-t-2xl bg-white px-5 pb-10 pt-5 shadow-xl">
            {/* Handle */}
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />

            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">
                Catat Pengeluaran / Part
              </h2>
              <button
                onClick={handleClose}
                className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Description */}
            <label className="mb-1 block text-xs font-semibold text-gray-500">
              Nama item / keterangan
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="cth. Bensin, filter udara Honda, kampas rem…"
              className="mb-4 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none"
              autoFocus
            />

            {/* Qty */}
            <div className="mb-4 flex items-center">
              <span className="text-xs font-semibold text-gray-500">
                Jumlah (Qty)
              </span>
              <div className="ml-auto flex items-center gap-3">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-lg font-bold text-gray-600 active:bg-gray-200"
                >
                  −
                </button>
                <span className="w-6 text-center text-base font-semibold text-gray-900">
                  {qty}
                </span>
                <button
                  onClick={() => setQty((q) => q + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-lg font-bold text-gray-600 active:bg-gray-200"
                >
                  +
                </button>
              </div>
            </div>

            {error && (
              <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="w-full rounded-xl bg-blue-500 py-3 text-sm font-semibold text-white shadow-sm active:bg-blue-600 disabled:opacity-50"
            >
              {isPending ? "Menyimpan…" : "Simpan Item"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
