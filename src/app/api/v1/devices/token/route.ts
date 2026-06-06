import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/v1/devices/token
 * Body: { token: string, platform?: "android" }
 *
 * Registers (upserts) an FCM device token for the authenticated user so the
 * server can later send push notifications via `sendPushNotification`.
 * Bearer-authorized like every other /api/v1 route — the cookie gate in
 * proxy.ts does not protect /api/v1, so we call getSession() here.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: { token?: string; platform?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const token = body.token?.trim();
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }
  const platform = body.platform?.trim() || "android";

  const supabase = await createClient();
  const { error } = await supabase
    .from("device_tokens")
    .upsert(
      {
        user_id: session.id,
        token,
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform" }
    );

  if (error) {
    console.error("[fcm] failed to upsert device token", error);
    return NextResponse.json({ error: "failed to save token" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
