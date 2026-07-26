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
 * Creates a row keyed by the legacy `name` (unique) column. Duplicate name →
 * returns the existing row's id instead of failing (matches the web
 * `createSkill`/`createExercise` Server Actions this replaces).
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

  // ignoreDuplicates не вернул строку — конфликт по name, читаем существующую.
  const { data: existing, error: fetchError } = await supabase
    .from(table)
    .select("id")
    .ilike("name", trimmedRu)
    .maybeSingle();

  if (existing) {
    return { success: true, id: existing.id as number };
  }

  return {
    success: false,
    error: insertError?.message ?? fetchError?.message ?? `Failed to create ${table}`,
  };
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
