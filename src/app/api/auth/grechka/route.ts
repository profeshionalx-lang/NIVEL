import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

export async function GET() {
  const state = randomBytes(16).toString("hex");

  const cookieStore = await cookies();
  cookieStore.set("__grechka_state", state, {
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
