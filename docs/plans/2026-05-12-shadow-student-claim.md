# Shadow Student Claim Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow a trainer to pre-create a student profile (shadow) with content, send an invite link, and have the student claim that profile on first Grechka sign-in (binding `firebase_uid` + Firebase email to the existing row).

**Architecture:** Invite token is stored directly on `profiles` (columns `claim_token`, `claim_expires_at`, `claimed_at`, `firebase_uid`, `created_by`). The `/invite/[token]` page validates the token, then redirects to `/api/auth/grechka?claim=<token>` which stashes the token in a short-lived cookie. After Grechka callback, if the claim cookie is present, the system runs `claimSession` (find profile by `claim_token`, write `firebase_uid` + Firebase email, mark claimed) instead of the normal `createSession` path. Firebase is the source of truth for email at claim time; collisions revoke the token.

**Tech Stack:** Next.js 16 App Router, Supabase Postgres, Firebase Auth (verified via jose+JWKS), TypeScript.

**Conventions:**
- Branch: `feat/shadow-student-claim`
- One commit per task; commit message style matches recent log (`feat:`, `fix:`, `chore:`).
- Supabase Management API base: `https://api.supabase.com/v1/projects/gqcyaxxhvyvpzuhoysis`.
- `$SUPABASE_ACCESS_TOKEN` lives in user memory at `/Users/ebabasyan/.claude/projects/-Users-ebabasyan-NIVEL/memory/supabase_access.md`. Source it before any curl.
- Dev URL `http://localhost:3000`; prod URL `https://nivel-five.vercel.app`.

**Pre-flight (run once before Task 1):**
```bash
git checkout main && git pull
git checkout -b feat/shadow-student-claim
```

---

### Task 1: Create migration `008_shadow_student_claim.sql`

**Files:** `supabase/migrations/008_shadow_student_claim.sql` (new)

**Step 1:** Create the file with this exact content:

```sql
-- ============================================
-- 008 — Shadow student profiles + claim tokens
-- ============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS firebase_uid     TEXT,
  ADD COLUMN IF NOT EXISTS claim_token      TEXT,
  ADD COLUMN IF NOT EXISTS claim_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Email is now optional: shadow rows are created with email = NULL,
-- and the claim flow writes the real Firebase email at first sign-in.
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;

-- A firebase_uid can map to at most one profile.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_firebase_uid_key
  ON public.profiles(firebase_uid)
  WHERE firebase_uid IS NOT NULL;

-- A claim_token is unique while live.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_claim_token_key
  ON public.profiles(claim_token)
  WHERE claim_token IS NOT NULL;

-- Lookup index for the claim landing page.
CREATE INDEX IF NOT EXISTS idx_profiles_claim_token ON public.profiles(claim_token);
CREATE INDEX IF NOT EXISTS idx_profiles_created_by  ON public.profiles(created_by);

COMMENT ON COLUMN public.profiles.firebase_uid     IS 'Firebase Auth UID. NULL until the profile is claimed.';
COMMENT ON COLUMN public.profiles.claim_token      IS 'Single-use invite token (32+ chars hex). NULL after claim or revoke.';
COMMENT ON COLUMN public.profiles.claim_expires_at IS 'Invite expiration; ignored when claim_token is NULL.';
COMMENT ON COLUMN public.profiles.claimed_at       IS 'Set when student first signs in via the invite.';
COMMENT ON COLUMN public.profiles.created_by       IS 'Trainer profile.id that created this shadow row.';
```

**Step 2:** Apply via Supabase Management API:

```bash
source /Users/ebabasyan/.claude/projects/-Users-ebabasyan-NIVEL/memory/supabase_access.md 2>/dev/null || true
# (file is markdown; copy token manually into $SUPABASE_ACCESS_TOKEN if source fails)

SQL=$(cat supabase/migrations/008_shadow_student_claim.sql)
curl -s -X POST \
  "https://api.supabase.com/v1/projects/gqcyaxxhvyvpzuhoysis/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data "$(jq -Rs --arg q "$SQL" '{query: $q}' <<<'')"
```

**Step 3:** Verify with:

```bash
curl -s -X POST \
  "https://api.supabase.com/v1/projects/gqcyaxxhvyvpzuhoysis/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='\''public'\'' AND table_name='\''profiles'\'' ORDER BY ordinal_position;"}'
```

