export type InsightTag = "техника" | "тактика" | "физика" | "менталка";

export interface InsightCardDraft {
  title: string;
  body: string;
  tag: InsightTag;
  quote: string;
  momentBeforeSeconds: number | null;
  momentAfterSeconds: number | null;
}

export type ParseResult =
  | { ok: true; cards: InsightCardDraft[] }
  | { ok: false; error: string; line?: number };

const VALID_TAGS = new Set<InsightTag>(["техника", "тактика", "физика", "менталка"]);

const FIELD_KEYS = ["тема", "заголовок", "описание", "цитата", "момент до", "момент после"] as const;
type FieldKey = (typeof FIELD_KEYS)[number];

const FIELD_LINE = new RegExp(
  `^\\s*[-–—*•]?\\s*(${FIELD_KEYS.join("|")})\\s*:(.*)$`,
  "i"
);

/**
 * Строка похожа на поле списка (`- Ключ: значение`), но ключ не входит в
 * FIELD_KEYS. Раньше такие строки молча дописывались в предыдущее поле —
 * любое новое/неизвестное поле от модели портило уже распарсенные данные
 * (чаще всего Цитату, т.к. она идёт последней). Теперь такая строка сбрасывает
 * `current` и отбрасывается, не попадая никуда.
 */
const UNKNOWN_FIELD_LINE = /^\s*[-–—*•]\s*[^:\n]{1,40}:\s/;

function stripQuotes(s: string): string {
  return s.replace(/^["'«“‘«]+|["'»”’»]+$/g, "").trim();
}

/**
 * Парсит секунду момента из значения поля "Момент до"/"Момент после".
 * Принимает: "412.5", "412", "6:52", "6:52.5", "~412" (обрезает мусор по
 * краям). Что угодно, не сводящееся к числу секунд — null.
 */
export function parseMoment(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;

  // mm:ss или mm:ss.s
  const mmss = s.match(/^[^\d]*(\d+):(\d{1,2}(?:\.\d+)?)[^\d]*$/);
  if (mmss) {
    const minutes = Number(mmss[1]);
    const seconds = Number(mmss[2]);
    if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
      return minutes * 60 + seconds;
    }
    return null;
  }

  // Голое число секунд, возможно с мусором по краям (~, с, sec и т.п.)
  const bare = s.match(/^[^\d-]*(\d+(?:\.\d+)?)[^\d]*$/);
  if (bare) {
    const value = Number(bare[1]);
    return Number.isFinite(value) ? value : null;
  }

  return null;
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
    "момент до": [],
    "момент после": [],
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
    } else if (UNKNOWN_FIELD_LINE.test(line)) {
      // Похоже на поле с неизвестным ключом (например галлюцинированное
      // моделью) — не приклеиваем к предыдущему полю, сбрасываем current.
      current = null;
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
        error: `Карточка ${cardNum}: неизвестная тема «${fields.тема}». Допустимые: техника, тактика, физика, менталка`,
        line: startLine,
      };
    }

    cards.push({
      title: fields.заголовок,
      body: fields.описание,
      tag,
      quote: stripQuotes(fields.цитата),
      momentBeforeSeconds: fields["момент до"] !== undefined ? parseMoment(fields["момент до"]) : null,
      momentAfterSeconds: fields["момент после"] !== undefined ? parseMoment(fields["момент после"]) : null,
    });
  }

  return { ok: true, cards };
}
