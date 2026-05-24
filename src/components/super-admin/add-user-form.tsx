"use client";

import { useActionState } from "react";
import { addUserToTenant, type ActionState } from "@/lib/actions/tenant";
import { useState } from "react";
import { UserPlus, X } from "lucide-react";

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
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addUserToTenant,
    {}
  );

  // Close and reset after success
  function handleSuccess() {
    setOpen(false);
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

            {state.success ? (
              <div className="px-6 py-8 text-center">
                <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <UserPlus className="h-6 w-6 text-green-600" />
                </div>
                <p className="font-medium text-gray-900">Undangan Terkirim!</p>
                <p className="mt-1 text-sm text-gray-500">{state.success}</p>
                <button
                  onClick={handleSuccess}
                  className="mt-4 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-500"
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
                    Email undangan akan dikirim ke alamat ini
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
                    {pending ? "Mengirim..." : "Kirim Undangan"}
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
