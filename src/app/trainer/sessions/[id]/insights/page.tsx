import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import Link from "next/link";
import TrainerCardEditor from "@/components/insights/TrainerCardEditor";
import BackButton from "@/components/navigation/BackButton";
import type { InsightCard, ProblemCategory, Problem } from "@/lib/types";

export default async function TrainerSessionInsightsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSession();
  if (!user || user.role !== "trainer") redirect("/dashboard");

  const { id } = await params;
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("id, session_number, trainer_review_completed, goal_id")
    .eq("id", id)
    .single();

  if (!session) redirect("/dashboard");

  const [{ data: cards }, { data: categories }, { data: problems }] = await Promise.all([
    supabase
      .from("insight_cards")
      .select("id, front_text, context_text, problem_id, tags, trainer_status, student_decision")
      .eq("session_id", id)
      .order("position"),
    supabase.from("problem_categories").select("id, name, sort_order").order("sort_order"),
    supabase.from("problems").select("id, name").order("sort_order"),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass-nav flex items-center justify-between px-6 h-16">
        <BackButton fallbackHref={`/sessions/${id}`} />
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
