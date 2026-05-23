import { getUserContext } from "@/lib/get-user-context";
import { Sidebar } from "@/components/layout/sidebar";
import {
  LayoutDashboard,
  Building2,
  Settings,
  ShieldCheck,
} from "lucide-react";
import type { NavItem } from "@/components/layout/types";

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/super-admin/dashboard", icon: LayoutDashboard },
  { label: "Kelola Tenant", href: "/super-admin/tenants", icon: Building2 },
  { label: "Pengaturan Platform", href: "/super-admin/settings", icon: Settings },
];

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let ctx;
  try {
    ctx = await getUserContext();
  } catch (e: unknown) {
    // Re-throw redirect signals so Next.js handles them
    if (
      e instanceof Error &&
      ((e as Error & { digest?: string }).digest?.startsWith("NEXT_REDIRECT") ||
        (e as Error).message === "NEXT_REDIRECT")
    ) {
      throw e;
    }
    // Show actual error for debugging
    const msg = e instanceof Error ? e.stack ?? e.message : String(e);
    return (
      <div style={{ padding: "32px", fontFamily: "monospace" }}>
        <h1 style={{ color: "red" }}>SuperAdminLayout Error</h1>
        <pre style={{ background: "#f3f4f6", padding: "16px", borderRadius: "8px", whiteSpace: "pre-wrap", fontSize: "13px" }}>
          {msg}
        </pre>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        navItems={NAV_ITEMS}
        tenantName="Platform Admin"
        userFullName={ctx.fullName}
        userRole={ctx.role}
        accentClass="bg-slate-900 text-white"
      />

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center gap-3 border-b bg-white px-6">
          <ShieldCheck className="h-5 w-5 text-slate-600" />
          <span className="text-sm font-medium text-gray-600">
            Super Admin Panel
          </span>
        </header>

        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </main>
    </div>
  );
}