**Expected:** Response includes new rows `firebase_uid`, `claim_token`, `claim_expires_at`, `claimed_at`, `created_by` — all `is_nullable = YES`. Existing rows untouched (`firebase_uid` stays NULL; next login fills it via Task 2).

**Step 4:** Commit.
```bash
git add supabase/migrations/008_shadow_student_claim.sql
git commit -m "feat(db): add shadow student + claim_token columns to profiles"
```

---

### Task 2: Update `getOrCreateSupabaseProfile` — lookup by firebase_uid first

**Files:** `src/lib/auth/session.ts` (replace lines 73–95)

**Step 1:** Replace the entire `getOrCreateSupabaseProfile` function (and update the return shape so callers carry `firebase_uid`-aware data). The final file content for that region:

```ts
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
```

**Step 2:** Verify by `pnpm tsc --noEmit` (or `pnpm build` if no tsc script). Expected: no type errors.

**Step 3:** Manual smoke (optional, leave for end-to-end test): sign in with an existing user — should still land in `/dashboard`, and `firebase_uid` column in `profiles` for that email should be populated. Verify SQL:

```bash
curl -s -X POST \
  "https://api.supabase.com/v1/projects/gqcyaxxhvyvpzuhoysis/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT id, email, firebase_uid FROM public.profiles WHERE email = '\''profeshionalx@gmail.com'\'';"}'
```

**Expected:** `firebase_uid` non-null after a fresh sign-in.

**Step 4:** Commit.
```bash
git add src/lib/auth/session.ts
git commit -m "feat(auth): lookup profile by firebase_uid first, bind on first login"
```

---

### Task 3: Add `claimSession` to `src/lib/auth/session.ts`

**Files:** `src/lib/auth/session.ts` (add new exported function)

**Step 1:** Append this function below `getOrCreateSupabaseProfile`. It re-uses `getSecret()` and the constants already in the file.

```ts
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

export async function claimSession(
  idToken: string,
  claimToken: string
): Promise<SessionUser> {
  // 1) Verify Firebase ID token.
  let uid: string;
  let email: string;
  let avatar_url: string | null = null;
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

  // 5) Mint session cookie (same logic as createSession).
  const payload: SessionUser = {
    firebase_uid: uid,
    email,
    id: updated.id,
    full_name: updated.full_name,
    avatar_url: updated.avatar_url,
    role: updated.role,
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
```

**Step 2:** Run `pnpm tsc --noEmit`. Expected: no errors.

**Step 3:** Commit.
```bash
git add src/lib/auth/session.ts
git commit -m "feat(auth): add claimSession for invite-based profile binding"
```

---

### Task 4: Create `src/lib/actions/students.ts` with `createShadowStudent`, `regenerateClaimToken`, `revokeClaimToken`

**Files:** `src/lib/actions/students.ts` (new)

**Step 1:** Create the file:

