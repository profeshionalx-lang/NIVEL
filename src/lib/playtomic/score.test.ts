import { describe, it, expect } from "vitest";
import { parseSetScores, formatScore, computeWinner } from "./score";

const nested = [{ sets: [{ local_score: 6, visitor_score: 3 }, { local_score: 4, visitor_score: 6 }, { local_score: 6, visitor_score: 4 }] }];
const flat = [{ local_score: 6, visitor_score: 2 }, { local_score: 6, visitor_score: 1 }];

describe("playtomic score", () => {
  it("парсит вложенную форму { sets: [...] }", () => {
    expect(parseSetScores(nested)).toEqual([
      { local: 6, visitor: 3 },
      { local: 4, visitor: 6 },
      { local: 6, visitor: 4 },
    ]);
  });

  it("парсит плоскую форму", () => {
    expect(parseSetScores(flat)).toEqual([
      { local: 6, visitor: 2 },
      { local: 6, visitor: 1 },
    ]);
  });

  it("formatScore собирает строку по сетам", () => {
    expect(formatScore(nested)).toBe("6-3, 4-6, 6-4");
    expect(formatScore(null)).toBeNull();
    expect(formatScore([])).toBeNull();
  });

  it("computeWinner: local выиграл 2:1 -> 0", () => {
    expect(computeWinner(nested)).toBe(0);
  });

  it("computeWinner: visitor выиграл -> 1", () => {
    expect(computeWinner([{ local_score: 3, visitor_score: 6 }, { local_score: 2, visitor_score: 6 }])).toBe(1);
  });

  it("computeWinner: ничья по сетам или нет данных -> null", () => {
    expect(computeWinner([{ local_score: 6, visitor_score: 3 }, { local_score: 3, visitor_score: 6 }])).toBeNull();
    expect(computeWinner(null)).toBeNull();
  });
});
