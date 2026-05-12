"use client";

import { useState, useTransition } from "react";
import { connectPlaytomicProfile } from "@/lib/actions/playtomic";

interface Props {
  currentUserId: string | null;
}

/**
 * Shows a "Connect Playtomic" form when the user has no playtomic_user_id,
 * and a "Connected" badge with masked id when they do.
 *
 * Note: `currentUserId` is the playtomic_user_id (string | null),
 * NOT the Nivel profile id.
 */
export default function PlaytomicConnectBlock({ currentUserId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Already connected — show masked id
  if (currentUserId) {
    const masked =
      currentUserId.length > 6
        ? currentUserId.slice(0, 3) + "•••" + currentUserId.slice(-3)
        : currentUserId;

    return (
      <div className="bg-surface-card rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-0.5">
              Playtomic подключён
            </p>
            <p className="text-sm text-on-surface-variant font-mono">{masked}</p>
          </div>
          <span className="material-symbols-outlined text-primary text-2xl">check_circle</span>
        </div>
      </div>
    );
  }

  function handleConnect() {
    setError(null);
    startTransition(async () => {
      const result = await connectPlaytomicProfile(url);
      if (!result.success) {
        setError(result.error);
      }
      // On success, server action redirects to /matches — no extra client code needed
    });
  }

  return (
    <div className="bg-surface-card rounded-2xl p-4 space-y-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant mb-1">
          Подключи Playtomic
        </p>
        <p className="text-xs text-on-surface-variant">
          Вставь ссылку на свой профиль, чтобы видеть предстоящие матчи.
        </p>
      </div>

      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://app.playtomic.io/profile/users/…"
        className="w-full bg-surface-elevated rounded-xl p-3 text-sm text-on-surface border border-border-dim focus:border-primary focus:outline-none"
        disabled={isPending}
      />

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      <button
        onClick={handleConnect}
        disabled={isPending || !url.trim()}
        className="w-full py-2.5 rounded-xl font-black text-sm kinetic-gradient text-on-primary disabled:opacity-40"
      >
        {isPending ? "Подключение…" : "Подключить"}
      </button>
    </div>
  );
}
