import { createClient } from "@/lib/supabase/server";
import { notifySessionReminder } from "@/lib/telegram/notify";

export const dynamic = "force-dynamic";

const HOURS_BEFORE = 2;
const WINDOW_MIN = 15;

type Row = {
  id: string;
  scheduled_at: string;
  goals: { user_id: string } | null;
};

export async function GET(req: Request): Promise<Response> {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers.get("authorization") !== `Bearer ${expected}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const now = Date.now();
  const targetMin = new Date(now + (HOURS_BEFORE * 60 - WINDOW_MIN) * 60_000).toISOString();
  const targetMax = new Date(now + (HOURS_BEFORE * 60 + WINDOW_MIN) * 60_000).toISOString();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("id, scheduled_at, goals!inner(user_id)")
    .eq("status", "planned")
    .is("reminder_sent_at", null)
    .gte("scheduled_at", targetMin)
    .lte("scheduled_at", targetMax);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as Row[];
  let processed = 0;

  for (const s of rows) {
    const studentId = s.goals?.user_id;
    if (!studentId || !s.scheduled_at) continue;
    await notifySessionReminder(studentId, s.id, s.scheduled_at, HOURS_BEFORE);
    await supabase
      .from("sessions")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", s.id);
    processed++;
  }

  return Response.json({ processed, scanned: rows.length });
}
