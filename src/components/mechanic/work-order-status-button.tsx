"use client";

import { useTransition } from "react";
import { updateInvoiceMechanicStatus } from "@/lib/actions/invoice";

interface Props {
  invoiceId: string;
  nextStatus: "in_progress" | "completed";
  label: string;
}

export function WorkOrderStatusButton({ invoiceId, nextStatus, label }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`Konfirmasi: ${label}?`)) return;
    startTransition(async () => {
      const result = await updateInvoiceMechanicStatus(invoiceId, nextStatus);
      if (result?.error) alert(result.error);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`w-full rounded-2xl py-4 text-base font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-60 ${
        nextStatus === "in_progress"
          ? "bg-blue-600 active:bg-blue-700"
          : "bg-green-600 active:bg-green-700"
      }`}
    >
      {isPending ? "Memproses…" : label}
    </button>
  );
}
