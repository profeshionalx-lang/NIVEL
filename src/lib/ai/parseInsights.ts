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

function stripQuotes(s: string): string {
  return s.replace(/^["«"]+|["»"]+$/g, "").trim();
}

function extractField(lines: string[], key: string): string | undefined {
  const pattern = new RegExp(`^[-–]?\\s*${key}\\s*:(.*)$`, "i");
  for (const line of lines) {
    const m = line.match(pattern);
    if (m) return m[1].trim();
  }
  return undefined;
}

export function parseInsightsMarkdown(input: string): ParseResult {
  const lines = input.split("\n");
  const cardBlocks: { startLine: number; lines: string[] }[] = [];

  let current: { startLine: number; lines: string[] } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/^##\s+/)) {
      if (current) cardBlocks.push(current);
      current = { startLine: i + 1, lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) cardBlocks.push(current);

  if (cardBlocks.length === 0) {
    return { ok: false, error: "Не найдено ни одной карточки" };
  }

  const cards: InsightCardDraft[] = [];

  for (let idx = 0; idx < cardBlocks.length; idx++) {
    const block = cardBlocks[idx];
    const cardNum = idx + 1;

    const rawTag = extractField(block.lines, "Тема");
    const title = extractField(block.lines, "Заголовок");
    const body = extractField(block.lines, "Описание");
    const rawQuote = extractField(block.lines, "Цитата");

    if (!rawTag) {
      return { ok: false, error: `Карточка ${cardNum}: отсутствует поле «Тема»`, line: block.startLine };
    }
    if (!title) {
      return { ok: false, error: `Карточка ${cardNum}: отсутствует поле «Заголовок»`, line: block.startLine };
    }
    if (!body) {
      return { ok: false, error: `Карточка ${cardNum}: отсутствует поле «Описание»`, line: block.startLine };
    }
    if (rawQuote === undefined) {
      return { ok: false, error: `Карточка ${cardNum}: отсутствует поле «Цитата»`, line: block.startLine };
    }

    const tag = rawTag.toLowerCase().trim() as InsightTag;
    if (!VALID_TAGS.has(tag)) {
      return {
        ok: false,
        error: `Карточка ${cardNum}: неизвестная тема «${rawTag}». Допустимые: техника, тактика, физика, ментал`,
        line: block.startLine,
      };
    }

    cards.push({
      title: title.trim(),
      body: body.trim(),
      tag,
      quote: stripQuotes(rawQuote),
    });
  }

  return { ok: true, cards };
}
