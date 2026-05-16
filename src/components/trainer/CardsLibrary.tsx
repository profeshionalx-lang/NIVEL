"use client";

import { useMemo, useState, useTransition } from "react";
import type { CardTemplate, InsightCollection, InsightTrainerStatus } from "@/lib/types";
import { LibraryCardItem } from "./LibraryCardItem";
import {
  createCollection,
  addCardToCollection,
  removeCardFromCollection,
  applyCollectionToStudent,
  getStudentSessions,
} from "@/lib/actions/insightCards";
import type { StudentSessionOption } from "@/lib/actions/insightCards";

type Tab = "cards" | "collections";

const TAGS = ["техника", "тактика", "физика", "менталка"] as const;

const STATUS_OPTIONS: { value: InsightTrainerStatus | "all"; label: string }[] = [
  { value: "all", label: "Все статусы" },
  { value: "approved", label: "Approved" },
  { value: "draft", label: "Draft" },
  { value: "rejected", label: "Rejected" },
];

interface Student {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Props {
  templates: (CardTemplate & { student_ids: string[] })[];
  students: Student[];
  collections: (InsightCollection & { template_ids: string[] })[];
}

export function CardsLibrary({ templates, students, collections: initialCollections }: Props) {
  const [tab, setTab] = useState<Tab>("cards");
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<InsightTrainerStatus | "all">("all");
  const [studentFilter, setStudentFilter] = useState<string | null>(null);
  const [collections, setCollections] = useState(initialCollections);
  const [newCollName, setNewCollName] = useState("");
  const [collApplyState, setCollApplyState] = useState<{ id: string; name: string } | null>(null);
  const [collApplyStudentId, setCollApplyStudentId] = useState<string | null>(null);
  const [collApplySessions, setCollApplySessions] = useState<StudentSessionOption[]>([]);
  const [loadingCollSessions, setLoadingCollSessions] = useState(false);
  const [collApplyResult, setCollApplyResult] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Counts per tag / status — for sidebar badges
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of templates) {
      for (const tag of t.tags ?? []) counts[tag] = (counts[tag] ?? 0) + 1;
    }
    return counts;
  }, [templates]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: templates.length, approved: 0, draft: 0, rejected: 0 };
    for (const t of templates) counts[t.trainer_status] = (counts[t.trainer_status] ?? 0) + 1;
    return counts;
  }, [templates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (q && !t.title?.toLowerCase().includes(q) && !t.body?.toLowerCase().includes(q)) return false;
      if (tagFilter && !t.tags?.includes(tagFilter)) return false;
      if (statusFilter !== "all" && t.trainer_status !== statusFilter) return false;
      if (studentFilter && !t.student_ids.includes(studentFilter)) return false;
      return true;
    });
  }, [templates, search, tagFilter, statusFilter, studentFilter]);

  const hasFilters = !!(search || tagFilter || statusFilter !== "all" || studentFilter);

  function resetFilters() {
    setSearch("");
    setTagFilter(null);
    setStatusFilter("all");
    setStudentFilter(null);
  }

  function handleAddToCollection(collectionId: string, templateId: string) {
    startTransition(async () => {
      await addCardToCollection(collectionId, templateId);
      setCollections((prev) =>
        prev.map((c) =>
          c.id === collectionId && !c.template_ids.includes(templateId)
            ? { ...c, template_ids: [...c.template_ids, templateId], card_count: (c.card_count ?? 0) + 1 }
            : c
        )
      );
    });
  }

  function handleRemoveFromCollection(collectionId: string, templateId: string) {
    startTransition(async () => {
      await removeCardFromCollection(collectionId, templateId);
      setCollections((prev) =>
        prev.map((c) =>
          c.id === collectionId
            ? {
                ...c,
                template_ids: c.template_ids.filter((id) => id !== templateId),
                card_count: Math.max(0, (c.card_count ?? 1) - 1),
              }
            : c
        )
      );
    });
  }

  function handleCreateCollection() {
    if (!newCollName.trim()) return;
    const name = newCollName.trim();
    startTransition(async () => {
      const result = await createCollection(name);
      if (result.success) {
        setCollections((prev) => [
          { id: result.id, trainer_id: "", name, created_at: new Date().toISOString(), card_count: 0, template_ids: [] },
          ...prev,
        ]);
        setNewCollName("");
      }
    });
  }

  function startCollectionApply(id: string, name: string) {
    setCollApplyState({ id, name });
    setCollApplyStudentId(null);
    setCollApplySessions([]);
    setCollApplyResult(null);
  }

  async function selectStudentForCollection(studentId: string) {
    setCollApplyStudentId(studentId);
    setLoadingCollSessions(true);
    const sess = await getStudentSessions(studentId);
    setCollApplySessions(sess);
    setLoadingCollSessions(false);
  }

  function applyCollectionToSession(sessionId: string) {
    if (!collApplyState) return;
    startTransition(async () => {
      const result = await applyCollectionToStudent(collApplyState.id, sessionId);
      if (result.success) setCollApplyResult(`Добавлено ${result.applied} карточек`);
    });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ─────────── Top header ─────────── */}
      <header className="sticky top-0 z-30 glass-nav border-b border-border-dim">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-6">
          <div className="flex items-center gap-4 h-14">
            {/* Logo */}
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-base font-black text-primary uppercase italic tracking-tight hidden sm:block">
                Nivel
              </span>
              <span className="w-px h-5 bg-border-dim hidden sm:block" />
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-on-surface text-[20px]">style</span>
                <h1 className="text-[15px] font-bold text-on-surface tracking-tight">Card Library</h1>
              </div>
              <span className="hidden md:inline-flex items-center justify-center min-w-[24px] h-[22px] px-1.5 rounded-md bg-surface-elevated text-on-surface-variant text-[11px] font-bold tabular-nums">
                {templates.length}
              </span>
            </div>

            {/* Segmented tabs */}
            <div className="hidden md:flex items-center bg-surface-elevated/60 rounded-lg p-0.5 ml-2">
              {(["cards", "collections"] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`relative px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all duration-200 ${
                    tab === t
                      ? "bg-surface-card text-on-surface shadow-sm"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {t === "cards" ? "Cards" : "Collections"}
                  <span
                    className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[16px] px-1 rounded-[5px] text-[10px] font-bold tabular-nums ${
                      tab === t ? "bg-primary/15 text-primary" : "bg-surface-elevated text-on-surface-variant"
                    }`}
                  >
                    {t === "cards" ? templates.length : collections.length}
                  </span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="ml-auto flex items-center gap-2">
              <div className="relative hidden md:block w-64 lg:w-80">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px] pointer-events-none">
                  search
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search cards…"
                  className="w-full bg-surface-elevated/60 rounded-lg pl-9 pr-3 h-9 text-[13px] text-on-surface placeholder:text-on-surface-variant/60 border border-transparent focus:border-primary/40 focus:bg-surface-card focus:outline-none transition-colors"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                    aria-label="Очистить поиск"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Mobile tabs */}
          <div className="md:hidden flex items-center bg-surface-elevated/60 rounded-lg p-0.5 mb-3">
            {(["cards", "collections"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all duration-200 ${
                  tab === t ? "bg-surface-card text-on-surface shadow-sm" : "text-on-surface-variant"
                }`}
              >
                {t === "cards" ? `Cards · ${templates.length}` : `Collections · ${collections.length}`}
              </button>
            ))}
          </div>
        </div>
      </header>

      {tab === "cards" ? (
        <div className="flex flex-1 max-w-screen-2xl mx-auto w-full">
          {/* ─────────── Sidebar (desktop) ─────────── */}
          <aside className="hidden md:flex flex-col w-[220px] shrink-0 border-r border-border-dim sticky top-14 self-start h-[calc(100vh-3.5rem)] overflow-y-auto py-6 px-3">
            <SidebarSection title="Тема">
              <SidebarItem
                active={!tagFilter}
                onClick={() => setTagFilter(null)}
                label="Все темы"
                count={templates.length}
              />
              {TAGS.map((tag) => (
                <SidebarItem
                  key={tag}
                  active={tagFilter === tag}
                  onClick={() => setTagFilter(tag === tagFilter ? null : tag)}
                  label={tag}
                  count={tagCounts[tag] ?? 0}
                  capitalize
                />
              ))}
            </SidebarSection>

            <SidebarSection title="Статус">
              {STATUS_OPTIONS.map((opt) => (
                <SidebarItem
                  key={opt.value}
                  active={statusFilter === opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  label={opt.label}
                  count={statusCounts[opt.value] ?? 0}
                />
              ))}
            </SidebarSection>

            {students.length > 0 && (
              <SidebarSection title="Ученики">
                <SidebarItem
                  active={!studentFilter}
                  onClick={() => setStudentFilter(null)}
                  label="Все ученики"
                  count={students.length}
                />
                <div className="max-h-[280px] overflow-y-auto">
                  {students.map((s) => (
                    <SidebarItem
                      key={s.id}
                      active={studentFilter === s.id}
                      onClick={() => setStudentFilter(s.id === studentFilter ? null : s.id)}
                      label={s.full_name ?? "—"}
                    />
                  ))}
                </div>
              </SidebarSection>
            )}

            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-2 flex items-center gap-1.5 text-[12px] text-on-surface-variant hover:text-on-surface transition-colors px-3 py-2 rounded-lg hover:bg-surface-elevated/60"
              >
                <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                Reset filters
              </button>
            )}
          </aside>

          {/* ─────────── Main ─────────── */}
          <main className="flex-1 min-w-0">
            {/* Mobile search */}
            <div className="md:hidden px-4 pt-3">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
                  search
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search cards…"
                  className="w-full bg-surface-elevated/60 rounded-lg pl-9 pr-3 h-10 text-[13px] text-on-surface border border-transparent focus:border-primary/40 focus:outline-none"
                />
              </div>
            </div>

            {/* Mobile filter chips */}
            <div className="md:hidden flex gap-2 px-4 pt-3 pb-1 overflow-x-auto scrollbar-hide">
              <MobileChip active={!tagFilter} onClick={() => setTagFilter(null)} label="Все" />
              {TAGS.map((tag) => (
                <MobileChip
                  key={tag}
                  active={tagFilter === tag}
                  onClick={() => setTagFilter(tag === tagFilter ? null : tag)}
                  label={tag}
                />
              ))}
            </div>
            <div className="md:hidden flex gap-2 px-4 pt-2 pb-1 overflow-x-auto scrollbar-hide">
              {STATUS_OPTIONS.map((opt) => (
                <MobileChip
                  key={opt.value}
                  active={statusFilter === opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  label={opt.label}
                />
              ))}
            </div>

            {/* Summary bar */}
            <div className="flex items-center justify-between px-4 md:px-8 py-4 border-b border-border-dim">
              <div className="flex items-center gap-2">
                <p className="text-[13px] text-on-surface">
                  <span className="font-semibold tabular-nums">{filtered.length}</span>{" "}
                  <span className="text-on-surface-variant">
                    {filtered.length === templates.length
                      ? "cards"
                      : `of ${templates.length} cards`}
                  </span>
                </p>
                {hasFilters && (
                  <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-semibold">
                    <span className="material-symbols-outlined text-[14px]">filter_alt</span>
                    Filtered
                  </span>
                )}
              </div>
              {hasFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-[12px] text-on-surface-variant hover:text-on-surface font-medium flex items-center gap-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-[15px]">close</span>
                  Clear
                </button>
              )}
            </div>

            {/* Card grid */}
            <div className="p-4 md:p-8 pb-36">
              {filtered.length === 0 ? (
                <EmptyState
                  icon={hasFilters ? "search_off" : "style"}
                  title={hasFilters ? "No cards match your filters" : "Your library is empty"}
                  description={
                    hasFilters
                      ? "Try resetting filters or adjusting your search."
                      : "Cards you create will show up here."
                  }
                  action={
                    hasFilters ? (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="px-4 py-2 rounded-lg bg-surface-elevated text-on-surface text-[13px] font-semibold hover:bg-surface-high transition-colors"
                      >
                        Reset filters
                      </button>
                    ) : null
                  }
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map((template) => (
                    <LibraryCardItem
                      key={template.template_id ?? template.id}
                      template={template}
                      students={students}
                      collections={collections}
                      onAddToCollection={handleAddToCollection}
                      onRemoveFromCollection={handleRemoveFromCollection}
                    />
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>
      ) : (
        /* ─────────── Collections tab ─────────── */
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 md:px-8 py-6 pb-36">
          {/* Create */}
          <div className="rounded-2xl bg-surface-card border border-border-dim p-4 mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
              New collection
            </p>
            <div className="flex gap-2">
              <input
                value={newCollName}
                onChange={(e) => setNewCollName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateCollection()}
                placeholder="e.g. Beginner essentials"
                className="flex-1 bg-surface-elevated rounded-lg px-3 h-10 text-[13px] text-on-surface placeholder:text-on-surface-variant/60 border border-transparent focus:border-primary/40 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCreateCollection}
                disabled={!newCollName.trim()}
                className="px-4 h-10 rounded-lg kinetic-gradient text-on-primary text-[13px] font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md transition-all"
              >
                Create
              </button>
            </div>
          </div>

          {collections.length === 0 ? (
            <EmptyState
              icon="bookmarks"
              title="No collections yet"
              description="Group related cards into collections to apply them in bulk."
            />
          ) : (
            <div className="space-y-3">
              {collections.map((col) => (
                <div
                  key={col.id}
                  className="rounded-2xl bg-surface-card border border-border-dim overflow-hidden hover:border-border transition-colors"
                >
                  <div className="flex items-center justify-between px-5 py-4 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-primary text-[20px]">bookmarks</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-[14px] text-on-surface truncate">{col.name}</p>
                        <p className="text-[12px] text-on-surface-variant mt-0.5">
                          {col.card_count ?? col.template_ids.length} cards
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => startCollectionApply(col.id, col.name)}
                      disabled={col.template_ids.length === 0}
                      className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg kinetic-gradient text-on-primary text-[12px] font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md transition-all shrink-0"
                    >
                      <span className="material-symbols-outlined text-[15px]">send</span>
                      Assign
                    </button>
                  </div>
                  {col.template_ids.length > 0 && (
                    <div className="border-t border-border-dim divide-y divide-border-dim">
                      {templates
                        .filter((t) => col.template_ids.includes(t.template_id ?? t.id))
                        .map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center gap-3 px-5 py-3 hover:bg-surface-elevated/40 transition-colors"
                          >
                            <span className="material-symbols-outlined text-on-surface-variant text-[16px]">
                              drag_indicator
                            </span>
                            <p className="flex-1 text-[13px] text-on-surface truncate">{t.title}</p>
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveFromCollection(col.id, t.template_id ?? t.id)
                              }
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                              aria-label="Удалить из коллекции"
                            >
                              <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* ─────────── Collection apply sheet ─────────── */}
      {collApplyState && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end md:items-center justify-center"
          onClick={() => {
            setCollApplyState(null);
            setCollApplyResult(null);
          }}
        >
          <div
            className="bg-surface-card rounded-t-3xl md:rounded-3xl w-full max-w-[430px] mx-auto p-6 pb-10 md:pb-6 space-y-4 max-h-[85vh] overflow-y-auto border border-border-dim"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  Apply collection
                </p>
                <h3 className="text-[16px] font-bold tracking-tight text-on-surface mt-0.5">
                  {collApplyState.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCollApplyState(null);
                  setCollApplyResult(null);
                }}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-elevated text-on-surface-variant hover:text-on-surface transition-colors"
                aria-label="Закрыть"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {collApplyResult ? (
              <div className="text-center py-6 space-y-3">
                <span className="material-symbols-outlined text-5xl text-primary">check_circle</span>
                <p className="font-bold text-on-surface">{collApplyResult}</p>
                <button
                  type="button"
                  onClick={() => {
                    setCollApplyState(null);
                    setCollApplyResult(null);
                  }}
                  className="w-full h-11 rounded-xl kinetic-gradient text-on-primary font-bold text-[14px]"
                >
                  Done
                </button>
              </div>
            ) : !collApplyStudentId ? (
              <div className="space-y-2">
                <p className="text-[12px] text-on-surface-variant">Choose a student</p>
                {students.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => selectStudentForCollection(s.id)}
                    className="w-full flex items-center gap-3 rounded-xl bg-surface-elevated hover:bg-surface-high p-3.5 text-left transition-colors"
                  >
                    <span className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-[18px]">person</span>
                    </span>
                    <span className="font-semibold text-[13px] text-on-surface flex-1">
                      {s.full_name ?? "—"}
                    </span>
                    <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                      chevron_right
                    </span>
                  </button>
                ))}
              </div>
            ) : loadingCollSessions ? (
              <div className="py-8 flex justify-center">
                <span className="material-symbols-outlined text-on-surface-variant animate-spin">
                  progress_activity
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setCollApplyStudentId(null);
                    setCollApplySessions([]);
                  }}
                  className="flex items-center gap-1 text-[12px] text-secondary font-semibold mb-2"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  Different student
                </button>
                {collApplySessions.length === 0 ? (
                  <p className="text-[12px] text-on-surface-variant py-6 text-center">
                    No sessions for this student.
                  </p>
                ) : (
                  collApplySessions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => applyCollectionToSession(s.id)}
                      className="w-full flex items-center gap-3 rounded-xl bg-surface-elevated hover:bg-surface-high p-3.5 text-left transition-colors"
                    >
                      <span className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-secondary text-[18px]">
                          fitness_center
                        </span>
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[13px] text-on-surface truncate">
                          Session {s.session_number}
                          {s.trainer_notes ? ` — ${s.trainer_notes}` : ""}
                        </p>
                        <p className="text-[11px] text-on-surface-variant">
                          {new Date(s.scheduled_at ?? s.created_at).toLocaleDateString("ru-RU", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-primary text-[18px]">
                        add_circle
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Local UI primitives
   ───────────────────────────────────────────────────────────── */

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/70 px-3 mb-1.5">
        {title}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function SidebarItem({
  active,
  onClick,
  label,
  count,
  capitalize,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  capitalize?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[13px] transition-all duration-150 ${
        active
          ? "bg-surface-card border border-border font-semibold text-on-surface"
          : "font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-elevated/40"
      }`}
    >
      <span className={`truncate text-left ${capitalize ? "capitalize" : ""}`}>{label}</span>
      {typeof count === "number" && (
        <span className={`text-[11px] tabular-nums ml-2 shrink-0 ${active ? "text-on-surface" : "text-on-surface-variant/60"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function MobileChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 inline-flex items-center px-3 h-8 rounded-md text-[12px] font-semibold whitespace-nowrap transition-colors ${
        active
          ? "bg-primary text-on-primary"
          : "bg-surface-elevated/60 text-on-surface-variant border border-border-dim"
      }`}
    >
      <span className="capitalize">{label}</span>
    </button>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 rounded-2xl bg-surface-elevated/60 flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-[28px] text-on-surface-variant">{icon}</span>
      </div>
      <p className="text-[14px] font-semibold text-on-surface">{title}</p>
      <p className="text-[12px] text-on-surface-variant mt-1 max-w-xs">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
