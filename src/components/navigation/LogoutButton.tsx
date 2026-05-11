"use client";

import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";
import { t, type Locale } from "@/lib/i18n/dict";

export default function LogoutButton({ locale }: { locale: Locale }) {
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(getFirebaseAuth());
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:text-error transition-colors"
      title={t(locale, "nav.logout")}
    >
      <span className="material-symbols-outlined">logout</span>
    </button>
  );
}
