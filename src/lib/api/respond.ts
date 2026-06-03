import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  requireTrainer,
  requireTrainerOwnsSession,
  requireTrainerOwnsCard,
  requireTrainerOwnsStudent,
  requireTrainerOwnsGoal,
  type TrainerContext,
  type OwnershipContext,
  type CardOwnershipContext,
  type StudentOwnershipContext,
} from "@/lib/auth/ownership";

/**
 * Shared helpers for /api/v1 write-endpoints. Keep route handlers thin: parse
 * the body, run the guard, delegate to a `*Core` function, map the result to a
 * status code. Business logic lives in `src/lib/core/*`; these helpers only deal
 * with HTTP shape and the standard auth ladder (401 -> 403 -> 400 -> 404 -> 422).
 */

export type GuardResult<C> =
  | { ok: true; ctx: C }
  | { ok: false; res: NextResponse };

const unauthenticated = () =>
  NextResponse.json({ error: "unauthenticated" }, { status: 401 });
const forbidden = () => NextResponse.json({ error: "forbidden" }, { status: 403 });

/** 401 if no session, 403 if not a trainer. Returns { user, supabase }. */
export async function guardTrainer(): Promise<GuardResult<TrainerContext>> {
  if (!(await getSession())) return { ok: false, res: unauthenticated() };
  const ctx = await requireTrainer();
  if (!ctx) return { ok: false, res: forbidden() };
  return { ok: true, ctx };
}

/** 401 if no session, 403 if not the trainer who owns the session. */
export async function guardSession(
  sessionId: string
): Promise<GuardResult<OwnershipContext>> {
  if (!(await getSession())) return { ok: false, res: unauthenticated() };
  const ctx = await requireTrainerOwnsSession(sessionId);
  if (!ctx) return { ok: false, res: forbidden() };
  return { ok: true, ctx };
}

/** 401 if no session, 403 if not the trainer who created the student. */
export async function guardStudent(
  studentId: string
): Promise<GuardResult<StudentOwnershipContext>> {
  if (!(await getSession())) return { ok: false, res: unauthenticated() };
  const ctx = await requireTrainerOwnsStudent(studentId);
  if (!ctx) return { ok: false, res: forbidden() };
  return { ok: true, ctx };
}

/** 401 if no session, 403 if not the trainer who owns the goal's student. */
export async function guardGoal(
  goalId: string
): Promise<GuardResult<StudentOwnershipContext>> {
  if (!(await getSession())) return { ok: false, res: unauthenticated() };
  const ctx = await requireTrainerOwnsGoal(goalId);
  if (!ctx) return { ok: false, res: forbidden() };
  return { ok: true, ctx };
}

/** 401 if no session, 403 if not the trainer who owns the card. */
export async function guardCard(
  cardId: string
): Promise<GuardResult<CardOwnershipContext>> {
  if (!(await getSession())) return { ok: false, res: unauthenticated() };
  const ctx = await requireTrainerOwnsCard(cardId);
  if (!ctx) return { ok: false, res: forbidden() };
  return { ok: true, ctx };
}

/** Parse a JSON body; returns null + a 400 response on malformed JSON. */
export async function parseJson<T = Record<string, unknown>>(
  request: Request
): Promise<{ ok: true; body: T } | { ok: false; res: NextResponse }> {
  try {
    const body = (await request.json()) as T;
    return { ok: true, body };
  } catch {
    return {
      ok: false,
      res: NextResponse.json({ error: "invalid_json" }, { status: 400 }),
    };
  }
}

/** 400 Bad Request with a message. */
export const badRequest = (error: string) =>
  NextResponse.json({ error }, { status: 400 });

/** 404 Not Found with a message. */
export const notFound = (error = "not_found") =>
  NextResponse.json({ error }, { status: 404 });

/**
 * Maps a `*Core` failure error string to a status code. Core functions return
 * free-form messages; "not found" style messages become 404, everything else
 * is treated as a 400 validation error. Callers that need different mapping can
 * build the response directly instead.
 */
export function coreError(error: string): NextResponse {
  const lower = error.toLowerCase();
  if (lower.includes("not found") || lower.includes("не найден")) {
    return NextResponse.json({ error }, { status: 404 });
  }
  return NextResponse.json({ error }, { status: 400 });
}
