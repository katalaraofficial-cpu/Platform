"use client";

import { useState, useTransition } from "react";
import { removeUsersFromTenant, updateUserProfile, resendOwnTenantInvite } from "@/lib/actions/tenant";
import { Trash2, ChevronLeft, ChevronRight, AlertTriangle, Pencil, X, Phone, User, Send, Copy } from "lucide-react";

interface UserRow {
  id: string;
  full_name: string;
  role: string;
  phone: string;
  is_active: boolean;
  pending?: boolean;
  created_at: string;
}

interface Props {
  users: UserRow[];
  tenantId: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin / Kasir",
  mechanic: "Engineer",
};

const ROLE_BADGE: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700",
  admin: "bg-blue-100 text-blue-700",
  mechanic: "bg-amber-100 text-amber-700",
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
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPending, startEditTransition] = useTransition();
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendLink, setResendLink] = useState<string | null>(null);
  const [resendTransition, startResendTransition] = useTransition();

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

  function openEdit(u: UserRow) {
    setEditUser(u);
    setEditName(u.full_name === "(tanpa nama)" ? "" : u.full_name);
    setEditPhone(u.phone ?? "");
  }

  function handleEditSave() {
    if (!editUser) return;
    startEditTransition(async () => {
      const result = await updateUserProfile(editUser.id, {
        full_name: editName,
        phone: editPhone,
      });
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: result.success ?? "Profil diperbarui" });
      }
      setEditUser(null);
    });
  }

  function handleResend(u: UserRow) {
    setResendLink(null);
    setResendingId(u.id);
    startResendTransition(async () => {
      const result = await resendOwnTenantInvite(u.id);
      setResendingId(null);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: result.success ?? "Link aktivasi baru dibuat" });
        if (result.invite_link) setResendLink(result.invite_link);
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

      {/* Resend invite link (untuk dikirim manual jika email gagal) */}
      {resendLink && (
        <div className="border-b border-amber-100 bg-amber-50 px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-amber-700">Link aktivasi baru:</p>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(resendLink);
                setMessage({ type: "success", text: "Link disalin ke clipboard" });
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1
                         text-xs font-medium text-amber-700 hover:bg-amber-100"
            >
              <Copy className="h-3.5 w-3.5" />
              Salin
            </button>
          </div>
          <p className="mt-1 break-all rounded bg-white px-2 py-1 text-[11px] text-gray-600">{resendLink}</p>
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
                No. HP
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
              <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Aksi
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
                  {u.phone ? u.phone : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-5 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[u.role] ?? "bg-gray-100 text-gray-600"}`}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-5 py-3">
                  {u.pending ? (
                    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Menunggu Aktivasi
                    </span>
                  ) : u.is_active ? (
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
                <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="inline-flex items-center gap-2">
                    {u.pending && (
                      <button
                        onClick={() => handleResend(u)}
                        disabled={resendTransition && resendingId === u.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5
                                   text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {resendTransition && resendingId === u.id ? "Mengirim…" : "Kirim Ulang"}
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(u)}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5
                                 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                  </div>
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

      {/* Edit modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="font-semibold text-gray-900">Edit Pengguna</h3>
              <button
                onClick={() => setEditUser(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                Role:{" "}
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[editUser.role] ?? "bg-gray-100 text-gray-600"}`}>
                  {ROLE_LABELS[editUser.role] ?? editUser.role}
                </span>
                <span className="ml-2 text-gray-400">(tidak dapat diubah dari sini)</span>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  <User className="inline h-3.5 w-3.5 mr-1 text-gray-400" />
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nama lengkap"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  <Phone className="inline h-3.5 w-3.5 mr-1 text-gray-400" />
                  No. HP / WhatsApp
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="08xxxxxxxxxx"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setEditUser(null)}
                  className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={editPending || !editName.trim()}
                  className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white
                             hover:bg-blue-500 disabled:opacity-50"
                >
                  {editPending ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </div>
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
