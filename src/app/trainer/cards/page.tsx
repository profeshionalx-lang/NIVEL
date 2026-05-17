import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import type { CardTemplate, InsightCollection, InsightTrainerStatus } from "@/lib/types";
import { CardsLibrary } from "@/components/trainer/CardsLibrary";

export default async function TrainerCardsPage() {
  const user = await getSession();
  if (!user || user.role !== "trainer") redirect("/dashboard");

  const supabase = await createClient();

  const [
    { data: allCards },
    { data: students },
    { data: collections },
  ] = await Promise.all([
    supabase
      .from("insight_cards")
      .select("id, template_id, title, body, quote, tags, trainer_status, created_at, student_id, student_decision")
      .eq("trainer_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("role", "student")
      .order("full_name"),
    supabase
      .from("insight_collections")
      .select("id, name, created_at, insight_collection_cards(template_id)")
      .eq("trainer_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  // Deduplicate by template_id, aggregate stats
  const templateMap = new Map<string, CardTemplate & { student_ids: string[] }>();
  for (const card of allCards ?? []) {
    const key = card.template_id ?? card.id;
    if (!templateMap.has(key)) {
      templateMap.set(key, {
        id: card.id,
        template_id: card.template_id,
        title: card.title,
        body: card.body,
        quote: card.quote,
        tags: card.tags,
        trainer_status: card.trainer_status as InsightTrainerStatus,
        created_at: card.created_at,
        student_count: 0,
        taken_count: 0,
        skipped_count: 0,
        pending_count: 0,
        student_ids: [],
      });
    }
    const t = templateMap.get(key)!;
    t.student_count++;
    t.student_ids.push(card.student_id);
    if (card.student_decision === "taken") t.taken_count++;
    else if (card.student_decision === "skipped") t.skipped_count++;
    else t.pending_count++;
  }
  const templates = Array.from(templateMap.values());

  const collectionsWithCount: (InsightCollection & { template_ids: string[] })[] = (
    collections ?? []
  ).map((c) => ({
    id: c.id,
    trainer_id: user.id,
    name: c.name,
    created_at: c.created_at,
    card_count: (c.insight_collection_cards as { template_id: string }[]).length,
    template_ids: (c.insight_collection_cards as { template_id: string }[]).map((x) => x.template_id),
  }));

  return (
    <CardsLibrary
      templates={templates}
      students={(students ?? []) as { id: string; full_name: string | null; avatar_url: string | null }[]}
      collections={collectionsWithCount}
    />
  );
}
