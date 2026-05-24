"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Client-side auth exchange page.
 *
 * Supabase invite / magic-link emails sometimes redirect with the token in the
 * URL hash fragment (#access_token=…). Hash fragments are never sent to the
 * server, so the Route Handler at /auth/callback cannot read them. Instead,
 * the Route Handler forwards here so the browser-side Supabase client can
 * detect the hash, create the session, then navigate to `next`.
 */
export default function AuthExchangePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const next = searchParams.get("next") ?? "/";
    const supabase = createClient();

    // Subscribe first so we don't miss the SIGNED_IN event that fires
    // as soon as supabase-js processes the #access_token hash fragment.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        subscription.unsubscribe();
        router.replace(next);
      }
    });

    // Also check immediately in case the client already processed the hash.
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setErrorMsg("Gagal memproses autentikasi: " + error.message);
        subscription.unsubscribe();
        return;
      }
      if (session) {
        subscription.unsubscribe();
        router.replace(next);
      } else {
        // Give onAuthStateChange a moment; if nothing fires, show error.
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session: s } }) => {
            if (!s) {
              subscription.unsubscribe();
              setErrorMsg(
                "Link undangan sudah kedaluwarsa atau tidak valid. Minta undangan baru dari administrator."
              );
            }
          });
        }, 3000);
      }
    });

    return () => subscription.unsubscribe();
  }, [router, searchParams]);

  if (errorMsg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-md p-8 text-center">
          <h1 className="text-xl font-bold text-red-600 mb-2">Akses Ditolak</h1>
          <p className="text-sm text-gray-600">{errorMsg}</p>
          <a
            href="/login"
            className="mt-6 inline-block text-sm text-blue-600 hover:underline"
          >
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