```ts
"use server";

import { randomBytes } from "crypto";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const CLAIM_TTL_DAYS = 30;

function generateToken(): string {
  // 32 bytes → 64 hex chars. URL-safe out of the box.
  return randomBytes(32).toString("hex");
}

function expiryFromNow(days = CLAIM_TTL_DAYS): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function buildClaimUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_NIVEL_URL?.trim();
  if (!base) throw new Error("NEXT_PUBLIC_NIVEL_URL is not set");
  return `${base.replace(/\/$/, "")}/invite/${token}`;
}

async function requireTrainer() {
  const session = await getSession();
  if (!session) throw new Error("unauthorized");
  if (session.role !== "trainer") throw new Error("forbidden");
  return session;
}

export type CreateShadowStudentInput = {
  full_name: string;
};

export type CreateShadowStudentResult = {
  studentId: string;
  claimUrl: string;
  claimToken: string;
  expiresAt: string;
};

export async function createShadowStudent(
  input: CreateShadowStudentInput
): Promise<CreateShadowStudentResult> {
  const trainer = await requireTrainer();

  const full_name = input.full_name?.trim();
  if (!full_name) throw new Error("full_name is required");

  const supabase = await createClient();

  const claimToken = generateToken();
  const expiresAt = expiryFromNow();

  // Email is left NULL on purpose — it will be filled from the Firebase token
  // when the student claims the profile.
  const { data: created, error } = await supabase
    .from("profiles")
    .insert({
      email: null,
      full_name,
      role: "student",
      created_by: trainer.id,
      claim_token: claimToken,
      claim_expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(`Failed to create shadow student: ${error?.message}`);
  }

  return {
    studentId: created.id,
    claimUrl: buildClaimUrl(claimToken),
    claimToken,
    expiresAt,
  };
}

export async function regenerateClaimToken(
  studentId: string
): Promise<CreateShadowStudentResult> {
  await requireTrainer();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("profiles")
    .select("id, claimed_at")
    .eq("id", studentId)
    .maybeSingle();
  if (!existing) throw new Error("not_found");
  if (existing.claimed_at) throw new Error("already_claimed");

  const claimToken = generateToken();
  const expiresAt = expiryFromNow();

  const { error } = await supabase
    .from("profiles")
    .update({ claim_token: claimToken, claim_expires_at: expiresAt })
    .eq("id", studentId);
  if (error) throw new Error(`Failed to regenerate token: ${error.message}`);

  return {
    studentId,
    claimUrl: buildClaimUrl(claimToken),
    claimToken,
    expiresAt,
  };
}

export async function revokeClaimToken(studentId: string): Promise<void> {
  await requireTrainer();
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ claim_token: null, claim_expires_at: null })
    .eq("id", studentId);
  if (error) throw new Error(`Failed to revoke token: ${error.message}`);
}
```

**Step 2:** Run `pnpm tsc --noEmit`. Expected: no errors.

**Step 3:** Smoke-test via a temporary Node REPL is not practical; instead verify the SQL-side from the acceptance test at the end. For now, only confirm the file compiles.

**Step 4:** Commit.
```bash
git add src/lib/actions/students.ts
git commit -m "feat(students): add createShadowStudent + regenerate/revoke claim tokens"
```

---

### Task 5: Invite landing page `/invite/[token]/page.tsx`

**Files:** `src/app/invite/[token]/page.tsx` (new)

**Step 1:** Create the page (Server Component; Next.js 16 async `params`):

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ token: string }>;
};

type InviteState =
  | { kind: "ok"; fullName: string; token: string }
  | { kind: "invalid" }
  | { kind: "expired" }
  | { kind: "claimed" };

async function loadInvite(token: string): Promise<InviteState> {
  if (!token || token.length < 16) return { kind: "invalid" };

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("full_name, claim_expires_at, claimed_at")
    .eq("claim_token", token)
    .maybeSingle();

  if (!data) return { kind: "invalid" };
  if (data.claimed_at) return { kind: "claimed" };
  if (
    data.claim_expires_at &&
    new Date(data.claim_expires_at).getTime() < Date.now()
  ) {
    return { kind: "expired" };
  }
  return { kind: "ok", fullName: data.full_name ?? "", token };
}

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;
  const state = await loadInvite(token);

  if (state.kind !== "ok") {
    const msg =
      state.kind === "expired"
        ? "Срок действия приглашения истёк. Попросите тренера выпустить новую ссылку."
        : state.kind === "claimed"
        ? "Это приглашение уже использовано. Войдите обычным способом."
        : "Ссылка-приглашение недействительна.";
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-2xl font-semibold mb-4">Приглашение недоступно</h1>
        <p className="text-neutral-600 mb-6">{msg}</p>
        <Link href="/login" className="underline">
          На страницу входа
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-2xl font-semibold mb-2">
        Привет{state.fullName ? `, ${state.fullName}` : ""}!
      </h1>
      <p className="text-neutral-600 mb-6">
        Ваш тренер уже создал для вас профиль в Nivel. Войдите через Гречку,
        чтобы привязать его к вашему аккаунту.
      </p>
      <a
        href={`/api/auth/grechka?claim=${encodeURIComponent(state.token)}`}
        className="inline-block rounded-md bg-black text-white px-6 py-3 font-medium"
      >
        Войти через Гречку
      </a>
    </main>
  );
}
```

**Step 2:** Verify route exists by running `pnpm dev`, then `curl -I http://localhost:3000/invite/does-not-exist-token`. Expected: HTTP 200 with HTML containing "Приглашение недоступно" (after Task 9 fixes the proxy).

