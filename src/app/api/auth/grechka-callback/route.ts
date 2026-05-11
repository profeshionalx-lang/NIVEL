import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get("token");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const savedState = cookieStore.get("__grechka_state")?.value;
  cookieStore.delete("__grechka_state");

  if (!token || !state || state !== savedState) {
    return NextResponse.redirect(`${origin}/login?error=invalid_state`);
  }

  try {
    await createSession(token);
    return NextResponse.redirect(`${origin}/dashboard`);
  } catch (err) {
    console.error("[grechka-callback] createSession failed:", err);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }
}
