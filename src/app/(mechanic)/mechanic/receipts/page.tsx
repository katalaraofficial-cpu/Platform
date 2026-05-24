import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/get-user-context";
import type { Invoice, Customer } from "@/types/database";
import { UploadReceiptForm } from "@/components/mechanic/upload-receipt-form";
import { Receipt } from "lucide-react";

export default async function UploadReceiptPage() {
  const supabase = await createClient();
  const ctx = await getUserContext();

  // Fetch active (draft + in_progress) assignments
  const { data: assignments } = await supabase
    .from("invoice_mechanics")
    .select("invoice_id")
    .eq("mechanic_id", ctx.id);

  const invoiceIds = (assignments ?? []).map((a) => a.invoice_id);

  let assignedInvoices: { invoiceId: string; invoiceNumber: string; customerName: string }[] = [];

  if (invoiceIds.length > 0) {
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, invoice_number, customer_id, status, tenant_id")
      .in("id", invoiceIds)
      .in("status", ["draft", "in_progress"])
      .order("created_at", { ascending: false });

    if (invoices?.length) {
      const customerIds = [
        ...new Set((invoices as Invoice[]).map((i) => i.customer_id).filter(Boolean)),
      ] as string[];

      const { data: customers } = await supabase
        .from("customers")
        .select("id, name")
        .in("id", customerIds);

      const customerMap = new Map(
        (customers ?? []).map((c) => [c.id, (c as Customer).name])
      );

      assignedInvoices = (invoices as Invoice[]).map((inv) => ({
        invoiceId: inv.id,
        invoiceNumber: inv.invoice_number,
        customerName: customerMap.get(inv.customer_id ?? "") ?? "—",
      }));
    }
  }

  const tenantId = ctx.tenantId;

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
          <Receipt className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Upload Struk</h1>
          <p className="text-xs text-gray-400">Catat pembelian part yang Anda tanggung</p>
        </div>
      </div>

      {/* Info card */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <p className="font-semibold">Cara penggunaan:</p>
        <ol className="mt-1 list-decimal pl-4 text-xs leading-5 text-amber-700">
          <li>Pilih invoice pekerjaan yang sedang dikerjakan</li>
          <li>Isi nama part dan nominal pembelian sesuai struk</li>
          <li>Foto struk belanja sebagai bukti</li>
          <li>Nominal akan tercatat sebagai piutang di tab Piutang Saya</li>
        </ol>
      </div>

      {/* Form */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <UploadReceiptForm
          mechanic_id={ctx.id}
          tenant_id={tenantId}
          assignedInvoices={assignedInvoices}
        />
      </div>
    </div>
  );
}
