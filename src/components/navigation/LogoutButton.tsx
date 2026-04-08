"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:text-error transition-colors"
      title="Выйти"
    >
      <span className="material-symbols-outlined">logout</span>
    </button>
  );
}
