export type InsightTag = "техника" | "тактика" | "физика" | "ментал";

export interface InsightCardDraft {
  title: string;
  body: string;
  tag: InsightTag;
  quote: string;
}

export type ParseResult =
  | { ok: true; cards: InsightCardDraft[] }
  | { ok: false; error: string; line?: number };

const VALID_TAGS = new Set<InsightTag>(["техника", "тактика", "физика", "ментал"]);

const FIELD_KEYS = ["тема", "заголовок", "описание", "цитата"] as const;
type FieldKey = (typeof FIELD_KEYS)[number];

const FIELD_LINE = new RegExp(
  `^\\s*[-–—*•]?\\s*(${FIELD_KEYS.join("|")})\\s*:(.*)$`,
  "i"
);

function stripQuotes(s: string): string {
  return s.replace(/^["'«“‘«]+|["'»”’»]+$/g, "").trim();
}

interface CardBlock {
  startLine: number;
  fields: Partial<Record<FieldKey, string>>;
}

function parseBlock(lines: string[]): Partial<Record<FieldKey, string>> {
  const acc: Record<FieldKey, string[]> = {
    тема: [],
    заголовок: [],
    описание: [],
    цитата: [],
  };
  const seen = new Set<FieldKey>();
  let current: FieldKey | null = null;

  for (const line of lines) {
    const m = line.match(FIELD_LINE);
    if (m) {
      const key = m[1].toLowerCase() as FieldKey;
      current = key;
      seen.add(key);
      acc[key].push(m[2].trim());
    } else if (current) {
      const trimmed = line.trim();
      if (trimmed) acc[current].push(trimmed);
    }
  }

  const out: Partial<Record<FieldKey, string>> = {};
  for (const key of FIELD_KEYS) {
    if (seen.has(key)) out[key] = acc[key].join(" ").replace(/\s+/g, " ").trim();
  }
  return out;
}

export function parseInsightsMarkdown(input: string): ParseResult {
  const lines = input.split(/\r?\n/);
  const blocks: CardBlock[] = [];
  let current: { startLine: number; lines: string[] } | null = null;

  for (let i = 0; i < lines.length; i++) {
    if (/^\s*##\s+/.test(lines[i])) {
      if (current) {
        blocks.push({ startLine: current.startLine, fields: parseBlock(current.lines) });
      }
      current = { startLine: i + 1, lines: [] };
    } else if (current) {
      current.lines.push(lines[i]);
    }
  }
  if (current) {
    blocks.push({ startLine: current.startLine, fields: parseBlock(current.lines) });
  }

  if (blocks.length === 0) {
    return { ok: false, error: "Не найдено ни одной карточки" };
  }

  const cards: InsightCardDraft[] = [];

  for (let idx = 0; idx < blocks.length; idx++) {
    const { fields, startLine } = blocks[idx];
    const cardNum = idx + 1;

    if (!fields.тема) {
      return { ok: false, error: `Карточка ${cardNum}: отсутствует поле «Тема»`, line: startLine };
    }
    if (!fields.заголовок) {
      return { ok: false, error: `Карточка ${cardNum}: отсутствует поле «Заголовок»`, line: startLine };
    }
    if (!fields.описание) {
      return { ok: false, error: `Карточка ${cardNum}: отсутствует поле «Описание»`, line: startLine };
    }
    if (fields.цитата === undefined) {
      return { ok: false, error: `Карточка ${cardNum}: отсутствует поле «Цитата»`, line: startLine };
    }

    const tag = fields.тема.toLowerCase() as InsightTag;
    if (!VALID_TAGS.has(tag)) {
      return {
        ok: false,
        error: `Карточка ${cardNum}: неизвестная тема «${fields.тема}». Допустимые: техника, тактика, физика, ментал`,
        line: startLine,
      };
    }

    cards.push({
      title: fields.заголовок,
      body: fields.описание,
      tag,
      quote: stripQuotes(fields.цитата),
    });
  }

  return { ok: true, cards };
}
