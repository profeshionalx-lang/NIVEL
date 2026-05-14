import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const claim = searchParams.get("claim");

  // CSRF nonce stored in cookie; claim token rides along inside `state` itself,
  // because the OAuth `state` round-trips reliably through Гречка while a
  // separate cookie can be dropped by in-app browsers / long redirect chains.
  const csrf = randomBytes(16).toString("hex");
  const state = claim ? `${csrf}~${claim}` : csrf;

  const cookieStore = await cookies();
  cookieStore.set("__grechka_state", csrf, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 min
    path: "/",
  });

  const grechkaUrl = process.env.NEXT_PUBLIC_GRECHKA_URL?.trim();
  const nivelUrl = process.env.NEXT_PUBLIC_NIVEL_URL?.trim();

  const redirectUrl = new URL(`${grechkaUrl}/auth-nivel.html`);
  redirectUrl.searchParams.set("redirect_uri", `${nivelUrl}/api/auth/grechka-callback`);
  redirectUrl.searchParams.set("state", state);

  return NextResponse.redirect(redirectUrl.toString());
}
