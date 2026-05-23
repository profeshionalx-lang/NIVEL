import { NextResponse } from "next/server";
import { createSession, claimSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const { idToken, claimToken } = await request.json();
    if (!idToken) return NextResponse.json({ error: "Missing idToken" }, { status: 400 });

    const user = claimToken
      ? await claimSession(idToken, claimToken)
      : await createSession(idToken);
    return NextResponse.json({ ok: true, user });
  } catch (err) {
    console.error("Session creation failed:", err);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
