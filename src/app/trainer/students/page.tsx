import { createClient } from "@/lib/supabase/server";
import { DEMO_USER } from "@/lib/supabase/demoUser";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function TrainerStudentsPage() {
  const supabase = await createClient();

  const user = DEMO_USER;
const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Fetch all students
  const { data: students } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "student")
    .order("created_at", { ascending: false });

  // For each student, get goal & session counts
  interface StudentWithStats {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    active_goals: number;
    total_sessions: number;
  }

  const studentsWithStats: StudentWithStats[] = await Promise.all(
    (students || []).map(async (student: Record<string, unknown>) => {
      const { count: goalCount } = await supabase
        .from("goals")
        .select("*", { count: "exact", head: true })
        .eq("user_id", student.id as string)
        .eq("status", "active");

      const { count: sessionCount } = await supabase
        .from("sessions")
        .select("*, goals!inner(user_id)", { count: "exact", head: true })
        .eq("goals.user_id", student.id as string);

      return {
        id: student.id as string,
        email: student.email as string,
        full_name: student.full_name as string | null,
        avatar_url: student.avatar_url as string | null,
        active_goals: goalCount || 0,
        total_sessions: sessionCount || 0,
      };
    })
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass-nav flex items-center justify-between px-6 h-16">
        <span className="text-lg font-black text-primary uppercase italic tracking-tight">
          Students
        </span>
        <Link href="/dashboard" className="text-on-surface-variant">
          <span className="material-symbols-outlined">close</span>
        </Link>
      </header>

      <main className="px-5 pt-6 pb-36 max-w-4xl mx-auto">
        {studentsWithStats.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-on-surface-variant text-5xl mb-4">
              groups
            </span>
            <p className="text-on-surface-variant">No students yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {studentsWithStats.map((student) => (
              <Link
                key={student.id as string}
                href={`/trainer/students/${student.id}`}
                className="flex items-center gap-4 bg-surface-low rounded-2xl px-4 py-4 active:bg-surface-card transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-surface-card border-2 border-primary/30 flex items-center justify-center flex-shrink-0">
                  {student.avatar_url ? (
                    <img
                      src={student.avatar_url}
                      alt=""
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-bold text-on-surface">
                      {student.full_name
                        ?.split(" ")
                        .map((w: string) => w[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2) || "??"}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-on-surface">
                    {student.full_name || student.email}
                  </p>
                  <div className="flex gap-3 mt-1">
                    <span className="text-[11px] text-on-surface-variant">
                      <span className="text-primary font-bold">
                        {student.active_goals}
                      </span>{" "}
                      goals
                    </span>
                    <span className="text-[11px] text-on-surface-variant">
                      <span className="text-secondary font-bold">
                        {student.total_sessions}
                      </span>{" "}
                      sessions
                    </span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant opacity-40">
                  chevron_right
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
