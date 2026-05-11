// Firebase token verification without firebase-admin.
// Uses Firebase REST Identity Toolkit API + Google's public JWKS.

import { importX509, jwtVerify, createRemoteJWKSet } from "jose";

const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!.trim();
const GOOGLE_CERTS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

const JWKS = createRemoteJWKSet(new URL(GOOGLE_CERTS_URL));

export async function verifyFirebaseIdToken(idToken: string) {
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
    algorithms: ["RS256"],
  });

  const uid = payload.sub!;
  const email = (payload as Record<string, unknown>).email as string;

  if (!uid || !email) throw new Error("Invalid token: missing uid or email");

  return { uid, email };
}
