"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { updateStudentProfile } from "@/lib/actions/students";
import type { DashboardProfile } from "@/lib/dashboard/data";

export default function InlineProfileHeader({ profile }: { profile: DashboardProfile }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");

  function handleSave() {
    startTransition(async () => {
      const res = await updateStudentProfile(profile.id, {
        full_name: fullName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      });
      if (!res.success) {
        alert(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  const displayName = profile.full_name || profile.email || "Unnamed";
  const initials = displayName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  if (editing) {
    return (
      <div className="bg-surface-card rounded-2xl p-4 space-y-3">
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Full name"
          className="w-full bg-surface-elevated rounded-xl p-3 text-sm text-on-surface border border-border-dim focus:border-primary focus:outline-none"
        />
        <input
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="Avatar URL (optional)"
          className="w-full bg-surface-elevated rounded-xl p-3 text-sm text-on-surface border border-border-dim focus:border-primary focus:outline-none"
        />
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={isPending} className="flex-1 py-2 rounded-xl font-bold text-xs kinetic-gradient text-on-primary disabled:opacity-40">
            {isPending ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setFullName(profile.full_name ?? "");
              setAvatarUrl(profile.avatar_url ?? "");
            }}
            className="flex-1 py-2 rounded-xl font-bold text-xs border border-border-dim text-on-surface"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="w-full flex items-center gap-4 text-left active:opacity-80">
      <div className="w-14 h-14 rounded-full bg-surface-card border-2 border-primary flex items-center justify-center overflow-hidden">
        {profile.avatar_url ? (
          <Image src={profile.avatar_url} alt="" width={56} height={56} className="w-full h-full object-cover" />
        ) : (
          <span className="text-lg font-bold text-on-surface">{initials}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.2em]">
          Trainer admin · tap to edit
        </p>
        <h1 className="text-2xl font-black tracking-tight truncate">{displayName}</h1>
        {profile.email && <p className="text-on-surface-variant text-xs truncate">{profile.email}</p>}
      </div>
      <span className="material-symbols-outlined text-on-surface-variant opacity-40">edit</span>
    </button>
  );
}
