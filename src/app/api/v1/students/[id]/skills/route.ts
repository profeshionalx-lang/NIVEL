import { NextResponse } from "next/server";
import { guardStudent, parseJson, badRequest } from "@/lib/api/respond";
import { addSkillToStudentCore, createAndAddSkillCore } from "@/lib/core/skills";

/**
 * POST /api/v1/students/{id}/skills
 *
 * Adds skill points to the student. Two shapes:
 *   - { skillId: number, points: number }          → add to an existing skill
 *   - { nameRu: string, nameEn?: string, points }  → create (upsert) then add
 *
 * Trainer-only; the trainer must own the student. Mirrors the web
 * `addSkillToStudent` / `createAndAddSkill` Server Actions.
 */
type Body = {
  skillId?: number;
  nameRu?: string;
  nameEn?: string;
  points?: number;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const guard = await guardStudent(id);
  if (!guard.ok) return guard.res;

  const parsed = await parseJson<Body>(request);
  if (!parsed.ok) return parsed.res;
  const { skillId, nameRu, nameEn, points } = parsed.body;

  if (typeof points !== "number") return badRequest("points is required");

  const result =
    typeof skillId === "number"
      ? await addSkillToStudentCore(guard.ctx.supabase, id, skillId, points)
      : nameRu
        ? await createAndAddSkillCore(guard.ctx.supabase, id, nameRu, nameEn ?? "", points)
        : null;

  if (!result) return badRequest("Provide either skillId or nameRu");
  if ("error" in result) return badRequest(result.error);

  return NextResponse.json({ ok: true });
}
