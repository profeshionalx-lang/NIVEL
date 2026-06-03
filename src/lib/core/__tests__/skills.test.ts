import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addSkillToStudentCore, createAndAddSkillCore } from "../skills";

// A supabase stub that throws if any query is attempted — these tests only
// exercise the validation guards, which must short-circuit before touching the DB.
const exploding = new Proxy(
  {},
  {
    get() {
      throw new Error("DB should not be touched on the validation path");
    },
  }
) as unknown as SupabaseClient;

describe("addSkillToStudentCore — validation", () => {
  it("rejects points below 1 without hitting the DB", async () => {
    const result = await addSkillToStudentCore(exploding, "student", 1, 0);
    expect(result).toEqual({ error: "Баллы должны быть от 1 до 10" });
  });

  it("rejects points above 10 without hitting the DB", async () => {
    const result = await addSkillToStudentCore(exploding, "student", 1, 11);
    expect(result).toEqual({ error: "Баллы должны быть от 1 до 10" });
  });
});

describe("createAndAddSkillCore — validation", () => {
  it("rejects an empty russian name", async () => {
    const result = await createAndAddSkillCore(exploding, "student", "   ", "", 5);
    expect(result).toEqual({ error: "Название обязательно" });
  });

  it("rejects a russian name longer than 40 chars", async () => {
    const longName = "а".repeat(41);
    const result = await createAndAddSkillCore(exploding, "student", longName, "", 5);
    expect(result).toEqual({ error: "Название не более 40 символов" });
  });
});
