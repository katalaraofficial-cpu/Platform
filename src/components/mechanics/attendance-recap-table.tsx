"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, X, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { adjustAttendanceRecord, deleteAttendanceRecords } from "@/lib/actions/attendance";

export type RecapRecord = {
  id: string;
  profile_id: string;
  attendance_date: string;
  check_in_at: string;
  check_out_at: string;
  status: string;
  mode: string;
};
export type RecapEngineer = { id: string; name: string };
export type WeekDay = { date: string; dayLabel: string; dateLabel: string };

const PAGE_SIZE = 8;

function toWIBTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function hoursBetween(inIso: string, outIso: string) {
  const h = (new Date(outIso).getTime() - new Date(inIso).getTime()) / 3_600_000;
  return Math.max(0, h);
}

function fmtHours(h: number) {
  return h.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

type EditTarget = {
  engineer: RecapEngineer;
  day: WeekDay;
  record: RecapRecord | null;
};

export function AttendanceRecapTable({
  engineers,
  records,
  weekDays,
  prevWeek,
  nextWeek,
  weekRangeLabel,
}: {
  engineers: RecapEngineer[];
  records: RecapRecord[];
  weekDays: WeekDay[];
  prevWeek: string;
  nextWeek: string;
  weekRangeLabel: string;
}) {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const [pending, startTransition] = useTransition();

  // map[profileId][date] = record
  const recordMap = useMemo(() => {
    const m = new Map<string, Map<string, RecapRecord>>();
    for (const r of records) {
      if (!m.has(r.profile_id)) m.set(r.profile_id, new Map());
      m.get(r.profile_id)!.set(r.attendance_date, r);
    }
    return m;
  }, [records]);

  const totalPages = Math.max(1, Math.ceil(engineers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageEngineers = engineers.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const pageIds = pageEngineers.map((e) => e.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function toggleAllPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function rowTotal(engineerId: string) {
    const days = recordMap.get(engineerId);
    if (!days) return 0;
    let total = 0;
    for (const wd of weekDays) {
      const rec = days.get(wd.date);
      if (rec && rec.status === "present") total += hoursBetween(rec.check_in_at, rec.check_out_at);
    }
    return total;
  }

  function handleBulkDelete() {
    const ids: string[] = [];
    for (const engId of selected) {
      const days = recordMap.get(engId);
      if (!days) continue;
      for (const wd of weekDays) {
        const rec = days.get(wd.date);
        if (rec) ids.push(rec.id);
      }
    }
    if (ids.length === 0) {
      toast.error("Engineer terpilih belum punya kehadiran di minggu ini");
      return;
    }
    if (!confirm(`Hapus ${ids.length} catatan kehadiran (minggu ini) untuk ${selected.size} engineer terpilih?`))
      return;
    startTransition(async () => {
      const res = await deleteAttendanceRecords(ids);
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.success);
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Week navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-violet-500" />
          <span className="text-sm font-semibold text-gray-800">{weekRangeLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          <a
            href={`/owner/mechanics?tab=performa&view=rekap&week=${prevWeek}`}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <ChevronLeft className="h-4 w-4" /> Sebelumnya
          </a>
          <a
            href={`/owner/mechanics?tab=performa&view=rekap&week=${nextWeek}`}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Berikutnya <ChevronRight className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5">
          <span className="text-sm font-medium text-violet-700">{selected.size} engineer dipilih</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-white"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> Hapus Minggu Ini
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={toggleAllPage}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </th>
              <th className="w-10 px-2 py-3">No</th>
              <th className="px-3 py-3">Nama</th>
              {weekDays.map((wd) => (
                <th key={wd.date} className="px-2 py-3 text-center">
                  <div className="font-semibold text-gray-600">{wd.dayLabel}</div>
                  <div className="font-normal normal-case text-gray-400">{wd.dateLabel}</div>
                </th>
              ))}
              <th className="px-3 py-3 text-center">Total Jam</th>
              <th className="px-3 py-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {pageEngineers.length === 0 ? (
              <tr>
                <td colSpan={weekDays.length + 5} className="px-4 py-10 text-center text-gray-400">
                  Belum ada engineer
                </td>
              </tr>
            ) : (
              pageEngineers.map((eng, idx) => {
                const days = recordMap.get(eng.id);
                const total = rowTotal(eng.id);
                return (
                  <tr key={eng.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(eng.id)}
                        onChange={() => toggleOne(eng.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </td>
                    <td className="px-2 py-2.5 text-gray-400">{safePage * PAGE_SIZE + idx + 1}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">{eng.name}</td>
                    {weekDays.map((wd) => {
                      const rec = days?.get(wd.date) ?? null;
                      const h = rec && rec.status === "present" ? hoursBetween(rec.check_in_at, rec.check_out_at) : null;
                      return (
                        <td key={wd.date} className="px-1 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => setEdit({ engineer: eng, day: wd, record: rec })}
                            className={`mx-auto flex min-w-[44px] flex-col items-center rounded-lg px-2 py-1 transition-colors hover:ring-1 hover:ring-violet-300 ${
                              rec
                                ? rec.status === "invalid"
                                  ? "bg-red-50 text-red-600"
                                  : rec.mode === "field"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-emerald-50 text-emerald-700"
                                : "text-gray-300 hover:bg-gray-100"
                            }`}
                            title={rec ? `Masuk ${toWIBTime(rec.check_in_at)} – Keluar ${toWIBTime(rec.check_out_at)}` : "Tambah kehadiran manual"}
                          >
                            <span className="text-sm font-bold tabular-nums">
                              {h !== null ? fmtHours(h) : rec ? "!" : "—"}
                            </span>
                            {rec && (
                              <span className="text-[9px] opacity-70">{toWIBTime(rec.check_in_at)}</span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-center font-bold tabular-nums text-gray-800">
                      {fmtHours(total)}j
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-[11px] text-gray-400">klik sel hari</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Menampilkan {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, engineers.length)} dari {engineers.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="rounded-lg border border-gray-200 p-1.5 text-gray-500 disabled:opacity-40 hover:bg-gray-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-sm font-medium text-gray-600">
              {safePage + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="rounded-lg border border-gray-200 p-1.5 text-gray-500 disabled:opacity-40 hover:bg-gray-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {edit && (
        <EditModal
          target={edit}
          pending={pending}
          onClose={() => setEdit(null)}
          onSave={(payload) => {
            startTransition(async () => {
              const res = await adjustAttendanceRecord(payload);
              if (res.error) toast.error(res.error);
              else {
                toast.success(res.success);
                setEdit(null);
                router.refresh();
              }
            });
          }}
          onDelete={(id) => {
            if (!confirm("Hapus kehadiran ini?")) return;
            startTransition(async () => {
              const res = await deleteAttendanceRecords([id]);
              if (res.error) toast.error(res.error);
              else {
                toast.success(res.success);
                setEdit(null);
                router.refresh();
              }
            });
          }}
        />
      )}
      <p className="text-xs text-gray-400">
        Klik sel hari untuk menyesuaikan jam masuk/keluar aktual (override otomatis 8 jam). Sel kosong &quot;—&quot; bisa diisi manual.
      </p>
    </div>
  );
}

function EditModal({
  target,
  pending,
  onClose,
  onSave,
  onDelete,
}: {
  target: EditTarget;
  pending: boolean;
  onClose: () => void;
  onSave: (p: {
    recordId?: string;
    profileId: string;
    attendanceDate: string;
    checkInTime: string;
    checkOutTime: string;
    status: "present" | "invalid";
  }) => void;
  onDelete: (id: string) => void;
}) {
  const { engineer, day, record } = target;
  const [checkIn, setCheckIn] = useState(record ? toWIBTime(record.check_in_at) : "08:00");
  const [checkOut, setCheckOut] = useState(record ? toWIBTime(record.check_out_at) : "16:00");
  const [status, setStatus] = useState<"present" | "invalid">(
    (record?.status as "present" | "invalid") ?? "present"
  );

  const durasi = useMemo(() => {
    const re = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!re.test(checkIn) || !re.test(checkOut)) return null;
    const [ih, im] = checkIn.split(":").map(Number);
    const [oh, om] = checkOut.split(":").map(Number);
    const mins = oh * 60 + om - (ih * 60 + im);
    return mins > 0 ? mins / 60 : null;
  }, [checkIn, checkOut]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900">{engineer.name}</h3>
            <p className="text-xs text-gray-500">
              {day.dayLabel}, {day.dateLabel}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Jam Masuk</label>
            <input
              type="time"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Jam Keluar</label>
            <input
              type="time"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-3 rounded-xl bg-violet-50 px-4 py-2.5 text-sm">
          <span className="text-violet-500">Durasi aktual: </span>
          <span className="font-bold text-violet-700">
            {durasi !== null ? `${fmtHours(durasi)} jam` : "—"}
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "present" | "invalid")}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
          >
            <option value="present">Hadir</option>
            <option value="invalid">Tidak valid</option>
          </select>
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          {record ? (
            <button
              type="button"
              onClick={() => onDelete(record.id)}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> Hapus
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={pending || durasi === null}
              onClick={() =>
                onSave({
                  recordId: record?.id,
                  profileId: engineer.id,
                  attendanceDate: day.date,
                  checkInTime: checkIn,
                  checkOutTime: checkOut,
                  status,
                })
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              <Pencil className="h-4 w-4" /> Simpan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
