"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type ActionState = { error?: string };

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
