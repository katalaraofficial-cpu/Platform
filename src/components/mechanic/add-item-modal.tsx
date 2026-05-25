"use client";

import { useState, useTransition } from "react";
import { Plus, X, Wrench, Package } from "lucide-react";
import { addMechanicItem } from "@/lib/actions/mechanic-item";

type ItemType = "service" | "part_external";
type PaySrc = "mechanic" | "owner";

export function AddMechanicItemButton({ invoiceId }: { invoiceId: string }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [itemType, setItemType] = useState<ItemType>("service");
  const [qty, setQty] = useState(1);
  const [paySrc, setPaySrc] = useState<PaySrc>("mechanic");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setDescription("");
    setItemType("service");
    setQty(1);
    setPaySrc("mechanic");
    setError("");
  }

  function handleClose() {
    reset();
    setOpen(false);
  }

  function handleSubmit() {
    if (!description.trim()) {
      setError("Deskripsi wajib diisi");
      return;
    }
    setError("");
    startTransition(async () => {
      const res = await addMechanicItem({
        invoiceId,
        description: description.trim(),
        itemType,
        qty,
        paymentSource: itemType === "part_external" ? paySrc : undefined,
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
                Tambah Item Pekerjaan
              </h2>
              <button
                onClick={handleClose}
                className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Type toggle */}
            <div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1">
              {(
                [
                  { value: "service" as ItemType, label: "Jasa", Icon: Wrench },
                  { value: "part_external" as ItemType, label: "Part", Icon: Package },
                ] as const
              ).map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={() => setItemType(value)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors ${
                    itemType === value
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Description */}
            <label className="mb-1 block text-xs font-semibold text-gray-500">
              Deskripsi
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                itemType === "service"
                  ? "cth. Ganti oli mesin, tune-up…"
                  : "cth. Filter udara Honda, kampas rem…"
              }
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

            {/* Payment source — part_external only */}
            {itemType === "part_external" && (
              <div className="mb-4">
                <label className="mb-1 block text-xs font-semibold text-gray-500">
                  Dibayar oleh
                </label>
                <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
                  {(
                    [
                      { value: "mechanic" as PaySrc, label: "Saya (Piutang)" },
                      { value: "owner" as PaySrc, label: "Perusahaan" },
                    ] as const
                  ).map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setPaySrc(value)}
                      className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                        paySrc === value
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-500"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
