import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import Link from "next/link";
import { ChevronRight, ClipboardList } from "lucide-react";
import type { Invoice, Customer, InvoiceStatus, MechanicRoleInInvoice } from "@/types/database";

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Menunggu",
  in_progress: "Dikerjakan",
  completed: "Selesai",
  paid: "Lunas",
  cancelled: "Batal",
};

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  paid: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-600",
};

type WorkOrderRow = {
  assignmentId: string;
  mechanicRole: MechanicRoleInInvoice;
  invoice: Invoice;
  customer: Customer | null;
};

export default async function MechanicDashboard({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = tab === "all" ? "all" : "active";

  const supabase = await createClient();
  const ctx = await getUserContext();

  // 1. Fetch assignments for this mechanic
  const { data: assignments, error: assignError } = await supabase
    .from("invoice_mechanics")
    .select("id, mechanic_role, invoice_id")
    .eq("mechanic_id", ctx.id)
    .order("assigned_at", { ascending: false });

  if (assignError) {
    console.error("[MechanicDashboard] invoice_mechanics query error:", assignError);
  }

  let workOrders: WorkOrderRow[] = [];

  if (assignments?.length) {
    const invoiceIds = assignments.map((a) => a.invoice_id);

    // 2. Fetch invoices
    const { data: invoices } = await supabase
      .from("invoices")
      .select("*")
      .in("id", invoiceIds);

    // 3. Fetch relevant customers
    const customerIds = [
      ...new Set(
        (invoices ?? []).map((i) => i.customer_id).filter(Boolean) as string[]
      ),
    ];
    const { data: customers } = customerIds.length
      ? await supabase.from("customers").select("*").in("id", customerIds)
      : { data: [] };

    // 4. Build lookup maps
    const invoiceMap = Object.fromEntries((invoices ?? []).map((i) => [i.id, i]));
    const customerMap = Object.fromEntries((customers ?? []).map((c) => [c.id, c]));

    // 5. Compose work order rows
    workOrders = assignments
      .map((a) => {
        const invoice = invoiceMap[a.invoice_id] as Invoice | undefined;
        if (!invoice) return null;
        return {
          assignmentId: a.id,
          mechanicRole: a.mechanic_role as MechanicRoleInInvoice,
          invoice,
          customer: invoice.customer_id
            ? ((customerMap[invoice.customer_id] as Customer) ?? null)
            : null,
        };
      })
      .filter(Boolean) as WorkOrderRow[];
  }

  // 6. Filter by tab
  const activeStatuses: InvoiceStatus[] = ["draft", "in_progress"];
  const filtered =
    activeTab === "active"
      ? workOrders.filter((wo) =>
          activeStatuses.includes(wo.invoice.status as InvoiceStatus)
        )
      : workOrders;

  const activeCount = workOrders.filter((wo) =>
    activeStatuses.includes(wo.invoice.status as InvoiceStatus)
  ).length;

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Work Order Saya</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Daftar pekerjaan yang ditugaskan
        </p>
      </div>

      {/* Tab filter */}
      <div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1">
        <Link
          href="/mechanic/dashboard"
          className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold transition-colors ${
            activeTab === "active"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500"
          }`}
        >
          Aktif
          {activeCount > 0 && (
            <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </Link>
        <Link
          href="/mechanic/dashboard?tab=all"
          className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold transition-colors ${
            activeTab === "all"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500"
          }`}
        >
          Semua
        </Link>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <ClipboardList className="h-6 w-6 text-gray-400" />
          </div>
          <p className="font-semibold text-gray-600">
            {activeTab === "active"
              ? "Tidak ada pekerjaan aktif"
              : "Belum ada pekerjaan"}
          </p>
          <p className="mt-1 text-sm text-gray-400">
            {activeTab === "active" ? (
              <>
                Semua pekerjaan sudah selesai.{" "}
                <Link
                  href="/mechanic/dashboard?tab=all"
                  className="text-blue-600 underline"
                >
                  Lihat riwayat
                </Link>
              </>
            ) : (
              "Belum ada invoice yang ditugaskan ke kamu."
            )}
          </p>
          {/* Diagnostic info — helps verify mechanic ID matches DB */}
          <p className="mt-3 rounded bg-yellow-50 px-3 py-2 text-[10px] text-yellow-700 border border-yellow-200">
            ID Mekanik: <span className="font-mono select-all">{ctx.id}</span>
            {assignError && (
              <span className="block mt-1 text-red-600">Error: {assignError.message}</span>
            )}
            {!assignError && (assignments === null || assignments?.length === 0) && (
              <span className="block mt-1">Tidak ada data di tabel invoice_mechanics untuk ID ini.</span>
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((wo) => {
            const v = wo.customer?.vehicle_info;
            const vehicleStr = [v?.brand, v?.model, v?.plate]
              .filter(Boolean)
              .join(" · ");
            const status = wo.invoice.status as InvoiceStatus;
            const isActive = activeStatuses.includes(status);

            return (
              <Link
                key={wo.assignmentId}
                href={`/mechanic/dashboard/${wo.invoice.id}`}
                className="block rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all active:scale-[0.99] active:bg-gray-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-gray-900">
                        {wo.invoice.invoice_number}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[status]}`}
                      >
                        {STATUS_LABELS[status]}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-base font-semibold text-gray-800">
                      {wo.customer?.name ?? "–"}
                    </p>
                    {vehicleStr && (
                      <p className="mt-0.5 truncate text-sm text-gray-500">
                        {vehicleStr}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-gray-400">
                      {new Date(wo.invoice.created_at).toLocaleDateString(
                        "id-ID",
                        { day: "numeric", month: "short", year: "numeric" }
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2 pt-0.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        wo.mechanicRole === "lead"
                          ? "bg-violet-100 text-violet-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {wo.mechanicRole === "lead" ? "Lead" : "Helper"}
                    </span>
                    <ChevronRight
                      className={`h-4 w-4 ${isActive ? "text-blue-400" : "text-gray-300"}`}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

