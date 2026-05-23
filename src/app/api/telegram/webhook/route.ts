import { createClient } from "@/lib/supabase/server";
import { sendMessage } from "@/lib/telegram/client";
import { consumeLinkToken } from "@/lib/telegram/tokens";

export const dynamic = "force-dynamic";

type TelegramUser = {
  id: number;
  username?: string;
};

type TelegramChat = {
  id: number;
};

type TelegramMessage = {
  text?: string;
  from?: TelegramUser;
  chat: TelegramChat;
};

type TelegramUpdate = {
  message?: TelegramMessage;
};

const OK = new Response("ok", { status: 200 });

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const headerSecret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!secret || headerSecret !== secret) {
    // Silently 200 so Telegram doesn't retry on misconfigured webhooks.
    return OK;
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return OK;
  }

  const message = update.message;
  if (!message || !message.text) return OK;

  const text = message.text.trim();
  const chatId = message.chat.id;

  if (text === "/start") {
    await sendMessage(
      chatId,
      "Привет. Чтобы связать аккаунт, открой раздел настроек в Nivel и нажми «Подключить Telegram»."
    );
    return OK;
  }

  if (text.startsWith("/start ")) {
    const token = text.slice("/start ".length).trim();
    if (!token) return OK;
    await handleStartWithToken(token, message, chatId);
    return OK;
  }

  return OK;
}

async function handleStartWithToken(
  token: string,
  message: TelegramMessage,
  chatId: number
): Promise<void> {
  try {
    const consumed = await consumeLinkToken(token);
    if (!consumed) {
      await sendMessage(
        chatId,
        "Ссылка устарела или уже использована. Открой настройки Nivel и попробуй ещё раз."
      );
      return;
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("telegram_links")
      .upsert(
        {
          profile_id: consumed.profileId,
          telegram_chat_id: chatId,
          telegram_user_id: message.from?.id ?? null,
          username: message.from?.username ?? null,
          linked_at: new Date().toISOString(),
          is_active: true,
        },
        { onConflict: "profile_id" }
      );

    if (error) {
      if (error.code === "23505") {
        await sendMessage(
          chatId,
          "Этот Telegram уже привязан к другому аккаунту Nivel. Сначала отключи его в том аккаунте."
        );
        return;
      }
      console.error("[tg] upsert link failed", error);
      await sendMessage(chatId, "Не удалось подключить. Попробуй позже.");
      return;
    }

    await sendMessage(
      chatId,
      "✅ Подключено к Nivel. Будем писать про новые разборы и тренировки."
    );
  } catch (e) {
    console.error("[tg] handleStartWithToken failed", e);
  }
}
