"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  approvePointRedemptionClaim,
  rejectPointRedemptionClaim,
} from "@/lib/actions/employee-points";

type ClaimRow = {
  id: string;
  profileId: string;
  mechanicName: string;
  points: number;
  payoutAmount: number;
  notes: string | null;
  createdAt: string;
};

function fmtRp(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

export function PointClaimReviewList({ claims }: { claims: ClaimRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onApprove(id: string) {
    startTransition(async () => {
      const res = await approvePointRedemptionClaim(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.success ?? "Pengajuan disetujui");
      router.refresh();
    });
  }

  function onReject(id: string) {
    startTransition(async () => {
      const res = await rejectPointRedemptionClaim(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.success ?? "Pengajuan ditolak");
      router.refresh();
    });
  }

  if (claims.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-amber-700">
          Pengajuan Klaim Point Menunggu Approval
        </h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
          {claims.length}
        </span>
      </div>

      <div className="space-y-2">
        {claims.map((c) => (
          <div
            key={c.id}
            className="rounded-xl border border-amber-100 bg-white px-3 py-2.5 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-900">{c.mechanicName}</p>
                <p className="text-xs text-gray-500">
                  {c.points} pt · {fmtRp(c.payoutAmount)}
                </p>
                {c.notes && <p className="text-xs text-gray-400">{c.notes}</p>}
                <p className="text-[11px] text-gray-400">
                  {new Date(c.createdAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onReject(c.id)}
                  disabled={isPending}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Tolak
                </button>
                <button
                  type="button"
                  onClick={() => onApprove(c.id)}
                  disabled={isPending}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Setujui
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
