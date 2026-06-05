"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PanelRightClose,
  PanelRightOpen,
  UserCircle2,
  BookOpen,
  Star,
  Wallet,
  ReceiptText,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PrivateSidebarToggleProps = {
  fullName: string;
};

type PrivateMenu = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

const PRIVATE_ITEMS: PrivateMenu[] = [
  {
    label: "Profile",
    href: "/mechanic/profile",
    icon: <UserCircle2 className="h-4 w-4" />,
  },
  {
    label: "Piutang",
    href: "/mechanic/debts",
    icon: <BookOpen className="h-4 w-4" />,
  },
  {
    label: "Point",
    href: "/mechanic/dashboard?tab=point",
    icon: <Star className="h-4 w-4" />,
  },
  {
    label: "Dompet (Kasbon)",
    href: "/mechanic/wallet",
    icon: <Wallet className="h-4 w-4" />,
  },
  {
    label: "Slip Gaji",
    href: "/mechanic/payslips",
    icon: <ReceiptText className="h-4 w-4" />,
  },
];

export function PrivateSidebarToggle({ fullName }: PrivateSidebarToggleProps) {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem("mechanic-private-sidebar-hidden");
    if (raw === "1") setHidden(true);
  }, []);

  function toggleVisibility() {
    setHidden((prev) => {
      const next = !prev;
      window.localStorage.setItem("mechanic-private-sidebar-hidden", next ? "1" : "0");
      if (next) setOpen(false);
      return next;
    });
  }

  if (hidden) {
    return (
      <button
        type="button"
        onClick={toggleVisibility}
        className="rounded-full p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-500 transition-colors"
        title="Unhide panel pribadi"
        aria-label="Unhide panel pribadi"
      >
        <PanelRightOpen className="h-4 w-4" />
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        title={open ? "Sembunyikan panel pribadi" : "Tampilkan panel pribadi"}
        aria-label={open ? "Sembunyikan panel pribadi" : "Tampilkan panel pribadi"}
      >
        <PanelRightClose className="h-4 w-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-label="Tutup panel pribadi"
          />
          <aside className="absolute right-0 top-0 h-full w-72 border-l border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">Panel Pribadi</p>
                <p className="text-sm font-semibold text-gray-900">{fullName}</p>
              </div>
              <button
                type="button"
                onClick={toggleVisibility}
                className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50"
              >
                Hide
              </button>
            </div>

            <nav className="p-3">
              <ul className="space-y-1">
                {PRIVATE_ITEMS.map((item) => {
                  const itemPath = item.href.split("?")[0];
                  const isActive = pathname === itemPath || pathname.startsWith(itemPath + "/");
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
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
