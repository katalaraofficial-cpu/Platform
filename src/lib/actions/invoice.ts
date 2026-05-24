"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ItemType, InvoiceStatus, Invoice, PaymentSource, MechanicRoleInInvoice } from "@/types/database";

export type ActionState = { error?: string };

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// ── Internal: generate next invoice number ───────────────────
async function genInvoiceNumber(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", `${year}-01-01`);
  return `INV-${year}-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

// ── Internal: recalculate invoice totals from items ──────────
async function syncTotals(supabase: SupabaseClient, invoiceId: string) {
  const { data: items } = await supabase
    .from("invoice_items")
    .select("unit_price, quantity, final_price")
    .eq("invoice_id", invoiceId);
  if (!items) return;
  const subtotal = items.reduce(
    (s, i) => s + Number(i.unit_price) * Number(i.quantity),
    0
  );
  const grandTotal = items.reduce((s, i) => s + Number(i.final_price), 0);
  await supabase
    .from("invoices")
    .update({
      subtotal,
      total_markup: grandTotal - subtotal,
      grand_total: grandTotal,
    })
    .eq("id", invoiceId);
}

// ── Create invoice + customer ────────────────────────────────
export async function createInvoice(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesi berakhir, silakan login kembali" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!profile?.tenant_id) return { error: "Akun tidak terhubung ke tenant" };

  const tenantId = profile.tenant_id;
  const basePath = formData.get("base_path") as string;
  const name = String(formData.get("customer_name") ?? "").trim();
  if (!name) return { error: "Nama pelanggan wajib diisi" };

  // Create customer record
  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .insert({
      tenant_id: tenantId,
      name,
      phone: (formData.get("customer_phone") as string) || null,
      vehicle_info: {
        plate: (formData.get("vehicle_plate") as string) || "",
        brand: (formData.get("vehicle_brand") as string) || "",
        model: (formData.get("vehicle_model") as string) || "",
        year: formData.get("vehicle_year")
          ? Number(formData.get("vehicle_year"))
          : undefined,
      },
    })
    .select("id")
    .single();
  if (custErr || !customer) return { error: "Gagal menyimpan data pelanggan" };

  const invoiceNumber = await genInvoiceNumber(supabase, tenantId);
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .insert({
      tenant_id: tenantId,
      customer_id: customer.id,
      invoice_number: invoiceNumber,
      status: "draft" as InvoiceStatus,
      notes: (formData.get("notes") as string) || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (invErr || !invoice)
    return { error: "Gagal membuat invoice: " + (invErr?.message ?? "") };

  revalidatePath(`${basePath}/invoices`);
  redirect(`${basePath}/invoices/${invoice.id}`);
}

// ── Add item to invoice ──────────────────────────────────────
export async function addInvoiceItem(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const invoiceId = formData.get("invoice_id") as string;
  const tenantId = formData.get("tenant_id") as string;
  const basePath = formData.get("base_path") as string;
  const itemType = (formData.get("item_type") ?? "service") as ItemType;
  const description = String(formData.get("description") ?? "").trim();
  if (!description) return { error: "Deskripsi wajib diisi" };

  const quantity = Math.max(0.01, Number(formData.get("quantity")) || 1);
  const unitPrice = Math.max(0, Number(formData.get("unit_price")) || 0);
  const markupPct =
    itemType === "part_external"
      ? Math.max(0, Number(formData.get("markup_pct")) || 0)
      : 0;
  const finalPrice = unitPrice * quantity * (1 + markupPct / 100);
  const paymentSource: PaymentSource | null =
    itemType === "part_external"
      ? (((formData.get("payment_source") as string) || "owner") as PaymentSource)
      : null;

  const { error } = await supabase.from("invoice_items").insert({
    invoice_id: invoiceId,
    tenant_id: tenantId,
    item_type: itemType,
    description,
    quantity,
    unit_price: unitPrice,
    markup_pct: markupPct,
    final_price: finalPrice,
    payment_source: paymentSource,
    submitted_by: user.id,
  });
  if (error) return { error: "Gagal menambah item: " + error.message };

  await syncTotals(supabase, invoiceId);
  revalidatePath(`${basePath}/invoices/${invoiceId}`);
  return {};
}

// ── Remove item from invoice ─────────────────────────────────
export async function removeInvoiceItem(
  itemId: string,
  invoiceId: string,
  basePath: string
) {
  const supabase = await createClient();
  await supabase.from("invoice_items").delete().eq("id", itemId);
  await syncTotals(supabase, invoiceId);
  revalidatePath(`${basePath}/invoices/${invoiceId}`);
}

// ── Transition invoice status ────────────────────────────────
export async function updateInvoiceStatus(
  invoiceId: string,
  newStatus: "in_progress" | "completed" | "paid" | "cancelled",
  basePath: string
) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const update: Partial<Omit<Invoice, "id" | "created_at">> = { status: newStatus };
  if (newStatus === "completed") update.completed_at = now;
  if (newStatus === "paid") update.paid_at = now;

  await supabase.from("invoices").update(update).eq("id", invoiceId);
  revalidatePath(`${basePath}/invoices`);
  revalidatePath(`${basePath}/invoices/${invoiceId}`);
}

// ── Assign mechanic to invoice ───────────────────────────────
export async function assignMechanic(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const invoiceId = formData.get("invoice_id") as string;
  const mechanicId = formData.get("mechanic_id") as string;
  const tenantId = formData.get("tenant_id") as string;
  const basePath = formData.get("base_path") as string;
  const mechanicRole = (formData.get("mechanic_role") as string) || "lead";

  if (!mechanicId) return { error: "Pilih mekanik terlebih dahulu" };

  const { error } = await supabase.from("invoice_mechanics").insert({
    invoice_id: invoiceId,
    mechanic_id: mechanicId,
    tenant_id: tenantId,
    mechanic_role: mechanicRole as "lead" | "helper",
  });

  if (error) {
    if (error.code === "23505")
      return { error: "Mekanik sudah ditugaskan ke invoice ini" };
    return { error: "Gagal menugaskan mekanik: " + error.message };
  }

  revalidatePath(`${basePath}/invoices/${invoiceId}`);
  return {};
}

// ── Remove mechanic from invoice ─────────────────────────────
export async function removeMechanic(
  assignmentId: string,
  invoiceId: string,
  basePath: string
) {
  const supabase = await createClient();
  await supabase.from("invoice_mechanics").delete().eq("id", assignmentId);
  revalidatePath(`${basePath}/invoices/${invoiceId}`);
}

// ── Delete invoice ────────────────────────────────────────────
export async function deleteInvoice(invoiceId: string, basePath: string) {
  const supabase = await createClient();
  // RLS ensures user can only delete their own tenant's invoices.
  // Only draft/cancelled invoices should be deleted; check status first.
  const { data: inv } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", invoiceId)
    .single();
  if (!inv) return;
  if (inv.status !== "draft" && inv.status !== "cancelled")
    return; // Jangan hapus invoice yang sudah in_progress/completed/paid

  await supabase.from("invoices").delete().eq("id", invoiceId);
  revalidatePath(`${basePath}/invoices`);
}

// ── Create invoice with items in one shot (POS flow) ──────────
export type InvoiceItemDraft = {
  description: string;
  notes: string;
  qty: number;
  unitPrice: number;
  sellPrice: number;
  itemType: ItemType;
};

export type MechanicAssignment = {
  id: string;
  role: MechanicRoleInInvoice;
};

export async function createInvoiceWithItems(payload: {
  customerId: string;
  jobDescription: string;
  mechanics: MechanicAssignment[];
  items: InvoiceItemDraft[];
  notes: string;
  basePath: string;
}): Promise<{ error?: string; invoiceId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesi berakhir, silakan login kembali" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!profile?.tenant_id) return { error: "Akun tidak terhubung ke tenant" };

  const tenantId = profile.tenant_id;
  const invoiceNumber = await genInvoiceNumber(supabase, tenantId);
  const combinedNotes = [payload.jobDescription, payload.notes]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" | ") || null;

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .insert({
      tenant_id: tenantId,
      customer_id: payload.customerId || null,
      invoice_number: invoiceNumber,
      status: "draft" as InvoiceStatus,
      notes: combinedNotes,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (invErr || !invoice)
    return { error: "Gagal membuat invoice: " + (invErr?.message ?? "") };

  const invoiceId = invoice.id;

  if (payload.items.length > 0) {
    const { error: itemsErr } = await supabase.from("invoice_items").insert(
      payload.items.map((item) => ({
        invoice_id: invoiceId,
        tenant_id: tenantId,
        item_type: item.itemType,
        description: item.description,
        quantity: item.qty,
        unit_price: item.unitPrice,
        markup_pct: 0,
        final_price: item.sellPrice * item.qty,
        payment_source: null as PaymentSource | null,
      }))
    );
    if (itemsErr) {
      await supabase.from("invoices").delete().eq("id", invoiceId);
      return { error: "Gagal menyimpan items: " + itemsErr.message };
    }
    await syncTotals(supabase, invoiceId);
  }

  if (payload.mechanics.length > 0) {
    await supabase.from("invoice_mechanics").insert(
      payload.mechanics.map((m) => ({
        invoice_id: invoiceId,
        mechanic_id: m.id,
        tenant_id: tenantId,
        mechanic_role: m.role,
      }))
    );
  }

  revalidatePath(`${payload.basePath}/invoices`);
  return { invoiceId };
}

