"use client";

import { useActionState } from "react";
import { createTenant, type ActionState } from "@/lib/actions/tenant";
import Link from "next/link";
import { useEffect, useRef } from "react";

export default function NewTenantPage() {
  const [state, action, isPending] = useActionState<ActionState, FormData>(
    createTenant,
    {}
  );
  const nameRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);

  // Auto-populate slug from name
  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!slugRef.current) return;
    const auto = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    slugRef.current.value = auto;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link
          href="/super-admin/tenants"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Kembali ke Kelola Tenant
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          Buat Tenant Baru
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Tambah bengkel baru ke platform
        </p>
      </div>

      <form action={action} className="space-y-5">
        {state.error && (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
            {state.error}
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Nama Bengkel <span className="text-red-500">*</span>
              </label>
              <input
                ref={nameRef}
                id="name"
                type="text"
                name="name"
                required
                onChange={handleNameChange}
                placeholder="contoh: Bengkel Maju Jaya"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="slug"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Slug URL <span className="text-red-500">*</span>
              </label>
              <div className="flex rounded-md border border-gray-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                <span className="flex items-center rounded-l-md bg-gray-50 px-3 text-xs text-gray-400 border-r border-gray-300">
                  bengkel/
                </span>
                <input
                  ref={slugRef}
                  id="slug"
                  type="text"
                  name="slug"
                  required
                  placeholder="maju-jaya"
                  pattern="[a-z0-9\-]+"
                  className="flex-1 rounded-r-md px-3 py-2 text-sm font-mono focus:outline-none"
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Hanya huruf kecil, angka, dan tanda hubung (-)
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isPending ? "Membuat..." : "Buat Tenant"}
          </button>
          <Link
            href="/super-admin/tenants"
            className="rounded-md border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Batal
          </Link>
        </div>
      </form>
    </div>
  );
}
