"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Calendar, ListFilter, User } from "lucide-react";

type StatusOption = { label: string; value: string };

type Props = {
  basePath: string;
  dateFrom: string;
  dateTo: string;
  statusList: string[];
  customerQuery: string;
  itemQuery: string;
  invoiceNoQuery: string;
  pageSize: number;
  defaultPageSize: number;
  pageSizeOptions: readonly number[];
  statusOptions: readonly StatusOption[];
};

type Panel = "date" | "status" | "customer";

export function InvoiceFilterBar({
  basePath,
  dateFrom,
  dateTo,
  statusList,
  customerQuery,
  itemQuery,
  invoiceNoQuery,
  pageSize,
  defaultPageSize,
  pageSizeOptions,
  statusOptions,
}: Props) {
  const [open, setOpen] = useState<Set<Panel>>(new Set());

  const toggle = (p: Panel) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const anyOpen = open.size > 0;
  const dateActive = Boolean(dateFrom || dateTo);
  const statusActive = statusList.length > 0;
  const customerActive = Boolean(customerQuery);
  const hasActiveFilter =
    statusActive ||
    dateActive ||
    customerActive ||
    itemQuery ||
    invoiceNoQuery ||
    pageSize !== defaultPageSize;

  const badgeClass = (active: boolean, isOpen: boolean) =>
    `inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
      isOpen
        ? "border-gray-900 bg-gray-900 text-white"
        : active
        ? "border-gray-900 bg-gray-100 text-gray-900"
        : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
    }`;

  return (
    <form method="get" action={`${basePath}/invoices`} className="space-y-3">
      {/* Always-visible: search box + toggle badges */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            name="item"
            defaultValue={itemQuery}
            placeholder="Cari jasa / barang dalam invoice…"
            className="w-full rounded-md border border-gray-300 py-1.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
          aria-label="Cari"
        >
          <Search className="h-4 w-4" />
        </button>

        <button type="button" onClick={() => toggle("date")} className={badgeClass(dateActive, open.has("date"))}>
          <Calendar className="h-4 w-4" />
          <span className="hidden sm:inline">Tanggal</span>
        </button>
        <button type="button" onClick={() => toggle("status")} className={badgeClass(statusActive, open.has("status"))}>
          <ListFilter className="h-4 w-4" />
          <span className="hidden sm:inline">Status</span>
        </button>
        <button type="button" onClick={() => toggle("customer")} className={badgeClass(customerActive, open.has("customer"))}>
          <User className="h-4 w-4" />
          <span className="hidden sm:inline">Pelanggan</span>
        </button>
      </div>

      {/* Persist values from collapsed panels so they aren't lost on submit */}
      {!open.has("date") && (
        <>
          <input type="hidden" name="from" value={dateFrom} />
          <input type="hidden" name="to" value={dateTo} />
        </>
      )}
      {!open.has("status") &&
        statusList.map((s) => <input key={s} type="hidden" name="status" value={s} />)}
      {!open.has("customer") && <input type="hidden" name="q" value={customerQuery} />}

      {/* Expandable detail panels */}
      {anyOpen && (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
          {open.has("date") && (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Dari</label>
                <input
                  type="date"
                  name="from"
                  defaultValue={dateFrom}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Sampai</label>
                <input
                  type="date"
                  name="to"
                  defaultValue={dateTo}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            </div>
          )}

          {open.has("status") && (
            <div>
              <label className="mb-1 block text-xs text-gray-500">Status</label>
              <div className="flex flex-wrap gap-2">
                {statusOptions
                  .filter((o) => o.value)
                  .map((opt) => {
                    const checked = statusList.includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:border-gray-400"
                      >
                        <input
                          type="checkbox"
                          name="status"
                          value={opt.value}
                          defaultChecked={checked}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                          data-no-uppercase
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
              </div>
              <p className="mt-1 text-[10px] text-gray-400">Tidak dicentang = semua status</p>
            </div>
          )}

          {open.has("customer") && (
            <div className="w-full max-w-xs">
              <label className="mb-1 block text-xs text-gray-500">Cari Pelanggan</label>
              <input
                type="text"
                name="q"
                defaultValue={customerQuery}
                placeholder="Nama pelanggan"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          )}

          <div className="flex flex-wrap items-end justify-between gap-3 border-t border-gray-200 pt-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Baris</label>
              <select
                name="size"
                defaultValue={String(pageSize)}
                className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              {hasActiveFilter && (
                <Link href={`${basePath}/invoices`} className="text-sm text-gray-400 underline hover:text-gray-600">
                  Reset
                </Link>
              )}
              <button
                type="submit"
                className="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
              >
                Terapkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keep page size on submit when panels are collapsed */}
      {!anyOpen && <input type="hidden" name="size" value={String(pageSize)} />}
    </form>
  );
}
