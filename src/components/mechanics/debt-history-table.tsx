"use client";

import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  ClipboardList,
  Trash2,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { deleteDebtEntries, markDebtEntries } from "@/lib/actions/mechanics";

// ── Types ──────────────────────────────────────────────────────
export type HistoryRow = {
  id: string;
  mechanic_id: string;
  transaction_type: string;
  amount: number;
  notes: string | null;
  created_at: string;
  is_paid: boolean;
  invoice_items: { receipt_image_url: string | null } | null;
};

export type MechanicInfo = {
  id: string;
  name: string;
  color: string; // tailwind bg-* class, pre-computed server-side
};

// ── Helpers ────────────────────────────────────────────────────
function fmt(n: number) {
  return "Rp " + Math.abs(n).toLocaleString("id-ID");
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;

function getPaginationRange(
  current: number,
  total: number
): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const pages: (number | "...")[] = [];
  const add = (i: number) => {
    const last = pages[pages.length - 1];
    if (last !== undefined && last !== "..." && i - (last as number) > 1)
      pages.push("...");
    pages.push(i);
  };
  add(0);
  for (let i = current - 2; i <= current + 2; i++) {
    if (i > 0 && i < total - 1) add(i);
  }
  add(total - 1);
  return pages;
}

// ── Component ──────────────────────────────────────────────────
export function DebtHistoryTable({
  initialRows,
  mechanicInfos,
}: {
  initialRows: HistoryRow[];
  mechanicInfos: MechanicInfo[];
}) {
  const infoMap = new Map(mechanicInfos.map((m) => [m.id, m]));

  const [rows, setRows] = useState<HistoryRow[]>(initialRows);
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Ref holds snapshot + pending timer for undo-delete
  const pendingDelete = useRef<{
    snapshot: HistoryRow[];
    ids: string[];
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);

  // ── Pagination ────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = rows.slice(safePage * perPage, (safePage + 1) * perPage);
  const allPageSelected =
    pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));
  const someSelected = selected.size > 0;

  function goToPage(p: number) {
    setPage(Math.max(0, Math.min(p, totalPages - 1)));
  }

  function changePerPage(size: (typeof PAGE_SIZE_OPTIONS)[number]) {
    setPerPage(size);
    setPage(0);
  }

  // ── Selection ─────────────────────────────────────────────────
  function toggleAll() {
    setSelected((s) => {
      const next = new Set(s);
      if (allPageSelected) {
        pageRows.forEach((r) => next.delete(r.id));
      } else {
        pageRows.forEach((r) => next.add(r.id));
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Delete with rollback (5-second undo window) ───────────────
  const handleDelete = useCallback(() => {
    const ids = [...selected];
    if (ids.length === 0) return;

    // Cancel any previous pending delete first
    if (pendingDelete.current) {
      clearTimeout(pendingDelete.current.timer);
      // commit the previous delete immediately
      deleteDebtEntries(pendingDelete.current.ids);
      pendingDelete.current = null;
    }

    const snapshot = rows;
    setRows((r) => r.filter((row) => !ids.includes(row.id)));
    setSelected(new Set());

    const timer = setTimeout(async () => {
      pendingDelete.current = null;
      const res = await deleteDebtEntries(ids);
      if ("error" in res) {
        setRows(snapshot);
        toast.error("Gagal menghapus: " + res.error);
      }
    }, 5000);

    pendingDelete.current = { snapshot, ids, timer };

    toast(`${ids.length} entri dihapus`, {
      action: {
        label: "Undo",
        onClick: () => {
          if (pendingDelete.current) {
            clearTimeout(pendingDelete.current.timer);
            setRows(pendingDelete.current.snapshot);
            setSelected(new Set(pendingDelete.current.ids));
            pendingDelete.current = null;
            toast.success("Penghapusan dibatalkan");
          }
        },
      },
      duration: 5000,
    });
  }, [selected, rows]);

  // ── Mark as paid (optimistic) ─────────────────────────────────
  const handleMark = useCallback(async () => {
    const ids = [...selected];
    if (ids.length === 0) return;

    const snapshot = rows;
    setRows((r) =>
      r.map((row) => (ids.includes(row.id) ? { ...row, is_paid: true } : row))
    );
    setSelected(new Set());

    const res = await markDebtEntries(ids);
    if ("error" in res) {
      setRows(snapshot);
      toast.error("Gagal menandai: " + res.error);
    } else {
      toast.success(`${ids.length} entri ditandai lunas`);
    }
  }, [selected, rows]);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-gray-400" />
        <p className="text-sm font-semibold text-gray-700">Riwayat Transaksi</p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        {/* ── Toolbar ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
          {/* Bulk actions */}
          <div className="flex items-center gap-2">
            {someSelected ? (
              <>
                <span className="text-xs font-medium text-gray-500">
                  {selected.size} dipilih
                </span>
                <button
                  onClick={handleMark}
                  className="flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Tandai Lunas
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Hapus
                </button>
              </>
            ) : (
              <span className="text-xs text-gray-400">
                Pilih baris untuk aksi massal
              </span>
            )}
          </div>

          {/* Per-page selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Tampilkan</span>
            <div className="flex gap-1">
              {PAGE_SIZE_OPTIONS.map((size) => (
                <button
                  key={size}
                  onClick={() => changePerPage(size)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    perPage === size
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Table ───────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-gray-300 accent-primary"
                  />
                </th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Tanggal
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Engineer
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Tipe
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Jumlah
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Keterangan
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Nota
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-sm text-gray-400"
                  >
                    Belum ada riwayat kasbon atau reimburse
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => {
                  const isAdvance = row.transaction_type === "advance";
                  const info = infoMap.get(row.mechanic_id);
                  const receiptUrl = row.invoice_items?.receipt_image_url ?? null;
                  const isSelected = selected.has(row.id);

                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors hover:bg-gray-50/60 ${
                        isSelected ? "bg-primary/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(row.id)}
                          className="h-4 w-4 rounded border-gray-300 accent-primary"
                        />
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-xs text-gray-500">
                        {fmtDate(row.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                              info?.color ?? "bg-gray-400"
                            }`}
                          >
                            {initials(info?.name ?? "?")}
                          </div>
                          <span className="text-sm text-gray-800">
                            {info?.name ?? "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              isAdvance
                                ? "bg-orange-50 text-orange-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {isAdvance ? "Advance" : "Reimburse"}
                          </span>
                          {row.is_paid && isAdvance && (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
                              Lunas
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        <span
                          className={
                            isAdvance ? "text-orange-600" : "text-emerald-600"
                          }
                        >
                          {isAdvance ? "+" : "-"}
                          {fmt(Number(row.amount))}
                        </span>
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-3 text-xs text-gray-500">
                        {row.notes ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {receiptUrl ? (
                          <a
                            href={receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative inline-block"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={receiptUrl}
                              alt="Nota"
                              className="h-10 w-10 rounded-lg border border-gray-200 object-cover transition-opacity group-hover:opacity-80"
                            />
                            <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                              <span className="rounded bg-black/60 px-1 py-0.5 text-[9px] text-white">
                                Buka
                              </span>
                            </span>
                          </a>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination footer ────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
          <span className="text-xs text-gray-400">
            {rows.length === 0
              ? "Tidak ada data"
              : `${safePage * perPage + 1}–${Math.min(
                  (safePage + 1) * perPage,
                  rows.length
                )} dari ${rows.length} entri`}
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(safePage - 1)}
              disabled={safePage === 0}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            {getPaginationRange(safePage, totalPages).map((item, idx) =>
              item === "..." ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="flex h-7 w-7 items-center justify-center text-xs text-gray-400"
                >
                  …
                </span>
              ) : (
                <button
                  key={item}
                  onClick={() => goToPage(item as number)}
                  className={`flex h-7 min-w-[28px] items-center justify-center rounded-lg border px-1.5 text-xs font-medium transition-colors ${
                    safePage === item
                      ? "border-primary bg-primary text-white"
                      : "border-gray-200 text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {(item as number) + 1}
                </button>
              )
            )}

            <button
              onClick={() => goToPage(safePage + 1)}
              disabled={safePage >= totalPages - 1}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
