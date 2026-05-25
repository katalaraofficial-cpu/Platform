"use client";

import { useState, useTransition } from "react";
import { X, Loader2, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { reimburseDebt } from "@/lib/actions/mechanics";

// ── Types ─────────────────────────────────────────────────────
export type MechanicOption = { id: string; full_name: string };

// ── Helpers ───────────────────────────────────────────────────
function fmtDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return parseInt(digits, 10).toLocaleString("id-ID");
}
function parseAmount(display: string): number {
  return parseInt(display.replace(/\./g, ""), 10) || 0;
}

// ── Modal shell ───────────────────────────────────────────────
function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// ============================================================
// REIMBURSE MODAL  — add a reimbursement entry
// If defaultMechanicId is set (from "Lunasi" button on a card),
// the mechanic selector is pre-filled and locked.
// ============================================================
export function ReimburseModal({
  mechanics,
  defaultMechanicId,
  onClose,
}: {
  mechanics: MechanicOption[];
  defaultMechanicId?: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"kas_tunai" | "bank">("kas_tunai");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const fd = new FormData(e.currentTarget);
    const mechanicId = fd.get("mechanic_id") as string;
    const amtVal = parseAmount(amount);
    if (!mechanicId) {
      setErr("Pilih mekanik terlebih dahulu");
      return;
    }
    if (!amtVal || amtVal <= 0) {
      setErr("Jumlah harus lebih dari 0");
      return;
    }
    startTransition(async () => {
      const res = await reimburseDebt({
        mechanicId,
        amount: amtVal,
        notes: (fd.get("notes") as string) || undefined,
        paymentMethod,
      });
      if ("error" in res) {
        setErr(res.error);
      } else {
        toast.success("Reimburse berhasil dicatat");
        onClose();
      }
    });
  }

  const locked = !!defaultMechanicId;
  const lockedName = mechanics.find((m) => m.id === defaultMechanicId)?.full_name;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {err && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>
      )}

      {/* Mechanic selector */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Mekanik
        </label>
        {locked ? (
          <>
            <input type="hidden" name="mechanic_id" value={defaultMechanicId} />
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {lockedName?.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-gray-800">{lockedName}</span>
            </div>
          </>
        ) : (
          <div className="relative">
            <select
              name="mechanic_id"
              className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              required
            >
              <option value="">— Pilih mekanik —</option>
              {mechanics.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </select>
            <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          </div>
        )}
      </div>

      {/* Payment method */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Bayar Via
        </label>
        <div className="flex gap-2">
          {(["kas_tunai", "bank"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setPaymentMethod(opt)}
              className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                paymentMethod === opt
                  ? opt === "kas_tunai"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              {opt === "kas_tunai" ? "Kas Tunai" : "Transfer Bank"}
            </button>
          ))}
        </div>
      </div>

      {/* Amount */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Jumlah Dibayarkan
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
            Rp
          </span>
          <input
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(fmtDisplay(e.target.value))}
            required
          />
        </div>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Keterangan (opsional)
        </label>
        <input
          name="notes"
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="e.g. Pembayaran advance bulan Mei"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-60 hover:bg-primary/90 transition-colors"
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Simpan Reimbursement
      </button>
    </form>
  );
}
      setErr("Pilih mekanik terlebih dahulu");
      return;
    }
    if (!amtVal || amtVal <= 0) {
      setErr("Jumlah harus lebih dari 0");
      return;
    }
    startTransition(async () => {
      const res = await reimburseDebt({
        mechanicId,
        amount: amtVal,
        notes: (fd.get("notes") as string) || undefined,
      });
      if ("error" in res) {
        setErr(res.error);
      } else {
        toast.success("Reimburse berhasil dicatat");
        onClose();
      }
    });
  }

  const locked = !!defaultMechanicId;
  const lockedName = mechanics.find((m) => m.id === defaultMechanicId)?.full_name;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {err && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>
      )}

      {/* Mechanic selector */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Mekanik
        </label>
        {locked ? (
          <>
            <input type="hidden" name="mechanic_id" value={defaultMechanicId} />
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {lockedName?.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-gray-800">{lockedName}</span>
            </div>
          </>
        ) : (
          <div className="relative">
            <select
              name="mechanic_id"
              className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              required
            >
              <option value="">— Pilih mekanik —</option>
              {mechanics.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </select>
            <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          </div>
        )}
      </div>

      {/* Amount */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Jumlah Dibayarkan
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
            Rp
          </span>
          <input
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(fmtDisplay(e.target.value))}
            required
          />
        </div>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Keterangan (opsional)
        </label>
        <input
          name="notes"
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="e.g. Pembayaran advance bulan Mei"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-60 hover:bg-primary/90 transition-colors"
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Simpan Reimbursement
      </button>
    </form>
  );
}

// ============================================================
// REIMBURSE TRIGGER  — "Lunasi" button on mechanic card
// Opens modal pre-filled with the mechanic
// ============================================================
export function LunasiButton({
  mechanic,
  allMechanics,
}: {
  mechanic: MechanicOption;
  allMechanics: MechanicOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90 transition-colors"
      >
        Lunasi Hutang
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Reimburse — ${mechanic.full_name}`}
      >
        <ReimburseModal
          mechanics={allMechanics}
          defaultMechanicId={mechanic.id}
          onClose={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}

// ============================================================
// QUICK REIMBURSE BUTTON  — for the top of Reimburse tab
// Opens modal without pre-selected mechanic
// ============================================================
export function QuickReimburseButton({
  mechanics,
}: {
  mechanics: MechanicOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors"
      >
        + Catat Reimburse
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Catat Reimbursement">
        <ReimburseModal mechanics={mechanics} onClose={() => setOpen(false)} />
      </Modal>
    </>
  );
}
