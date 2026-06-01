"use client";

import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useState } from "react";

type Props = {
  accountFilter: string;
  typeFilter: string;
  fromDate: string;
  toDate: string;
  search: string;
  pageSize: string;
};

export function KasFilterBar({
  accountFilter,
  typeFilter,
  fromDate,
  toDate,
  search,
  pageSize,
}: Props) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(search);

  function buildUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams();
    params.set("page", "1");
    const merged = {
      account: accountFilter,
      type: typeFilter,
      from: fromDate,
      to: toDate,
      search: searchInput,
      size: pageSize,
      ...overrides,
    };
    if (merged.account && merged.account !== "all") params.set("account", merged.account);
    if (merged.type && merged.type !== "all") params.set("type", merged.type);
    if (merged.from) params.set("from", merged.from);
    if (merged.to) params.set("to", merged.to);
    if (merged.search) params.set("search", merged.search);
    if (merged.size && merged.size !== "20") params.set("size", merged.size);
    return `/owner/kas?${params.toString()}`;
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(buildUrl({ search: searchInput }));
  }

  function clearSearch() {
    setSearchInput("");
    router.push(buildUrl({ search: "" }));
  }

  return (
    <div className="flex flex-col gap-2 border-b border-gray-100 px-5 py-3">
      {/* Row 1: filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-0.5 text-xs">
          {(
            [
              ["all", "Semua"],
              ["kas_tunai", "Kas Tunai"],
              ["bank", "Bank"],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              onClick={() => router.push(buildUrl({ account: val }))}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                accountFilter === val
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-0.5 text-xs">
          {(
            [
              ["all", "Semua"],
              ["kas_masuk", "Masuk"],
              ["kas_keluar", "Keluar"],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              onClick={() => router.push(buildUrl({ type: val }))}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                typeFilter === val
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 2: search + date range */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-1 min-w-[180px] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5"
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <input
            type="text"
            placeholder="Cari kategori / keterangan..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex-1 bg-transparent text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none"
          />
          {searchInput && (
            <button
              type="button"
              onClick={clearSearch}
              className="text-gray-300 hover:text-gray-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </form>

        {/* Date range */}
        <div className="ml-auto flex items-center gap-2">
          <input
            type="date"
            defaultValue={fromDate}
            onChange={(e) => router.push(buildUrl({ from: e.target.value }))}
            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <span className="text-xs text-gray-400">–</span>
          <input
            type="date"
            defaultValue={toDate}
            onChange={(e) => router.push(buildUrl({ to: e.target.value }))}
            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {(fromDate || toDate || search) && (
            <button
              onClick={() => {
                setSearchInput("");
                router.push("/owner/kas");
              }}
              className="text-xs text-gray-400 hover:text-red-500"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
