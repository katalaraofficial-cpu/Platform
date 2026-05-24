"use client";

import { useState, useTransition } from "react";
import { processPayment } from "@/lib/actions/invoice";

interface Props {
  invoiceId: string;
  basePath: string;
  grandTotal: number;
}

function fmtRp(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const METHODS = [
  { value: "cash", label: "Tunai (Cash)" },
  { value: "transfer", label: "Transfer Bank" },
  { value: "other", label: "Lainnya" },
];

export function PaymentForm({ invoiceId, basePath, grandTotal }: Props) {
  const [method, setMethod] = useState("cash");
  const [paymentDate, setPaymentDate] = useState(todayStr());
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm(`Konfirmasi pembayaran sebesar ${fmtRp(grandTotal)} via ${METHODS.find((m) => m.value === method)?.label}?`))
      return;
    startTransition(async () => {
      await processPayment(invoiceId, method, paymentDate, basePath);
    });
  }

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-6 shadow-sm">
      <h2 className="mb-1 font-semibold text-gray-900">Konfirmasi Pembayaran</h2>
      <p className="mb-4 text-sm text-gray-500">
        Pekerjaan selesai. Pilih metode pembayaran dan tanggal untuk menandai invoice sebagai Lunas.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Total */}
        <div className="rounded-md bg-white border border-green-200 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-gray-600">Total yang harus dibayar</span>
          <span className="text-lg font-bold text-gray-900">{fmtRp(grandTotal)}</span>
        </div>

        {/* Method */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Metode Pembayaran
          </label>
          <div className="flex flex-wrap gap-2">
            {METHODS.map((m) => (
              <label
                key={m.value}
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  method === m.value
                    ? "border-green-500 bg-white font-medium text-green-700 shadow-sm"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="method"
                  value={m.value}
                  checked={method === m.value}
                  onChange={() => setMethod(m.value)}
                  className="sr-only"
                />
                {m.label}
              </label>
            ))}
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Tanggal Pembayaran
          </label>
          <input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            max={todayStr()}
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Memproses..." : "✓ Proses Pembayaran & Catat ke Kas"}
        </button>
      </form>
    </div>
  );
}
