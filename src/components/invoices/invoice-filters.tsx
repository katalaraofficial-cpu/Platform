"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const FILTERS = [
  { label: "Semua", value: "" },
  { label: "Draft", value: "draft" },
  { label: "Dikerjakan", value: "in_progress" },
  { label: "Selesai", value: "completed" },
  { label: "Lunas", value: "paid" },
  { label: "Dibatalkan", value: "cancelled" },
];

export function InvoiceFilters({ basePath }: { basePath: string }) {
  const searchParams = useSearchParams();
  const current = searchParams.get("status") ?? "";

  return (
    <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-1">
      {FILTERS.map((f) => {
        const href = f.value
          ? `${basePath}/invoices?status=${f.value}`
          : `${basePath}/invoices`;
        const isActive = current === f.value;
        return (
          <Link
            key={f.value}
            href={href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-gray-900 text-white"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            )}
          >
            {f.label}
          </Link>
        );
      })}
    </div>
  );
}
