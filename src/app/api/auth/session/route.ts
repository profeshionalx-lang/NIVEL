import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();
    if (!idToken) return NextResponse.json({ error: "Missing idToken" }, { status: 400 });

    const user = await createSession(idToken);
    return NextResponse.json({ ok: true, user });
  } catch (err) {
    console.error("Session creation failed:", err);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
