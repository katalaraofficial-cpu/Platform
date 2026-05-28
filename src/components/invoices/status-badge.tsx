import { cn } from "@/lib/utils";
import type { InvoiceStatus } from "@/types/database";

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-gray-100 text-gray-600" },
  in_progress: { label: "Dikerjakan", cls: "bg-blue-100 text-blue-700" },
  completed: { label: "Selesai", cls: "bg-yellow-100 text-yellow-700" },
  paid: { label: "Lunas", cls: "bg-green-100 text-green-700" },
  cancelled: { label: "Dibatalkan", cls: "bg-red-100 text-red-600" },
};

export function StatusBadge({ status, complaint = false }: { status: InvoiceStatus; complaint?: boolean }) {
  if (complaint && status === "completed") {
    return (
      <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", "bg-red-100 text-red-700")}>
        Komplain
      </span>
    );
  }
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        cfg.cls
      )}
    >
      {cfg.label}
    </span>
  );
}

export const STATUS_LABELS = STATUS_CONFIG;
