"use client";

import { useState, useTransition } from "react";
import { Gift } from "lucide-react";
import { toast } from "sonner";
import { submitPointRedemptionClaim } from "@/lib/actions/employee-points";

function fmtNum(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

type Props = {
  currentBalance: number;
  minRedeem: number;
  pointValue: number;
};

export function SubmitPointClaimCard({
  currentBalance,
  minRedeem,
  pointValue,
}: Props) {
  const [points, setPoints] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const pointsNum = Math.max(0, parseInt(points) || 0);
  const payout = pointsNum * pointValue;

  function onSubmit() {
    if (pointsNum < minRedeem) {
      toast.error(`Minimal redeem ${minRedeem} point`);
      return;
    }
    if (pointsNum > currentBalance) {
      toast.error("Saldo point tidak cukup");
      return;
    }

    startTransition(async () => {
      const res = await submitPointRedemptionClaim(pointsNum, notes);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.success ?? "Pengajuan klaim berhasil dikirim");
      setPoints("");
      setNotes("");
    });
  }

  return (
    <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <Gift className="h-4 w-4 text-amber-500" />
        <p className="text-sm font-semibold text-gray-800">Ajukan Klaim Point</p>
      </div>
      <p className="text-xs text-gray-500">
        Nilai point: Rp {fmtNum(pointValue)} / point · Minimal: {minRedeem} point
      </p>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <input
          type="number"
          min={minRedeem}
          max={currentBalance}
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          placeholder={`Masukkan jumlah point (min ${minRedeem})`}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
        />
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Catatan klaim (opsional)"
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
        />
      </div>

      {pointsNum > 0 && (
        <p className="mt-2 text-xs font-medium text-emerald-600">
          Estimasi payout: Rp {fmtNum(payout)}
        </p>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={
          isPending || pointsNum < minRedeem || pointsNum > currentBalance || currentBalance < minRedeem
        }
        className="mt-3 w-full rounded-xl bg-amber-500 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
      >
        {isPending ? "Mengirim..." : "Kirim Pengajuan Klaim"}
      </button>
    </div>
  );
}
