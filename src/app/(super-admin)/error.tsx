"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function SuperAdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[super-admin] layout error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="max-w-md w-full text-center px-6 py-12">
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          Terjadi kesalahan
        </h1>
        <p className="text-sm text-gray-500 mb-1">
          {error.message || "Server error saat memuat halaman."}
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 mb-6">Digest: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-700"
          >
            Coba lagi
          </button>
          <Link
            href="/login"
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
          >
            Kembali ke Login
          </Link>
        </div>
      </div>
    </div>
  );
}
