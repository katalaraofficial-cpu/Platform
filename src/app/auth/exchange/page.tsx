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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        subscription.unsubscribe();
        router.replace(next);
      }
    });

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

