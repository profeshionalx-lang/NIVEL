import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import Link from "next/link";
import BackButton from "@/components/navigation/BackButton";

export default async function LibraryPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const { data: skills } = await supabase
    .from("skills")
    .select("*")
    .order("name");

  const { data: exercises } = await supabase
    .from("exercises")
    .select("*")
    .order("name");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass-nav flex items-center justify-between px-6 h-16">
        <BackButton fallbackHref="/dashboard" />
        <span className="text-lg font-black text-primary uppercase italic tracking-tight">
          Library
        </span>
        <div className="w-10" />
      </header>

      <main className="px-5 pt-6 pb-36 max-w-4xl mx-auto space-y-8">
        {/* Exercises */}
        <section>
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant mb-4">
            Exercises ({exercises?.length || 0})
          </h3>
          {exercises && exercises.length > 0 ? (
            <div className="space-y-2">
              {exercises.map((exercise: Record<string, unknown>) => (
                <div
                  key={exercise.id as number}
                  className="bg-surface-card rounded-xl px-4 py-3 flex items-center justify-between"
                >
                  <span className="text-sm text-on-surface">
                    {exercise.name as string}
                  </span>
                  <span className="text-[10px] text-on-surface-variant">
                    {new Date(
                      exercise.created_at as string
                    ).toLocaleDateString("en-US")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-on-surface-variant text-sm bg-surface-card rounded-2xl p-4">
              Exercises are created as sessions are added
            </p>
          )}
        </section>

        {/* Skills */}
        <section>
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant mb-4">
            Skills ({skills?.length || 0})
          </h3>
          {skills && skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {skills.map((skill: Record<string, unknown>) => (
                <span
                  key={skill.id as number}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-primary/10 text-primary"
                >
                  {skill.name as string}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-on-surface-variant text-sm bg-surface-card rounded-2xl p-4">
              Skills are created as sessions are added
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
