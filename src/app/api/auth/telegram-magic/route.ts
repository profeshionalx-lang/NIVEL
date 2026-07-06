import { NextRequest, NextResponse } from "next/server";
import { consumeMagicToken } from "@/lib/telegram/magicTokens";
import { createSessionForProfile, getSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const url = request.nextUrl.clone();
  url.search = "";

  if (!token) {
    return redirectExpired(request);
  }

  const consumed = await consumeMagicToken(token);
  if (!consumed) {
    // Invalid, expired, or already-used token. If the caller already has a
    // valid session, just send them to the dashboard (we no longer know
    // the intended next_path). Otherwise send them to login with a hint.
    const existing = await getSession();
    if (existing) {
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    return redirectExpired(request);
  }

  try {
    await createSessionForProfile(consumed.profileId);
  } catch (error) {
    console.error("[tg] telegram-magic: failed to create session", error);
    return redirectExpired(request);
  }

  url.pathname = consumed.nextPath;
  return NextResponse.redirect(url);
}

function redirectExpired(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "?reason=magic_expired";
  return NextResponse.redirect(url);
}
