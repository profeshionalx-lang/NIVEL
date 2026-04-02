import { Profile } from "@/lib/types";

interface TopBarProps {
  profile: Pick<Profile, "full_name" | "avatar_url" | "role">;
}

function getInitials(name: string | null): string {
  if (!name) return "NN";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function TopBar({ profile }: TopBarProps) {
  const initials = getInitials(profile.full_name);

  return (
    <header className="glass-nav sticky top-0 z-30 flex h-16 items-center justify-between px-6">
      {/* Left: Avatar + Logo */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-primary overflow-hidden">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name ?? "Avatar"}
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

      {/* Right: Notifications */}
      <button className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface transition-colors">
        <span className="material-symbols-outlined">notifications</span>
      </button>
    </header>
  );
}
