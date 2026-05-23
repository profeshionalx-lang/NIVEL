const API_BASE = "https://api.telegram.org";

export type InlineKeyboard = {
  inline_keyboard: { text: string; url: string }[][];
};

export type SendMessageOptions = {
  parse_mode?: "HTML" | "MarkdownV2";
  reply_markup?: InlineKeyboard;
  disable_web_page_preview?: boolean;
};

export type SendResult = {
  ok: boolean;
  status: number;
  forbidden: boolean;
};

export async function sendMessage(
  chatId: number | string,
  text: string,
  options: SendMessageOptions = {}
): Promise<SendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("[tg] TELEGRAM_BOT_TOKEN is not set");
    return { ok: false, status: 0, forbidden: false };
  }
  const res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, ...options }),
    cache: "no-store",
  });
  return { ok: res.ok, status: res.status, forbidden: res.status === 403 };
}
