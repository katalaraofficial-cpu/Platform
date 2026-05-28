"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserContext } from "@/lib/get-user-context";
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
  const [{ data: items }, { data: invData }] = await Promise.all([
    supabase
      .from("invoice_items")
      .select("unit_price, quantity, final_price")
      .eq("invoice_id", invoiceId),
    supabase
      .from("invoices")
      .select("ppn_pct, pph_pct, discount_amount, shipping_cost")
      .eq("id", invoiceId)
      .single(),
  ]);
  if (!items) return;
  const subtotal = items.reduce(
    (s, i) => s + Number(i.unit_price) * Number(i.quantity),
    0
  );
  const preTax = items.reduce((s, i) => s + Number(i.final_price), 0);
  const totalMarkup = preTax - subtotal;
  type InvData = { ppn_pct?: unknown; pph_pct?: unknown; discount_amount?: unknown; shipping_cost?: unknown } | null;
  const d = invData as InvData;
  const ppnPct = Number(d?.ppn_pct ?? 0);
  const pphPct = Number(d?.pph_pct ?? 0);
  const discountAmount = Number(d?.discount_amount ?? 0);
  const shippingCost = Number(d?.shipping_cost ?? 0);
  const taxableBase = Math.max(0, preTax - discountAmount);
  const ppnAmount = taxableBase * ppnPct / 100;
  const pphAmount = taxableBase * pphPct / 100;
  await supabase
    .from("invoices")
    .update({
      subtotal,
      total_markup: totalMarkup,
      ppn_amount: ppnAmount,
      pph_amount: pphAmount,
      grand_total: taxableBase + ppnAmount - pphAmount + shippingCost,
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
      invoice_date: (formData.get("invoice_date") as string) || new Date().toISOString().split("T")[0],
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
    (itemType === "part_external" || itemType === "part_internal")
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
    unit_label: null,
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
  // Notify other roles so they see the status update immediately
  revalidatePath("/mechanic/dashboard");
  revalidatePath("/owner/invoices");
  revalidatePath("/admin/invoices");
  revalidatePath("/owner/dashboard");
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
  // Delete associated ledger entries first (reference_id is not a FK, so no cascade)
  await supabase.from("ledger").delete().eq("reference_id", invoiceId);
  // RLS ensures user can only delete their own tenant's invoices.
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
  unitLabel?: string;
  paymentSource?: PaymentSource;
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
  invoiceDate?: string;
  dueDate?: string;
  shippingCost?: number;
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
      invoice_date: payload.invoiceDate ?? new Date().toISOString().split("T")[0],
      due_date: payload.dueDate ?? null,
      shipping_cost: payload.shippingCost ?? 0,
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
        unit_label: item.unitLabel ?? null,
        payment_source: item.paymentSource ?? null as PaymentSource | null,
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

// ── Update invoice tax (PPN / PPh) ────────────────────────────
export async function updateInvoiceTax(
  invoiceId: string,
  ppnPct: number,
  pphPct: number,
  basePath: string
) {
  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx.tenantId) return;

  const { data: inv } = await supabase
    .from("invoices")
    .select("subtotal, total_markup, discount_amount, shipping_cost")
    .eq("id", invoiceId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (!inv) return;

  const preTax = Number(inv.subtotal) + Number(inv.total_markup);
  const discountAmount = Number(inv.discount_amount ?? 0);
  const shippingCost = Number(inv.shipping_cost ?? 0);
  const taxableBase = Math.max(0, preTax - discountAmount);
  const ppnAmount = taxableBase * ppnPct / 100;
  const pphAmount = taxableBase * pphPct / 100;

  await supabase
    .from("invoices")
    .update({
      ppn_pct: ppnPct,
      ppn_amount: ppnAmount,
      pph_pct: pphPct,
      pph_amount: pphAmount,
      grand_total: taxableBase + ppnAmount - pphAmount + shippingCost,
    })
    .eq("id", invoiceId)
    .eq("tenant_id", ctx.tenantId);

  revalidatePath(`${basePath}/invoices/${invoiceId}`);
}

// ── Update invoice item (inline edit) ────────────────────────
export async function updateInvoiceItem(
  itemId: string,
  invoiceId: string,
  basePath: string,
  data: { description: string; quantity: number; unitPrice: number; sellPrice?: number; unitLabel?: string }
) {
  const supabase = await createClient();
  let markupPct: number;
  let finalPrice: number;

  if (data.sellPrice !== undefined) {
    // Explicit sell price provided — recalculate markup from buy/sell
    finalPrice = data.sellPrice * data.quantity;
    markupPct =
      data.unitPrice > 0
        ? Math.max(0, ((data.sellPrice - data.unitPrice) / data.unitPrice) * 100)
        : 0;
    await supabase
      .from("invoice_items")
      .update({
        description: data.description,
        quantity: data.quantity,
        unit_price: data.unitPrice,
        markup_pct: markupPct,
        final_price: finalPrice,
        ...(data.unitLabel !== undefined ? { unit_label: data.unitLabel || null } : {}),
      })
      .eq("id", itemId);
  } else {
    // Legacy: unitPrice is the sell price (services) or buy price (parts, recalculate via existing markup)
    const { data: item } = await supabase
      .from("invoice_items")
      .select("markup_pct")
      .eq("id", itemId)
      .single();
    markupPct = Number(item?.markup_pct ?? 0);
    finalPrice = data.unitPrice * data.quantity * (1 + markupPct / 100);
    await supabase
      .from("invoice_items")
      .update({
        description: data.description,
        quantity: data.quantity,
        unit_price: data.unitPrice,
        final_price: finalPrice,
        ...(data.unitLabel !== undefined ? { unit_label: data.unitLabel || null } : {}),
      })
      .eq("id", itemId);
  }

  await syncTotals(supabase, invoiceId);
  revalidatePath(`${basePath}/invoices/${invoiceId}`);
}

// ── Update invoice notes ──────────────────────────────────────
export async function updateInvoiceNotes(
  invoiceId: string,
  notes: string,
  basePath: string
) {
  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx.tenantId) return;
  await supabase
    .from("invoices")
    .update({ notes: notes.trim() || null })
    .eq("id", invoiceId)
    .eq("tenant_id", ctx.tenantId);
  revalidatePath(`${basePath}/invoices/${invoiceId}`);
}

// ── Update invoice global discount ───────────────────────────
export async function updateInvoiceDiscount(
  invoiceId: string,
  discountAmount: number,
  basePath: string
) {
  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx.tenantId) return;

  const { data: inv } = await supabase
    .from("invoices")
    .select("subtotal, total_markup, ppn_pct, pph_pct, shipping_cost")
    .eq("id", invoiceId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (!inv) return;

  const preTax = Number(inv.subtotal) + Number(inv.total_markup);
  const ppnPct = Number(inv.ppn_pct ?? 0);
  const pphPct = Number(inv.pph_pct ?? 0);
  const shippingCost = Number(inv.shipping_cost ?? 0);
  const taxableBase = Math.max(0, preTax - discountAmount);
  const ppnAmount = taxableBase * ppnPct / 100;
  const pphAmount = taxableBase * pphPct / 100;

  await supabase
    .from("invoices")
    .update({
      discount_amount: discountAmount,
      ppn_amount: ppnAmount,
      pph_amount: pphAmount,
      grand_total: taxableBase + ppnAmount - pphAmount + shippingCost,
    })
    .eq("id", invoiceId)
    .eq("tenant_id", ctx.tenantId);

  revalidatePath(`${basePath}/invoices/${invoiceId}`);
}

// ── Process payment (completed → paid) ───────────────────────
export async function processPayment(
  invoiceId: string,
  method: string,
  paymentDate: string,
  basePath: string
) {
  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx.tenantId) return;

  const { data: inv } = await supabase
    .from("invoices")
    .select("grand_total, invoice_number, status")
    .eq("id", invoiceId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (!inv || inv.status !== "completed") return;

  // Update invoice to paid
  const paidAt = paymentDate
    ? new Date(paymentDate).toISOString()
    : new Date().toISOString();

  await supabase
    .from("invoices")
    .update({
      status: "paid",
      paid_at: paidAt,
      payment_method: method,
    })
    .eq("id", invoiceId)
    .eq("tenant_id", ctx.tenantId);

  // Record kas masuk in ledger (use admin client to bypass RLS — admin role
  // is blocked from ledger by design, but invoice payment must always land here)
  const amount = Number(inv.grand_total);
  if (amount > 0) {
    const methodLabel: Record<string, string> = {
      cash: "Tunai",
      transfer: "Transfer Bank",
      other: "Lainnya",
    };
    const adminClient = createAdminClient();
    await adminClient.from("ledger").insert({
      tenant_id: ctx.tenantId,
      transaction_type: "kas_masuk",
      account_type: method === "transfer" ? "bank" : "kas_tunai",
      category: "Pembayaran Invoice",
      amount,
      reference_id: invoiceId,
      transfer_ref: null,
      notes: `Pembayaran invoice ${inv.invoice_number} via ${methodLabel[method] ?? method}`,
      created_by: ctx.id,
    } as never);
  }

  // ── Auto-earn employee points ────────────────────────────────
  try {
    const adminClient2 = createAdminClient();
    const { data: settings } = await adminClient2
      .from("settings")
      .select("reward_employee_enabled, reward_spend_per_point, reward_point_validity_days, reward_lead_multiplier, reward_helper_multiplier")
      .eq("tenant_id", ctx.tenantId)
      .single();

    if (settings?.reward_employee_enabled && amount > 0) {
      const { data: mechanics } = await adminClient2
        .from("invoice_mechanics")
        .select("mechanic_id, mechanic_role")
        .eq("invoice_id", invoiceId)
        .eq("tenant_id", ctx.tenantId);

      if (mechanics?.length) {
        const basePoints = Math.floor(amount / Number(settings.reward_spend_per_point));
        if (basePoints > 0) {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + (settings.reward_point_validity_days ?? 365));
          const expiresStr = expiresAt.toISOString().split("T")[0];

          for (const m of mechanics) {
            const multiplier = m.mechanic_role === "lead"
              ? Number(settings.reward_lead_multiplier ?? 1)
              : Number(settings.reward_helper_multiplier ?? 0.5);
            const earned = Math.floor(basePoints * multiplier);
            if (earned <= 0) continue;

            // Upsert or update balance
            const { data: existing } = await adminClient2
              .from("employee_points")
              .select("id, points_balance, total_earned")
              .eq("tenant_id", ctx.tenantId)
              .eq("profile_id", m.mechanic_id)
              .maybeSingle();

            if (existing) {
              await adminClient2.from("employee_points").update({
                points_balance: existing.points_balance + earned,
                total_earned: existing.total_earned + earned,
              }).eq("id", existing.id);
            } else {
              await adminClient2.from("employee_points").insert({
                tenant_id: ctx.tenantId,
                profile_id: m.mechanic_id,
                points_balance: earned,
                total_earned: earned,
                total_redeemed: 0,
              });
            }

            // Log transaction
            await adminClient2.from("employee_point_transactions").insert({
              tenant_id: ctx.tenantId,
              profile_id: m.mechanic_id,
              transaction_type: "earn",
              points: earned,
              reference_id: invoiceId,
              expires_at: expiresStr,
              notes: `Invoice ${inv.invoice_number} (${m.mechanic_role})`,
            });
          }
        }
      }
    }
  } catch {
    // Point earning is non-critical — do not fail the payment
  }

  revalidatePath(`${basePath}/invoices/${invoiceId}`);
  revalidatePath(`${basePath}/invoices`);
}

