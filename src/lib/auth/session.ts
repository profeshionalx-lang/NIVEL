import { cookies, headers } from "next/headers";
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

async function resolveLoginPayload(idToken: string): Promise<SessionUser> {
  const { uid, email } = await verifyFirebaseIdToken(idToken);
  const profile = await getOrCreateSupabaseProfile(uid, email);
  return {
    firebase_uid: uid,
    email,
    id: profile.id,
    full_name: profile.full_name,
    avatar_url: profile.avatar_url,
    role: profile.role,
  };
}

async function signSessionToken(payload: SessionUser): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
}

async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function createSession(idToken: string): Promise<SessionUser> {
  const payload = await resolveLoginPayload(idToken);
  await setSessionCookie(await signSessionToken(payload));
  return payload;
}

export type BearerSession = { token: string; user: SessionUser; expiresIn: number };

/**
 * Exchange a Firebase ID token for a bearer session JWT, for native/mobile
 * clients that can't use the httpOnly `__session` cookie. Returns the SAME
 * HMAC-signed token as the web cookie — verified identically by getSession.
 * Honors the claim flow when a claimToken is provided.
 */
export async function exchangeIdTokenForBearer(
  idToken: string,
  claimToken?: string | null
): Promise<BearerSession> {
  const payload = claimToken
    ? await resolveClaimPayload(idToken, claimToken)
    : await resolveLoginPayload(idToken);
  const token = await signSessionToken(payload);
  return { token, user: payload, expiresIn: MAX_AGE_SECONDS };
}

export async function getSession(): Promise<SessionUser | null> {
  // Native/mobile clients send the session JWT as a bearer token; the web
  // sends it as the httpOnly cookie. Accept either — bearer takes precedence.
  try {
    const requestHeaders = await headers();
    const authorization =
      requestHeaders.get("authorization") ?? requestHeaders.get("Authorization");
    if (authorization?.startsWith("Bearer ")) {
      const fromBearer = await verifySessionToken(authorization.slice(7).trim());
      if (fromBearer) return fromBearer;
    }
  } catch {
    // headers() can be unavailable in some execution contexts — fall back to cookie.
  }

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
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

export class ClaimError extends Error {
  code:
    | "invalid_token"
    | "expired"
    | "already_claimed"
    | "email_collision"
    | "uid_collision"
    | "firebase_invalid";
  constructor(code: ClaimError["code"], message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

async function resolveClaimPayload(
  idToken: string,
  claimToken: string
): Promise<SessionUser> {
  // 1) Verify Firebase ID token.
  let uid: string;
  let email: string;
  const avatar_url: string | null = null;
  try {
    const verified = await verifyFirebaseIdToken(idToken);
    uid = verified.uid;
    email = verified.email;
    // verifyFirebaseIdToken returns { uid, email }; picture (if present) is optional.
    // If your verifier exposes more claims, extend it; for now avatar_url stays null
    // and will be updated via a future profile-edit screen.
  } catch {
    throw new ClaimError("firebase_invalid");
  }

  const supabase = await createClient();

  // 2) Find shadow profile by claim_token.
  const { data: shadow } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role, claim_expires_at, claimed_at, firebase_uid")
    .eq("claim_token", claimToken)
    .maybeSingle();

  if (!shadow) throw new ClaimError("invalid_token");
  if (shadow.claimed_at) throw new ClaimError("already_claimed");
  if (
    shadow.claim_expires_at &&
    new Date(shadow.claim_expires_at).getTime() < Date.now()
  ) {
    throw new ClaimError("expired");
  }

  // 3) Detect collisions: another profile already bound to this firebase_uid
  //    or holding this email.
  const { data: byUid } = await supabase
    .from("profiles")
    .select("id")
    .eq("firebase_uid", uid)
    .neq("id", shadow.id)
    .maybeSingle();
  if (byUid) {
    // Revoke the token so the link can't be re-used.
    await supabase
      .from("profiles")
      .update({ claim_token: null, claim_expires_at: null })
      .eq("id", shadow.id);
    throw new ClaimError("uid_collision");
  }

  const { data: byEmail } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .neq("id", shadow.id)
    .maybeSingle();
  if (byEmail) {
    await supabase
      .from("profiles")
      .update({ claim_token: null, claim_expires_at: null })
      .eq("id", shadow.id);
    throw new ClaimError("email_collision");
  }

  // 4) Bind Firebase identity to the shadow profile.
  const { data: updated, error: updErr } = await supabase
    .from("profiles")
    .update({
      firebase_uid: uid,
      email,
      avatar_url: avatar_url ?? shadow.avatar_url,
      claimed_at: new Date().toISOString(),
      claim_token: null,
      claim_expires_at: null,
    })
    .eq("id", shadow.id)
    .select("id, full_name, avatar_url, role")
    .single();

  if (updErr || !updated) {
    throw new ClaimError("invalid_token", `Failed to update profile: ${updErr?.message}`);
  }

  // 5) Build the session payload (token minting / cookie handled by callers).
  const payload: SessionUser = {
    firebase_uid: uid,
    email,
    id: updated.id,
    full_name: updated.full_name,
    avatar_url: updated.avatar_url,
    role: updated.role,
  };

  return payload;
}

export async function claimSession(
  idToken: string,
  claimToken: string
): Promise<SessionUser> {
  const payload = await resolveClaimPayload(idToken, claimToken);
  await setSessionCookie(await signSessionToken(payload));
  return payload;
}
