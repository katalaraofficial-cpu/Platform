"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function AuthExchangeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const next = searchParams.get("next") ?? "/";
    const supabase = createClient();

    // Parse hash fragment manual — createBrowserClient (@supabase/ssr) tidak
    // memproses hash secara otomatis karena default-nya PKCE flow.
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (accessToken && refreshToken) {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ data, error }) => {
          if (error || !data.session) {
            setErrorMsg(
              "Link undangan sudah kedaluwarsa atau tidak valid. Minta undangan baru dari administrator."
            );
          } else {
            router.replace(next);
          }
        });
    } else {
      // Tidak ada hash token — tampilkan error langsung
      setErrorMsg(
        "Link undangan tidak valid. Minta undangan baru dari administrator."
      );
    }
  }, [router, searchParams]);

  if (errorMsg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-md p-8 text-center">
          <h1 className="text-xl font-bold text-red-600 mb-2">Akses Ditolak</h1>
          <p className="text-sm text-gray-600">{errorMsg}</p>
          <a href="/login" className="mt-6 inline-block text-sm text-blue-600 hover:underline">
            Kembali ke halaman login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-sm text-gray-500">Memproses autentikasi…</p>
      </div>
    </div>
  );
}

const Spinner = (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
      <p className="text-sm text-gray-500">Memproses autentikasi…</p>
    </div>
  </div>
);

export default function AuthExchangePage() {
  return <Suspense fallback={Spinner}><AuthExchangeInner /></Suspense>;
}