// ── Rollback invoice status one step ─────────────────────────
export async function rollbackInvoiceStatus(invoiceId: string, basePath: string) {
  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx.tenantId) return;

  const { data: inv } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", invoiceId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (!inv) return;

  const prevMap: Partial<Record<string, string>> = {
    paid: "completed",
    completed: "in_progress",
    in_progress: "draft",
    cancelled: "draft",
  };
  const next = prevMap[inv.status];
  if (!next) return;

  type InvoiceUpdate = {
    status: InvoiceStatus;
    paid_at?: string | null;
    payment_method?: string | null;
    completed_at?: string | null;
  };
  const update: InvoiceUpdate = { status: next as InvoiceStatus };
  if (inv.status === "paid") {
    update.paid_at = null;
    update.payment_method = null;
    // Reverse the ledger entry (admin client — admin role is blocked from ledger by RLS)
    const adminClient = createAdminClient();
    await adminClient.from("ledger").delete().eq("reference_id", invoiceId);
  }
  if (inv.status === "completed") {
    update.completed_at = null;
  }

  await supabase
    .from("invoices")
    .update(update)
    .eq("id", invoiceId)
    .eq("tenant_id", ctx.tenantId);

  revalidatePath(`${basePath}/invoices/${invoiceId}`);
  revalidatePath(`${basePath}/invoices`);
}

