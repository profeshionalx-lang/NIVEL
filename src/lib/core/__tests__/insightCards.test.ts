import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyTemplateToStudentCore } from "../insightCards";

/**
 * Minimal chainable query-builder stub. `applyTemplateToStudentCore` always
 * calls `.from(table)` in the same fixed order (template lookup, session
 * lookup, duplicate check, last-position lookup, insert), so responses are
 * handed out by call index rather than by matching table/method names.
 */
function makeChain(
  response: Record<string, unknown>,
  onInsert?: (payload: Record<string, unknown>) => void
) {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    single: () => Promise.resolve(response),
    maybeSingle: () => Promise.resolve(response),
    insert: (payload: Record<string, unknown>) => {
      onInsert?.(payload);
      return chain;
    },
    then: (resolve: (v: unknown) => unknown) => resolve(response),
  };
  return chain;
}

describe("applyTemplateToStudentCore — frames and moments are not copied", () => {
  it("does not carry frame_*/moment_* from the template card onto the new copy", async () => {
    // The source template card has frames/moments attached — as it would for
    // a real video-insight draft — to prove they are excluded, not merely
    // absent by coincidence.
    const templateRow = {
      id: "template-card-id",
      title: "Замах ниже",
      body: "Держи ракетку ниже плеча",
      quote: "во, во туда",
      tags: ["техника"],
      front_text: "Замах ниже",
      context_text: "Держи ракетку ниже плеча",
      problem_id: null,
      category_id: null,
      moment_before_seconds: 42.5,
      moment_after_seconds: 48.1,
      frame_before_path: "session-1/card-1/before-abc.jpg",
      frame_after_path: "session-1/card-1/after-def.jpg",
    };
    const sessionRow = { id: "session-2", goals: { user_id: "student-2" } };

    let insertPayload: Record<string, unknown> | undefined;
    let callIndex = 0;
    const responses = [
      { data: templateRow }, // 1: template lookup
      { data: sessionRow }, // 2: session lookup
      { count: 0 }, // 3: duplicate check
      { data: null }, // 4: last position lookup
      { data: { id: "new-card-id" } }, // 5: insert
    ];

    const supabase = {
      from: () => {
        const response = responses[callIndex];
        const isInsertCall = callIndex === 4;
        callIndex++;
        return makeChain(response, isInsertCall ? (p) => (insertPayload = p) : undefined);
      },
    } as unknown as SupabaseClient;

    const result = await applyTemplateToStudentCore(
      supabase,
      "trainer-1",
      "template-id",
      "session-2"
    );

    expect(result).toEqual({ success: true, id: "new-card-id" });
    expect(insertPayload).toBeDefined();

    // The insert must not reference the template's frame/moment fields at
    // all — the row lands with the column default (NULL), not a copied
    // value from a different training session's video.
    expect(insertPayload).not.toHaveProperty("moment_before_seconds");
    expect(insertPayload).not.toHaveProperty("moment_after_seconds");
    expect(insertPayload).not.toHaveProperty("frame_before_path");
    expect(insertPayload).not.toHaveProperty("frame_after_path");
  });
});
