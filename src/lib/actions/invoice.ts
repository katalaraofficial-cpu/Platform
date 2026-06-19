"use server";

import { createClient } from "@/lib/supabase/server";
import { createTenantAdminClient } from "@/lib/supabase/tenant-admin";
import { getUserContext } from "@/lib/get-user-context";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ItemType, InvoiceStatus, Invoice, PaymentSource, MechanicRoleInInvoice } from "@/types/database";

export type ActionState = { error?: string };

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

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

async function reconcileInvoiceMechanicPoints(params: {
  tenantId: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  shouldAwardFromInvoice: boolean;
}) {
  const { tenantId, invoiceId, invoiceNumber, amount, shouldAwardFromInvoice } = params;
  const admin = createTenantAdminClient(tenantId);

  const [{ data: settings }, { data: mechanics }, { data: pointTxns }] = await Promise.all([
    admin
      .from("settings")
      .select("reward_employee_enabled, reward_spend_per_point, reward_point_validity_days, reward_lead_multiplier, reward_helper_multiplier")
      .single(),
    admin
      .from("invoice_mechanics")
      .select("mechanic_id, mechanic_role")
      .eq("invoice_id", invoiceId),
    admin
      .from("employee_point_transactions")
      .select("profile_id, points")
      .eq("reference_id", invoiceId)
      .in("transaction_type", ["earn", "adjust"]),
  ]);

  const expectedByProfile = new Map<string, number>();
  const canAward =
    shouldAwardFromInvoice &&
    Boolean(settings?.reward_employee_enabled) &&
    amount > 0 &&
    Number(settings?.reward_spend_per_point ?? 0) > 0;

  if (canAward) {
    const spendPerPoint = Number(settings?.reward_spend_per_point ?? 0);
    for (const m of mechanics ?? []) {
      const multiplier = m.mechanic_role === "lead"
        ? Number(settings?.reward_lead_multiplier ?? 1)
        : Number(settings?.reward_helper_multiplier ?? 0.5);
      // Floor sekali pada (amount * multiplier) / spendPerPoint agar fraksi point
      // helper (multiplier < 1) tidak hilang karena pembulatan ganda.
      const earned = Math.floor((amount * multiplier) / spendPerPoint);
      if (earned > 0) expectedByProfile.set(m.mechanic_id, earned);
    }
  }

  const netByProfile = new Map<string, number>();
  for (const txn of pointTxns ?? []) {
    netByProfile.set(
      txn.profile_id,
      (netByProfile.get(txn.profile_id) ?? 0) + Number(txn.points ?? 0)
    );
  }

  const roleByProfile = new Map<string, string>();
  for (const m of mechanics ?? []) {
    roleByProfile.set(m.mechanic_id, m.mechanic_role ?? "mechanic");
  }

  const profileIds = new Set<string>([
    ...expectedByProfile.keys(),
    ...netByProfile.keys(),
  ]);
  if (profileIds.size === 0) return;

  const expiresAt = new Date();
  expiresAt.setDate(
    expiresAt.getDate() + Number(settings?.reward_point_validity_days ?? 365)
  );
  const expiresStr = expiresAt.toISOString().split("T")[0];

  for (const profileId of profileIds) {
    const expected = Number(expectedByProfile.get(profileId) ?? 0);
    const currentNet = Number(netByProfile.get(profileId) ?? 0);
    const delta = expected - currentNet;
    if (delta === 0) continue;

    const { data: ep } = await admin
      .from("employee_points")
      .select("id, points_balance, total_earned, total_redeemed")
      .eq("profile_id", profileId)
      .maybeSingle();

    if (ep) {
      await admin
        .from("employee_points")
        .update({
          points_balance: Math.max(0, Number(ep.points_balance ?? 0) + delta),
          total_earned: Math.max(0, Number(ep.total_earned ?? 0) + delta),
          total_redeemed: Math.max(0, Number(ep.total_redeemed ?? 0)),
        })
        .eq("id", ep.id);
    } else if (delta > 0) {
      await admin.from("employee_points").insert({
        profile_id: profileId,
        points_balance: delta,
        total_earned: delta,
        total_redeemed: 0,
      });
    }

    const txType = canAward && delta > 0 ? "earn" : "adjust";
    await admin.from("employee_point_transactions").insert({
      profile_id: profileId,
      transaction_type: txType,
      points: delta,
      reference_id: invoiceId,
      expires_at: txType === "earn" ? expiresStr : null,
      notes:
        txType === "earn"
          ? `Point diberikan dari nota ${invoiceNumber} (${roleByProfile.get(profileId) ?? "mechanic"}) setelah status lunas.`
          : `Penyesuaian point: nota ${invoiceNumber} tidak lagi berstatus lunas, sehingga point dibatalkan.`,
    });
  }
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

  // --- ATOMIC INVOICE NUMBER GENERATION ---
  // Format: INV-MMYY-NNNN (contoh: INV-0126-0001). Counter reset per tahun per tenant.
  const _nowInv = new Date();
  const year = _nowInv.getFullYear();
  const mm = String(_nowInv.getMonth() + 1).padStart(2, "0");
  const yy = String(year).slice(-2);
  const { data: sequence, error: sequenceError } = await supabase
    .rpc('get_next_invoice_sequence', { p_tenant_id: tenantId, p_year: year });

  if (sequenceError || sequence === null || sequence === undefined) {
    console.error("Gagal mendapatkan nomor urut invoice:", sequenceError);
    return {
      error: "Terjadi kesalahan pada server saat membuat nomor invoice. Silakan coba lagi.",
    };
  }

  const invoiceNumber = `INV-${mm}${yy}-${String(sequence).padStart(4, "0")}`;
  // --- END OF ATOMIC GENERATION ---

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

  if (invErr || !invoice) {
    console.error("Gagal membuat invoice:", invErr);
    return { error: "Gagal membuat invoice: " + (invErr?.message ?? "Kesalahan tidak diketahui.") };
  }

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
  basePath: string,
  completedAt?: string
) {
  const supabase = await createClient();
  const ctx = await getUserContext();
  const invoiceQuery = supabase
    .from("invoices")
    .select("status, grand_total, invoice_number, tenant_id")
    .eq("id", invoiceId);
  const scopedInvoiceQuery = ctx.tenantId
    ? invoiceQuery.eq("tenant_id", ctx.tenantId)
    : invoiceQuery;
  const { data: previousInvoice } = await scopedInvoiceQuery.single();
  const now = new Date().toISOString();
  const update: Partial<Omit<Invoice, "id" | "created_at">> = { status: newStatus };

  if (newStatus === "completed") {
    if (completedAt) {
      // User-supplied date (YYYY-MM-DD). Use noon UTC so timezone math is stable.
      update.completed_at = new Date(`${completedAt}T12:00:00Z`).toISOString();
    } else {
      // Fallback heuristic untuk invoice retroaktif
      const { data: inv } = await supabase
        .from("invoices")
        .select("invoice_date")
        .eq("id", invoiceId)
        .single();
      const today = new Date().toISOString().split("T")[0];
      const invoiceDate = inv?.invoice_date as string | undefined;
      update.completed_at =
        invoiceDate && invoiceDate < today
          ? new Date(invoiceDate + "T12:00:00Z").toISOString()
          : now;
    }
  }

  if (newStatus === "paid") update.paid_at = now;

  await supabase.from("invoices").update(update).eq("id", invoiceId);

  const shouldAwardNow = newStatus === "paid";
  const shouldRemoveAward = previousInvoice?.status === "paid" && newStatus !== "paid";
  if ((shouldAwardNow || shouldRemoveAward) && previousInvoice?.tenant_id) {
    try {
      await reconcileInvoiceMechanicPoints({
        tenantId: previousInvoice.tenant_id,
        invoiceId,
        invoiceNumber: previousInvoice.invoice_number,
        amount: Number(previousInvoice.grand_total ?? 0),
        shouldAwardFromInvoice: shouldAwardNow,
      });
    } catch {
      // Point sync is non-critical for status transition.
    }
  }

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

  const { data: inv } = await supabase
    .from("invoices")
    .select("status, grand_total, invoice_number")
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId)
    .single();

  if (inv?.status === "paid") {
    try {
      await reconcileInvoiceMechanicPoints({
        tenantId,
        invoiceId,
        invoiceNumber: inv.invoice_number,
        amount: Number(inv.grand_total ?? 0),
        shouldAwardFromInvoice: true,
      });
    } catch {
      // Point sync is non-critical for assignment changes.
    }
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
  const ctx = await getUserContext();
  await supabase.from("invoice_mechanics").delete().eq("id", assignmentId);

  if (ctx.tenantId) {
    const { data: inv } = await supabase
      .from("invoices")
      .select("status, grand_total, invoice_number")
      .eq("id", invoiceId)
      .eq("tenant_id", ctx.tenantId)
      .single();

    if (inv?.status === "paid") {
      try {
        await reconcileInvoiceMechanicPoints({
          tenantId: ctx.tenantId,
          invoiceId,
          invoiceNumber: inv.invoice_number,
          amount: Number(inv.grand_total ?? 0),
          shouldAwardFromInvoice: true,
        });
      } catch {
        // Point sync is non-critical for assignment changes.
      }
    }
  }

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
  jobTitle?: string;
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
  const combinedNotes = [payload.jobDescription, payload.notes]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" | ") || null;

  // --- ATOMIC INVOICE NUMBER GENERATION ---
  // Format: INV-MMYY-NNNN (contoh: INV-0126-0001). Counter reset per tahun per tenant.
  const _nowInv = new Date();
  const year = _nowInv.getFullYear();
  const mm = String(_nowInv.getMonth() + 1).padStart(2, "0");
  const yy = String(year).slice(-2);
  const { data: sequence, error: sequenceError } = await supabase
    .rpc('get_next_invoice_sequence', { p_tenant_id: tenantId, p_year: year });

  if (sequenceError || sequence === null || sequence === undefined) {
    console.error("Gagal mendapatkan nomor urut invoice:", sequenceError);
    return {
      error: "Terjadi kesalahan pada server saat membuat nomor invoice. Silakan coba lagi.",
    };
  }

  const invoiceNumber = `INV-${mm}${yy}-${String(sequence).padStart(4, "0")}`;
  // --- END OF ATOMIC GENERATION ---

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
      job_title: payload.jobTitle?.trim() ? payload.jobTitle.trim() : null,
      shipping_cost: payload.shippingCost ?? 0,
    })
    .select("id")
    .single();

  if (invErr || !invoice) {
    console.error("Gagal membuat invoice:", invErr);
    return { error: "Gagal membuat invoice: " + (invErr?.message ?? "Kesalahan tidak diketahui.") };
  }

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
  data: {
    description: string;
    quantity: number;
    unitPrice: number;
    itemType?: ItemType;
    sellPrice?: number;
    unitLabel?: string;
    syncCatalogMaster?: boolean;
  }
) {
  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx.tenantId) return;

  const newItemType = data.itemType;
  const isService = newItemType === "service";
  const resolvedUnitPrice = isService && data.sellPrice !== undefined ? data.sellPrice : data.unitPrice;
  let markupPct: number;
  let finalPrice: number;

  if (data.sellPrice !== undefined) {
    // Explicit sell price provided — recalculate markup from buy/sell
    finalPrice = data.sellPrice * data.quantity;
    markupPct =
      !isService && resolvedUnitPrice > 0
        ? Math.max(0, ((data.sellPrice - resolvedUnitPrice) / resolvedUnitPrice) * 100)
        : 0;
    await supabase
      .from("invoice_items")
      .update({
        description: data.description,
        quantity: data.quantity,
        unit_price: resolvedUnitPrice,
        markup_pct: markupPct,
        final_price: finalPrice,
        ...(newItemType ? { item_type: newItemType } : {}),
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
    finalPrice = resolvedUnitPrice * data.quantity * (1 + markupPct / 100);
    await supabase
      .from("invoice_items")
      .update({
        description: data.description,
        quantity: data.quantity,
        unit_price: resolvedUnitPrice,
        ...(newItemType ? { item_type: newItemType } : {}),
        final_price: finalPrice,
        ...(data.unitLabel !== undefined ? { unit_label: data.unitLabel || null } : {}),
      })
      .eq("id", itemId);
  }

  if (data.syncCatalogMaster && newItemType) {
    // Optional: keep snapshot change in sync with catalog master for this tenant.
    await supabase
      .from("catalog_items")
      .update({ item_type: newItemType, updated_at: new Date().toISOString() })
      .eq("tenant_id", ctx.tenantId)
      .eq("description", data.description.trim());
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

// ── Tracking notes (per-invoice activity log) ─────────────────
export type TrackingNote = {
  id: string;
  date: string;       // YYYY-MM-DD
  text: string;
  created_at: string; // ISO
  images?: string[];  // optional foto pendukung (max 2)
};

// Daftar preset aksi cepat catatan tracking (mis. Diambil/Diantar/Dipasang).
export async function getTrackingNotePresets(): Promise<string[]> {
  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx.tenantId) return [];
  const { data } = await supabase
    .from("settings")
    .select("tracking_note_presets")
    .eq("tenant_id", ctx.tenantId)
    .single();
  const raw = (data as { tracking_note_presets?: unknown } | null)?.tracking_note_presets;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

export async function getInvoiceTrackingNotes(
  invoiceId: string
): Promise<TrackingNote[]> {
  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx.tenantId) return [];
  const { data } = await supabase
    .from("invoices")
    .select("tracking_notes")
    .eq("id", invoiceId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  const raw = (data as { tracking_notes?: unknown } | null)?.tracking_notes;
  if (!Array.isArray(raw)) return [];
  return raw as TrackingNote[];
}

export async function addInvoiceTrackingNote(
  invoiceId: string,
  date: string,
  text: string,
  basePath: string,
  images?: string[]
): Promise<ActionState> {
  const trimmed = text.trim();
  if (!trimmed) return { error: "Catatan tidak boleh kosong." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Tanggal tidak valid." };
  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx.tenantId) return { error: "Sesi tidak valid." };

  const { data: inv } = await supabase
    .from("invoices")
    .select("tracking_notes")
    .eq("id", invoiceId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (!inv) return { error: "Invoice tidak ditemukan." };

  const existing = Array.isArray((inv as { tracking_notes?: unknown }).tracking_notes)
    ? ((inv as { tracking_notes: TrackingNote[] }).tracking_notes)
    : [];
  const cleanImages = Array.isArray(images)
    ? images.filter((u): u is string => typeof u === "string" && u.length > 0).slice(0, 2)
    : [];
  const entry: TrackingNote = {
    id: crypto.randomUUID(),
    date,
    text: trimmed,
    created_at: new Date().toISOString(),
    ...(cleanImages.length ? { images: cleanImages } : {}),
  };
  const next = [entry, ...existing];

  const { error } = await supabase
    .from("invoices")
    .update({ tracking_notes: next } as never)
    .eq("id", invoiceId)
    .eq("tenant_id", ctx.tenantId);
  if (error) return { error: error.message };

  revalidatePath(`${basePath}/invoices`);
  return {};
}

export async function updateInvoiceTrackingNote(
  invoiceId: string,
  noteId: string,
  date: string,
  text: string,
  basePath: string,
  images?: string[]
): Promise<ActionState> {
  const trimmed = text.trim();
  if (!trimmed) return { error: "Catatan tidak boleh kosong." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Tanggal tidak valid." };
  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx.tenantId) return { error: "Sesi tidak valid." };

  const { data: inv } = await supabase
    .from("invoices")
    .select("tracking_notes")
    .eq("id", invoiceId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (!inv) return { error: "Invoice tidak ditemukan." };

  const existing = Array.isArray((inv as { tracking_notes?: unknown }).tracking_notes)
    ? ((inv as { tracking_notes: TrackingNote[] }).tracking_notes)
    : [];
  const cleanImages = Array.isArray(images)
    ? images.filter((u): u is string => typeof u === "string" && u.length > 0).slice(0, 2)
    : [];
  const next = existing.map((n) => {
    if (n.id !== noteId) return n;
    const updated: TrackingNote = { ...n, date, text: trimmed };
    if (cleanImages.length) updated.images = cleanImages;
    else delete updated.images;
    return updated;
  });

  const { error } = await supabase
    .from("invoices")
    .update({ tracking_notes: next } as never)
    .eq("id", invoiceId)
    .eq("tenant_id", ctx.tenantId);
  if (error) return { error: error.message };

  revalidatePath(`${basePath}/invoices`);
  return {};
}

export async function deleteInvoiceTrackingNote(
  invoiceId: string,
  noteId: string,
  basePath: string
): Promise<ActionState> {
  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx.tenantId) return { error: "Sesi tidak valid." };

  const { data: inv } = await supabase
    .from("invoices")
    .select("tracking_notes")
    .eq("id", invoiceId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (!inv) return { error: "Invoice tidak ditemukan." };

  const existing = Array.isArray((inv as { tracking_notes?: unknown }).tracking_notes)
    ? ((inv as { tracking_notes: TrackingNote[] }).tracking_notes)
    : [];
  const next = existing.filter((n) => n.id !== noteId);

  const { error } = await supabase
    .from("invoices")
    .update({ tracking_notes: next } as never)
    .eq("id", invoiceId)
    .eq("tenant_id", ctx.tenantId);
  if (error) return { error: error.message };

  revalidatePath(`${basePath}/invoices`);
  return {};
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
    .select("grand_total, invoice_number, status, customer_id, customer:customers(name)")
    .eq("id", invoiceId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (!inv || inv.status !== "completed") return;

  const customerName =
    (inv as { customer?: { name?: string } | null }).customer?.name?.trim() || null;

  const effectivePaymentDate =
    paymentDate || new Date().toISOString().split("T")[0];

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
    const adminClient = createTenantAdminClient(ctx.tenantId);
    const methodLabelText = methodLabel[method] ?? method;
    const noteText = customerName
      ? `${customerName} — Pembayaran ${inv.invoice_number} via ${methodLabelText}`
      : `Pembayaran invoice ${inv.invoice_number} via ${methodLabelText}`;
    await adminClient.from("ledger").insert({
      transaction_type: "kas_masuk",
      account_type: method === "transfer" ? "bank" : "kas_tunai",
      category: "Pembayaran Invoice",
      amount,
      reference_id: invoiceId,
      transfer_ref: null,
      notes: noteText,
      transaction_date: effectivePaymentDate,
      created_by: ctx.id,
      created_at: paidAt,
    });
  }

  // Keep point state equal to current invoice state (paid => expected earn).
  try {
    await reconcileInvoiceMechanicPoints({
      tenantId: ctx.tenantId,
      invoiceId,
      invoiceNumber: inv.invoice_number,
      amount,
      shouldAwardFromInvoice: true,
    });
  } catch {
    // Point sync is non-critical — do not fail the payment
  }

  revalidatePath(`${basePath}/invoices/${invoiceId}`);
  revalidatePath(`${basePath}/invoices`);
  revalidatePath("/owner/mechanics");
  revalidatePath("/mechanic/dashboard");
  revalidatePath("/owner/dashboard");
}

// ── Rollback invoice status one step ─────────────────────────
export async function rollbackInvoiceStatus(invoiceId: string, basePath: string) {
  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx.tenantId) return;

  const { data: inv } = await supabase
    .from("invoices")
    .select("status, grand_total, invoice_number")
    .eq("id", invoiceId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (!inv) return;

  // Points are earned only at paid state; rollback from paid must bring them back to zero.
  if (inv.status === "paid") {
    try {
      await reconcileInvoiceMechanicPoints({
        tenantId: ctx.tenantId,
        invoiceId,
        invoiceNumber: inv.invoice_number,
        amount: Number(inv.grand_total ?? 0),
        shouldAwardFromInvoice: false,
      });
    } catch {
      // Point sync is non-critical; invoice rollback should still proceed.
    }
  }

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
    const adminClient = createTenantAdminClient(ctx.tenantId);
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
  revalidatePath("/owner/mechanics");
  revalidatePath("/mechanic/dashboard");
  revalidatePath("/owner/dashboard");
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
  sellPrice?: number;
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

  const { description, itemType, quantity, unitPrice, sellPrice, markupPct, paymentSource } = params;
  const effectiveSellPrice = Math.max(
    0,
    sellPrice !== undefined
      ? Number(sellPrice)
      : unitPrice * (1 + markupPct / 100),
  );

  // --- Upsert to Catalog ---
  // Setiap kali item ditambahkan, sinkronkan master katalog (auto-belajar harga terbaru).
  // onConflict menarget unique index (tenant_id, description_norm, item_type)
  // di mana description_norm = lower(btrim(description)) (generated column).
  const trimmedDesc = description.trim();
  if (trimmedDesc) {
    const adminClient = createTenantAdminClient(params.tenantId);
    const { error: upsertCatalogError } = await adminClient
      .from('catalog_items')
      .upsert(
        {
          description: trimmedDesc,
          item_type: itemType,
          unit_label: params.unitLabel ?? null,
          default_buy_price: itemType !== 'service' ? unitPrice : 0,
          default_sell_price: effectiveSellPrice,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'tenant_id,description_norm,item_type',
        }
      );
    if (upsertCatalogError) {
      console.error("Gagal upsert ke catalog_items:", upsertCatalogError);
    }
  }
  // --- End Upsert to Catalog ---

  if (!description.trim()) return { error: "Deskripsi wajib diisi" };

  const qty = Math.max(0.01, quantity);
  const finalPrice = effectiveSellPrice * qty;
  const normalizedMarkupPct =
    itemType !== "service" && unitPrice > 0
      ? Math.max(0, ((effectiveSellPrice - unitPrice) / unitPrice) * 100)
      : 0;

  const { data, error } = await supabase
    .from("invoice_items")
    .insert({
      invoice_id: params.invoiceId,
      tenant_id: params.tenantId,
      item_type: itemType,
      description: description.trim(),
      quantity: qty,
      unit_price: unitPrice,
      markup_pct: normalizedMarkupPct,
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
): Promise<{ description: string; item_type: string; unit_price: number; sell_price: number; unit_label: string | null }[]> {
  if (!query.trim()) return [];
  const ctx = await getUserContext();
  if (!ctx.tenantId) return [];
  const supabase = await createClient();
  const q = query.trim();

  // 1) Master catalog (preferred — sudah punya harga "default")
  const { data: catalogRows } = await supabase
    .from("catalog_items")
    .select("description, item_type, default_buy_price, default_sell_price, unit_label")
    .eq("tenant_id", ctx.tenantId)
    .ilike("description", `%${q}%`)
    .order("description", { ascending: true })
    .limit(20);

  type Row = { description: string; item_type: string; unit_price: number; sell_price: number; unit_label: string | null };
  const map = new Map<string, Row>();
  for (const item of catalogRows ?? []) {
    const key = `${(item.item_type ?? "").toLowerCase()}::${item.description.trim().toLowerCase()}`;
    map.set(key, {
      description: item.description,
      item_type: item.item_type,
      unit_price: Number(item.default_buy_price ?? 0),
      sell_price: Number(item.default_sell_price ?? 0),
      unit_label: item.unit_label ?? null,
    });
  }

  // 2) Fallback: invoice_items historis (untuk data lama yang belum sempat
  //    masuk catalog_items karena upsert pernah gagal atau invoice diimport).
  const { data: histRows } = await supabase
    .from("invoice_items")
    .select("description, item_type, unit_price, final_price, quantity, unit_label, created_at")
    .eq("tenant_id", ctx.tenantId)
    .ilike("description", `%${q}%`)
    .order("created_at", { ascending: false })
    .limit(40);

  for (const row of histRows ?? []) {
    const key = `${(row.item_type ?? "").toLowerCase()}::${row.description.trim().toLowerCase()}`;
    if (map.has(key)) continue; // catalog wins
    const qty = Math.max(1, Number(row.quantity ?? 1));
    const sellUnit = qty > 0 ? Number(row.final_price ?? 0) / qty : Number(row.final_price ?? 0);
    map.set(key, {
      description: row.description,
      item_type: row.item_type,
      unit_price: Number(row.unit_price ?? 0),
      sell_price: Math.round(sellUnit),
      unit_label: row.unit_label ?? null,
    });
  }

  return Array.from(map.values())
    .sort((a, b) => a.description.localeCompare(b.description))
    .slice(0, 12);
}

// ── Pekerjaan: cari job_title historis (autocomplete invoice editor) ──
export async function searchJobTitles(query: string): Promise<string[]> {
  const q = query.trim();
  if (!q) return [];
  const ctx = await getUserContext();
  if (!ctx.tenantId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select("job_title")
    .eq("tenant_id", ctx.tenantId)
    .not("job_title", "is", null)
    .ilike("job_title", `${q}%`)
    .order("created_at", { ascending: false })
    .limit(80);

  if (!data) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of data) {
    const t = (row.job_title ?? "").trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= 10) break;
  }
  return out;
}

// ── Mechanic: update work order status ───────────────────────
// Uses admin client (service role) so RLS never blocks the update.
// Security is enforced manually: mechanic must be assigned to the invoice.
export async function updateInvoiceMechanicStatus(
  invoiceId: string,
  newStatus: "in_progress" | "completed",
  completedAt?: string
): Promise<{ error?: string }> {
  const ctx = await getUserContext();
  if (ctx.role !== "mechanic") return { error: "Akses ditolak" };
  if (!ctx.tenantId) return { error: "Tenant tidak ditemukan" };

  const supabase = await createClient(); // user client for ownership checks
  // Tenant-scoped admin: auto-filter tenant_id pada semua query (mechanic
  // tidak bisa menyentuh invoice di tenant lain meski lewat service_role).
  const admin = createTenantAdminClient(ctx.tenantId);

  // 1. Verify this mechanic is assigned to the invoice
  const { data: assignment } = await supabase
    .from("invoice_mechanics")
    .select("id")
    .eq("invoice_id", invoiceId)
    .eq("mechanic_id", ctx.id)
    .maybeSingle();

  if (!assignment) return { error: "Anda tidak ditugaskan pada invoice ini" };

  // 2. Fetch current status (wrapper auto-filter tenant_id).
  const { data: inv } = await admin
    .from("invoices")
    .select("status, tenant_id")
    .eq("id", invoiceId)
    .single();

  if (!inv) return { error: "Invoice tidak ditemukan" };

  const transitions: Record<string, string> = {
    draft: "in_progress",
    in_progress: "completed",
  };

  if (transitions[inv.status] !== newStatus) {
    return { error: "Transisi status tidak diizinkan dari kondisi saat ini" };
  }

  const updateData: { status: "in_progress" | "completed"; completed_at?: string } = { status: newStatus };
  if (newStatus === "completed") {
    if (completedAt) {
      updateData.completed_at = new Date(`${completedAt}T12:00:00Z`).toISOString();
    } else {
      // Fallback heuristic untuk invoice retroaktif
      const { data: invDate } = await admin
        .from("invoices")
        .select("invoice_date")
        .eq("id", invoiceId)
        .single();
      const today = new Date().toISOString().split("T")[0];
      const invoiceDate = (invDate as { invoice_date?: string } | null)?.invoice_date;
      updateData.completed_at =
        invoiceDate && invoiceDate < today
          ? new Date(invoiceDate + "T12:00:00Z").toISOString()
          : new Date().toISOString();
    }
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
// Dua mode:
//  1. invoiceId terisi → buat invoice_item (part_external) + entry kasbon.
//  2. invoiceId null + claimCategory terisi → klaim non-invoice (bensin /
//     kesehatan / lainnya). Hanya entri kasbon yang dibuat, struk disimpan
//     langsung di mechanic_debt_ledger.receipt_image_url.
export async function submitMechanicReceipt(payload: {
  invoiceId: string | null;
  description: string;
  amount: number;
  receiptImageUrl: string;
  claimCategory?: "bensin" | "kesehatan" | "lainnya" | null;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const ctx = await getUserContext();

  const isClaim = !payload.invoiceId;

  if (isClaim) {
    if (!ctx.tenantId) return { error: "Tenant tidak ditemukan" };
    if (!payload.claimCategory) {
      return { error: "Pilih kategori klaim" };
    }

    const { error: ledgerError } = await supabase
      .from("mechanic_debt_ledger")
      .insert({
        tenant_id: ctx.tenantId,
        mechanic_id: ctx.id,
        invoice_item_id: null,
        transaction_type: "advance",
        amount: payload.amount,
        notes: payload.description,
        claim_category: payload.claimCategory,
        receipt_image_url: payload.receiptImageUrl,
        is_paid: false,
        created_by: ctx.id,
      });

    if (ledgerError) return { error: ledgerError.message };

    revalidatePath("/mechanic/receipts");
    revalidatePath("/mechanic/debts");
    return {};
  }

  // Verify mechanic is assigned to this invoice
  const { data: assignment } = await supabase
    .from("invoice_mechanics")
    .select("id")
    .eq("invoice_id", payload.invoiceId!)
    .eq("mechanic_id", ctx.id)
    .single();

  if (!assignment) return { error: "Anda tidak ditugaskan pada invoice ini" };

  // Fetch tenant_id from the invoice
  const { data: inv } = await supabase
    .from("invoices")
    .select("tenant_id")
    .eq("id", payload.invoiceId!)
    .single();

  if (!inv) return { error: "Invoice tidak ditemukan" };

  // Insert invoice_item as part_external bought by mechanic
  const { data: item, error: itemError } = await supabase
    .from("invoice_items")
    .insert({
      invoice_id: payload.invoiceId!,
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

// ── Update invoice job title ───────────────────────────────────
export async function updateInvoiceJobTitle(
  invoiceId: string,
  jobTitle: string | null,
  basePath: string
) {
  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx.tenantId) return;
  const trimmed = jobTitle?.trim() || null;
  await supabase
    .from("invoices")
    .update({ job_title: trimmed })
    .eq("id", invoiceId)
    .eq("tenant_id", ctx.tenantId);
  revalidatePath(`${basePath}/invoices`);
  revalidatePath(`${basePath}/invoices/${invoiceId}`);
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

// ── Update invoice down payment (DP / uang muka) ─────────────
export async function updateInvoiceDp(
  invoiceId: string,
  dpAmount: number,
  basePath: string
) {
  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx.tenantId) return;
  await supabase
    .from("invoices")
    .update({ dp_amount: Math.max(0, dpAmount) })
    .eq("id", invoiceId)
    .eq("tenant_id", ctx.tenantId);
  revalidatePath(`${basePath}/invoices/${invoiceId}`);
}

// ── Toggle complaint status for mechanics on invoice ────────
export async function setInvoiceComplaintStatus(
  invoiceId: string,
  isComplaint: boolean,
  basePath: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx.tenantId || !["owner", "admin"].includes(ctx.role ?? "")) {
    return { error: "Tidak memiliki akses" };
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", invoiceId)
    .eq("tenant_id", ctx.tenantId)
    .single();

  if (!invoice) return { error: "Invoice tidak ditemukan" };
  if (invoice.status !== "completed") {
    return { error: "Komplain hanya bisa diubah saat status invoice Selesai" };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("invoice_mechanics")
    .update({
      is_complaint: isComplaint,
      complaint_at: isComplaint ? now : null,
      complaint_resolved_at: isComplaint ? null : now,
    })
    .eq("invoice_id", invoiceId)
    .eq("tenant_id", ctx.tenantId);

  if (error) return { error: "Gagal menyimpan status komplain: " + error.message };

  revalidatePath(`${basePath}/invoices/${invoiceId}`);
  revalidatePath(`${basePath}/invoices`);
  revalidatePath("/owner/mechanics");
  revalidatePath("/owner/invoices");
  revalidatePath("/admin/invoices");
  return {};
}

// -- Bulk actions ---------------------------------------------
export async function bulkMarkInvoicesPaid(
  invoiceIds: string[],
  method: string,
  paymentDate: string,
  basePath: string
) {
  const ctx = await getUserContext();
  if (!ctx.tenantId) return { error: "Tenant tidak ditemukan", processed: 0 };
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "Tidak berwenang", processed: 0 };
  }
  let processed = 0;
  for (const id of invoiceIds) {
    try {
      await processPayment(id, method, paymentDate, basePath);
      processed++;
    } catch {
      // skip individual failures
    }
  }
  revalidatePath(`${basePath}/invoices`);
  return { processed };
}

export async function bulkDeleteInvoices(invoiceIds: string[], basePath: string) {
  const ctx = await getUserContext();
  if (!ctx.tenantId) return { error: "Tenant tidak ditemukan", processed: 0 };
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "Tidak berwenang", processed: 0 };
  }
  let processed = 0;
  for (const id of invoiceIds) {
    try {
      await deleteInvoice(id, basePath);
      processed++;
    } catch {
      // skip individual failures
    }
  }
  revalidatePath(`${basePath}/invoices`);
  return { processed };
}
export type InvoicePreviewData = {
  id: string;
  invoice_number: string;
  status: string;
  invoice_date: string | null;
  completed_at: string | null;
  paid_at: string | null;
  notes: string | null;
  subtotal: number;
  discount_amount: number;
  ppn_pct: number;
  ppn_amount: number;
  pph_pct: number;
  pph_amount: number;
  dp_amount: number;
  shipping_cost: number;
  grand_total: number;
  payment_method: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  mechanics: string[];
  items: Array<{
    id: string;
    item_type: string;
    description: string;
    quantity: number;
    unit_label: string | null;
    unit_price: number;
    final_price: number;
  }>;
};

export async function getInvoicePreview(invoiceId: string): Promise<InvoicePreviewData | null> {
  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx.tenantId) return null;

  const { data: inv } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, status, invoice_date, completed_at, paid_at, notes, subtotal, discount_amount, ppn_pct, ppn_amount, pph_pct, pph_amount, dp_amount, shipping_cost, grand_total, payment_method, customer_id"
    )
    .eq("id", invoiceId)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (!inv) return null;

  const [{ data: items }, customerRes, mechRes] = await Promise.all([
    supabase
      .from("invoice_items")
      .select("id, item_type, description, quantity, unit_label, unit_price, final_price")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: true }),
    inv.customer_id
      ? supabase
          .from("customers")
          .select("name, phone")
          .eq("id", inv.customer_id)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from("invoice_mechanics")
      .select("mechanic_id")
      .eq("invoice_id", invoiceId),
  ]);

  const mechIds = (mechRes.data ?? []).map((m) => m.mechanic_id);
  const { data: mechProfiles } =
    mechIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", mechIds)
      : { data: [] as { id: string; full_name: string | null }[] };
  const nameMap = Object.fromEntries(
    (mechProfiles ?? []).map((p) => [p.id, p.full_name ?? "?"])
  );

  return {
    id: inv.id,
    invoice_number: inv.invoice_number,
    status: inv.status,
    invoice_date: inv.invoice_date,
    completed_at: inv.completed_at,
    paid_at: inv.paid_at,
    notes: inv.notes,
    subtotal: Number(inv.subtotal ?? 0),
    discount_amount: Number(inv.discount_amount ?? 0),
    ppn_pct: Number(inv.ppn_pct ?? 0),
    ppn_amount: Number(inv.ppn_amount ?? 0),
    pph_pct: Number(inv.pph_pct ?? 0),
    pph_amount: Number(inv.pph_amount ?? 0),
    dp_amount: Number(inv.dp_amount ?? 0),
    shipping_cost: Number(inv.shipping_cost ?? 0),
    grand_total: Number(inv.grand_total ?? 0),
    payment_method: inv.payment_method,
    customer_name: customerRes.data?.name ?? null,
    customer_phone: customerRes.data?.phone ?? null,
    mechanics: mechIds.map((id) => nameMap[id] ?? "?"),
    items: (items ?? []).map((it) => ({
      id: it.id,
      item_type: String(it.item_type),
      description: it.description,
      quantity: Number(it.quantity),
      unit_label: it.unit_label,
      unit_price: Number(it.unit_price),
      final_price: Number(it.final_price),
    })),
  };
}