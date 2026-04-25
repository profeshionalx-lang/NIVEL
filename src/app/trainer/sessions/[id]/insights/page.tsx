import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import TrainerCardEditor from "@/components/insights/TrainerCardEditor";
import type { InsightCard, ProblemCategory, Problem } from "@/lib/types";

export default async function TrainerSessionInsightsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "trainer") redirect("/dashboard");

  const { data: session } = await supabase
    .from("sessions")
    .select("id, session_number, trainer_review_completed, goal_id")
    .eq("id", id)
    .single();

  if (!session) redirect("/dashboard");

  const [{ data: cards }, { data: categories }, { data: problems }] = await Promise.all([
    supabase
      .from("insight_cards")
      .select("*")
      .eq("session_id", id)
      .order("created_at"),
    supabase.from("problem_categories").select("*").order("sort_order"),
    supabase.from("problems").select("*").order("sort_order"),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass-nav flex items-center justify-between px-6 h-16">
        <Link href={`/sessions/${id}`} className="text-on-surface-variant">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <span className="text-lg font-black text-primary uppercase italic tracking-tight">
          Session {session.session_number} cards
        </span>
        <div className="w-10" />
      </header>

      <main className="px-5 pt-6 pb-36 max-w-[430px] mx-auto">
        <TrainerCardEditor
          sessionId={id}
          cards={(cards ?? []) as InsightCard[]}
          categories={(categories ?? []) as ProblemCategory[]}
          problems={(problems ?? []) as Problem[]}
          reviewCompleted={session.trainer_review_completed}
        />
      </main>
    </div>
  );
}
