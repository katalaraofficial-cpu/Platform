import { CalendarDays } from "lucide-react";
import type { AttendanceRecord } from "@/types/database";

function fmtDate(dateStr: string) {
  // attendance_date adalah DATE (yyyy-mm-dd), tampilkan ringkas.
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("id-ID", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

function durasi(inIso: string, outIso: string) {
  const ms = new Date(outIso).getTime() - new Date(inIso).getTime();
  if (ms <= 0) return "-";
  const h = ms / 3_600_000;
  return `${h.toLocaleString("id-ID", { maximumFractionDigits: 1 })} jam`;
}

export function AttendanceLogTable({ records }: { records: AttendanceRecord[] }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-gray-400" />
        <h3 className="text-sm font-bold text-gray-800">Log Absensi Harian</h3>
      </div>
      {records.length === 0 ? (
        <p className="mt-4 text-center text-xs text-gray-400">Belum ada riwayat absensi.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wide text-gray-400">
                <th className="py-2 pr-3 font-semibold">Tanggal</th>
                <th className="py-2 pr-3 font-semibold">Masuk</th>
                <th className="py-2 pr-3 font-semibold">Pulang</th>
                <th className="py-2 pr-3 font-semibold">Durasi</th>
                <th className="py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const manual = Boolean(r.checked_out_at);
                return (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 pr-3 font-medium text-gray-700">
                      {fmtDate(r.attendance_date)}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-gray-600">
                      {fmtTime(r.check_in_at)}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-gray-600">
                      {fmtTime(r.check_out_at)}
                      {!manual && <span className="ml-1 text-[10px] text-gray-400">(auto)</span>}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-gray-700">
                      {durasi(r.check_in_at, r.check_out_at)}
                    </td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          r.status === "invalid"
                            ? "bg-red-100 text-red-600"
                            : r.mode === "field"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {r.status === "invalid"
                          ? "Invalid"
                          : r.mode === "field"
                            ? "Lapangan"
                            : "Hadir"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
