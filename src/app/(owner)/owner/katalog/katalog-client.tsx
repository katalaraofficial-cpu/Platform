"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { reclassifyItemDescription, type CatalogItem } from "@/lib/actions/catalog";
import { ArrowLeftRight, Search } from "lucide-react";

type Filter = "all" | "service" | "part";

const TYPE_LABEL: Record<string, string> = {
  service: "Jasa",
  part_internal: "Barang (stok)",
  part_external: "Barang (beli)",
};

const TYPE_BADGE: Record<string, string> = {
  service: "bg-blue-100 text-blue-700",
  part_internal: "bg-emerald-100 text-emerald-700",
  part_external: "bg-amber-100 text-amber-700",
};

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function KatalogClient({ items, error }: { items: CatalogItem[]; error?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (q && !it.description.toLowerCase().includes(q)) return false;
      if (filter === "service") return it.item_type === "service";
      if (filter === "part") return it.item_type !== "service";
      return true;
    });
  }, [items, query, filter]);

  function handleReclassify(
    item: CatalogItem,
    newType: "service" | "part_internal" | "part_external",
  ) {
    if (pendingId) return;
    const confirmed = window.confirm(
      `Pindahkan "${item.description}" ke ${TYPE_LABEL[newType]}? Hanya mengubah klasifikasi di katalog master; data invoice lama tidak berubah.`,
    );
    if (!confirmed) return;
    setPendingId(item.id);
    startTransition(async () => {
      const res = await reclassifyItemDescription(item.description, newType);
      setPendingId(null);
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.success ?? "Berhasil");
        router.refresh();
      }
    });
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama item..."
            className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1 text-xs font-semibold">
          {([
            ["all", "Semua"],
            ["service", "Jasa"],
            ["part", "Barang"],
          ] as const).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`rounded px-3 py-1.5 transition-colors ${
                filter === v ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Nama Item</th>
              <th className="px-4 py-3 text-left">Tipe</th>
              <th className="px-4 py-3 text-right">Harga Beli</th>
              <th className="px-4 py-3 text-right">Harga Jual</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-800">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">
                  Tidak ada data sesuai filter.
                </td>
              </tr>
            )}
            {filtered.map((it) => {
              const targetType = it.item_type === "service" ? "part_internal" : "service";
              const targetLabel = it.item_type === "service" ? "Pindah ke Barang" : "Pindah ke Jasa";
              return (
                <tr key={it.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{it.description}</div>
                    {it.unit_label && (
                      <div className="text-xs text-gray-500">satuan: {it.unit_label}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${TYPE_BADGE[it.item_type]}`}
                    >
                      {TYPE_LABEL[it.item_type]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {it.default_buy_price > 0 ? fmt(it.default_buy_price) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {it.default_sell_price > 0 ? fmt(it.default_sell_price) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      disabled={pendingId === it.id}
                      onClick={() => handleReclassify(it, targetType)}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50"
                    >
                      <ArrowLeftRight className="h-3 w-3" />
                      {pendingId === it.id ? "Memproses..." : targetLabel}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">
        Saran harga & satuan saat input invoice baru diambil dari tabel master ini. Setiap item baru
        yang diinput di invoice otomatis mengisi/memperbarui katalog.
      </p>
    </div>
  );
}
