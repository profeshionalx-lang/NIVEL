import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import VaultGrid from "@/components/insights/VaultGrid";
import VaultFilters from "@/components/insights/VaultFilters";
import { getVaultCards } from "@/lib/actions/insightCards";
import { getLocale, t } from "@/lib/i18n";
import type { ProblemCategory } from "@/lib/types";

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  const { category } = await searchParams;
  const supabase = await createClient();
  const locale = await getLocale();

  const categoryId = category ? Number(category) : undefined;

  const [cards, { data: categoriesRaw }] = await Promise.all([
    getVaultCards({ categoryId }),
    supabase
      .from("problem_categories")
      .select("id, sort_order, name_ru, name_en")
      .order("sort_order"),
  ]);

  const nameCol = locale === "en" ? "name_en" : "name_ru";
  const categories = (categoriesRaw ?? []).map((c) => ({
    id: c.id,
    sort_order: c.sort_order,
    name: (c as Record<string, unknown>)[nameCol] as string,
  })) as ProblemCategory[];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass-nav h-16 flex items-center justify-between px-6">
        <span className="text-lg font-black text-primary uppercase italic tracking-tight">
          {t(locale, "nav.insights")}
        </span>
        <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          {cards.length}
        </span>
      </header>

      <main className="px-4 pt-4 pb-36 max-w-[430px] mx-auto space-y-4">
        <VaultFilters
          categories={categories}
          activeCategoryId={categoryId}
          allLabel={t(locale, "insights.filterAll")}
        />
        <VaultGrid cards={cards} />
      </main>
    </div>
  );
}
