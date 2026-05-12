import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { verifyFirebaseIdToken } from "@/lib/firebase/admin";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = {
  firebase_uid: string;
  email: string;
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: "trainer" | "student";
};

const SESSION_COOKIE = "__session";
const MAX_AGE_SECONDS = 14 * 24 * 60 * 60; // 14 days

function getSecret() {
  const s = process.env.SESSION_SECRET?.trim();
  if (!s) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function createSession(idToken: string): Promise<SessionUser> {
  const { uid, email } = await verifyFirebaseIdToken(idToken);
  const profile = await getOrCreateSupabaseProfile(uid, email);

  const payload: SessionUser = {
    firebase_uid: uid,
    email,
    id: profile.id,
    full_name: profile.full_name,
    avatar_url: profile.avatar_url,
    role: profile.role,
  };

  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });

  return payload;
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

async function getOrCreateSupabaseProfile(
  firebase_uid: string,
  email: string
): Promise<{ id: string; full_name: string; avatar_url: string | null; role: "trainer" | "student" }> {
  const supabase = await createClient();

  // 1) Primary lookup: firebase_uid (stable identity).
  const { data: byUid } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role")
    .eq("firebase_uid", firebase_uid)
    .maybeSingle();

  if (byUid) return byUid;

  // 2) Secondary lookup: email. If found and firebase_uid is still NULL,
  //    attach this Firebase identity to that profile (first-login bind).
  const { data: byEmail } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role, firebase_uid")
    .eq("email", email)
    .maybeSingle();

  if (byEmail) {
    if (!byEmail.firebase_uid) {
      const { error: bindErr } = await supabase
        .from("profiles")
        .update({ firebase_uid })
        .eq("id", byEmail.id);
      if (bindErr) throw new Error(`Failed to bind firebase_uid: ${bindErr.message}`);
    }
    return {
      id: byEmail.id,
      full_name: byEmail.full_name,
      avatar_url: byEmail.avatar_url,
      role: byEmail.role,
    };
  }

  // 3) Brand-new user: create profile with both email AND firebase_uid set.
  const { data: created, error } = await supabase
    .from("profiles")
    .insert({
      email,
      firebase_uid,
      full_name: email.split("@")[0],
      role: "student",
    })
    .select("id, full_name, avatar_url, role")
    .single();

  if (error || !created) throw new Error(`Failed to create profile: ${error?.message}`);
  return created;
}
