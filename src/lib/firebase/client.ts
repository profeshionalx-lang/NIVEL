import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;

export function getFirebaseAuth(): Auth {
  if (_auth) return _auth;

  if (!_app) {
    _app = getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!.trim(),
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!.trim(),
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!.trim(),
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!.trim(),
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!.trim(),
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!.trim(),
        });
  }

  _auth = getAuth(_app);
  return _auth;
}
