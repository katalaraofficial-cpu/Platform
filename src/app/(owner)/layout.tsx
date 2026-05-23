import { getUserContext } from "@/lib/get-user-context";
import { Sidebar } from "@/components/layout/sidebar";
import {
  LayoutDashboard,
  FileText,
  Wallet,
  Users,
  Wrench,
  PiggyBank,
  Settings,
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
    { label: "Dashboard", href: "/owner/dashboard", icon: LayoutDashboard },
    { label: "Running Invoice", href: "/owner/invoices", icon: FileText },

    // Toggle: module_ledger — main cash management
    ...(toggles?.module_ledger !== false
      ? [{ label: "Kas & Keuangan", href: "/owner/kas", icon: Wallet }]
      : []),

    // Toggle: module_customer_history
    ...(toggles?.module_customer_history !== false
      ? [{ label: "Pelanggan", href: "/owner/customers", icon: Users }]
      : []),

    // Toggle: module_mechanic_portal — mechanic & debt management
    ...(toggles?.module_mechanic_portal !== false
      ? [{ label: "Mekanik & Hutang", href: "/owner/mechanics", icon: Wrench }]
      : []),

    // Toggle: module_petty_cash — owner can monitor petty cash
    ...(toggles?.module_petty_cash !== false
      ? [{ label: "Kas Kecil", href: "/owner/petty-cash", icon: PiggyBank }]
      : []),

    // Always visible
    { label: "Pengaturan", href: "/owner/settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        navItems={navItems}
        tenantName={ctx.tenantName}
        userFullName={ctx.fullName}
        userRole={ctx.role}
        accentClass="bg-primary/10 text-primary font-semibold"
      />

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </main>
    </div>
  );
}