// ── Item description autocomplete ────────────────────────────
// ── Add item (structured params, returns created item) ───────
export async function addItemToInvoice(params: {
  invoiceId: string;
  tenantId: string;
  basePath: string;
  itemType: ItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  markupPct: number;
  paymentSource: PaymentSource | null;
  unitLabel?: string;
}): Promise<
  | {
      item: {
        id: string;
        description: string;
        quantity: number;
        unit_price: number;
        markup_pct: number;
        final_price: number;
        item_type: string;
      };
    }
  | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { description, itemType, quantity, unitPrice, markupPct, paymentSource } = params;
  if (!description.trim()) return { error: "Deskripsi wajib diisi" };

  const qty = Math.max(0.01, quantity);
  const finalPrice = unitPrice * qty * (1 + markupPct / 100);

  const { data, error } = await supabase
    .from("invoice_items")
    .insert({
      invoice_id: params.invoiceId,
      tenant_id: params.tenantId,
      item_type: itemType,
      description: description.trim(),
      quantity: qty,
      unit_price: unitPrice,
      markup_pct: markupPct,
      final_price: finalPrice,
      unit_label: params.unitLabel ?? null,
      payment_source: paymentSource,
      submitted_by: user.id,
    })
    .select("id, description, quantity, unit_price, markup_pct, final_price, item_type, unit_label")
    .single();

  if (error || !data) return { error: "Gagal menambah item: " + (error?.message ?? "") };

  await syncTotals(supabase, params.invoiceId);
  revalidatePath(`${params.basePath}/invoices/${params.invoiceId}`);
  return { item: data };
}

