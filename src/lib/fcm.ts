// Server-side push notifications via Firebase Cloud Messaging HTTP v1.
//
// Mirrors the project's "no firebase-admin" decision (see CLAUDE.md): we mint a
// Google OAuth2 access token ourselves by signing a JWT with the service-account
// private key (`jose`), then call the FCM v1 `messages:send` endpoint.
//
// Credentials live in the `FCM_SERVICE_ACCOUNT_JSON` env var — the full service
// account JSON downloaded from Firebase Console → Project Settings → Service
// accounts → Generate new private key. If it is absent, every helper no-ops
// gracefully (same posture as Telegram when TELEGRAM_BOT_TOKEN is unset), so
// missing config never breaks the surrounding Server Action.

import { SignJWT, importPKCS8 } from "jose";
import { createClient } from "@/lib/supabase/server";

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

export type PushResult = "sent" | "no_token" | "not_configured" | "failed";

function getServiceAccount(): ServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      console.error("[fcm] FCM_SERVICE_ACCOUNT_JSON missing required fields");
      return null;
    }
    // Normalize escaped newlines (common when stored as a single-line env var).
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    return parsed;
  } catch (e) {
    console.error("[fcm] FCM_SERVICE_ACCOUNT_JSON is not valid JSON", e);
    return null;
  }
}

// Cache the access token across invocations within a warm lambda.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(sa: ServiceAccount): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - 60 > now) {
    return cachedToken.value;
  }

  try {
    const key = await importPKCS8(sa.private_key, "RS256");
    const assertion = await new SignJWT({ scope: FCM_SCOPE })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuer(sa.client_email)
      .setSubject(sa.client_email)
      .setAudience(TOKEN_URL)
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(key);

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[fcm] token exchange failed", res.status, await res.text());
      return null;
    }
    const json = (await res.json()) as { access_token: string; expires_in: number };
    cachedToken = {
      value: json.access_token,
      expiresAt: now + (json.expires_in ?? 3600),
    };
    return json.access_token;
  } catch (e) {
    console.error("[fcm] failed to mint access token", e);
    return null;
  }
}

async function getDeviceTokens(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("device_tokens")
    .select("token")
    .eq("user_id", userId);
  return (data ?? []).map((r) => (r as { token: string }).token).filter(Boolean);
}

async function deleteDeviceToken(token: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("device_tokens").delete().eq("token", token);
}

/**
 * Send a push notification to every registered device of `userId`.
 *
 * `data` is delivered as FCM data payload (string values only) — the Android
 * client reads e.g. `data.deeplink` to open the right screen on tap.
 * Never throws: returns a status enum so callers can fire-and-forget.
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<PushResult> {
  const sa = getServiceAccount();
  if (!sa) return "not_configured";

  try {
    const tokens = await getDeviceTokens(userId);
    if (tokens.length === 0) return "no_token";

    const accessToken = await getAccessToken(sa);
    if (!accessToken) return "failed";

    const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

    let anySent = false;
    let anyFailed = false;

    await Promise.all(
      tokens.map(async (token) => {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
              data,
              android: { priority: "HIGH" },
            },
          }),
          cache: "no-store",
        });

        if (res.ok) {
          anySent = true;
          return;
        }
        anyFailed = true;
        // 404 UNREGISTERED / 400 invalid token → drop the stale token.
        if (res.status === 404 || res.status === 400) {
          await deleteDeviceToken(token);
        } else {
          console.error("[fcm] send failed", res.status, await res.text());
        }
      })
    );

    if (anySent) return "sent";
    return anyFailed ? "failed" : "no_token";
  } catch (e) {
    console.error("[fcm] sendPushNotification failed", e);
    return "failed";
  }
}
