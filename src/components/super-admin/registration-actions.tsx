"use client";

import { useState, useTransition } from "react";
import { approveRegistration, rejectRegistration } from "@/lib/actions/tenant";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

interface Props {
  requestId: string;
  businessName: string;
  ownerEmail: string;
}

export function RegistrationActions({ requestId, businessName, ownerEmail }: Props) {
  const [isPending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleApprove() {
    startTransition(async () => {
      const result = await approveRegistration(requestId);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: `Tenant "${businessName}" disetujui. Undangan dikirim ke ${ownerEmail}.` });
      }
    });
  }

  async function handleReject() {
    startTransition(async () => {
      const result = await rejectRegistration(requestId, rejectNote);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setRejectOpen(false);
      }
    });
  }

  if (message) {
    return (
      <span
        className={`text-xs font-medium ${
          message.type === "success" ? "text-green-600" : "text-red-600"
        }`}
      >
        {message.text}
      </span>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={handleApprove}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5
                     text-xs font-medium text-white hover:bg-green-500 disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <CheckCircle className="h-3 w-3" />
          )}
          Setujui
        </button>
        <button
          onClick={() => setRejectOpen(true)}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-red-300 px-3 py-1.5
                     text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          <XCircle className="h-3 w-3" />
          Tolak
        </button>
      </div>

      {/* Reject modal */}
      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-gray-900 mb-1">Tolak Pendaftaran</h3>
            <p className="text-sm text-gray-500 mb-4">
              {businessName} — {ownerEmail}
            </p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Alasan penolakan (opsional)..."
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setRejectOpen(false)}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleReject}
                disabled={isPending}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {isPending ? "Memproses..." : "Konfirmasi Tolak"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
