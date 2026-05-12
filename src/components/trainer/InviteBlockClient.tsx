// src/components/trainer/InviteBlockClient.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { regenerateInvite, revokeInvite } from "@/lib/actions/students";

interface Props {
  studentId: string;
  claimUrl: string;
  status: "pending" | "claimed" | "revoked";
  claimedAt: string | null;
}

export default function InviteBlockClient({ studentId, claimUrl, status, claimedAt }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(claimUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleRegenerate() {
    if (!confirm("Regenerate invite? Old link will stop working.")) return;
    startTransition(async () => {
      const res = await regenerateInvite(studentId);
      if (!res.success) alert(res.error);
      else router.refresh();
    });
  }

  function handleRevoke() {
    if (!confirm("Revoke invite?")) return;
    startTransition(async () => {
      const res = await revokeInvite(studentId);
      if (!res.success) alert(res.error);
      else router.refresh();
    });
  }

  const badge = {
    pending: { text: "Pending claim", className: "bg-secondary/20 text-secondary" },
    claimed: { text: "Claimed", className: "bg-primary/20 text-primary" },
    revoked: { text: "Revoked", className: "bg-error/20 text-error" },
  }[status];

  return (
    <section className="bg-surface-card rounded-2xl p-4 space-y-3 border border-border-dim">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Student invite</p>
        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${badge.className}`}>
          {badge.text}
        </span>
      </div>
      {status === "claimed" && claimedAt && (
        <p className="text-xs text-on-surface-variant">Claimed {new Date(claimedAt).toLocaleString()}</p>
      )}
      {status === "pending" && (
        <>
          <div className="bg-surface-elevated rounded-xl p-3 flex items-center gap-2">
            <code className="text-xs text-on-surface flex-1 truncate">{claimUrl}</code>
            <button onClick={handleCopy} className="text-xs font-bold uppercase tracking-wider text-primary px-2">
              {copied ? "✓" : "Copy"}
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={handleRegenerate} disabled={isPending} className="flex-1 py-2 rounded-xl text-xs font-bold border border-border-dim text-on-surface disabled:opacity-40">
              Regenerate
            </button>
            <button onClick={handleRevoke} disabled={isPending} className="flex-1 py-2 rounded-xl text-xs font-bold border border-border-dim text-error disabled:opacity-40">
              Revoke
            </button>
          </div>
        </>
      )}
    </section>
  );
}
