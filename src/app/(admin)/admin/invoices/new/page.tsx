"use client";

import { useActionState } from "react";
import { createInvoice, type ActionState } from "@/lib/actions/invoice";
import Link from "next/link";

const BASE_PATH = "/admin";

export default function NewAdminInvoicePage() {
  const [state, action, isPending] = useActionState<ActionState, FormData>(
    createInvoice,
    {}
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={`${BASE_PATH}/invoices`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Kembali ke Invoice
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          Buat Invoice Baru
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Nomor invoice akan dibuat otomatis
        </p>
      </div>

      <form action={action} className="space-y-6">
        <input type="hidden" name="base_path" value={BASE_PATH} />

        {state.error && (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
            {state.error}
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            Data Pelanggan
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label
                htmlFor="customer_name"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Nama Pelanggan <span className="text-red-500">*</span>
              </label>
              <input
                id="customer_name"
                type="text"
                name="customer_name"
                required
                placeholder="contoh: Budi Santoso"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="customer_phone"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                No. HP
              </label>
              <input
                id="customer_phone"
                type="tel"
                name="customer_phone"
                placeholder="contoh: 08123456789"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            Data Kendaraan
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="vehicle_plate"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Nomor Plat
              </label>
              <input
                id="vehicle_plate"
                type="text"
                name="vehicle_plate"
                placeholder="contoh: B 1234 XX"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="vehicle_year"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Tahun
              </label>
              <input
                id="vehicle_year"
                type="number"
                name="vehicle_year"
                placeholder={String(new Date().getFullYear())}
                min="1900"
                max={new Date().getFullYear() + 1}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="vehicle_brand"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Merek
              </label>
              <input
                id="vehicle_brand"
                type="text"
                name="vehicle_brand"
                placeholder="contoh: Toyota"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="vehicle_model"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Model
              </label>
              <input
                id="vehicle_model"
                type="text"
                name="vehicle_model"
                placeholder="contoh: Avanza"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            Catatan
          </h2>
          <textarea
            name="notes"
            rows={3}
            placeholder="Keluhan pelanggan, permintaan khusus, dll."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 rounded-md bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isPending ? "Membuat invoice..." : "Buat Invoice"}
          </button>
          <Link
            href={`${BASE_PATH}/invoices`}
            className="rounded-md border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Batal
          </Link>
        </div>
      </form>
    </div>
  );
}
