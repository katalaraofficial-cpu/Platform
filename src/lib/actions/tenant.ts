"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { UserRole } from "@/types/database";

export type ActionState = { error?: string; success?: string; invite_link?: string };

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner (Pemilik Bengkel)",
  admin: "Admin / Kasir",
  mechanic: "Mekanik",
};

/** Kirim email undangan via Resend REST API. Tidak gagalkan action jika error. */
async function sendInviteEmail(
  email: string,
  fullName: string,
  role: string,
  inviteLink: string
) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Katalara POS <onboarding@resend.dev>",
      to: [email],
      subject: "Undangan Bergabung - Katalara POS",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#1e3a5f">Anda Diundang ke Katalara POS</h2>
          <p>Halo <strong>${fullName}</strong>,</p>
          <p>Anda telah diundang untuk bergabung sebagai <strong>${ROLE_LABELS[role] ?? role}</strong>
             di platform manajemen bengkel <strong>Katalara POS</strong>.</p>
          <p>Klik tombol di bawah untuk membuat password dan mulai menggunakan platform:</p>
          <p style="text-align:center;margin:28px 0">
            <a href="${inviteLink}"
               style="background:#2563eb;color:#fff;padding:13px 32px;border-radius:8px;
                      text-decoration:none;font-weight:600;display:inline-block;font-size:15px">
              Terima Undangan
            </a>
          </p>
          <p style="color:#6b7280;font-size:13px">Link ini berlaku selama 24 jam. Jika Anda tidak merasa diundang, abaikan email ini.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
          <p style="color:#9ca3af;font-size:12px">Katalara POS — Platform Manajemen Bengkel</p>
        </div>`,
    }),
  }).catch(() => {
    /* jangan gagalkan action jika email error */
  });
}

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

  // Generate invite link tanpa mengirim email (bypass SMTP/rate-limit issues).
  // Link diberikan ke admin untuk dikirim manual via WhatsApp / email.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://katalara-pos.vercel.app";
  const { data: linkData, error: linkErr } =
    await adminClient.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        data: { full_name: fullName, role, tenant_id: tenantId },
        redirectTo: `${siteUrl}/auth/callback?next=/auth/set-password`,
      },
    });
  if (linkErr || !linkData?.properties?.action_link)
    return { error: "Gagal membuat link undangan: " + (linkErr?.message ?? "unknown") };

  const inviteLink = linkData.properties.action_link;

  // Kirim email undangan via Resend (fire-and-forget, tidak gagalkan action)
  await sendInviteEmail(email, fullName, role, inviteLink);

  revalidatePath(`/super-admin/tenants/${tenantId}`);
  return {
    success: `Undangan berhasil dikirim ke ${email}`,
    invite_link: inviteLink,
  };
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

  // Generate invite link untuk pemilik bengkel (tanpa kirim email)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://katalara-pos.vercel.app";
  const { data: linkData, error: linkErr } =
    await adminClient.auth.admin.generateLink({
      type: "invite",
      email: req.email,
      options: {
        data: { full_name: req.owner_name, role: "owner", tenant_id: tenant.id },
        redirectTo: `${siteUrl}/auth/callback?next=/auth/set-password`,
      },
    });
  if (linkErr || !linkData?.properties?.action_link) {
    await adminClient.from("tenants").delete().eq("id", tenant.id);
    return { error: "Gagal membuat link undangan: " + (linkErr?.message ?? "unknown") };
  }

  const ownerInviteLink = linkData.properties.action_link;
  await sendInviteEmail(req.email, req.owner_name, "owner", ownerInviteLink);

  // Update status request
  const { data: { user } } = await supabase.auth.getUser();
  await adminClient
    .from("tenant_requests")
    .update({ status: "approved", reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() })
    .eq("id", requestId);

  revalidatePath("/super-admin/registrations");
  revalidatePath("/super-admin/dashboard");
  return {
    success: `Tenant berhasil dibuat. Undangan dikirim ke ${req.email}.`,
    invite_link: ownerInviteLink,
  };
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

// ── Hapus pengguna dari tenant (hapus auth user + cascade ke profile) ──
export async function removeUsersFromTenant(
  userIds: string[],
  tenantId: string
): Promise<ActionState> {
  await assertSuperAdmin();
  const adminClient = createAdminClient();

  if (!userIds.length) return { error: "Tidak ada pengguna yang dipilih" };

  const failed: string[] = [];
  for (const uid of userIds) {
    const { error } = await adminClient.auth.admin.deleteUser(uid);
    if (error) failed.push(error.message);
  }

  if (failed.length > 0)
    return { error: `${failed.length} pengguna gagal dihapus: ${failed[0]}` };

  revalidatePath(`/super-admin/tenants/${tenantId}`);
  return { success: `${userIds.length} pengguna berhasil dihapus` };
}

