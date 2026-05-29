"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  formatCustomerAddress,
  parseCustomerAddress,
  type CustomerRegionCatalog,
} from "@/lib/customer-address";
import {
  bulkDeleteOwnerCustomers,
  deleteOwnerCustomer,
  updateOwnerCustomer,
} from "@/lib/actions/customer";

export type OwnerCustomerTableRow = {
  id: string;
  name: string;
  address: string;
  phone: string;
  omzet: number;
  createdAt: string;
};

type Props = {
  rows: OwnerCustomerTableRow[];
  regionCatalog: CustomerRegionCatalog;
};

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function OwnerCustomerListTable({ rows, regionCatalog }: Props) {
  const router = useRouter();
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [previewRow, setPreviewRow] = useState<OwnerCustomerTableRow | null>(null);
  const [editRow, setEditRow] = useState<OwnerCustomerTableRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editStreet, setEditStreet] = useState("");
  const [editDistrict, setEditDistrict] = useState("");
  const [editRegency, setEditRegency] = useState("");
  const [editProvince, setEditProvince] = useState(regionCatalog.province);
  const [editPhone, setEditPhone] = useState("");

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  const districtOptions = useMemo(
    () => (editRegency ? regionCatalog.districtsByRegency[editRegency] ?? [] : []),
    [editRegency, regionCatalog]
  );

  useEffect(() => {
    if (editDistrict && districtOptions.length > 0 && !districtOptions.includes(editDistrict)) {
      setEditDistrict("");
    }
  }, [districtOptions, editDistrict]);

  const allOnPageSelected =
    pagedRows.length > 0 && pagedRows.every((row) => selectedIds.has(row.id));
  const someOnPageSelected = pagedRows.some((row) => selectedIds.has(row.id));

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        pagedRows.forEach((row) => next.delete(row.id));
      } else {
        pagedRows.forEach((row) => next.add(row.id));
      }
      return next;
    });
  }

  function openEdit(row: OwnerCustomerTableRow) {
    const parsed = parseCustomerAddress(row.address === "-" ? "" : row.address, regionCatalog);
    setEditRow(row);
    setEditName(row.name);
    setEditStreet(parsed.street);
    setEditDistrict(parsed.district);
    setEditRegency(parsed.regency);
    setEditProvince(parsed.province || regionCatalog.province);
    setEditPhone(row.phone === "-" ? "" : row.phone);
  }

  function handleSaveEdit() {
    if (!editRow) return;
    startTransition(async () => {
      const res = await updateOwnerCustomer(editRow.id, {
        name: editName,
        address: formatCustomerAddress({
          street: editStreet,
          district: editDistrict,
          regency: editRegency,
          province: editProvince || regionCatalog.province,
        }),
        phone: editPhone,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.success ?? "Data pelanggan diperbarui");
      setEditRow(null);
      router.refresh();
    });
  }

  function handleDeleteSingle() {
    if (!deleteId) return;
    startTransition(async () => {
      const res = await deleteOwnerCustomer(deleteId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.success ?? "Pelanggan dihapus");
      setDeleteId(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteId);
        return next;
      });
      router.refresh();
    });
  }

  function handleBulkDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0) {
      toast.error("Pilih data pelanggan terlebih dahulu");
      return;
    }

    startTransition(async () => {
      const res = await bulkDeleteOwnerCustomers(ids);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.success ?? "Bulk delete pelanggan berhasil");
      setConfirmBulkDelete(false);
      setSelectedIds(new Set());
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-gray-400">
        Belum ada pelanggan terdaftar.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 px-4 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">List View</label>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Dipilih: {selectedIds.size}</span>
          <button
            type="button"
            onClick={() => setConfirmBulkDelete(true)}
            disabled={selectedIds.size === 0 || pending}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
          >
            Hapus Bulk
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-10 px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected;
                  }}
                  onChange={toggleAllOnPage}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Nama</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Alamat</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Telepon</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Omzet</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {pagedRows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(row.id)}
                    onChange={() => toggleRow(row.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{row.address || "-"}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{row.phone || "-"}</td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-600">{fmtCurrency(row.omzet)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPreviewRow(row)}
                      className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                    >
                      <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" />Preview</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      <span className="inline-flex items-center gap-1"><Pencil className="h-3.5 w-3.5" />Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteId(row.id)}
                      className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                    >
                      <span className="inline-flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" />Hapus</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 border-t border-gray-100 px-4 py-3 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, rows.length)} dari {rows.length} pelanggan
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="px-2 text-xs text-gray-500">{page}/{totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {previewRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold text-gray-900">Preview Pelanggan</h3>
            <div className="mt-4 space-y-2 text-sm">
              <p><span className="font-semibold text-gray-700">Nama:</span> {previewRow.name}</p>
              <p><span className="font-semibold text-gray-700">Alamat:</span> {previewRow.address || "-"}</p>
              <p><span className="font-semibold text-gray-700">Telepon:</span> {previewRow.phone || "-"}</p>
              <p><span className="font-semibold text-gray-700">Omzet:</span> {fmtCurrency(previewRow.omzet)}</p>
              <p><span className="font-semibold text-gray-700">Dibuat:</span> {fmtDate(previewRow.createdAt)}</p>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewRow(null)}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {editRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold text-gray-900">Edit Pelanggan</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Nama</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Alamat Jalan</label>
                <textarea
                  value={editStreet}
                  onChange={(e) => setEditStreet(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Kabupaten/Kota</label>
                  <select
                    value={editRegency}
                    onChange={(e) => {
                      setEditRegency(e.target.value);
                      setEditDistrict("");
                    }}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  >
                    <option value="">Pilih kabupaten/kota</option>
                    {regionCatalog.regencies.map((regency) => (
                      <option key={regency} value={regency}>
                        {regency}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Kecamatan</label>
                  <select
                    value={editDistrict}
                    onChange={(e) => setEditDistrict(e.target.value)}
                    disabled={!editRegency}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">Pilih kecamatan</option>
                    {districtOptions.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Provinsi</label>
                <input
                  value={editProvince}
                  readOnly
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Telepon</label>
                <input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditRow(null)}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={pending}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Hapus Pelanggan"
        message="Data pelanggan akan dihapus. Invoice terkait akan tetap ada tetapi tanpa relasi pelanggan. Lanjutkan?"
        confirmLabel="Hapus"
        danger
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDeleteSingle}
      />

      <ConfirmDialog
        open={confirmBulkDelete}
        title="Hapus Pelanggan Terpilih"
        message={`Anda akan menghapus ${selectedIds.size} pelanggan sekaligus. Lanjutkan?`}
        confirmLabel="Hapus Bulk"
        danger
        onCancel={() => setConfirmBulkDelete(false)}
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}
