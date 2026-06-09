"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Clock, CheckCircle2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { submitCheckIn } from "@/lib/actions/attendance";
import type { AttendanceRecord } from "@/types/database";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

export function CheckInCard({
  hasActiveLocation,
  todayRecord,
  locationName,
}: {
  hasActiveLocation: boolean;
  todayRecord: AttendanceRecord | null;
  locationName: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [geoPending, setGeoPending] = useState(false);

  function handleCheckIn() {
    if (!navigator.geolocation) {
      toast.error("Browser tidak mendukung geolokasi");
      return;
    }
    setGeoPending(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoPending(false);
        startTransition(async () => {
          const res = await submitCheckIn({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          if (res.error) toast.error(res.error);
          else {
            toast.success(res.success);
            router.refresh();
          }
        });
      },
      (err) => {
        setGeoPending(false);
        toast.error("Gagal mengambil lokasi: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // Modul aktif tapi owner belum set lokasi.
  if (!hasActiveLocation) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 p-8 text-center">
        <MapPin className="mx-auto h-10 w-10 text-gray-300" />
        <p className="mt-3 text-sm font-semibold text-gray-700">Lokasi kerja belum tersedia</p>
        <p className="mt-1 text-xs text-gray-500">
          Owner belum menetapkan lokasi kerja. Absensi belum bisa dilakukan.
        </p>
      </div>
    );
  }

  // Sudah absen hari ini.
  if (todayRecord) {
    const isField = todayRecord.mode === "field";
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          <p className="text-base font-bold text-emerald-800">Sudah absen hari ini</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/70 px-4 py-3">
            <div className="flex items-center gap-1.5 text-emerald-500">
              <LogIn className="h-3.5 w-3.5" />
              <span className="text-[11px] font-semibold uppercase tracking-wide">Masuk</span>
            </div>
            <p className="mt-1 text-xl font-bold text-emerald-700 tabular-nums">
              {fmtTime(todayRecord.check_in_at)}
            </p>
          </div>
          <div className="rounded-xl bg-white/70 px-4 py-3">
            <div className="flex items-center gap-1.5 text-emerald-500">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-[11px] font-semibold uppercase tracking-wide">Keluar (auto)</span>
            </div>
            <p className="mt-1 text-xl font-bold text-emerald-700 tabular-nums">
              {fmtTime(todayRecord.check_out_at)}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              isField ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {isField ? "Mode Lapangan" : "Di Kantor"}
          </span>
          {locationName && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
              <MapPin className="h-3.5 w-3.5" />
              {locationName}
            </span>
          )}
          {todayRecord.distance_m !== null && (
            <span className="text-xs text-emerald-500">±{todayRecord.distance_m} m dari titik</span>
          )}
        </div>
        <p className="mt-3 text-xs text-emerald-600">
          Jam keluar tercatat otomatis 8 jam setelah absen masuk.
        </p>
      </div>
    );
  }

  // Belum absen → tombol check-in.
  return (
    <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
        <MapPin className="h-7 w-7 text-blue-500" />
      </div>
      <p className="mt-3 text-base font-bold text-gray-900">Absen Masuk</p>
      <p className="mt-1 text-xs text-gray-500">
        Pastikan Anda berada di lokasi kerja. GPS akan memvalidasi posisi Anda.
      </p>
      <button
        type="button"
        onClick={handleCheckIn}
        disabled={pending || geoPending}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        <LogIn className="h-4 w-4" />
        {geoPending ? "Mengambil lokasi..." : pending ? "Memproses..." : "Absen Masuk Sekarang"}
      </button>
      <p className="mt-3 text-[11px] text-gray-400">
        Jam keluar akan tercatat otomatis 8 jam setelah absen masuk.
      </p>
    </div>
  );
}
