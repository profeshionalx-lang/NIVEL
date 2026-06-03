import { NextResponse } from "next/server";
import { exchangeIdTokenForBearer, ClaimError } from "@/lib/auth/session";

/**
 * POST /api/v1/auth/token
 *
 * Native/mobile bearer login. Body: { idToken, claimToken? }.
 * Verifies the Firebase ID token and returns a bearer session JWT
 * (same HMAC token as the web __session cookie) for use in the
 * `Authorization: Bearer <token>` header on subsequent /api/v1 calls.
 */
export async function POST(request: Request) {
  let body: { idToken?: string; claimToken?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { idToken, claimToken } = body;
  if (!idToken) {
    return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
  }

  try {
    const session = await exchangeIdTokenForBearer(idToken, claimToken ?? null);
    return NextResponse.json({ ok: true, ...session });
  } catch (err) {
    if (err instanceof ClaimError) {
      return NextResponse.json({ error: `claim_${err.code}` }, { status: 422 });
    }
    console.error("Bearer token exchange failed:", err);
    return NextResponse.json({ error: "auth_failed" }, { status: 401 });
  }
}