**Step 3:** Commit.
```bash
git add src/app/invite/[token]/page.tsx
git commit -m "feat(invite): add /invite/[token] landing page"
```

---

### Task 6: Pass `claim` token through `/api/auth/grechka`

**Files:** `src/app/api/auth/grechka/route.ts` (replace fully)

**Step 1:** Replace the file with:

```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const claim = searchParams.get("claim");

  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();

  cookieStore.set("__grechka_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 min
    path: "/",
  });

  if (claim) {
    cookieStore.set("__grechka_claim", claim, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 min — must outlive the round-trip
      path: "/",
    });
  } else {
    // Defensive: clear any stale claim cookie.
    cookieStore.delete("__grechka_claim");
  }

  const grechkaUrl = process.env.NEXT_PUBLIC_GRECHKA_URL?.trim();
  const nivelUrl = process.env.NEXT_PUBLIC_NIVEL_URL?.trim();

  const redirectUrl = new URL(`${grechkaUrl}/auth-nivel.html`);
  redirectUrl.searchParams.set("redirect_uri", `${nivelUrl}/api/auth/grechka-callback`);
  redirectUrl.searchParams.set("state", state);

  return NextResponse.redirect(redirectUrl.toString());
}
```

**Step 2:** Verify: `curl -sI "http://localhost:3000/api/auth/grechka?claim=abc"` — response should include `Set-Cookie: __grechka_claim=abc; ...` and `Set-Cookie: __grechka_state=...`.

**Step 3:** Commit.
```bash
git add src/app/api/auth/grechka/route.ts
git commit -m "feat(auth): accept ?claim=<token> and stash in short-lived cookie"
```

---

### Task 7: Branch grechka-callback on `__grechka_claim`

**Files:** `src/app/api/auth/grechka-callback/route.ts` (replace fully)

**Step 1:** Replace with:

```ts
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
```

**Step 2:** Verify by `pnpm tsc --noEmit`. Expected: no errors. Manual end-to-end test happens in the Acceptance section.

**Step 3:** Commit.
```bash
git add src/app/api/auth/grechka-callback/route.ts
git commit -m "feat(auth): route callback through claimSession when claim cookie present"
```

---

### Task 8: Allow `/invite/*` through the auth proxy

**Files:** `src/proxy.ts` (replace fully)

**Step 1:** Replace with:

```ts
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/invite/");

  const session = request.cookies.get("__session")?.value;

  if (!session) {
    if (isPublic) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Logged in — redirect away from login (but allow invite re-entry).
  if (pathname === "/" || pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**Step 2:** Verify by visiting `http://localhost:3000/invite/does-not-exist` in an incognito window. Expected: invite page renders (with "недоступно" message), NOT a redirect to `/login`.

**Step 3:** Commit.
```bash
git add src/proxy.ts
git commit -m "feat(proxy): allow /invite/* without session"
```

---

### Task 9: Surface claim errors on `/login`

**Files:** `src/app/login/page.tsx` (read first; add a small banner when `?error=claim_*`)

**Step 1:** Read the existing login page:
```bash
# Look at it before editing
```
Open `src/app/login/page.tsx`. Wherever the current `?error=` is rendered (e.g. a single line under the heading), extend the mapping to include claim codes. Add this helper near the top of the component:

```tsx
const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "Сессия истекла, попробуйте ещё раз.",
  auth_failed: "Не удалось войти. Попробуйте снова.",
  claim_invalid_token: "Ссылка-приглашение недействительна.",
  claim_expired: "Срок действия приглашения истёк.",
  claim_already_claimed: "Это приглашение уже использовано.",
  claim_email_collision: "Email уже привязан к другому профилю.",
  claim_uid_collision: "Этот Grechka-аккаунт уже привязан к другому профилю.",
  claim_firebase_invalid: "Ошибка проверки токена Firebase.",
};
```

…and render `ERROR_MESSAGES[error] ?? error` instead of the raw code. Keep the rest of the page intact. (If the page is currently a Client Component reading `searchParams` via `useSearchParams`, wrap in Suspense per Next.js 16 rules; the existing page already handles this — do not break it.)

**Step 2:** Verify: visit `http://localhost:3000/login?error=claim_expired`. Expected: russian message "Срок действия приглашения истёк." rendered.

