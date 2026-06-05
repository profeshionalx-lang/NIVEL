// src/lib/playtomic/score.ts
// Разбор Playtomic-результата (jsonb `matches.results`) в структуру по сетам.
// teams[0] = local (хозяева), teams[1] = visitor (гости); local_score/visitor_score
// в каждом сете соответствуют этим же двум командам.

export interface SetScore {
  local: number;
  visitor: number;
}

/**
 * Парсит `results` в массив сетов. Поддерживает обе формы Playtomic:
 *   [{ sets: [{local_score, visitor_score}, ...] }]  и  [{local_score, visitor_score}, ...]
 * Возвращает [] если распарсить нечего.
 */
export function parseSetScores(results: unknown): SetScore[] {
  if (results == null || typeof results !== "object" || !Array.isArray(results)) {
    return [];
  }

  const sets: SetScore[] = [];

  const pushFrom = (obj: Record<string, unknown>) => {
    const local = obj["local_score"] ?? obj["team1"] ?? obj["home"];
    const visitor = obj["visitor_score"] ?? obj["team2"] ?? obj["away"];
    if (local != null && visitor != null) {
      sets.push({ local: Number(local), visitor: Number(visitor) });
    }
  };

  for (const item of results) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    if (Array.isArray(obj["sets"])) {
      for (const s of obj["sets"] as unknown[]) {
        if (s && typeof s === "object") pushFrom(s as Record<string, unknown>);
      }
    } else {
      pushFrom(obj);
    }
  }

  return sets;
}

/** "6-3, 4-6, 6-4" или null. */
export function formatScore(results: unknown): string | null {
  const sets = parseSetScores(results);
  return sets.length > 0 ? sets.map((s) => `${s.local}-${s.visitor}`).join(", ") : null;
}

/**
 * Индекс команды-победителя по числу выигранных сетов: 0 (local), 1 (visitor)
 * или null (нет данных / ничья).
 */
export function computeWinner(results: unknown): 0 | 1 | null {
  const sets = parseSetScores(results);
  if (sets.length === 0) return null;
  let local = 0;
  let visitor = 0;
  for (const s of sets) {
    if (s.local > s.visitor) local++;
    else if (s.visitor > s.local) visitor++;
  }
  if (local === visitor) return null;
  return local > visitor ? 0 : 1;
}
