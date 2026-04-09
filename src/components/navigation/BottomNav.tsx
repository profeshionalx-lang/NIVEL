"use client";

import Link from "next/link";
import type { UserRole } from "@/lib/types";

interface BottomNavProps {
  role: UserRole;
  currentPath: string;
}

interface Tab {
  label: string;
  icon: string;
  href: string;
  roles: UserRole[];
}

const tabs: Tab[] = [
  { label: "Прогресс", icon: "person", href: "/dashboard", roles: ["student", "trainer"] },
  { label: "Занятия", icon: "event_note", href: "/sessions", roles: ["student", "trainer"] },
  { label: "Цели", icon: "emoji_events", href: "/goals/new", roles: ["student", "trainer"] },
  { label: "Ученики", icon: "groups", href: "/trainer/students", roles: ["trainer"] },
];

export default function BottomNav({ role, currentPath }: BottomNavProps) {
  const visibleTabs = tabs.filter((tab) => tab.roles.includes(role));

  return (
    <nav className="glass-nav fixed bottom-0 left-1/2 -translate-x-1/2 z-30 w-full max-w-[430px] lg:max-w-full rounded-t-3xl border-t border-border-dim">
      <div className="flex items-center justify-around px-2 py-2">
        {visibleTabs.map((tab) => {
          const isActive = currentPath === tab.href || currentPath.startsWith(tab.href + "/");

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 rounded-2xl px-4 py-2 transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "opacity-50 text-on-surface-variant"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[22px] ${
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
