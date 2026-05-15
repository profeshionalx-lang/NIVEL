import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ClaimError, claimSession, createSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get("token");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const savedState = cookieStore.get("__grechka_state")?.value;
  cookieStore.delete("__grechka_state");
  // Legacy fallback: claim used to ride in its own cookie.
  const legacyClaimCookie = cookieStore.get("__grechka_claim")?.value ?? null;
  cookieStore.delete("__grechka_claim");

  // `state` is `${csrf}` or `${csrf}~${claimToken}` — the claim token rides
  // inside state so it survives the OAuth round-trip even when cookies don't.
  const [csrf, claimFromState] = (state ?? "").split("~");
  const claimToken = claimFromState ?? legacyClaimCookie;

  if (!token || !csrf || csrf !== savedState) {
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
