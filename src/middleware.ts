import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/middleware";
import type { UserRole, Profile } from "@/types/database";

// ============================================================
// ROUTE ACCESS MATRIX
// Defines which roles are allowed on which path prefixes.
// Order matters: more specific paths should come first.
// ============================================================

const PROTECTED_ROUTES: { prefix: string; allowed: UserRole[] }[] = [
  // Super Admin portal — platform owner only
  { prefix: "/super-admin", allowed: ["super_admin"] },

  // Owner portal — main business dashboard, kas, settings
  { prefix: "/owner", allowed: ["owner"] },

  // Admin / Cashier portal — running invoices, petty cash
  { prefix: "/admin", allowed: ["admin"] },

  // Mechanic portal — assigned work orders, receipt upload
  { prefix: "/mechanic", allowed: ["mechanic"] },
];

// Role → default landing page after login
const ROLE_HOME: Record<UserRole, string> = {
  super_admin: "/super-admin/dashboard",
  owner: "/owner/dashboard",
  admin: "/admin/dashboard",
  mechanic: "/mechanic/dashboard",
};

// Public routes that do NOT require authentication
// `/print/*` sengaja dibuat publik agar link preview yang dishare ke pelanggan
// (mis. via WhatsApp) bisa dibuka tanpa login dan menampilkan status realtime.
const PUBLIC_PATHS = ["/", "/login", "/error", "/register", "/auth/callback", "/auth/set-password", "/auth/exchange", "/print"];

// Auth-flow paths: accessible even when authenticated (invite/reset flows)
const AUTH_FLOW_PATHS = ["/auth/callback", "/auth/set-password", "/auth/exchange"];

// ============================================================
// MIDDLEWARE
// ============================================================

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. Refresh session cookie (must always run) ────────────
  const { supabase, response } = await createClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── 2. Allow public paths unconditionally ──────────────────
  const isPublicPath = PUBLIC_PATHS.some((p) =>
    p === "/" ? pathname === "/" : pathname.startsWith(p)
  );
  if (isPublicPath) {
    // Auth-flow paths (callback, set-password) must always be reachable even when
    // authenticated — the invite/password-reset flow depends on them.
    // /print/* juga harus tetap reachable saat login agar owner bisa preview.
    const isAuthFlow = AUTH_FLOW_PATHS.some((p) => pathname.startsWith(p));
    const isPrint = pathname.startsWith("/print");
    if (!isAuthFlow && !isPrint && user) {
      // Already logged in on a login/register page → send to role home
      const profile = await getProfile(supabase, user.id);
      if (profile?.role) {
        return NextResponse.redirect(
          new URL(ROLE_HOME[profile.role], request.url)
        );
      }
    }
    return response;
  }

  // ── 3. Unauthenticated user → login ───────────────────────
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── 4. Fetch user profile (role + tenant) ─────────────────
  const profile = await getProfile(supabase, user.id);

  // Profile missing (edge case: auth user exists but no profile row)
  if (!profile) {
    return NextResponse.redirect(new URL("/error?reason=no_profile", request.url));
  }

  const userRole = profile.role as UserRole;

  // ── 5. Root path → redirect to role home ──────────────────
  if (pathname === "/") {
    return NextResponse.redirect(new URL(ROLE_HOME[userRole], request.url));
  }

  // ── 6. Check route-level access control ───────────────────
  const matchedRoute = PROTECTED_ROUTES.find((r) =>
    pathname.startsWith(r.prefix)
  );

  if (matchedRoute && !matchedRoute.allowed.includes(userRole)) {
    // User is authenticated but accessing a route they are not allowed on.
    // Redirect them to their own home, not a 403 page.
    return NextResponse.redirect(new URL(ROLE_HOME[userRole], request.url));
  }

  // ── 7. Active tenant check (non-super_admin users) ────────
  if (userRole !== "super_admin" && !profile.tenant_id) {
    return NextResponse.redirect(
      new URL("/error?reason=no_tenant", request.url)
    );
  }

  return response;
}

// ── Helper: fetch minimal profile from Supabase ─────────────
async function getProfile(
  supabase: Awaited<ReturnType<typeof createClient>>["supabase"],
  userId: string
): Promise<Pick<Profile, "role" | "tenant_id" | "is_active"> | null> {
  const { data } = await supabase
    .from("profiles")
    .select("role, tenant_id, is_active")
    .eq("id", userId)
    .single();

  return data as Pick<Profile, "role" | "tenant_id" | "is_active"> | null;
}

// ============================================================
// MATCHER — which paths does middleware run on?
// Excludes Next.js internals and static files.
// ============================================================

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static  (static files)
     * - _next/image   (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - Any file with an extension (images, fonts, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
