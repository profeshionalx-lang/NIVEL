// Firebase token verification without firebase-admin.
// Uses Firebase REST Identity Toolkit API + Google's public JWKS.

import { importX509, jwtVerify, createRemoteJWKSet } from "jose";

const GOOGLE_CERTS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

const JWKS = createRemoteJWKSet(new URL(GOOGLE_CERTS_URL));

// Lazy: читаем env внутри функции, а не на module-scope. Иначе отсутствие
// NEXT_PUBLIC_FIREBASE_PROJECT_ID (напр. в Preview-окружении) роняет
// вычисление модуля при `next build` (collect page data), а не в рантайме.
function getFirebaseProjectId(): string {
  const id = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  if (!id) throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set");
  return id;
}

export async function verifyFirebaseIdToken(idToken: string) {
  const projectId = getFirebaseProjectId();
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    algorithms: ["RS256"],
  });

  const uid = payload.sub!;
  const email = (payload as Record<string, unknown>).email as string;

  if (!uid || !email) throw new Error("Invalid token: missing uid or email");

  return { uid, email };
}