// ── Assign mechanic (structured params, returns assignment ID) ─
export async function addMechanicToInvoice(
  invoiceId: string,
  mechanicId: string,
  role: MechanicRoleInInvoice,
  basePath: string
): Promise<{ assignmentId: string } | { error: string }> {
  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx.tenantId) return { error: "Tenant tidak ditemukan" };

  const { data, error } = await supabase
    .from("invoice_mechanics")
    .insert({
      invoice_id: invoiceId,
      mechanic_id: mechanicId,
      tenant_id: ctx.tenantId,
      mechanic_role: role,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "Mekanik sudah ditugaskan" };
    return { error: "Gagal menugaskan mekanik: " + error.message };
  }

  revalidatePath(`${basePath}/invoices/${invoiceId}`);
  return { assignmentId: data.id };
}

export async function searchItemDescriptions(
  query: string
): Promise<{ description: string; item_type: string }[]> {
  if (!query.trim()) return [];
  const ctx = await getUserContext();
  if (!ctx.tenantId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoice_items")
    .select("description, item_type")
    .eq("tenant_id", ctx.tenantId)
    .ilike("description", `%${query}%`)
    .order("created_at", { ascending: false })
    .limit(12);
  // Deduplicate by description (keep most recent)
  const seen = new Set<string>();
  return (data ?? []).filter((item) => {
    const key = item.description.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Mechanic: update work order status ───────────────────────
// Uses admin client (service role) so RLS never blocks the update.
// Security is enforced manually: mechanic must be assigned to the invoice.
export async function updateInvoiceMechanicStatus(
  invoiceId: string,
  newStatus: "in_progress" | "completed"
): Promise<{ error?: string }> {
  const ctx = await getUserContext();
  if (ctx.role !== "mechanic") return { error: "Akses ditolak" };

  const supabase = await createClient(); // user client for ownership checks
  const admin = createAdminClient();     // service role for the actual update

  // 1. Verify this mechanic is assigned to the invoice
  const { data: assignment } = await supabase
    .from("invoice_mechanics")
    .select("id")
    .eq("invoice_id", invoiceId)
    .eq("mechanic_id", ctx.id)
    .maybeSingle();

  if (!assignment) return { error: "Anda tidak ditugaskan pada invoice ini" };

  // 2. Fetch current status (via admin so tenant isolation is done manually)
  const { data: inv } = await admin
    .from("invoices")
    .select("status, tenant_id")
    .eq("id", invoiceId)
    .single();

  if (!inv) return { error: "Invoice tidak ditemukan" };
  if (inv.tenant_id !== ctx.tenantId) return { error: "Akses ditolak" };

  const transitions: Record<string, string> = {
    draft: "in_progress",
    in_progress: "completed",
  };

  if (transitions[inv.status] !== newStatus) {
    return { error: "Transisi status tidak diizinkan dari kondisi saat ini" };
  }

  const updateData: { status: "in_progress" | "completed"; completed_at?: string } = { status: newStatus };
  if (newStatus === "completed") {
    updateData.completed_at = new Date().toISOString();
  }

  // 3. Update using service role — bypasses RLS
  const { error } = await admin
    .from("invoices")
    .update(updateData)
    .eq("id", invoiceId);

  if (error) return { error: error.message };

  revalidatePath(`/mechanic/dashboard/${invoiceId}`);
  revalidatePath("/mechanic/dashboard");
  revalidatePath(`/owner/invoices/${invoiceId}`);
  revalidatePath("/owner/invoices");
  revalidatePath(`/admin/invoices/${invoiceId}`);
  revalidatePath("/admin/invoices");
  return {};
}

// ── Mechanic: submit receipt (upload struk) ──────────────────
// Creates an invoice_item (part_external, payment_source=mechanic)
// and a mechanic_debt_ledger entry (advance).
export async function submitMechanicReceipt(payload: {
  invoiceId: string;
  description: string;
  amount: number;
  receiptImageUrl: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const ctx = await getUserContext();

  // Verify mechanic is assigned to this invoice
  const { data: assignment } = await supabase
    .from("invoice_mechanics")
    .select("id")
    .eq("invoice_id", payload.invoiceId)
    .eq("mechanic_id", ctx.id)
    .single();

  if (!assignment) return { error: "Anda tidak ditugaskan pada invoice ini" };

  // Fetch tenant_id from the invoice
  const { data: inv } = await supabase
    .from("invoices")
    .select("tenant_id")
    .eq("id", payload.invoiceId)
    .single();

  if (!inv) return { error: "Invoice tidak ditemukan" };

  // Insert invoice_item as part_external bought by mechanic
  const { data: item, error: itemError } = await supabase
    .from("invoice_items")
    .insert({
      invoice_id: payload.invoiceId,
      tenant_id: inv.tenant_id,
      item_type: "part_external",
      description: payload.description,
      quantity: 1,
      unit_price: payload.amount,
      markup_pct: 0,
      final_price: payload.amount,
      payment_source: "mechanic",
      receipt_image_url: payload.receiptImageUrl,
      submitted_by: ctx.id,
    })
    .select("id")
    .single();

  if (itemError) return { error: itemError.message };

  // Insert mechanic_debt_ledger entry
  const { error: ledgerError } = await supabase
    .from("mechanic_debt_ledger")
    .insert({
      tenant_id: inv.tenant_id,
      mechanic_id: ctx.id,
      invoice_item_id: item.id,
      transaction_type: "advance",
      amount: payload.amount,
      notes: payload.description,
      is_paid: false,
      created_by: ctx.id,
    });

  if (ledgerError) return { error: ledgerError.message };

  revalidatePath("/mechanic/receipts");
  revalidatePath("/mechanic/debts");
  revalidatePath(`/mechanic/dashboard/${payload.invoiceId}`);
  return {};
}

// ── Update invoice due date ───────────────────────────────────
export async function updateInvoiceDueDate(
  invoiceId: string,
  dueDate: string | null,
  basePath: string
) {
  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx.tenantId) return;
  await supabase
    .from("invoices")
    .update({ due_date: dueDate || null })
    .eq("id", invoiceId)
    .eq("tenant_id", ctx.tenantId);
  revalidatePath(`${basePath}/invoices/${invoiceId}`);
}

// ── Update invoice date ──────────────────────────────────────
export async function updateInvoiceDate(
  invoiceId: string,
  invoiceDate: string | null,
  basePath: string
) {
  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx.tenantId) return;
  if (!invoiceDate) return;
  await supabase
    .from("invoices")
    .update({ invoice_date: invoiceDate })
    .eq("id", invoiceId)
    .eq("tenant_id", ctx.tenantId);
  revalidatePath(`${basePath}/invoices/${invoiceId}`);
  revalidatePath(`${basePath}/invoices`);
}

// ── Update invoice shipping cost ──────────────────────────────
export async function updateInvoiceShipping(
  invoiceId: string,
  shippingCost: number,
  basePath: string
) {
  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx.tenantId) return;
  await supabase
    .from("invoices")
    .update({ shipping_cost: Math.max(0, shippingCost) })
    .eq("id", invoiceId)
    .eq("tenant_id", ctx.tenantId);
  await syncTotals(supabase, invoiceId);
  revalidatePath(`${basePath}/invoices/${invoiceId}`);
}
