import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { FeatureToggles, UserRole } from "@/types/database";

export interface UserContext {
  id: string;
  fullName: string;
  role: UserRole;
  tenantId: string | null;
  tenantName: string | null;
  featureToggles: FeatureToggles | null;
}

/**
 * Server-side helper — fetches the authenticated user's profile and tenant.
 * Redirects to /login if not authenticated.
 * Call this at the top of each role-specific layout.
 */
export async function getUserContext(): Promise<UserContext> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Explicit shape for the join query result
  type ProfileWithTenant = {
    id: string;
    full_name: string;
    role: string;
    tenant_id: string | null;
    tenants: { name: string; feature_toggles: FeatureToggles } | null;
  };

  // Fetch profile with tenant info in a single join
  const { data: rawProfile } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      role,
      tenant_id,
      tenants (
        name,
        feature_toggles
      )
    `)
    .eq("id", user.id)
    .single();

  const profile = rawProfile as unknown as ProfileWithTenant | null;

  if (!profile) {
    redirect("/error?reason=no_profile");
  }

  return {
    id: profile.id,
    fullName: profile.full_name,
    role: profile.role as UserRole,
    tenantId: profile.tenant_id,
    tenantName: profile.tenants?.name ?? null,
    featureToggles: profile.tenants?.feature_toggles ?? null,
  };
}
