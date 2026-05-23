import { getUserContext } from "@/lib/get-user-context";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { signOut } from "@/lib/actions/auth";
import { ClipboardList, UploadCloud, BookOpen, LogOut } from "lucide-react";
import type { NavItem } from "@/components/layout/types";

const NAV_ITEMS: NavItem[] = [
  { label: "Work Order", href: "/mechanic/dashboard", icon: ClipboardList },
  { label: "Upload Struk", href: "/mechanic/receipts", icon: UploadCloud },
  { label: "Piutang Saya", href: "/mechanic/debts", icon: BookOpen },
];

export default async function MechanicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getUserContext();

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* ── Top header ── */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-white px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">
            P
          </div>
          <span className="text-sm font-semibold text-gray-900">
            {ctx.tenantName ?? "POS Workshop"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-medium text-gray-900 leading-tight">
              {ctx.fullName}
            </p>
            <p className="text-xs text-gray-400 leading-tight">Mekanik</p>
          </div>

          {/* Logout */}
          <form action={signOut}>
            <button
              type="submit"
              title="Keluar"
              className="rounded-full p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </header>

      {/* ── Page content ── */}
      {/* pb-20 to clear the fixed bottom nav */}
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="mx-auto max-w-lg px-4 py-4">{children}</div>
      </main>

      {/* ── Bottom navigation ── */}
      <MobileBottomNav navItems={NAV_ITEMS} />
    </div>
  );
}
