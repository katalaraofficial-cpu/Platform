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
  { label: "Dashboard", href: "/super-admin/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: "Kelola Tenant", href: "/super-admin/tenants", icon: <Building2 className="h-4 w-4" /> },
  { label: "Pengaturan Platform", href: "/super-admin/settings", icon: <Settings className="h-4 w-4" /> },
];

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getUserContext();

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
