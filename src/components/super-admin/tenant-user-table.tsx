"use client";

import { useState, useTransition } from "react";
import { removeUsersFromTenant } from "@/lib/actions/tenant";
import { Trash2, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";

interface UserRow {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface Props {
  users: UserRow[];
  tenantId: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  mechanic: "Mekanik",
};

const PAGE_SIZE = 10;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function TenantUserTable({ users, tenantId }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const totalPages = Math.ceil(users.length / PAGE_SIZE);
  const paginated = users.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const allOnPageSelected =
    paginated.length > 0 && paginated.every((u) => selected.has(u.id));
  const someOnPageSelected = paginated.some((u) => selected.has(u.id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        paginated.forEach((u) => next.delete(u.id));
      } else {
        paginated.forEach((u) => next.add(u.id));
      }
      return next;
    });
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const ids = [...selected];
      const result = await removeUsersFromTenant(ids, tenantId);
      setConfirmDelete(false);
      setSelected(new Set());
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: result.success ?? "Pengguna berhasil dihapus" });
      }
    });
  }

  if (users.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-400">
        Belum ada pengguna di tenant ini
      </p>
    );
  }

  return (
    <>
      {/* Feedback message */}
      {message && (
        <div
          className={`px-5 py-3 text-sm border-b flex items-center justify-between ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border-green-100"
              : "bg-red-50 text-red-700 border-red-100"
          }`}
        >
          <span>{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            className="text-current opacity-60 hover:opacity-100 text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="px-5 py-2.5 bg-red-50 border-b border-red-100 flex items-center justify-between">
          <span className="text-sm text-red-700 font-medium">
            {selected.size} pengguna dipilih
          </span>
          <button
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5
                       text-xs font-medium text-white hover:bg-red-500 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Hapus Dipilih
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected;
                  }}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600
                             focus:ring-blue-500 cursor-pointer"
                />
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Nama
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Role
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Bergabung
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {paginated.map((u) => (
              <tr
                key={u.id}
                onClick={() => toggle(u.id)}
                className={`cursor-pointer transition-colors ${
                  selected.has(u.id) ? "bg-blue-50" : "hover:bg-gray-50"
                }`}
              >
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(u.id)}
                    onChange={() => toggle(u.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600
                               focus:ring-blue-500 cursor-pointer"
                  />
                </td>
                <td className="px-5 py-3 text-sm font-medium text-gray-900">
                  {u.full_name}
                </td>
                <td className="px-5 py-3 text-sm text-gray-500">
                  {ROLE_LABELS[u.role] ?? u.role}
                </td>
                <td className="px-5 py-3">
                  {u.is_active ? (
                    <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Aktif
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      Non-Aktif
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-sm text-gray-500">
                  {formatDate(u.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
          <p className="text-sm text-gray-500">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, users.length)}{" "}
            dari {users.length} pengguna
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200
                         text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`h-8 min-w-8 px-2.5 rounded-lg text-sm font-medium transition-colors ${
                  i === page
                    ? "bg-slate-900 text-white"
                    : "border border-gray-200 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              disabled={page === totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200
                         text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Hapus Pengguna</h3>
                <p className="text-sm text-gray-500">Tindakan ini tidak dapat dibatalkan</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-5">
              Anda akan menghapus <strong>{selected.size} pengguna</strong> secara permanen dari
              tenant ini. Akun mereka akan dihapus dari sistem.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white
                           hover:bg-red-500 disabled:opacity-50"
              >
                {isPending ? "Menghapus..." : `Ya, Hapus ${selected.size} Pengguna`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
