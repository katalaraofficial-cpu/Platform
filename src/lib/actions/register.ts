"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export type RegisterState = { error?: string; success?: boolean };

export async function submitRegistration(
  _prev: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const businessName = String(formData.get("business_name") ?? "").trim();
  const ownerName = String(formData.get("owner_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = (formData.get("phone") as string) || null;
  const city = (formData.get("city") as string) || null;
  const message = (formData.get("message") as string) || null;

  if (!businessName || !ownerName || !email) {
    return { error: "Nama bengkel, nama pemilik, dan email wajib diisi" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Format email tidak valid" };
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.from("tenant_requests").insert({
    business_name: businessName,
    owner_name: ownerName,
    email,
    phone,
    city,
    message,
    status: "pending",
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Email ini sudah terdaftar dan sedang dalam proses tinjauan." };
    }
    return { error: "Gagal mengirim pendaftaran. Silakan coba lagi." };
  }

  return { success: true };
}
