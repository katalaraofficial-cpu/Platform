import { getUserContext } from "@/lib/get-user-context";
import { Sidebar } from "@/components/layout/sidebar";
import {
  LayoutDashboard,
  FileText,
  PiggyBank,
  Users,
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

  // ── Admin nav: NO access to Kas Utama or Mekanik Hutang ─────
  const navItems: NavItem[] = [
    // Always visible
    { label: "Dashboard", href: "/admin/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: "Running Invoice", href: "/admin/invoices", icon: <FileText className="h-4 w-4" /> },

    // Toggle: module_petty_cash
    ...(toggles?.module_petty_cash !== false
      ? [{ label: "Kas Kecil", href: "/admin/petty-cash", icon: <PiggyBank className="h-4 w-4" /> }]
      : []),

    // Toggle: module_engineer — admin can process reimbursements
    ...(toggles?.module_engineer !== false
      ? [{ label: "Engineer", href: "/admin/reimburse", icon: <Wrench className="h-4 w-4" /> }]
      : []),

    // Toggle: module_customer_history
    ...(toggles?.module_customer_history !== false
      ? [{ label: "Pelanggan", href: "/admin/customers", icon: <Users className="h-4 w-4" /> }]
      : []),
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
