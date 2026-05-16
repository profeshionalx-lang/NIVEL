"use client";

import { useState, useTransition } from "react";
import type { CardTemplate, InsightCollection, InsightTrainerStatus } from "@/lib/types";
import { LibraryCardItem } from "./LibraryCardItem";
import {
  createCollection,
  addCardToCollection,
  removeCardFromCollection,
  applyCollectionToStudent,
  getStudentSessions,
} from "@/lib/actions/insightCards";
import { ApplyCardSheet } from "./ApplyCardSheet";

type Tab = "cards" | "collections";

const TAGS = ["техника", "тактика", "физика", "менталка"] as const;
const STATUS_OPTIONS: { value: InsightTrainerStatus | "all"; label: string }[] = [
  { value: "all", label: "Все" },
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
  const [applyCollectionState, setApplyCollectionState] = useState<{
    collectionId: string;
    collectionName: string;
  } | null>(null);
  const [collApplyStudentId, setCollApplyStudentId] = useState<string | null>(null);
  const [collApplySessions, setCollApplySessions] = useState<{ id: string; session_number: number; trainer_notes: string | null; scheduled_at: string | null; created_at: string }[]>([]);
  const [loadingCollSessions, setLoadingCollSessions] = useState(false);
  const [collApplyResult, setCollApplyResult] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const q = search.toLowerCase();
  const filtered = templates.filter((t) => {
    if (q && !t.title?.toLowerCase().includes(q) && !t.body?.toLowerCase().includes(q)) return false;
    if (tagFilter && !t.tags?.includes(tagFilter)) return false;
    if (statusFilter !== "all" && t.trainer_status !== statusFilter) return false;
    if (studentFilter && !t.student_ids.includes(studentFilter)) return false;
    return true;
  });

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
            ? { ...c, template_ids: c.template_ids.filter((id) => id !== templateId), card_count: Math.max(0, (c.card_count ?? 1) - 1) }
            : c
        )
      );
    });
  }

  function handleCreateCollection() {
    if (!newCollName.trim()) return;
    startTransition(async () => {
      const result = await createCollection(newCollName.trim());
      if (result.success) {
        setCollections((prev) => [
          { id: result.id, trainer_id: "", name: newCollName.trim(), created_at: new Date().toISOString(), card_count: 0, template_ids: [] },
          ...prev,
        ]);
        setNewCollName("");
      }
    });
  }

  async function startCollectionApply(collectionId: string, collectionName: string) {
    setApplyCollectionState({ collectionId, collectionName });
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
    if (!applyCollectionState) return;
    startTransition(async () => {
      const result = await applyCollectionToStudent(applyCollectionState.collectionId, sessionId);
      if (result.success) {
        setCollApplyResult(`Добавлено ${result.applied} карточек`);
      }
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass-nav flex items-center justify-between px-6 h-16">
        <div className="w-10" />
        <span className="text-lg font-black text-primary uppercase italic tracking-tight">
          Библиотека карточек
        </span>
        <div className="w-10" />
      </header>

      {/* Tab switcher */}
      <div className="sticky top-16 z-20 bg-background border-b border-border-dim px-5 flex gap-1 py-2">
        <button
          onClick={() => setTab("cards")}
          className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest min-h-[36px] transition-colors ${
            tab === "cards" ? "bg-primary/10 text-primary" : "text-on-surface-variant"
          }`}
        >
          Карточки ({templates.length})
        </button>
        <button
          onClick={() => setTab("collections")}
          className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest min-h-[36px] transition-colors ${
            tab === "collections" ? "bg-primary/10 text-primary" : "text-on-surface-variant"
          }`}
        >
          Коллекции ({collections.length})
        </button>
      </div>

      <main className="pb-36">
        {/* Desktop layout wrapper */}
        <div className="md:flex md:gap-6 md:px-8 md:pt-6">
          {/* === CARDS TAB === */}
          {tab === "cards" && (
            <>
              {/* Sidebar filters (desktop) / inline filters (mobile) */}
              <aside className="md:w-56 md:flex-shrink-0 md:sticky md:top-32 md:self-start md:space-y-4 px-5 pt-4 md:px-0 md:pt-0 space-y-3">
                {/* Search */}
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">
                    search
                  </span>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Поиск…"
                    className="w-full bg-surface-card rounded-2xl pl-9 pr-4 py-2.5 text-sm text-on-surface border border-border-dim focus:border-primary focus:outline-none"
                  />
                </div>

                {/* Tag filter chips */}
                <div className="flex gap-1.5 flex-wrap md:flex-col md:gap-1.5">
                  <button
                    onClick={() => setTagFilter(null)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest min-h-[32px] ${
                      !tagFilter ? "bg-primary text-on-primary" : "bg-surface-card text-on-surface-variant border border-border-dim"
                    }`}
                  >
                    Все темы
                  </button>
                  {TAGS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setTagFilter(tag === tagFilter ? null : tag)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest min-h-[32px] ${
                        tagFilter === tag ? "bg-primary text-on-primary" : "bg-surface-card text-on-surface-variant border border-border-dim"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>

                {/* Status filter */}
                <div className="flex gap-1.5 flex-wrap md:flex-col md:gap-1.5">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setStatusFilter(opt.value)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest min-h-[32px] ${
                        statusFilter === opt.value ? "bg-primary text-on-primary" : "bg-surface-card text-on-surface-variant border border-border-dim"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Student filter */}
                {students.length > 0 && (
                  <select
                    value={studentFilter ?? ""}
                    onChange={(e) => setStudentFilter(e.target.value || null)}
                    className="w-full bg-surface-card rounded-2xl px-3 py-2.5 text-sm text-on-surface border border-border-dim focus:border-primary focus:outline-none min-h-[44px]"
                  >
                    <option value="">Все ученики</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name ?? "—"}
                      </option>
                    ))}
                  </select>
                )}

                {(search || tagFilter || statusFilter !== "all" || studentFilter) && (
                  <button
                    onClick={() => { setSearch(""); setTagFilter(null); setStatusFilter("all"); setStudentFilter(null); }}
                    className="text-xs text-secondary font-bold flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                    Сбросить фильтры
                  </button>
                )}
              </aside>

              {/* Card list */}
              <div className="flex-1 min-w-0 px-5 pt-3 md:px-0 md:pt-0 space-y-3 md:grid md:grid-cols-2 md:gap-3 md:content-start">
                {filtered.length === 0 ? (
                  <p className="text-sm text-on-surface-variant col-span-2 py-12 text-center">
                    {search || tagFilter || statusFilter !== "all" || studentFilter
                      ? "Нет карточек по фильтрам"
                      : "Нет карточек в библиотеке"}
                  </p>
                ) : (
                  filtered.map((template) => (
                    <LibraryCardItem
                      key={template.template_id ?? template.id}
                      template={template}
                      students={students}
                      collections={collections}
                      onAddToCollection={handleAddToCollection}
                      onRemoveFromCollection={handleRemoveFromCollection}
                    />
                  ))
                )}
              </div>
            </>
          )}

          {/* === COLLECTIONS TAB === */}
          {tab === "collections" && (
            <div className="flex-1 px-5 pt-4 md:px-0 md:pt-0 space-y-4">
              {/* Create new collection */}
              <div className="flex gap-2">
                <input
                  value={newCollName}
                  onChange={(e) => setNewCollName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateCollection()}
                  placeholder="Название коллекции…"
                  className="flex-1 bg-surface-card rounded-2xl px-4 py-2.5 text-sm text-on-surface border border-border-dim focus:border-primary focus:outline-none min-h-[44px]"
                />
                <button
                  onClick={handleCreateCollection}
                  disabled={!newCollName.trim()}
                  className="px-4 rounded-2xl kinetic-gradient text-on-primary text-sm font-bold disabled:opacity-40 min-h-[44px]"
                >
                  Создать
                </button>
              </div>

              {collections.length === 0 ? (
                <p className="text-sm text-on-surface-variant text-center py-12">
                  Создай коллекцию, чтобы группировать карточки
                </p>
              ) : (
                collections.map((col) => (
                  <div key={col.id} className="rounded-2xl bg-surface-card border border-border-dim overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-4">
                      <div>
                        <p className="font-bold text-sm text-on-surface">{col.name}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          {col.card_count ?? col.template_ids.length} карточек
                        </p>
                      </div>
                      <button
                        onClick={() => startCollectionApply(col.id, col.name)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl kinetic-gradient text-on-primary text-xs font-bold min-h-[44px]"
                      >
                        <span className="material-symbols-outlined text-sm">send</span>
                        Применить
                      </button>
                    </div>
                    {col.template_ids.length > 0 && (
                      <div className="px-4 pb-4 space-y-1.5 border-t border-border-dim pt-3">
                        {templates
                          .filter((t) => col.template_ids.includes(t.template_id ?? t.id))
                          .map((t) => (
                            <div key={t.id} className="flex items-center gap-2">
                              <p className="flex-1 text-xs text-on-surface truncate">{t.title}</p>
                              <button
                                onClick={() => handleRemoveFromCollection(col.id, t.template_id ?? t.id)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant"
                                aria-label="Убрать из коллекции"
                              >
                                <span className="material-symbols-outlined text-sm">close</span>
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>

      {/* Collection apply bottom sheet */}
      {applyCollectionState && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end justify-center"
          onClick={() => { setApplyCollectionState(null); setCollApplyResult(null); }}
        >
          <div
            className="bg-surface-card rounded-t-3xl w-full max-w-[430px] mx-auto p-6 pb-10 space-y-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black tracking-tight">
                Применить «{applyCollectionState.collectionName}»
              </h3>
              <button
                onClick={() => { setApplyCollectionState(null); setCollApplyResult(null); }}
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-surface-elevated text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {collApplyResult ? (
              <div className="text-center py-6 space-y-3">
                <span className="material-symbols-outlined text-4xl text-primary">check_circle</span>
                <p className="font-bold text-on-surface">{collApplyResult}</p>
                <button
                  onClick={() => { setApplyCollectionState(null); setCollApplyResult(null); }}
                  className="w-full py-3 rounded-xl kinetic-gradient text-on-primary font-bold text-sm min-h-[44px]"
                >
                  Готово
                </button>
              </div>
            ) : !collApplyStudentId ? (
              <div className="space-y-2">
                <p className="text-xs text-on-surface-variant">Выбери ученика</p>
                {students.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => selectStudentForCollection(s.id)}
                    className="w-full flex items-center gap-3 rounded-2xl bg-surface-elevated p-4 text-left min-h-[56px]"
                  >
                    <span className="material-symbols-outlined text-on-surface-variant">person</span>
                    <span className="font-bold text-sm text-on-surface">{s.full_name ?? "—"}</span>
                    <span className="material-symbols-outlined text-on-surface-variant ml-auto text-base">chevron_right</span>
                  </button>
                ))}
              </div>
            ) : loadingCollSessions ? (
              <div className="py-8 flex justify-center">
                <span className="material-symbols-outlined text-on-surface-variant animate-spin">progress_activity</span>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => { setCollApplyStudentId(null); setCollApplySessions([]); }}
                  className="flex items-center gap-1 text-xs text-secondary font-bold"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  Другой ученик
                </button>
                {collApplySessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => applyCollectionToSession(s.id)}
                    className="w-full flex items-center gap-3 rounded-2xl bg-surface-elevated p-4 text-left min-h-[56px]"
                  >
                    <span className="material-symbols-outlined text-on-surface-variant text-sm">fitness_center</span>
                    <div className="flex-1">
                      <p className="font-bold text-sm text-on-surface">
                        Сессия {s.session_number}{s.trainer_notes ? ` — ${s.trainer_notes}` : ""}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {new Date(s.scheduled_at ?? s.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <span className="material-symbols-outlined text-primary text-sm">add_circle</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