**Step 3:** Commit.
```bash
git add src/app/login/page.tsx
git commit -m "feat(login): show human-readable claim error messages"
```

---

### Task 10: Open PR

**Step 1:** Push and open PR.

```bash
git push -u origin feat/shadow-student-claim
gh pr create --title "feat: shadow student profile + claim-via-invite flow" --body "$(cat <<'EOF'
## Summary
- Adds `firebase_uid`, `claim_token`, `claim_expires_at`, `claimed_at`, `created_by` to `profiles`.
- Adds `createShadowStudent` / `regenerateClaimToken` / `revokeClaimToken` server actions.
- Adds `/invite/[token]` landing page.
- Routes `?claim=<token>` through Grechka OAuth via `__grechka_claim` cookie and `claimSession()`.
- `getOrCreateSupabaseProfile` now looks up by `firebase_uid` first, binds on first login.

## Test plan
- [ ] Migration 008 applied; new columns visible in `profiles`.
- [ ] Existing user login still works; `firebase_uid` populated on next login.
- [ ] Shadow row inserted via SQL; `/invite/<token>` renders trainer message.
- [ ] Login via Grechka claims the row: `firebase_uid` set, `email` from Firebase, `claimed_at` set, `claim_token` NULL.
- [ ] Expired token → `/login?error=claim_expired` with human message.
- [ ] Re-using a claimed token → `/login?error=claim_already_claimed`.

🤖 Generated with Claude Code
EOF
)"
```

**Step 2:** Update issue (if linked) per CLAUDE.md issue workflow.

---

## Acceptance for the whole epic

Run after all tasks merged to `feat/shadow-student-claim` and built (`pnpm dev` running).

**Pre-setup — find trainer profile.id:**
```bash
curl -s -X POST \
  "https://api.supabase.com/v1/projects/gqcyaxxhvyvpzuhoysis/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT id FROM public.profiles WHERE email = '\''profeshionalx@gmail.com'\'' LIMIT 1;"}'
```
Save the returned `id` as `$TRAINER_ID`.

**1) Insert shadow student via SQL** (stand-in for the UI from a later epic). Note: `email` is NULL — claim flow writes the real Firebase email.

```bash
curl -s -X POST \
  "https://api.supabase.com/v1/projects/gqcyaxxhvyvpzuhoysis/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"INSERT INTO public.profiles (email, full_name, role, created_by, claim_token, claim_expires_at) VALUES (NULL, 'Test Shadow', 'student', '$TRAINER_ID', 'test-token-abc-1234567890abcdef', now() + interval '30 days') RETURNING id;\"}"
```

**2) Open in incognito:** `http://localhost:3000/invite/test-token-abc-1234567890abcdef`. Expected: page shows "Привет, Test Shadow!" and a "Войти через Гречку" button.

**3) Click the button** — flow goes through `grecha.one/auth-nivel.html`, you sign in with a real Grechka test account that does NOT already have a Nivel profile. Browser lands on `/dashboard`.

**4) Verify final DB state:**

```bash
curl -s -X POST \
  "https://api.supabase.com/v1/projects/gqcyaxxhvyvpzuhoysis/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT id, email, firebase_uid, claim_token, claimed_at FROM public.profiles WHERE full_name = '\''Test Shadow'\'';"}'
```

**Expected row:**
- `firebase_uid` is non-null (matches the test Grechka account's Firebase UID).
- `email` matches the Firebase email (was NULL before claim).
- `claim_token` is NULL.
- `claimed_at` is a recent timestamp.

**5) Negative paths:**
- Re-visit `/invite/test-token-abc-1234567890abcdef` → page shows "уже использовано".
- Manually set `claim_expires_at = now() - interval '1 day'` on a fresh shadow row, visit invite → "истёк".
- Create two shadow rows, claim one with account A, claim the other with account A — second attempt redirects to `/login?error=claim_uid_collision`, and that second row's `claim_token` is NULL (revoked).

**Cleanup:**
```bash
curl -s -X POST \
  "https://api.supabase.com/v1/projects/gqcyaxxhvyvpzuhoysis/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"DELETE FROM public.profiles WHERE full_name = '\''Test Shadow'\'';"}'
```
