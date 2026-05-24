"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { UserRole } from "@/types/database";

export type ActionState = { error?: string; success?: string };

async function assertSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "super_admin") throw new Error("Forbidden");
  return supabase;
}

// ── Create new tenant (+ settings row) ──────────────────────
export async function createTenant(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await assertSuperAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Nama tenant wajib diisi" };

  // Auto-generate slug from name
  const rawSlug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const slug =
    rawSlug ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const { data: tenant, error } = await supabase
    .from("tenants")
    .insert({ name, slug, is_active: true })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505")
      return { error: `Slug "${slug}" sudah digunakan. Gunakan slug lain.` };
    return { error: "Gagal membuat tenant: " + error.message };
  }

  // Settings row is created by trigger, but insert as fallback
  await supabase
    .from("settings")
    .upsert({ tenant_id: tenant!.id, default_markup_pct: 20, petty_cash_limit: 500000 });

  revalidatePath("/super-admin/tenants");
  redirect(`/super-admin/tenants/${tenant!.id}`);
}

// ── Toggle tenant active/inactive ───────────────────────────
export async function toggleTenantActive(
  tenantId: string,
  isActive: boolean
): Promise<void> {
  const supabase = await assertSuperAdmin();
  await supabase
    .from("tenants")
    .update({ is_active: isActive })
    .eq("id", tenantId);
  revalidatePath("/super-admin/tenants");
  revalidatePath(`/super-admin/tenants/${tenantId}`);
}

// ── Update tenant feature toggles ───────────────────────────
export async function updateFeatureToggles(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await assertSuperAdmin();
  const tenantId = formData.get("tenant_id") as string;

  const toggles = {
    module_ledger: formData.get("module_ledger") === "on",
    module_petty_cash: formData.get("module_petty_cash") === "on",
    module_mechanic_portal: formData.get("module_mechanic_portal") === "on",
    module_customer_history: formData.get("module_customer_history") === "on",
  };

  const { error } = await supabase
    .from("tenants")
    .update({ feature_toggles: toggles })
    .eq("id", tenantId);

  if (error) return { error: "Gagal menyimpan: " + error.message };
  revalidatePath(`/super-admin/tenants/${tenantId}`);
  return {};
}

// ── Update tenant settings (markup, petty cash) ──────────────
export async function updateTenantSettings(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await assertSuperAdmin();
  const tenantId = formData.get("tenant_id") as string;
  const defaultMarkupPct = Math.max(
    0,
    Number(formData.get("default_markup_pct")) || 0
  );
  const pettyCashLimit = Math.max(
    0,
    Number(formData.get("petty_cash_limit")) || 0
  );

  const { error } = await supabase
    .from("settings")
    .update({ default_markup_pct: defaultMarkupPct, petty_cash_limit: pettyCashLimit })
    .eq("tenant_id", tenantId);

  if (error) return { error: "Gagal menyimpan: " + error.message };
  revalidatePath(`/super-admin/tenants/${tenantId}`);
  return {};
}

// ── Tambah user ke tenant (via Admin API) ────────────────────
export async function addUserToTenant(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await assertSuperAdmin();
  const adminClient = createAdminClient();

  const tenantId = formData.get("tenant_id") as string;
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = formData.get("role") as UserRole;

  if (!fullName || !email || !role) return { error: "Semua field wajib diisi" };
  if (!["owner", "admin", "mechanic"].includes(role))
    return { error: "Role tidak valid" };

  // Invite user — trigger handle_new_user() akan auto-buat profile
  // dengan role & tenant_id dari metadata
  const { error: inviteErr } =
    await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, role, tenant_id: tenantId },
    });
  if (inviteErr) return { error: "Gagal mengundang: " + inviteErr.message };

  revalidatePath(`/super-admin/tenants/${tenantId}`);
  return { success: `Undangan berhasil dikirim ke ${email}` };
}

// ── Setujui pendaftaran tenant ────────────────────────────────
export async function approveRegistration(
  requestId: string
): Promise<ActionState> {
  const supabase = await assertSuperAdmin();
  const adminClient = createAdminClient();

  const { data: req } = await supabase
    .from("tenant_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (!req) return { error: "Permintaan tidak ditemukan" };
  if (req.status !== "pending") return { error: "Permintaan sudah diproses" };

  // Generate slug unik dari nama bisnis
  const baseSlug = req.business_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const { count } = await adminClient
    .from("tenants")
    .select("*", { count: "exact", head: true })
    .like("slug", `${baseSlug}%`);
  const slug = count && count > 0 ? `${baseSlug}-${count}` : baseSlug;

  // Buat tenant
  const { data: tenant, error: tenantErr } = await adminClient
    .from("tenants")
    .insert({
      name: req.business_name,
      slug,
      is_active: true,
      feature_toggles: {
        module_ledger: true,
        module_petty_cash: true,
        module_mechanic_portal: true,
        module_customer_history: true,
      },
    })
    .select("id")
    .single();
  if (tenantErr || !tenant) return { error: "Gagal membuat tenant: " + (tenantErr?.message ?? "") };

  // Buat settings default
  await adminClient
    .from("settings")
    .insert({ tenant_id: tenant.id, default_markup_pct: 20, petty_cash_limit: 500000 });

  // Undang pemilik bengkel — trigger handle_new_user() auto-buat profile owner
  const { error: inviteErr } =
    await adminClient.auth.admin.inviteUserByEmail(req.email, {
      data: { full_name: req.owner_name, role: "owner", tenant_id: tenant.id },
    });
  if (inviteErr) {
    await adminClient.from("tenants").delete().eq("id", tenant.id);
    return { error: "Gagal mengundang pemilik: " + inviteErr.message };
  }

  // Update status request
  const { data: { user } } = await supabase.auth.getUser();
  await adminClient
    .from("tenant_requests")
    .update({ status: "approved", reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() })
    .eq("id", requestId);

  revalidatePath("/super-admin/registrations");
  revalidatePath("/super-admin/dashboard");
  return {};
}

// ── Tolak pendaftaran tenant ──────────────────────────────────
export async function rejectRegistration(
  requestId: string,
  rejectionNote: string
): Promise<ActionState> {
  const supabase = await assertSuperAdmin();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("tenant_requests")
    .update({
      status: "rejected",
      rejection_note: rejectionNote || null,
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) return { error: "Gagal memperbarui status: " + error.message };
  revalidatePath("/super-admin/registrations");
  return {};
}

