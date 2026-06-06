import { createClient } from "@/lib/supabase/server";
import { sendMessage, type InlineKeyboard } from "./client";
import { sendPushNotification } from "@/lib/fcm";

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

export type NotifyResult = "sent" | "no_link" | "failed";

async function getActiveChat(profileId: string): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("telegram_links")
    .select("telegram_chat_id")
    .eq("profile_id", profileId)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  return Number(data.telegram_chat_id);
}

export async function notifyNewInsights(
  profileId: string,
  sessionId: string,
  count: number
): Promise<NotifyResult> {
  // Push (FCM) fires independently of the Telegram link — best-effort.
  const word = plural(count, "новый разбор", "новых разбора", "новых разборов");
  void sendPushNotification(
    profileId,
    "Новые разборы",
    `Тренер прислал ${count} ${word} с тренировки.`,
    { deeplink: `nivel://session/${sessionId}`, type: "new_insights", sessionId }
  );

  try {
    const chatId = await getActiveChat(profileId);
    if (chatId === null) return "no_link";
    const text = `🎾 Тренер прислал ${count} ${word} с тренировки.`;
    const keyboard: InlineKeyboard = {
      inline_keyboard: [
        [{ text: "Открыть в Nivel", url: `${APP_URL}/sessions/${sessionId}/insights` }],
      ],
    };
    const res = await sendMessage(chatId, text, { reply_markup: keyboard });
    if (res.forbidden) {
      await deactivateLink(profileId);
      return "no_link";
    }
    return res.ok ? "sent" : "failed";
  } catch (e) {
    console.error("[tg] notifyNewInsights failed", e);
    return "failed";
  }
}

export async function notifySessionReminder(
  profileId: string,
  sessionId: string,
  scheduledAt: string,
  hoursBefore: number
): Promise<NotifyResult> {
  const word = plural(hoursBefore, "час", "часа", "часов");
  const date = new Date(scheduledAt);
  const time = date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  });

  void sendPushNotification(
    profileId,
    "Скоро тренировка",
    `Через ${hoursBefore} ${word} тренировка (в ${time}).`,
    { deeplink: `nivel://session/${sessionId}`, type: "session_reminder", sessionId }
  );

  try {
    const chatId = await getActiveChat(profileId);
    if (chatId === null) return "no_link";
    const text = `⏰ Через ${hoursBefore} ${word} тренировка (в ${time}).`;
    const keyboard: InlineKeyboard = {
      inline_keyboard: [
        [{ text: "Открыть в Nivel", url: `${APP_URL}/sessions/${sessionId}` }],
      ],
    };
    const res = await sendMessage(chatId, text, { reply_markup: keyboard });
    if (res.forbidden) {
      await deactivateLink(profileId);
      return "no_link";
    }
    return res.ok ? "sent" : "failed";
  } catch (e) {
    console.error("[tg] notifySessionReminder failed", e);
    return "failed";
  }
}

export async function notifyStudentCompletedReview(
  trainerProfileId: string,
  sessionId: string,
  studentName: string,
  sessionNumber: number
): Promise<NotifyResult> {
  void sendPushNotification(
    trainerProfileId,
    "Разбор завершён",
    `${studentName} завершил разбор тренировки #${sessionNumber}.`,
    { deeplink: `nivel://session/${sessionId}`, type: "review_complete", sessionId }
  );

  try {
    const chatId = await getActiveChat(trainerProfileId);
    if (chatId === null) return "no_link";
    const text = `✅ ${studentName} завершил разбор тренировки #${sessionNumber}.`;
    const keyboard: InlineKeyboard = {
      inline_keyboard: [
        [{ text: "Посмотреть", url: `${APP_URL}/trainer/sessions/${sessionId}/insights` }],
      ],
    };
    const res = await sendMessage(chatId, text, { reply_markup: keyboard });
    if (res.forbidden) {
      await deactivateLink(trainerProfileId);
      return "no_link";
    }
    return res.ok ? "sent" : "failed";
  } catch (e) {
    console.error("[tg] notifyStudentCompletedReview failed", e);
    return "failed";
  }
}
