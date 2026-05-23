#!/usr/bin/env node
// Usage:
//   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... \
//   [TELEGRAM_WEBHOOK_URL=https://your.app/api/telegram/webhook] \
//   node scripts/setup-telegram-webhook.mjs

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const url = process.env.TELEGRAM_WEBHOOK_URL ?? "https://nivel-five.vercel.app/api/telegram/webhook";

if (!token || !secret) {
  console.error("Need TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in env.");
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url,
    secret_token: secret,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  }),
});

const body = await res.text();
console.log("HTTP", res.status);
console.log(body);
if (!res.ok) process.exit(1);
