"use client";

import { useState, useTransition } from "react";
import { Gift, X } from "lucide-react";
import { redeemEmployeePoints } from "@/lib/actions/employee-points";
import { toast } from "sonner";

function fmtNum(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

type Props = {
  profileId: string;
  mechanicName: string;
  currentBalance: number;
  pointValue: number; // Rp per point
  minRedeem: number;
};

export function RedeemPointButton({
  profileId,
  mechanicName,
  currentBalance,
  pointValue,
  minRedeem,
}: Props) {
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const pointsNum = Math.max(0, parseInt(points) || 0);
  const bonusAmount = pointsNum * pointValue;

  function handleSubmit() {
    if (pointsNum < minRedeem) {
      toast.error(`Minimal redeem ${minRedeem} point`);
      return;
    }
    startTransition(async () => {
      const res = await redeemEmployeePoints(profileId, pointsNum, notes);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.success);
        setOpen(false);
        setPoints("");
        setNotes("");
      }
    });
  }

  if (currentBalance <= 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors"
      >
        <Gift className="h-3 w-3" />
        Tukar Point
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Tukar Point — {mechanicName}</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Balance info */}
            <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3">
              <p className="text-xs text-amber-600 font-medium">Saldo Point</p>
              <p className="text-2xl font-bold text-amber-700">{fmtNum(currentBalance)} pt</p>
              <p className="text-xs text-amber-500 mt-0.5">
                Nilai: Rp {fmtNum(pointValue)} / point · Min. redeem: {minRedeem} pt
              </p>
            </div>

            {/* Points input */}
            <div className="mb-3">
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                Jumlah Point Ditukar
              </label>
              <input
                type="number"
                min={minRedeem}
                max={currentBalance}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                placeholder={`Min ${minRedeem} pt`}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
              />
              {pointsNum > 0 && (
                <p className="mt-1 text-xs text-emerald-600 font-medium">
                  = Rp {fmtNum(bonusAmount)} bonus kas
                </p>
              )}
            </div>

            {/* Notes */}
            <div className="mb-5">
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                Catatan (opsional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Bonus Mei 2026"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={isPending || pointsNum < minRedeem || pointsNum > currentBalance}
                className="flex-1 rounded-xl bg-amber-500 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {isPending ? "Memproses..." : "Tukar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
