import { createClient } from "@/lib/supabase/server";
import { sendMessage } from "@/lib/telegram/client";
import { consumeLinkToken } from "@/lib/telegram/tokens";
import { confirmAuthCode, getPendingClaimProfileId } from "@/lib/telegram/authCodes";

export const dynamic = "force-dynamic";

const LOGIN_PREFIX = "login_";

type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
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
  if (!secret) {
    // Fail loudly: missing env is a deploy bug, not a Telegram-side issue.
    console.error("[tg] TELEGRAM_WEBHOOK_SECRET is not set — webhook is misconfigured");
    return new Response("misconfigured", { status: 500 });
  }
  const headerSecret = req.headers.get("x-telegram-bot-api-secret-token");
  if (headerSecret !== secret) {
    // Silently 200 so legitimate Telegram retries don't pile up if a real request gets here.
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
    const payload = text.slice("/start ".length).trim();
    if (!payload) return OK;

    if (payload.startsWith(LOGIN_PREFIX)) {
      const code = payload.slice(LOGIN_PREFIX.length).trim();
      if (!code) return OK;
      await handleStartWithLoginCode(code, message, chatId);
      return OK;
    }

    await handleStartWithToken(payload, message, chatId);
    return OK;
  }

  return OK;
}

async function handleStartWithLoginCode(
  code: string,
  message: TelegramMessage,
  chatId: number
): Promise<void> {
  try {
    const supabase = await createClient();

    // 0) Invite flow: the code carries a trainer-created shadow profile —
    //    bind this Telegram to it instead of the regular login path.
    const claimProfileId = await getPendingClaimProfileId(code);
    if (claimProfileId) {
      await handleClaimLogin(code, claimProfileId, message, chatId);
      return;
    }

    // 1) Chat already linked to a profile → just confirm the login code.
    const { data: existingLink } = await supabase
      .from("telegram_links")
      .select("profile_id")
      .eq("telegram_chat_id", chatId)
      .eq("is_active", true)
      .maybeSingle();

    let profileId = existingLink?.profile_id as string | undefined;

    if (!profileId) {
      // 2) New chat → auto-create a student profile from Telegram identity.
      const firstName = message.from?.first_name?.trim() ?? "";
      const lastName = message.from?.last_name?.trim() ?? "";
      const fullName = [firstName, lastName].filter(Boolean).join(" ").trim() || "Telegram-пользователь";
      const telegramUserId = message.from?.id;
      const syntheticEmail = telegramUserId ? `tg${telegramUserId}@telegram.local` : null;

      const { data: created, error: createErr } = await supabase
        .from("profiles")
        .insert({
          full_name: fullName,
          role: "student",
          email: syntheticEmail,
          firebase_uid: null,
        })
        .select("id")
        .single();

      if (createErr || !created) {
        console.error("[tg] failed to auto-create profile", createErr);
        await sendMessage(chatId, "Не удалось войти. Попробуй позже.");
        return;
      }

      profileId = created.id as string;

      const { error: linkErr } = await supabase.from("telegram_links").upsert(
        {
          profile_id: profileId,
          telegram_chat_id: chatId,
          telegram_user_id: telegramUserId ?? null,
          username: message.from?.username ?? null,
          linked_at: new Date().toISOString(),
          is_active: true,
        },
        { onConflict: "profile_id" }
      );

      if (linkErr) {
        console.error("[tg] failed to link auto-created profile", linkErr);
        await sendMessage(chatId, "Не удалось войти. Попробуй позже.");
        return;
      }
    }

    const confirmed = await confirmAuthCode(code, profileId);
    if (!confirmed) {
      await sendMessage(
        chatId,
        "Ссылка устарела, обнови страницу входа и попробуй ещё раз."
      );
      return;
    }

    await sendMessage(
      chatId,
      "✅ Готово! Возвращайся на страницу Nivel — вход выполнится сам."
    );
  } catch (e) {
    console.error("[tg] handleStartWithLoginCode failed", e);
  }
}

async function handleClaimLogin(
  code: string,
  claimProfileId: string,
  message: TelegramMessage,
  chatId: number
): Promise<void> {
  const supabase = await createClient();

  // Re-check the shadow profile is still claimable (start endpoint validated
  // it, but the invite could have been claimed/expired since).
  const { data: shadow } = await supabase
    .from("profiles")
    .select("id, claimed_at, claim_expires_at")
    .eq("id", claimProfileId)
    .maybeSingle();

  if (
    !shadow ||
    shadow.claimed_at ||
    (shadow.claim_expires_at &&
      new Date(shadow.claim_expires_at).getTime() < Date.now())
  ) {
    await sendMessage(
      chatId,
      "Приглашение уже использовано или истекло. Открой страницу входа Nivel и войди без ссылки-приглашения."
    );
    return;
  }

  // This Telegram must not already belong to another profile — same
  // semantics as the uid_collision case in the Google claim flow.
  const { data: existingLink } = await supabase
    .from("telegram_links")
    .select("profile_id")
    .eq("telegram_chat_id", chatId)
    .eq("is_active", true)
    .maybeSingle();

  if (existingLink && existingLink.profile_id !== claimProfileId) {
    await sendMessage(
      chatId,
      "Этот Telegram уже привязан к другому аккаунту Nivel. Войди в него без ссылки-приглашения или сначала отключи Telegram в том аккаунте."
    );
    return;
  }

  const { error: linkErr } = await supabase.from("telegram_links").upsert(
    {
      profile_id: claimProfileId,
      telegram_chat_id: chatId,
      telegram_user_id: message.from?.id ?? null,
      username: message.from?.username ?? null,
      linked_at: new Date().toISOString(),
      is_active: true,
    },
    { onConflict: "profile_id" }
  );

  if (linkErr) {
    console.error("[tg] claim login: failed to link telegram", linkErr);
    await sendMessage(chatId, "Не удалось войти. Попробуй позже.");
    return;
  }

  const { error: claimErr } = await supabase
    .from("profiles")
    .update({
      claimed_at: new Date().toISOString(),
      claim_token: null,
      claim_expires_at: null,
    })
    .eq("id", claimProfileId)
    .is("claimed_at", null);

  if (claimErr) {
    console.error("[tg] claim login: failed to mark claimed", claimErr);
    await sendMessage(chatId, "Не удалось войти. Попробуй позже.");
    return;
  }

  const confirmed = await confirmAuthCode(code, claimProfileId);
  if (!confirmed) {
    await sendMessage(
      chatId,
      "Ссылка устарела, обнови страницу входа и попробуй ещё раз."
    );
    return;
  }

  await sendMessage(
    chatId,
    "✅ Готово! Возвращайся на страницу Nivel — вход выполнится сам."
  );
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
