"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createShadowStudent } from "@/lib/actions/students";

export default function CreateStudentButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [fullName, setFullName] = useState("");
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleCreate() {
    if (!fullName.trim()) return;
    startTransition(async () => {
      try {
        const res = await createShadowStudent({ full_name: fullName.trim() });
        setCreatedUrl(res.claimUrl);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to create student");
      }
    });
  }

  function handleCopy() {
    if (!createdUrl) return;
    navigator.clipboard.writeText(createdUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClose() {
    setOpen(false);
    setFullName("");
    setCreatedUrl(null);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="kinetic-gradient text-on-primary font-black py-2 px-4 rounded-xl text-sm active:scale-[0.98] transition-transform">
        + Create student
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-background/80 flex items-end sm:items-center justify-center p-4" onClick={handleClose}>
          <div className="bg-surface-card rounded-3xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            {!createdUrl ? (
              <>
                <h3 className="text-lg font-black tracking-tight">New student</h3>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name"
                  autoFocus
                  className="w-full bg-surface-elevated rounded-xl p-3 text-sm text-on-surface border border-border-dim focus:border-primary focus:outline-none"
                />
                <div className="flex gap-2">
                  <button onClick={handleCreate} disabled={isPending || !fullName.trim()} className="flex-1 py-3 rounded-xl font-bold text-sm kinetic-gradient text-on-primary disabled:opacity-40">
                    {isPending ? "Creating…" : "Create"}
                  </button>
                  <button onClick={handleClose} className="flex-1 py-3 rounded-xl font-bold text-sm border border-border-dim text-on-surface">
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-black tracking-tight">Student created</h3>
                <p className="text-sm text-on-surface-variant">Share this link with the student to claim their profile:</p>
                <div className="bg-surface-elevated rounded-xl p-3 flex items-center gap-2">
                  <code className="text-xs text-on-surface flex-1 truncate">{createdUrl}</code>
                  <button onClick={handleCopy} className="text-xs font-bold uppercase tracking-wider text-primary px-2">
                    {copied ? "✓" : "Copy"}
                  </button>
                </div>
                <button onClick={handleClose} className="w-full py-3 rounded-xl font-bold text-sm kinetic-gradient text-on-primary">Done</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
