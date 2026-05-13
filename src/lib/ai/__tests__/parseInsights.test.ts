import { describe, it, expect } from "vitest";
import { parseInsightsMarkdown } from "../parseInsights";

const VALID_3_CARDS = `
## Карточка 1
- Тема: техника
- Заголовок: Поздний замах при бандеха
- Описание: При бандеха ты начинаешь замах когда мяч уже на уровне плеча. Начинай замах когда мяч ещё летит к тебе — на 0.5 сек раньше.
- Цитата: "ты опять поздно взял, видишь — мяч уже тут а ты только начинаешь"

## Карточка 2
- Тема: тактика
- Заголовок: Держи позицию у сетки
- Описание: После удара смещайся к сетке, не оставайся у задней линии.
- Цитата: «не стой сзади, иди вперёд»

## Карточка 3
- Тема: физика
- Заголовок: Работа ног при смеше
- Описание: Прыжок и удар одновременно снижают силу. Сначала остановись, потом бей.
- Цитата: ты прыгаешь и бьёшь одновременно
`;

describe("parseInsightsMarkdown", () => {
  it("парсит 3 валидные карточки", () => {
    const result = parseInsightsMarkdown(VALID_3_CARDS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cards).toHaveLength(3);
    expect(result.cards[0].title).toBe("Поздний замах при бандеха");
    expect(result.cards[0].tag).toBe("техника");
    expect(result.cards[1].tag).toBe("тактика");
    expect(result.cards[2].tag).toBe("физика");
  });

  it("возвращает ошибку при отсутствии Темы", () => {
    const md = `
## Карточка 1
- Заголовок: Тест
- Описание: Описание теста.
- Цитата: "цитата"
`;
    const result = parseInsightsMarkdown(md);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Тема/);
  });

  it("возвращает ошибку при невалидной Теме", () => {
    const md = `
## Карточка 1
- Тема: мотивация
- Заголовок: Тест
- Описание: Описание теста.
- Цитата: "цитата"
`;
    const result = parseInsightsMarkdown(md);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/мотивация/);
  });

  it("парсит цитату в обычных кавычках", () => {
    const md = `
## Карточка 1
- Тема: ментал
- Заголовок: Фокус
- Описание: Не думай о счёте.
- Цитата: "не думай о счёте вообще"
`;
    const result = parseInsightsMarkdown(md);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cards[0].quote).toBe("не думай о счёте вообще");
  });

  it("парсит цитату в угловых кавычках", () => {
    const md = `
## Карточка 1
- Тема: тактика
- Заголовок: Позиция
- Описание: Держись ближе к центру.
- Цитата: «держись центра»
`;
    const result = parseInsightsMarkdown(md);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cards[0].quote).toBe("держись центра");
  });

  it("парсит ключи в разных регистрах", () => {
    const md = `
## Карточка 1
- ТЕМА: физика
- ЗАГОЛОВОК: Бег
- ОПИСАНИЕ: Бегай больше.
- ЦИТАТА: "бегай"
`;
    const result = parseInsightsMarkdown(md);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cards[0].tag).toBe("физика");
  });

  it("возвращает ошибку при 0 карточках", () => {
    const result = parseInsightsMarkdown("просто текст без карточек");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Не найдено ни одной карточки/);
  });

  it("тримит whitespace во всех полях", () => {
    const md = `
## Карточка 1
- Тема:   техника
- Заголовок:   Замах
- Описание:   Описание.
- Цитата:   "цитата"
`;
    const result = parseInsightsMarkdown(md);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cards[0].title).toBe("Замах");
    expect(result.cards[0].body).toBe("Описание.");
    expect(result.cards[0].quote).toBe("цитата");
  });

  it("возвращает ошибку при отсутствии Заголовка", () => {
    const md = `
## Карточка 1
- Тема: техника
- Описание: Описание.
- Цитата: "цитата"
`;
    const result = parseInsightsMarkdown(md);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Заголовок/);
  });

  it("возвращает ошибку при отсутствии Описания", () => {
    const md = `
## Карточка 1
- Тема: техника
- Заголовок: Замах
- Цитата: "цитата"
`;
    const result = parseInsightsMarkdown(md);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Описание/);
  });

  it("все 4 валидные темы принимаются", () => {
    for (const tag of ["техника", "тактика", "физика", "ментал"]) {
      const md = `
## Карточка 1
- Тема: ${tag}
- Заголовок: Тест
- Описание: Описание.
- Цитата: "цитата"
`;
      const result = parseInsightsMarkdown(md);
      expect(result.ok).toBe(true);
    }
  });

  it("парсит цитату без кавычек", () => {
    const md = `
## Карточка 1
- Тема: техника
- Заголовок: Замах
- Описание: Описание.
- Цитата: вот так он говорил
`;
    const result = parseInsightsMarkdown(md);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cards[0].quote).toBe("вот так он говорил");
  });

  it("стрипит типографские кавычки из Claude", () => {
    const md = `
## Карточка 1
- Тема: техника
- Заголовок: Замах
- Описание: Описание.
- Цитата: “не думай о счёте”
`;
    const result = parseInsightsMarkdown(md);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cards[0].quote).toBe("не думай о счёте");
  });

  it("склеивает многострочное Описание", () => {
    const md = `
## Карточка 1
- Тема: техника
- Заголовок: Замах
- Описание: Первая строка описания
  продолжение на следующей строке
  и ещё одна строка.
- Цитата: "тест"
`;
    const result = parseInsightsMarkdown(md);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cards[0].body).toContain("Первая строка");
    expect(result.cards[0].body).toContain("продолжение");
    expect(result.cards[0].body).toContain("ещё одна строка");
  });

  it("поддерживает разные маркеры пунктов (* • —)", () => {
    const md = `
## Карточка 1
* Тема: техника
• Заголовок: Тест
— Описание: Описание.
* Цитата: "тест"
`;
    const result = parseInsightsMarkdown(md);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cards[0].title).toBe("Тест");
    expect(result.cards[0].tag).toBe("техника");
  });

  it("возвращает ошибку на пустую строку", () => {
    const result = parseInsightsMarkdown("");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Не найдено/);
  });

  it("поддерживает CRLF (Windows line endings)", () => {
    const md = "## Карточка 1\r\n- Тема: техника\r\n- Заголовок: Тест\r\n- Описание: Описание.\r\n- Цитата: \"тест\"\r\n";
    const result = parseInsightsMarkdown(md);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cards[0].title).toBe("Тест");
    expect(result.cards[0].quote).toBe("тест");
  });
});
