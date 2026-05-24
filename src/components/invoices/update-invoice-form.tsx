"use client";

import { useState, useTransition } from "react";
import { updateInvoiceNotes } from "@/lib/actions/invoice";

interface Props {
  invoiceId: string;
  basePath: string;
  currentNotes: string | null;
}

export function UpdateInvoiceForm({ invoiceId, basePath, currentNotes }: Props) {
  const [notes, setNotes] = useState(currentNotes ?? "");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await updateInvoiceNotes(invoiceId, notes, basePath);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Catatan Invoice
        </label>
        <textarea
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
          rows={3}
          placeholder="Tambahkan catatan, misalnya keluhan pelanggan atau instruksi khusus..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {isPending ? "Menyimpan..." : "Perbarui Invoice"}
        </button>
        {saved && (
          <span className="text-sm text-green-600">Tersimpan!</span>
        )}
      </div>
    </form>
  );
}
