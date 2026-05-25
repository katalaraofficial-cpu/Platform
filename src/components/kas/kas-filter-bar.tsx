"use client";

import { useRouter } from "next/navigation";

type Props = {
  accountFilter: string;
  typeFilter: string;
  fromDate: string;
  toDate: string;
};

export function KasFilterBar({
  accountFilter,
  typeFilter,
  fromDate,
  toDate,
}: Props) {
  const router = useRouter();

  function buildUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams();
    params.set("page", "1");
    const merged = {
      account: accountFilter,
      type: typeFilter,
      from: fromDate,
      to: toDate,
      ...overrides,
    };
    if (merged.account !== "all") params.set("account", merged.account);
    if (merged.type !== "all") params.set("type", merged.type);
    if (merged.from) params.set("from", merged.from);
    if (merged.to) params.set("to", merged.to);
    return `/owner/kas?${params.toString()}`;
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-3">
      {/* Account filter */}
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

      {/* Type filter */}
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
        {(fromDate || toDate) && (
          <button
            onClick={() => router.push("/owner/kas")}
            className="text-xs text-gray-400 hover:text-red-500"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
