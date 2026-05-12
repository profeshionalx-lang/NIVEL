import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ClaimError, claimSession, createSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get("token");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const savedState = cookieStore.get("__grechka_state")?.value;
  const claimToken = cookieStore.get("__grechka_claim")?.value ?? null;
  cookieStore.delete("__grechka_state");
  cookieStore.delete("__grechka_claim");

  if (!token || !state || state !== savedState) {
    return NextResponse.redirect(`${origin}/login?error=invalid_state`);
  }

  try {
    if (claimToken) {
      await claimSession(token, claimToken);
    } else {
      await createSession(token);
    }
    return NextResponse.redirect(`${origin}/dashboard`);
  } catch (err) {
    if (err instanceof ClaimError) {
      console.error("[grechka-callback] claimSession failed:", err.code);
      return NextResponse.redirect(`${origin}/login?error=claim_${err.code}`);
    }
    console.error("[grechka-callback] createSession failed:", err);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }
}
