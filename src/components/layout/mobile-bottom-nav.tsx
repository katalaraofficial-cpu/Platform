"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavItem } from "./types";

interface MobileBottomNavProps {
  navItems: NavItem[];
}

export function MobileBottomNav({ navItems }: MobileBottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white">
      <ul className="flex h-16 items-center justify-around">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 text-xs font-medium transition-colors",
                  isActive ? "text-primary" : "text-gray-400 hover:text-gray-600"
                )}
              >
                <span className={cn(isActive ? "text-primary" : "text-gray-400")}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
