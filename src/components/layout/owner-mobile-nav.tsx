"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Wallet,
  Settings,
  Menu,
  X,
  Plus,
  FileText,
  Users,
  Wrench,
  PiggyBank,
  UserCog,
  LogOut,
} from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import type { NavItem } from "./types";

interface OwnerMobileNavProps {
  navItems: NavItem[];
  tenantName?: string | null;
  userFullName: string;
  /** Base path for the quick-create invoice link */
  newInvoiceHref?: string;
}

const FIXED_NAV: Array<{
  key: "dashboard" | "kas" | "settings";
  label: string;
  href: string;
  icon: React.ReactNode;
}> = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/owner/dashboard",
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    key: "kas",
    label: "Kas",
    href: "/owner/kas",
    icon: <Wallet className="h-5 w-5" />,
  },
  {
    key: "settings",
    label: "Pengaturan",
    href: "/owner/settings",
    icon: <Settings className="h-5 w-5" />,
  },
];

export function OwnerMobileNav({
  navItems,
  tenantName,
  userFullName,
  newInvoiceHref = "/owner/invoices/new",
}: OwnerMobileNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on navigation
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Prevent scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* ── Bottom Nav Bar ─────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
        <div className="relative mx-3 mb-3 flex h-16 items-center justify-around rounded-2xl bg-white shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-gray-100">
          {/* 1 – Menu Drawer */}
          <button
            onClick={() => setDrawerOpen(true)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors",
              drawerOpen ? "text-primary" : "text-gray-400"
            )}
          >
            <Menu className="h-5 w-5" />
            <span>Menu</span>
          </button>

          {/* 2 – Dashboard */}
          <Link
            href="/owner/dashboard"
            prefetch
            onMouseEnter={() => router.prefetch("/owner/dashboard")}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors",
              isActive("/owner/dashboard") && !drawerOpen ? "text-primary" : "text-gray-400"
            )}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span>Dashboard</span>
          </Link>

          {/* 5 – Quick Invoice FAB (center) */}
          <div className="flex flex-1 flex-col items-center">
            <Link
              href={newInvoiceHref}
              prefetch
              onMouseEnter={() => router.prefetch(newInvoiceHref)}
              className={cn(
                "absolute -top-6 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95",
                isActive("/owner/invoices") && !drawerOpen
                  ? "bg-primary"
                  : "bg-gray-900 hover:bg-gray-700"
              )}
              title="Buat Invoice Baru"
            >
              <Plus className="h-7 w-7 text-white" />
            </Link>
            <span className="mt-7 text-xs font-medium text-gray-400">Invoice</span>
          </div>

          {/* 3 – Kas */}
          <Link
            href="/owner/kas"
            prefetch
            onMouseEnter={() => router.prefetch("/owner/kas")}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors",
              isActive("/owner/kas") && !drawerOpen ? "text-primary" : "text-gray-400"
            )}
          >
            <Wallet className="h-5 w-5" />
            <span>Kas</span>
          </Link>

          {/* 4 – Settings */}
          <Link
            href="/owner/settings"
            prefetch
            onMouseEnter={() => router.prefetch("/owner/settings")}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors",
              isActive("/owner/settings") && !drawerOpen ? "text-primary" : "text-gray-400"
            )}
          >
            <Settings className="h-5 w-5" />
            <span>Pengaturan</span>
          </Link>
        </div>
      </nav>

      {/* ── Drawer Overlay ─────────────────────────────────────── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Drawer Sheet ───────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-white shadow-2xl transition-transform duration-300 ease-out lg:hidden",
          drawerOpen ? "translate-y-0" : "translate-y-full"
        )}
        style={{ maxHeight: "85vh" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">{tenantName ?? "Menu"}</p>
            <p className="text-xs text-gray-400">{userFullName}</p>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav list */}
        <div className="overflow-y-auto px-4 pb-10">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    prefetch
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    <span className={active ? "text-primary" : "text-gray-400"}>
                      {item.icon}
                    </span>
                    {item.label}
                    {active && (
                      <span className="ml-auto h-2 w-2 rounded-full bg-primary" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Logout */}
          <div className="mt-4 border-t border-gray-100 pt-4">
            <form action={signOut}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Keluar
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
