"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardList,
  UploadCloud,
  Menu,
  X,
  UserCircle2,
  BookOpen,
  Star,
  Wallet,
  ReceiptText,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { label: string; href: string; icon: React.ReactNode };

const NAV_LINKS: Item[] = [
  { label: "Work Order", href: "/mechanic/dashboard", icon: <ClipboardList className="h-5 w-5" /> },
  { label: "Upload Struk", href: "/mechanic/receipts", icon: <UploadCloud className="h-5 w-5" /> },
];

const MENU_ITEMS: Item[] = [
  { label: "Profile", href: "/mechanic/profile", icon: <UserCircle2 className="h-4 w-4" /> },
  { label: "Piutang Saya", href: "/mechanic/debts", icon: <BookOpen className="h-4 w-4" /> },
  { label: "Point", href: "/mechanic/dashboard?tab=point", icon: <Star className="h-4 w-4" /> },
  { label: "Dompet (Kasbon)", href: "/mechanic/wallet", icon: <Wallet className="h-4 w-4" /> },
  { label: "Slip Gaji", href: "/mechanic/payslips", icon: <ReceiptText className="h-4 w-4" /> },
];

export function MechanicBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white">
        <ul className="flex h-16 items-center justify-around">
          {NAV_LINKS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  prefetch
                  onMouseEnter={() => router.prefetch(item.href)}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2 text-xs font-medium transition-colors",
                    isActive ? "text-primary" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
          {/* Toggle menu list sidebar */}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setOpen((p) => !p)}
              aria-label="Buka menu"
              className={cn(
                "flex w-full flex-col items-center gap-1 py-2 text-xs font-medium transition-colors",
                open ? "text-primary" : "text-gray-400 hover:text-gray-600"
              )}
            >
              <span>{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</span>
              <span>Menu</span>
            </button>
          </li>
        </ul>
      </nav>

      {open && (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-label="Tutup menu"
          />
          <aside className="absolute bottom-0 left-0 right-0 rounded-t-2xl border-t border-gray-200 bg-white pb-20 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <p className="text-sm font-semibold text-gray-900">Menu</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="p-3">
              <ul className="grid grid-cols-1 gap-1">
                {MENU_ITEMS.map((item) => {
                  const itemPath = item.href.split("?")[0];
                  const isActive = pathname === itemPath || pathname.startsWith(itemPath + "/");
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-blue-50 text-blue-700"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                        )}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
