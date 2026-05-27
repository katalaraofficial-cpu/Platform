"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { removeTenantsBulk } from "@/lib/actions/tenant";

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
};

interface Props {
  tenants: TenantRow[];
  countByTenant: Record<string, number>;
  page: number;
  totalPages: number;
  totalCount: number;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function pageHref(page: number) {
  return page <= 1 ? "/super-admin/tenants" : `/super-admin/tenants?page=${page}`;
}

export function TenantListTable({
  tenants,
  countByTenant,
  page,
  totalPages,
  totalCount,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const selectableIds = useMemo(
    () => tenants.filter((t) => !t.is_active).map((t) => t.id),
    [tenants]
  );
  const allSelectableOnPageSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const someSelectableOnPageSelected =
    selectableIds.some((id) => selected.has(id)) && !allSelectableOnPageSelected;

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelectableOnPageSelected) {
        selectableIds.forEach((id) => next.delete(id));
      } else {
        selectableIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function toggleOne(id: string, isActive: boolean) {
    if (isActive) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkDelete() {
    if (selected.size === 0) return;
    startTransition(async () => {
      const result = await removeTenantsBulk([...selected]);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: result.success ?? "Bulk hapus tenant berhasil" });
        setSelected(new Set());
      }
      router.refresh();
    });
  }

  const start = totalCount === 0 ? 0 : (page - 1) * 10 + 1;
  const end = Math.min(page * 10, totalCount);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {message && (
        <div
          className={`flex items-center justify-between border-b px-5 py-3 text-sm ${
            message.type === "success"
              ? "border-green-100 bg-green-50 text-green-700"
              : "border-red-100 bg-red-50 text-red-700"
          }`}
        >
          <span>{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            className="text-lg leading-none opacity-60 hover:opacity-100"
          >
            ×
          </button>
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex items-center justify-between border-b border-red-100 bg-red-50 px-5 py-2.5">
          <p className="text-sm font-medium text-red-700">
            {selected.size} tenant non-aktif dipilih
          </p>
          <button
            onClick={handleBulkDelete}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isPending ? "Menghapus..." : "Hapus Dipilih"}
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelectableOnPageSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelectableOnPageSelected;
                  }}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Nama Bengkel</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Slug</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
              <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Pengguna</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Dibuat</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {tenants.map((t) => (
              <tr
                key={t.id}
                className={`${selected.has(t.id) ? "bg-blue-50" : "hover:bg-gray-50"} transition-colors`}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    disabled={t.is_active}
                    onChange={() => toggleOne(t.id, t.is_active)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 disabled:opacity-30"
                    title={t.is_active ? "Tenant aktif tidak dapat dihapus bulk" : "Pilih tenant"}
                  />
                </td>
                <td className="px-5 py-3 text-sm font-medium text-gray-900">{t.name}</td>
                <td className="px-5 py-3 text-sm font-mono text-gray-500">{t.slug}</td>
                <td className="px-5 py-3">
                  {t.is_active ? (
                    <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Aktif</span>
                  ) : (
                    <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-600">Non-Aktif</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right text-sm text-gray-500">{countByTenant[t.id] ?? 0}</td>
                <td className="px-5 py-3 text-sm text-gray-500">{formatDate(t.created_at)}</td>
                <td className="px-5 py-3 text-right text-sm">
                  <Link href={`/super-admin/tenants/${t.id}`} className="font-medium text-blue-600 hover:text-blue-500">
                    Kelola
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
          <p className="text-sm text-gray-500">
            {start}–{end} dari {totalCount} tenant
          </p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                ← Sebelumnya
              </Link>
            ) : (
              <span className="rounded-md border border-gray-100 px-3 py-1.5 text-sm text-gray-300">← Sebelumnya</span>
            )}

            <span className="rounded-md border border-gray-100 px-3 py-1.5 text-sm text-gray-400">
              {page} / {totalPages}
            </span>

            {page < totalPages ? (
              <Link
                href={pageHref(page + 1)}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                Selanjutnya →
              </Link>
            ) : (
              <span className="rounded-md border border-gray-100 px-3 py-1.5 text-sm text-gray-300">Selanjutnya →</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
