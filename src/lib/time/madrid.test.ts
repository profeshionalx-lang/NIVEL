import { describe, it, expect } from "vitest";
import { madridLocalToUtcISO } from "./madrid";

describe("madridLocalToUtcISO", () => {
  it("трактует летний ввод как CEST (UTC+2)", () => {
    // 15:00 в Мадриде летом = 13:00 UTC
    expect(madridLocalToUtcISO("2026-07-10T15:00")).toBe("2026-07-10T13:00:00.000Z");
  });

  it("трактует зимний ввод как CET (UTC+1)", () => {
    // 15:00 в Мадриде зимой = 14:00 UTC
    expect(madridLocalToUtcISO("2026-01-10T15:00")).toBe("2026-01-10T14:00:00.000Z");
  });

  it("round-trip: показ сохранённого инстанта в Europe/Madrid даёт исходное время", () => {
    const iso = madridLocalToUtcISO("2026-07-10T15:00");
    const shown = new Date(iso).toLocaleTimeString("ru-RU", {
      timeZone: "Europe/Madrid",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    expect(shown).toBe("15:00");
  });
});
