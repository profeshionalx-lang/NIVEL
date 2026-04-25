import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import VaultGrid from "@/components/insights/VaultGrid";
import VaultFilters from "@/components/insights/VaultFilters";
import { getVaultCards } from "@/lib/actions/insightCards";
import type { ProblemCategory } from "@/lib/types";

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const categoryId = category ? Number(category) : undefined;

  const [cards, { data: categories }] = await Promise.all([
    getVaultCards({ categoryId }),
    supabase.from("problem_categories").select("*").order("sort_order"),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass-nav h-16 flex items-center justify-between px-6">
        <span className="text-lg font-black text-primary uppercase italic tracking-tight">
          Insights
        </span>
        <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          {cards.length} {cards.length === 1 ? "card" : "cards"}
        </span>
      </header>

      <main className="px-4 pt-4 pb-36 max-w-[430px] mx-auto space-y-4">
        <VaultFilters
          categories={(categories ?? []) as ProblemCategory[]}
          activeCategoryId={categoryId}
        />
        <VaultGrid cards={cards} />
      </main>
    </div>
  );
}
