"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Wallet,
  Menu,
  X,
  Plus,
  LogOut,
} from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import type { NavItem } from "./types";

interface AdminMobileNavProps {
  navItems: NavItem[];
  tenantName?: string | null;
  userFullName: string;
  hasKas: boolean;
}

export function AdminMobileNav({
  navItems,
  tenantName,
  userFullName,
  hasKas,
}: AdminMobileNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => { setDrawerOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* ── Bottom Bar ──────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
        <div className="relative mx-3 mb-3 flex h-16 items-center justify-around rounded-2xl bg-white shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-gray-100">

          {/* Menu drawer */}
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

          {/* Dashboard */}
          <Link
            href="/admin/dashboard"
            prefetch
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors",
              isActive("/admin/dashboard") && !drawerOpen ? "text-primary" : "text-gray-400"
            )}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span>Dashboard</span>
          </Link>

          {/* FAB — Buat Invoice */}
          <div className="flex flex-1 flex-col items-center">
            <Link
              href="/admin/invoices/new"
              prefetch
              className={cn(
                "absolute -top-6 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95",
                isActive("/admin/invoices") && !drawerOpen
                  ? "bg-primary"
                  : "bg-gray-900 hover:bg-gray-700"
              )}
              title="Buat Invoice Baru"
            >
              <Plus className="h-7 w-7 text-white" />
            </Link>
            <span className="mt-7 text-xs font-medium text-gray-400">Invoice</span>
          </div>

          {/* Pengeluaran / Kas */}
          {hasKas ? (
            <Link
              href="/admin/kas"
              prefetch
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors",
                isActive("/admin/kas") && !drawerOpen ? "text-primary" : "text-gray-400"
              )}
            >
              <Wallet className="h-5 w-5" />
              <span>Keluar</span>
            </Link>
          ) : (
            <Link
              href="/admin/invoices"
              prefetch
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors",
                isActive("/admin/invoices") && !drawerOpen && !isActive("/admin/invoices/new") ? "text-primary" : "text-gray-400"
              )}
            >
              <FileText className="h-5 w-5" />
              <span>Invoice</span>
            </Link>
          )}

          {/* Empty slot / right-most */}
          <div className="flex flex-1 flex-col items-center py-2" />
        </div>
      </nav>

      {/* ── Drawer Overlay ──────────────────────────────────── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Drawer Sheet ────────────────────────────────────── */}
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
        <div className="overflow-y-auto px-4 pb-8">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    prefetch
                    onMouseEnter={() => router.prefetch(item.href)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <span className={active ? "text-primary" : "text-gray-400"}>
                      {item.icon}
                    </span>
                    {item.label}
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
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
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
