"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  SquareStack,
  Image as ImageIcon,
  Settings,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard", shortLabel: "Početna", icon: LayoutDashboard },
  { href: "/admin/termini", label: "Termini", shortLabel: "Termini", icon: Calendar },
  { href: "/admin/usluge", label: "Usluge", shortLabel: "Usluge", icon: SquareStack },
  { href: "/admin/galerija", label: "Galerija", shortLabel: "Galerija", icon: ImageIcon },
  { href: "/admin/postavke", label: "Postavke", shortLabel: "Više", icon: Settings },
] as const;

type Props = {
  userEmail: string | null;
  children: React.ReactNode;
};

export function AdminShell({ userEmail, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const sb = createClient();
    await sb.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen bg-stone-50 pb-28 md:pb-0">
      {/* Sidebar — desktop */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-cream bg-white md:flex">
        <div className="border-b border-cream px-6 py-6">
          <div className="flex items-center gap-3">
            <span className="font-display text-2xl font-semibold tracking-[0.15em] text-dark">
              UP
            </span>
            <div>
              <p className="text-[11px] font-medium text-dark">Beauty Studio</p>
              <p className="text-[9px] uppercase tracking-[0.2em] text-light">
                Admin Panel
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "mb-0.5 flex items-center gap-3 rounded px-3.5 py-2.5 text-[13px] transition-colors",
                  active
                    ? "bg-warm font-medium text-rose"
                    : "text-body hover:bg-stone-50",
                )}
              >
                <Icon
                  size={16}
                  strokeWidth={1.8}
                  className={active ? "text-rose" : "text-light"}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-cream p-3">
          <div className="mb-2 rounded bg-stone-50 px-3 py-2">
            <p className="truncate text-[10px] uppercase tracking-wider text-light">
              Prijavljen/a
            </p>
            <p className="truncate text-[11px] text-dark">{userEmail}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded px-3.5 py-2 text-[12px] text-light transition-colors hover:bg-stone-50 hover:text-rose cursor-pointer"
          >
            <LogOut size={14} strokeWidth={1.8} />
            Odjavi se
          </button>
        </div>
      </aside>

      {/* Main content. pt-safe rezerviše prostor za iPhone notch/dynamic
          island u PWA standalone modu (viewport-fit=cover ekstenduje view
          iza statusbar-a). Desktop dobija md:pt-0 jer ima sidebar koji
          počinje od vrha ekrana — main je flex sibling i ne treba ofset. */}
      <main className="flex-1 overflow-x-hidden pt-safe md:pt-0">{children}</main>

      {/* Bottom nav — mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-cream bg-white pb-safe md:hidden">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-3 text-[9px] uppercase tracking-wider transition-colors",
                active ? "text-rose" : "text-light",
              )}
            >
              <Icon size={18} strokeWidth={1.8} />
              {item.shortLabel}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
