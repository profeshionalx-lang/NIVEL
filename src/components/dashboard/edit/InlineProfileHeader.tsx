"use client";
import type { DashboardProfile } from "@/lib/dashboard/data";
export default function InlineProfileHeader({ profile }: { profile: DashboardProfile }) {
  return (
    <div>
      <p className="text-on-surface-variant text-sm font-medium">Trainer admin</p>
      <h1 className="text-4xl font-black tracking-tighter leading-none mt-0.5">
        {profile.full_name || profile.email || "Unnamed"}
      </h1>
    </div>
  );
}
