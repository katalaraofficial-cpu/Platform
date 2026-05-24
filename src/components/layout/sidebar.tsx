"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/actions/auth";
import { LogOut, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { NavItem } from "./types";
import { useState } from "react";

interface SidebarProps {
  navItems: NavItem[];
  tenantName?: string | null;
  userFullName: string;
  userRole: string;
  /** Accent colour class for the active nav item background */
  accentClass?: string;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  owner: "Pemilik",
  admin: "Kasir",
  mechanic: "Mekanik",
};

export function Sidebar({
  navItems,
  tenantName,
  userFullName,
  userRole,
  accentClass = "bg-primary/10 text-primary",
}: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r bg-white transition-all duration-200",
        collapsed ? "w-14" : "w-60"
      )}
    >
      {/* ── Header ── */}
      <div className="flex h-16 items-center border-b px-3 gap-2">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
          P
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">
              {tenantName ?? "POS Workshop"}
            </p>
            <p className="text-xs text-gray-400">{ROLE_LABELS[userRole] ?? userRole}</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Buka sidebar" : "Tutup sidebar"}
          className={cn(
            "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md",
            "text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors",
            collapsed && "mx-auto"
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
                    collapsed ? "justify-center" : "",
                    isActive
                      ? accentClass
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  <span
                    className={cn(
                      "flex-shrink-0",
                      isActive ? "" : "text-gray-400 group-hover:text-gray-600"
                    )}
                  >
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {isActive && (
                        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
                      )}
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── User footer ── */}
      <div className="border-t p-2">
        {!collapsed && (
          <div className="mb-1 flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600">
              {userFullName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{userFullName}</p>
              <p className="truncate text-xs text-gray-400">
                {ROLE_LABELS[userRole] ?? userRole}
              </p>
            </div>
          </div>
        )}
        <form action={signOut}>
          <button
            type="submit"
            title={collapsed ? "Keluar" : undefined}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm text-gray-600",
              "hover:bg-red-50 hover:text-red-600 transition-colors",
              collapsed && "justify-center"
            )}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>Keluar</span>}
          </button>
        </form>
      </div>
    </aside>
  );
}

