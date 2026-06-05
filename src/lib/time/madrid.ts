// src/lib/time/madrid.ts
// Nivel работает в одном часовом поясе — Europe/Madrid (см. также src/lib/telegram/notify.ts).
// Тренер вводит время тренировки во «wall-clock» Мадрида, а в БД (sessions.scheduled_at, timestamptz)
// мы храним НАСТОЯЩИЙ UTC-инстант. Это держит согласованными: dashboard, Telegram-напоминание
// и оконный запрос cron'а (который сравнивает scheduled_at с реальным «сейчас»).

export const APP_TIMEZONE = "Europe/Madrid";

// Смещение Europe/Madrid (в минутах) для конкретного UTC-инстанта. DST-aware.
function madridOffsetMinutes(date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = dtf.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  const asUTC = Date.UTC(
    +p.year,
    +p.month - 1,
    +p.day,
    +p.hour,
    +p.minute,
    +p.second
  );
  return (asUTC - date.getTime()) / 60000;
}

/**
 * Конвертирует значение `input[type=datetime-local]` ("YYYY-MM-DDTHH:mm"),
 * трактуя его как местное время Europe/Madrid, в UTC ISO-строку.
 * DST-корректно для лета (CEST, UTC+2) и зимы (CET, UTC+1).
 */
export function madridLocalToUtcISO(local: string): string {
  // Сначала трактуем строку как UTC, чтобы получить приблизительный инстант,
  // затем вычитаем фактическое мадридское смещение для этого инстанта.
  const naive = new Date(`${local}:00.000Z`);
  const offset = madridOffsetMinutes(naive);
  return new Date(naive.getTime() - offset * 60000).toISOString();
}
