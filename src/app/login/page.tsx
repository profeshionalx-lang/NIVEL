"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "Сессия истекла, попробуйте ещё раз.",
  auth_failed: "Не удалось войти. Попробуйте снова.",
  claim_invalid_token: "Ссылка-приглашение недействительна.",
  claim_expired: "Срок действия приглашения истёк.",
  claim_already_claimed: "Это приглашение уже использовано.",
  claim_email_collision: "Email уже привязан к другому профилю.",
  claim_uid_collision: "Этот аккаунт Google уже привязан к другому профилю. Возможно, вы уже зарегистрированы — попробуйте войти без ссылки-приглашения.",
  claim_firebase_invalid: "Ошибка проверки токена Firebase.",
};

function LoginContent() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  // Читаем claim из URL один раз и сразу убираем из адресной строки
  const claimRef = useRef(searchParams.get("claim"));
  const claimToken = claimRef.current;
  useEffect(() => {
    if (claimToken) {
      const url = new URL(window.location.href);
      url.searchParams.delete("claim");
      window.history.replaceState({}, "", url.toString());
    }
  }, [claimToken]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [tgLoading, setTgLoading] = useState(false);
  const [tgWaiting, setTgWaiting] = useState(false);
  const [tgError, setTgError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollDeadlineRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const handleTelegramLogin = async () => {
    setTgError(null);
    setTgLoading(true);
    stopPolling();
    try {
      const res = await fetch("/api/auth/telegram/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(claimToken ? { claimToken } : {}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const code: string = data.error ?? "";
        setTgError(ERROR_MESSAGES[code] ?? "Не удалось начать вход. Попробуйте снова.");
        return;
      }
      const { code, deepLink } = (await res.json()) as { code: string; deepLink: string };
      window.open(deepLink, "_blank");
      setTgWaiting(true);

      const POLL_INTERVAL_MS = 2000;
      const POLL_TIMEOUT_MS = 10 * 60_000;
      pollDeadlineRef.current = Date.now() + POLL_TIMEOUT_MS;

      pollTimerRef.current = setInterval(async () => {
        if (Date.now() > pollDeadlineRef.current) {
          stopPolling();
          setTgWaiting(false);
          setTgError("Время вышло, попробуйте ещё раз.");
          return;
        }
        try {
          const statusRes = await fetch(
            `/api/auth/telegram/status?code=${encodeURIComponent(code)}`
          );
          const data = (await statusRes.json()) as { status: "ok" | "pending" | "expired" };
          if (data.status === "ok") {
            stopPolling();
            window.location.href = "/dashboard";
          } else if (data.status === "expired") {
            stopPolling();
            setTgWaiting(false);
            setTgError("Время вышло, попробуйте ещё раз.");
          }
        } catch {
          // Transient network error — keep polling until the deadline.
        }
      }, POLL_INTERVAL_MS);
    } catch (err) {
      setTgError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setTgLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      const body: Record<string, string> = { idToken };
      if (claimToken) body.claimToken = claimToken;

      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const code: string = data.error ?? "auth_failed";
        setError(ERROR_MESSAGES[code] ?? "Ошибка входа");
        return;
      }
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  const displayError = error ?? (urlError ? (ERROR_MESSAGES[urlError] ?? urlError) : null);

  const grechkaAction = claimToken
    ? `/api/auth/grechka?claim=${encodeURIComponent(claimToken)}`
    : "/api/auth/grechka";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-12 text-center">
        {/* Logo */}
        <div>
          <h1 className="text-5xl font-black italic uppercase tracking-tighter kinetic-text">
            Nivel
          </h1>
          <p className="text-on-surface-variant text-sm mt-3">
            Падел-платформа для тренеров и игроков
          </p>
        </div>

        <div className="space-y-4">
          {/* Grechka Sign In */}
          <a
            href={grechkaAction}
            className="w-full flex items-center justify-center gap-3 bg-primary text-black font-semibold py-4 px-6 rounded-2xl hover:opacity-90 transition-opacity active:scale-[0.98]"
          >
            Войти через Гречку
          </a>

          {/* Google Sign In */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 font-semibold py-4 px-6 rounded-2xl hover:bg-gray-100 transition-colors active:scale-[0.98] disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {loading ? "Входим…" : "Войти через Google"}
          </button>

          {/* Telegram Sign In */}
          <button
            onClick={handleTelegramLogin}
            disabled={tgLoading || tgWaiting}
            className="w-full flex items-center justify-center gap-3 bg-[#229ED9] text-white font-semibold py-4 px-6 rounded-2xl hover:opacity-90 transition-opacity active:scale-[0.98] disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.94 4.36a1.5 1.5 0 0 0-1.53-.25L2.94 10.86a1.32 1.32 0 0 0 .1 2.49l4.6 1.44 1.78 5.72a1.1 1.1 0 0 0 1.83.44l2.55-2.4 4.5 3.32a1.29 1.29 0 0 0 2.05-.77l2.7-15.13a1.5 1.5 0 0 0-.51-1.35zM9.6 14.6l-1.24-3.98 9.6-6.13z" />
            </svg>
            {tgWaiting ? "Ждём подтверждения…" : tgLoading ? "Открываем Telegram…" : "Войти через Telegram"}
          </button>
          <p className="text-on-surface-variant text-xs">
            Откроется Telegram — нажми Start, и вход выполнится автоматически.
          </p>
          {tgError && <p className="text-error text-sm">{tgError}</p>}
        </div>

        {displayError && (
          <p className="text-error text-sm">{displayError}</p>
        )}

        <p className="text-on-surface-variant text-xs">
          Продолжая, вы соглашаетесь с условиями использования.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
