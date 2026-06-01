import { getUserContext } from "@/lib/get-user-context";
import { Sidebar } from "@/components/layout/sidebar";
import { AdminMobileNav } from "@/components/layout/admin-mobile-nav";
import {
  LayoutDashboard,
  FileText,
  PiggyBank,
  Wallet,
  Wrench,
} from "lucide-react";
import type { NavItem } from "@/components/layout/types";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getUserContext();
  const toggles = ctx.featureToggles;

  // ── Admin nav ─────────────────────────────────────────────
  const hasKas = toggles?.module_kas !== false;

  const navItems: NavItem[] = [
    // Always visible
    { label: "Dashboard", href: "/admin/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: "Running Invoice", href: "/admin/invoices", icon: <FileText className="h-4 w-4" /> },

    // Toggle: module_petty_cash
    ...(toggles?.module_petty_cash !== false
      ? [{ label: "Kas Kecil", href: "/admin/petty-cash", icon: <PiggyBank className="h-4 w-4" /> }]
      : []),

    // Toggle: module_kas — admin can only record pengeluaran
    ...(hasKas
      ? [{ label: "Pengeluaran", href: "/admin/kas", icon: <Wallet className="h-4 w-4" /> }]
      : []),

    // Toggle: module_engineer — admin can process reimbursements
    ...(toggles?.module_engineer !== false
      ? [{ label: "Engineer", href: "/admin/reimburse", icon: <Wrench className="h-4 w-4" /> }]
      : []),

    // Pelanggan: hidden for admin role (owner-only feature)
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop Sidebar */}
      <Sidebar
        navItems={navItems}
        tenantName={ctx.tenantName}
        userFullName={ctx.fullName}
        userRole={ctx.role}
        accentClass="bg-primary/10 text-primary font-semibold"
        className="hidden lg:flex"
      />

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 pb-24 sm:p-6 sm:pb-6">{children}</div>
      </main>

      {/* Mobile Bottom Nav */}
      <AdminMobileNav
        navItems={navItems}
        tenantName={ctx.tenantName}
        userFullName={ctx.fullName}
        hasKas={hasKas}
      />
    </div>
  );
}
