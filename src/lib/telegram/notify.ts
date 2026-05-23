import { createClient } from "@/lib/supabase/server";
import { sendMessage, type InlineKeyboard } from "./client";

const APP_URL = process.env.NEXT_PUBLIC_NIVEL_URL ?? "https://nivel-five.vercel.app";

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

async function deactivateLink(profileId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("telegram_links")
    .update({ is_active: false })
    .eq("profile_id", profileId);
}

async function getActiveChat(profileId: string): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("telegram_links")
    .select("telegram_chat_id, is_active")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!data || !data.is_active) return null;
  return Number(data.telegram_chat_id);
}

export async function notifyNewInsights(
  profileId: string,
  sessionId: string,
  count: number
): Promise<void> {
  try {
    const chatId = await getActiveChat(profileId);
    if (chatId === null) return;
    const word = plural(count, "новый разбор", "новых разбора", "новых разборов");
    const text = `🎾 Тренер прислал ${count} ${word} с тренировки.`;
    const keyboard: InlineKeyboard = {
      inline_keyboard: [
        [{ text: "Открыть в Nivel", url: `${APP_URL}/sessions/${sessionId}/insights` }],
      ],
    };
    const res = await sendMessage(chatId, text, { reply_markup: keyboard });
    if (res.forbidden) await deactivateLink(profileId);
  } catch (e) {
    console.error("[tg] notifyNewInsights failed", e);
  }
}

export async function notifySessionReminder(
  profileId: string,
  sessionId: string,
  scheduledAt: string,
  hoursBefore: number
): Promise<void> {
  try {
    const chatId = await getActiveChat(profileId);
    if (chatId === null) return;
    const word = plural(hoursBefore, "час", "часа", "часов");
    const date = new Date(scheduledAt);
    const time = date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Moscow",
    });
    const text = `⏰ Через ${hoursBefore} ${word} тренировка (в ${time}).`;
    const keyboard: InlineKeyboard = {
      inline_keyboard: [
        [{ text: "Открыть в Nivel", url: `${APP_URL}/sessions/${sessionId}` }],
      ],
    };
    const res = await sendMessage(chatId, text, { reply_markup: keyboard });
    if (res.forbidden) await deactivateLink(profileId);
  } catch (e) {
    console.error("[tg] notifySessionReminder failed", e);
  }
}
