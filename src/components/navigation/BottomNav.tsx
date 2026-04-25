"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/types";

interface BottomNavProps {
  role: UserRole;
}

interface Tab {
  label: string;
  icon: string;
  href: string;
  match: (path: string) => boolean;
  roles: UserRole[];
}

const tabs: Tab[] = [
  {
    label: "Home",
    icon: "home",
    href: "/dashboard",
    match: (p) => p === "/dashboard" || p.startsWith("/sessions") || p.startsWith("/goals"),
    roles: ["student", "trainer"],
  },
  {
    label: "Insights",
    icon: "auto_awesome",
    href: "/insights",
    match: (p) => p.startsWith("/insights"),
    roles: ["student", "trainer"],
  },
];

export default function BottomNav({ role }: BottomNavProps) {
  const pathname = usePathname();
  const visibleTabs = tabs.filter((tab) => tab.roles.includes(role));

  return (
    <nav
      className="glass-nav fixed bottom-0 left-1/2 -translate-x-1/2 z-30 w-full max-w-[430px] rounded-t-3xl border-t border-border-dim"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center justify-around px-2 py-2">
        {visibleTabs.map((tab) => {
          const isActive = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 rounded-2xl px-6 py-2 transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "opacity-50 text-on-surface-variant"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[24px] ${
                  isActive ? "fill-icon" : ""
                }`}
              >
                {tab.icon}
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
