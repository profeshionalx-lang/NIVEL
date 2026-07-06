import { NextResponse } from "next/server";
import { createSession, claimSession, ClaimError } from "@/lib/auth/session";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`auth-session:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!limit.ok) return tooManyRequests(limit.retryAfterMs);

  try {
    const { idToken, claimToken } = await request.json();
    if (!idToken) return NextResponse.json({ error: "Missing idToken" }, { status: 400 });

    const user = claimToken
      ? await claimSession(idToken, claimToken)
      : await createSession(idToken);
    return NextResponse.json({ ok: true, user });
  } catch (err) {
    if (err instanceof ClaimError) {
      return NextResponse.json({ error: `claim_${err.code}` }, { status: 422 });
    }
    console.error("Session creation failed:", err);
    return NextResponse.json({ error: "auth_failed" }, { status: 401 });
  }
}
