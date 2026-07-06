import Link from "next/link";
import Image from "next/image";
import { Profile } from "@/lib/types";
import { t, type Locale } from "@/lib/i18n";
import LogoutButton from "./LogoutButton";

interface TopBarProps {
  profile: Pick<Profile, "full_name" | "avatar_url" | "role">;
  locale: Locale;
}

function getInitials(name: string | null): string {
  if (!name) return "NN";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function TopBar({ profile, locale }: TopBarProps) {
  const initials = getInitials(profile.full_name);

  return (
    <header className="glass-nav sticky top-0 z-30 flex h-16 items-center justify-between px-6">
      {/* Left: Avatar + Logo */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-primary overflow-hidden">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={profile.full_name ?? "Avatar"}
              width={36}
              height={36}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-xs font-bold text-on-surface">
              {initials}
            </span>
          )}
        </div>
        <span className="font-black italic uppercase tracking-tight text-primary text-lg">
          Nivel
        </span>
      </div>

      {/* Right: Students (trainer) + Logout */}
      <div className="flex items-center gap-2">
        {profile.role === "trainer" && (
          <Link
            href="/trainer/students"
            aria-label={t(locale, "trainer.students")}
            title={t(locale, "trainer.students")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant active:bg-surface-card transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">group</span>
          </Link>
        )}
        <LogoutButton locale={locale} />
      </div>
    </header>
  );
}
