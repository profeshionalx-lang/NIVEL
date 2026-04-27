"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<"grechka" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorParam = searchParams.get("error");

  async function handleGoogleLogin() {
    setError(null);
    setLoading("google");
    try {
      const cred = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
      const idToken = await cred.user.getIdToken();
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) throw new Error("Session failed");
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      const message = (err as { message?: string }).message ?? String(err);
      console.error("[google-login]", code, message);
      if (code !== "auth/popup-closed-by-user") {
        setError(message || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-10 text-center">

        <div>
          <h1 className="text-5xl font-black italic uppercase tracking-tighter kinetic-text">
            Nivel
          </h1>
          <p className="text-on-surface-variant text-sm mt-3">
            Padel coaching platform
          </p>
        </div>

        <div className="space-y-3">
          {/* Sign in with Гречка */}
          <a
            href="/api/auth/grechka"
            onClick={() => setLoading("grechka")}
            className="w-full flex items-center justify-center gap-3 kinetic-gradient text-on-primary font-black py-4 px-6 rounded-2xl text-base active:scale-[0.98] transition-transform"
            style={{ boxShadow: "0 10px 30px rgba(202,253,0,0.25), 0 4px 12px rgba(0,0,0,0.4)" }}
          >
            {loading === "grechka" ? (
              <span className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="text-xl font-black">Г</span>
            )}
            Sign in with Гречка
          </a>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-surface-elevated" />
            <span className="text-on-surface-variant text-xs">or</span>
            <div className="flex-1 h-px bg-surface-elevated" />
          </div>

          {/* Sign in with Google */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 font-semibold py-4 px-6 rounded-2xl hover:bg-gray-100 transition-colors active:scale-[0.98] disabled:opacity-50"
          >
            {loading === "google" ? (
              <span className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            Continue with Google
          </button>
        </div>

        {(error || errorParam) && (
          <p className="text-red-400 text-xs">
            {error || (errorParam === "auth_failed" ? "Authentication failed. Try again." : "Something went wrong.")}
          </p>
        )}

        <p className="text-on-surface-variant text-xs">
          By continuing, you agree to the terms of use.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
