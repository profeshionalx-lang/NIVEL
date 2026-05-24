"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startTelegramLink, unlinkTelegram } from "@/lib/actions/telegram";

type Props = {
  linked: boolean;
  username: string | null;
};

export default function TelegramLinkCardClient({ linked, username }: Props) {
  const router = useRouter();
  const [pending, startT] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onConnect = () => {
    setError(null);
    startT(async () => {
      const res = await startTelegramLink();
      if (!res.success) {
        setError(res.error);
        return;
      }
      window.open(res.url, "_blank", "noopener");
    });
  };

  const onUnlink = () => {
    setError(null);
    startT(async () => {
      const res = await unlinkTelegram();
      if (!res.success) {
        setError(res.error ?? "Не удалось отключить");
        return;
      }
      router.refresh();
    });
  };

  if (linked) {
    return (
      <div className="rounded-2xl bg-surface-container p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl">✅</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Telegram подключён</p>
            {username && (
              <p className="text-xs text-on-surface-variant truncate">@{username}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onUnlink}
          disabled={pending}
          className="min-h-11 px-3 text-sm text-on-surface-variant disabled:opacity-50"
        >
          Отключить
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-surface-container p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold">Подключи Telegram</p>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Бот напишет, когда тренер пришлёт новые разборы и за 2 часа до тренировки.
        </p>
        <p className="text-[10px] text-on-surface-variant/70 mt-1">
          Ссылка одноразовая и действует 15 минут — не пересылай её другим.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onConnect}
          disabled={pending}
          className="flex-1 min-h-11 rounded-xl bg-primary text-on-primary text-sm font-semibold disabled:opacity-50"
        >
          {pending ? "Открываю…" : "Подключить Telegram"}
        </button>
        <button
          type="button"
          onClick={() => router.refresh()}
          disabled={pending}
          className="min-h-11 px-3 text-sm text-on-surface-variant disabled:opacity-50"
          aria-label="Обновить статус"
          title="Обновить статус"
        >
          ↻
        </button>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
