import { getUserContext } from "@/lib/get-user-context";
import { Sidebar } from "@/components/layout/sidebar";
import { OwnerMobileNav } from "@/components/layout/owner-mobile-nav";
import {
  LayoutDashboard,
  FileText,
  Wallet,
  Users,
  Wrench,
  PiggyBank,
  Settings,
  UserCog,
} from "lucide-react";
import type { NavItem } from "@/components/layout/types";

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getUserContext();
  const toggles = ctx.featureToggles;

  // ── Build nav dynamically based on feature toggles ──────────
  // Some items are always visible; others depend on toggles set by Super Admin.
  const navItems: NavItem[] = [
    // Always visible
    { label: "Dashboard", href: "/owner/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: "Running Invoice", href: "/owner/invoices", icon: <FileText className="h-4 w-4" /> },

    // Toggle: module_ledger — main cash management
    ...(toggles?.module_ledger !== false
      ? [{ label: "Kas & Keuangan", href: "/owner/kas", icon: <Wallet className="h-4 w-4" /> }]
      : []),

    // Toggle: module_customer_history
    ...(toggles?.module_customer_history !== false
      ? [{ label: "Pelanggan", href: "/owner/customers", icon: <Users className="h-4 w-4" /> }]
      : []),

    // Toggle: module_engineer — performa mekanik & reimburse
    ...(toggles?.module_engineer !== false
      ? [{ label: "Engineer", href: "/owner/mechanics", icon: <Wrench className="h-4 w-4" /> }]
      : []),

    // Toggle: module_petty_cash — owner can monitor petty cash
    ...(toggles?.module_petty_cash !== false
      ? [{ label: "Kas Kecil", href: "/owner/petty-cash", icon: <PiggyBank className="h-4 w-4" /> }]
      : []),

    // Always visible
    { label: "Pengaturan", href: "/owner/settings", icon: <Settings className="h-4 w-4" /> },

    // User management — always visible for owner
    { label: "Kelola Pengguna", href: "/owner/users", icon: <UserCog className="h-4 w-4" /> },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar – desktop only */}
      <Sidebar
        navItems={navItems}
        tenantName={ctx.tenantName}
        userFullName={ctx.fullName}
        userRole={ctx.role}
        accentClass="bg-primary/10 text-primary font-semibold"
        className="hidden lg:flex"
      />

      {/* Main content */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="border-b bg-white px-4 py-3 text-sm text-gray-500 lg:hidden">
          {ctx.tenantName} · {ctx.fullName}
        </div>
        {/* Extra bottom padding on mobile so content clears the bottom nav */}
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 lg:p-6 lg:pb-6">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <OwnerMobileNav
        navItems={navItems}
        tenantName={ctx.tenantName}
        userFullName={ctx.fullName}
        newInvoiceHref="/owner/invoices/new"
      />
    </div>
  );
}
