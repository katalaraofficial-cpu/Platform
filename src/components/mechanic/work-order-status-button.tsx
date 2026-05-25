"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateInvoiceMechanicStatus } from "@/lib/actions/invoice";

interface Props {
  invoiceId: string;
  nextStatus: "in_progress" | "completed";
  label: string;
}

export function WorkOrderStatusButton({ invoiceId, nextStatus, label }: Props) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  function handleClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    startTransition(async () => {
      const result = await updateInvoiceMechanicStatus(invoiceId, nextStatus);
      if (result?.error) {
        toast.error(result.error);
      } else {
        if (nextStatus === "completed") {
          // Hard navigation bypasses Next.js client router cache,
          // guaranteeing the dashboard re-fetches fresh server data.
          toast.success("Pekerjaan selesai!");
          window.location.href = "/mechanic/dashboard";
        } else {
          toast.success("Pekerjaan dimulai");
          router.refresh();
        }
      }
    });
  }

  const baseClass =
    "w-full rounded-2xl py-4 text-base font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2";

  if (confirming) {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="flex-1 rounded-2xl border-2 border-gray-300 py-4 text-base font-bold text-gray-600 transition-all active:scale-[0.98]"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={handleClick}
          className={`flex-1 ${baseClass} ${
            nextStatus === "in_progress" ? "bg-blue-600" : "bg-green-600"
          }`}
        >
          Ya, Konfirmasi
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`${baseClass} ${
        nextStatus === "in_progress"
          ? "bg-blue-600 active:bg-blue-700"
          : "bg-green-600 active:bg-green-700"
      }`}
    >
      {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
      {isPending ? "Memproses…" : label}
    </button>
  );
}
