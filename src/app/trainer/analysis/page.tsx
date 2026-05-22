import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  ready:      { label: "Готово",     color: "text-green-400",  icon: "check_circle" },
  processing: { label: "Анализ…",   color: "text-blue-400",   icon: "autorenew" },
  idle:       { label: "В очереди", color: "text-yellow-400", icon: "schedule" },
  failed:     { label: "Ошибка",    color: "text-red-400",    icon: "error" },
};

export default async function AnalysisAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getSession();
  if (!user || user.role !== "trainer") redirect("/dashboard");

  const { status: filterStatus } = await searchParams;

  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("transcripts")
    .select(`
      session_id,
      status,
      analysis_status,
      analysis_error,
      raw_text,
      sessions!inner(
        created_at,
        goals!inner(
          user_id,
          profiles!inner(full_name, created_by)
        )
      )
    `)
    .order("session_id");

  // Карточки по сессиям
  const { data: cardCounts } = await supabase
    .from("insight_cards")
    .select("session_id");

  const countMap: Record<string, number> = {};
  for (const c of cardCounts ?? []) {
    countMap[c.session_id] = (countMap[c.session_id] ?? 0) + 1;
  }

  type Row = {
    session_id: string;
    analysis_status: string;
    analysis_error: string | null;
    tr_len: number;
    created_at: string;
    student: string;
    cards: number;
  };

  const items: Row[] = (rows ?? [])
    .map((r) => {
      const session = Array.isArray(r.sessions) ? r.sessions[0] : r.sessions;
      const goal = Array.isArray(session?.goals) ? session?.goals[0] : session?.goals;
      const profile = Array.isArray(goal?.profiles) ? goal?.profiles[0] : goal?.profiles;
      return {
        session_id: r.session_id,
        analysis_status: r.analysis_status ?? "idle",
        analysis_error: r.analysis_error,
        tr_len: r.raw_text?.length ?? 0,
        created_at: session?.created_at ?? "",
        student: profile?.full_name ?? "—",
        cards: countMap[r.session_id] ?? 0,
      };
    })
    .filter((r) => !filterStatus || r.analysis_status === filterStatus)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const total = (rows ?? []).length;
  const byStatus = (rows ?? []).reduce<Record<string, number>>((acc, r) => {
    const s = r.analysis_status ?? "idle";
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="max-w-[430px] mx-auto px-4 py-5 pb-24">
      <h1 className="text-lg font-bold text-on-surface mb-1">Анализ транскриптов</h1>
      <p className="text-xs text-on-surface-variant mb-4">
        Бэкофис — статус pm2-анализатора по всем сессиям
      </p>

      {/* Счётчики по статусам */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {(["ready", "idle", "processing", "failed"] as const).map((s) => {
          const meta = STATUS_META[s];
          const count = byStatus[s] ?? 0;
          const isActive = filterStatus === s;
          return (
            <Link
              key={s}
              href={isActive ? "/trainer/analysis" : `/trainer/analysis?status=${s}`}
              className={`rounded-xl p-2 text-center border transition-colors ${
                isActive
                  ? "border-primary bg-primary/10"
                  : "border-border-dim bg-surface-card"
              }`}
            >
              <p className={`text-lg font-bold ${meta.color}`}>{count}</p>
              <p className="text-[10px] text-on-surface-variant leading-tight">{meta.label}</p>
            </Link>
          );
        })}
      </div>

      {filterStatus && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-on-surface-variant">
            Фильтр: <span className="font-bold text-on-surface">{STATUS_META[filterStatus]?.label}</span>
          </span>
          <Link href="/trainer/analysis" className="text-xs text-primary ml-auto">
            Сбросить
          </Link>
        </div>
      )}

      <p className="text-xs text-on-surface-variant mb-3">
        {items.length === total ? `Всего: ${total}` : `Показано: ${items.length} из ${total}`}
      </p>

      {/* Список */}
      <div className="space-y-2">
        {items.map((row) => {
          const meta = STATUS_META[row.analysis_status] ?? STATUS_META.idle;
          const date = row.created_at
            ? new Date(row.created_at).toLocaleDateString("ru-RU", {
                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
              })
            : "—";
          const trKb = (row.tr_len / 1000).toFixed(1);

          return (
            <Link
              key={row.session_id}
              href={`/sessions/${row.session_id}`}
              className="block rounded-2xl bg-surface-card border border-border-dim p-3 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-on-surface truncate">{row.student}</p>
                  <p className="text-xs text-on-surface-variant">{date}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`material-symbols-outlined text-base ${meta.color} ${row.analysis_status === "processing" ? "animate-spin" : ""}`}>
                    {meta.icon}
                  </span>
                  <span className={`text-xs font-bold ${meta.color}`}>{meta.label}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-2 text-xs text-on-surface-variant">
                <span>📄 {trKb}K симв.</span>
                <span>🃏 {row.cards} карточек</span>
              </div>

              {row.analysis_error && (
                <p className="mt-2 text-xs text-red-400 font-mono break-all line-clamp-2">
                  {row.analysis_error}
                </p>
              )}
            </Link>
          );
        })}

        {items.length === 0 && (
          <p className="text-center text-sm text-on-surface-variant py-10">Нет сессий</p>
        )}
      </div>
    </div>
  );
}
