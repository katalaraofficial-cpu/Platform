"use client";

import { useActionState } from "react";
import { addUserToTenant, type ActionState } from "@/lib/actions/tenant";
import { useState } from "react";
import { UserPlus, X, Copy, Check } from "lucide-react";

interface Props {
  tenantId: string;
}

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner (Pemilik)" },
  { value: "admin", label: "Admin / Kasir" },
  { value: "mechanic", label: "Mekanik" },
];

export function AddUserForm({ tenantId }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addUserToTenant,
    {}
  );

  function handleCopy(link: string) {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm
                   font-medium text-white hover:bg-blue-500 transition-colors"
      >
        <UserPlus className="h-4 w-4" />
        Tambah Pengguna
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="font-semibold text-gray-900">Tambah Pengguna Baru</h3>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {state.invite_link ? (
              <div className="px-6 py-6">
                {/* Header — warna beda tergantung apakah email terkirim */}
                {state.success?.startsWith("Email undangan") ? (
                  <>
                    <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                      <Check className="h-6 w-6 text-green-600" />
                    </div>
                    <p className="text-center font-medium text-gray-900 mb-1">Undangan Berhasil Dikirim!</p>
                    <p className="text-center text-sm text-gray-500 mb-4">{state.success}</p>

                    {/* Backup copy link */}
                    <details className="rounded-lg border border-gray-200 bg-gray-50">
                      <summary className="cursor-pointer px-3 py-2.5 text-xs text-gray-500 font-medium select-none">
                        Email tidak masuk? Salin link manual
                      </summary>
                      <div className="px-3 pb-3">
                        <p className="text-xs text-gray-700 break-all leading-relaxed my-2 font-mono bg-white border border-gray-200 rounded p-2">
                          {state.invite_link}
                        </p>
                        <button
                          onClick={() => handleCopy(state.invite_link!)}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-lg
                                     bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600"
                        >
                          {copied ? <><Check className="h-4 w-4" /> Tersalin!</> : <><Copy className="h-4 w-4" /> Salin Link</>}
                        </button>
                      </div>
                    </details>
                  </>
                ) : (
                  <>
                    <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                      <Copy className="h-6 w-6 text-yellow-600" />
                    </div>
                    <p className="text-center font-medium text-gray-900 mb-1">Link Undangan Siap</p>
                    <p className="text-center text-sm text-amber-600 mb-4">
                      Email gagal dikirim — salin link ini dan kirim manual via WhatsApp/chat.
                    </p>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <p className="text-xs text-gray-700 break-all leading-relaxed mb-3 font-mono">
                        {state.invite_link}
                      </p>
                      <button
                        onClick={() => handleCopy(state.invite_link!)}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg
                                   bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                      >
                        {copied ? <><Check className="h-4 w-4" /> Tersalin!</> : <><Copy className="h-4 w-4" /> Salin Link</>}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-gray-400 text-center">Link berlaku 24 jam.</p>
                  </>
                )}

                <button
                  onClick={() => setOpen(false)}
                  className="mt-4 w-full rounded-lg border border-gray-300 py-2 text-sm
                             font-medium text-gray-700 hover:bg-gray-50"
                >
                  Selesai
                </button>
              </div>
            ) : (
              <form action={formAction} className="px-6 py-5 space-y-4">
                <input type="hidden" name="tenant_id" value={tenantId} />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Lengkap <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="full_name"
                    type="text"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Budi Santoso"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="email"
                    type="email"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="budi@bengkel.com"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Link undangan akan dibuat untuk akun ini
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="role"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Pilih role --</option>
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                {state.error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                    {state.error}
                  </p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-lg border border-gray-300 py-2 text-sm
                               font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium
                               text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    {pending ? "Membuat Link..." : "Buat Link Undangan"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

