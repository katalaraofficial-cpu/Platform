"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useOnline } from "@/lib/hooks/use-online";
import { WifiOff } from "lucide-react";

/**
 * Online-only mutation policy (Poin 3 technical debt).
 *
 * - Saat offline: tampilkan banner sticky, tambahkan class `is-offline` di <body>
 *   (CSS di globals.css men-disable tombol mutasi), dan intercept semua submit
 *   form di tingkat dokumen agar tidak ada mutasi yang terkirim.
 * - Tidak ada queue / background sync — kebijakan eksplisit untuk menjaga
 *   integritas ledger akuntansi (cegah timestamp conflict & komplain ganda).
 */
export function OfflineGuard() {
  const online = useOnline();

  useEffect(() => {
    document.body.classList.toggle("is-offline", !online);
    if (online) return;

    const onSubmit = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      toast.error("Tidak ada koneksi. Aksi simpan dinonaktifkan untuk menjaga integritas data.");
    };

    // Capture phase agar lebih dulu dari handler React.
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, [online]);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-amber-500 px-3 py-2 text-center text-sm font-semibold text-amber-950 shadow"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>
        Mode luring — data dibaca dari cache. Tombol simpan dinonaktifkan sampai koneksi pulih.
      </span>
    </div>
  );
}
