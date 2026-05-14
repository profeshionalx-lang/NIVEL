import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import Link from "next/link";
import InsightTinder from "@/components/insights/InsightTinder";
import BackButton from "@/components/navigation/BackButton";
import type { InsightCardWithRelations } from "@/lib/types";

export default async function SessionInsightsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ include?: string; as?: string; from?: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  const { id } = await params;
  const { include, as, from } = await searchParams;
  const previewAsStudent = user.role === "trainer" && as === "student";

  const backHref = previewAsStudent
    ? `/sessions/${id}?as=student`
    : from === "dashboard"
    ? "/dashboard"
    : `/sessions/${id}`;
  const supabase = await createClient();

  let query = supabase
    .from("insight_cards")
    .select(
      `*,
      problem:problems(id, name),
      category:problem_categories(id, name),
      session:sessions(id, session_number, created_at)`
    )
    .eq("session_id", id)
    .eq("trainer_status", "approved")
    .order("created_at");

  if (include === "skipped") {
    query = query.in("student_decision", ["skipped"]).not("student_decision", "is", null);
    // Also reset to swipeable: include skipped only
  } else {
    query = query.is("student_decision", null);
  }

  const { data } = await query;
  const cards = (data ?? []) as unknown as InsightCardWithRelations[];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass-nav flex items-center justify-between px-6 h-16">
        <BackButton fallbackHref={backHref} />
        <span className="text-lg font-black text-primary uppercase italic tracking-tight">
          Insights
        </span>
        <div className="w-10" />
      </header>

      <main className="px-5 pt-4 pb-8 max-w-[430px] mx-auto">
        <InsightTinder cards={cards} />
      </main>
    </div>
  );
}
