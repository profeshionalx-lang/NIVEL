import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Business core for the skills/exercises library (`/trainer/library` on web,
 * consumed by the trainer's session-composition flow). Auth-agnostic: callers
 * verify the user is a trainer and pass a ready `supabase` client. No
 * "use server", no revalidate. Wrapped by both web Server Actions
 * (`src/lib/actions/library.ts`) and `/api/v1/{skills,exercises}`.
 *
 * `skills`/`exercises` rows carry a legacy `name` column (unique constraint,
 * historically the English name) alongside `name_ru`/`name_en` added by
 * migration 007. New rows set `name = name_ru` (matches the convention already
 * used by `createAndAddSkillCore` in `core/skills.ts`).
 */

const SEARCH_LIMIT = 50;

type LibraryTable = "skills" | "exercises";

export interface LibraryItem {
  id: number;
  name_ru: string;
  name_en: string;
  created_at: string;
}

type SearchResult =
  | { success: true; items: LibraryItem[] }
  | { success: false; error: string };

type CreateResult =
  | { success: true; id: number }
  | { success: false; error: string };

/**
 * `q` empty → first [SEARCH_LIMIT] rows alphabetically. `q` set → matches
 * against BOTH name_ru and name_en (a Russian query must find a skill whose
 * only translated field is name_ru, and vice versa), merged and de-duped.
 */
async function searchLibraryTable(
  supabase: SupabaseClient,
  table: LibraryTable,
  query: string
): Promise<SearchResult> {
  const trimmed = query.trim();

  if (!trimmed) {
    const { data, error } = await supabase
      .from(table)
      .select("id, name_ru, name_en, created_at")
      .order("name_ru")
      .limit(SEARCH_LIMIT);
    if (error) return { success: false, error: error.message };
    return { success: true, items: (data ?? []) as LibraryItem[] };
  }

  const pattern = `%${trimmed}%`;
  const [byRu, byEn] = await Promise.all([
    supabase
      .from(table)
      .select("id, name_ru, name_en, created_at")
      .ilike("name_ru", pattern)
      .order("name_ru")
      .limit(SEARCH_LIMIT),
    supabase
      .from(table)
      .select("id, name_ru, name_en, created_at")
      .ilike("name_en", pattern)
      .order("name_ru")
      .limit(SEARCH_LIMIT),
  ]);

  if (byRu.error) return { success: false, error: byRu.error.message };
  if (byEn.error) return { success: false, error: byEn.error.message };

  const merged = new Map<number, LibraryItem>();
  for (const row of [...(byRu.data ?? []), ...(byEn.data ?? [])] as LibraryItem[]) {
    merged.set(row.id, row);
  }

  const items = Array.from(merged.values())
    .sort((a, b) => a.name_ru.localeCompare(b.name_ru, "ru"))
    .slice(0, SEARCH_LIMIT);

  return { success: true, items };
}

export function searchSkillsCore(supabase: SupabaseClient, query: string): Promise<SearchResult> {
  return searchLibraryTable(supabase, "skills", query);
}

export function searchExercisesCore(supabase: SupabaseClient, query: string): Promise<SearchResult> {
  return searchLibraryTable(supabase, "exercises", query);
}

/**
 * Creates a row. Dedup key is `name_ru` (the field the caller actually submits
 * and the semantic identity for this API) — NOT the legacy `name` column.
 *
 * `name` carries a real DB unique constraint and is what the upsert conflicts
 * on, but per migration 007 (`007_skills_exercises_i18n.sql:12`) every
 * pre-existing row got `name_en = name` — so for legacy rows `name` holds the
 * ENGLISH string, not `name_ru`. Conflicting only on `name` would miss a
 * legitimate name_ru duplicate against any legacy row whose `name` differs
 * from the submitted nameRu (i.e. most explicitly-translated seed rows),
 * silently creating a second row with the same name_ru instead of returning
 * the existing id. Hence the explicit name_ru lookup before AND after the
 * insert attempt (the second catches a same-name_ru row created by a
 * concurrent request between the two, still funneled through the `name`
 * unique constraint at the DB level).
 */
async function createLibraryItem(
  supabase: SupabaseClient,
  table: LibraryTable,
  nameRu: string,
  nameEn: string
): Promise<CreateResult> {
  const trimmedRu = nameRu.trim();
  if (!trimmedRu) return { success: false, error: "nameRu is required" };
  const trimmedEn = nameEn.trim() || trimmedRu;

  const existingBefore = await findByNameRu(supabase, table, trimmedRu);
  if (!existingBefore.success) return existingBefore;
  if (existingBefore.id != null) return { success: true, id: existingBefore.id };

  const { data: inserted, error: insertError } = await supabase
    .from(table)
    .upsert(
      { name: trimmedRu, name_ru: trimmedRu, name_en: trimmedEn },
      { onConflict: "name", ignoreDuplicates: true }
    )
    .select("id")
    .single();

  if (!insertError && inserted) {
    return { success: true, id: inserted.id as number };
  }

  // Либо конфликт по легаси name (см. докблок), либо гонка с параллельным
  // созданием того же name_ru между проверкой выше и этим инсертом.
  const existingAfter = await findByNameRu(supabase, table, trimmedRu);
  if (!existingAfter.success) return existingAfter;
  if (existingAfter.id != null) return { success: true, id: existingAfter.id };

  return {
    success: false,
    error: insertError?.message ?? `Failed to create ${table}`,
  };
}

/**
 * `limit(1)` + first-of-array rather than `.maybeSingle()`: `name_ru` has no
 * DB unique constraint, so legacy rows could in principle collide on it —
 * `.maybeSingle()` errors on >1 rows, which would turn a harmless pre-existing
 * duplicate into a hard failure here.
 */
async function findByNameRu(
  supabase: SupabaseClient,
  table: LibraryTable,
  nameRu: string
): Promise<{ success: true; id: number | null } | { success: false; error: string }> {
  const { data, error } = await supabase.from(table).select("id").ilike("name_ru", nameRu).limit(1);
  if (error) return { success: false, error: error.message };
  return { success: true, id: (data?.[0]?.id as number | undefined) ?? null };
}

export function createSkillCore(
  supabase: SupabaseClient,
  nameRu: string,
  nameEn: string
): Promise<CreateResult> {
  return createLibraryItem(supabase, "skills", nameRu, nameEn);
}

export function createExerciseCore(
  supabase: SupabaseClient,
  nameRu: string,
  nameEn: string
): Promise<CreateResult> {
  return createLibraryItem(supabase, "exercises", nameRu, nameEn);
}
