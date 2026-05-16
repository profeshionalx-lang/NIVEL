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
import type { StudentSessionOption } from "@/lib/actions/insightCards";

type Tab = "cards" | "collections";

const TAGS = ["техника", "тактика", "физика", "менталка"] as const;

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

  const q = search.toLowerCase();
  const filtered = templates.filter((t) => {
    if (q && !t.title?.toLowerCase().includes(q) && !t.body?.toLowerCase().includes(q)) return false;
    if (tagFilter && !t.tags?.includes(tagFilter)) return false;
    if (statusFilter !== "all" && t.trainer_status !== statusFilter) return false;
    if (studentFilter && !t.student_ids.includes(studentFilter)) return false;
    return true;
  });

  const hasFilters = !!(search || tagFilter || statusFilter !== "all" || studentFilter);

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

  async function startCollectionApply(id: string, name: string) {
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
      {/* Top header bar */}
      <header className="sticky top-0 z-30 glass-nav border-b border-border-dim">
        <div className="flex items-center gap-6 px-6 h-14 max-w-screen-xl mx-auto">
          {/* Logo / title */}
          <span className="text-base font-black text-primary uppercase italic tracking-tight hidden md:block">
            Nivel
          </span>
          <div className="w-px h-5 bg-border-dim hidden md:block" />
          <span className="text-sm font-bold text-on-surface">Библиотека карточек</span>

          {/* Tabs */}
          <div className="flex gap-1 ml-4">
            {(["cards", "collections"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors ${
                  tab === t ? "bg-primary/15 text-primary" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {t === "cards" ? `Карточки · ${templates.length}` : `Коллекции · ${collections.length}`}
              </button>
            ))}
          </div>

          {/* Right: search (desktop) */}
          <div className="ml-auto hidden md:flex items-center gap-2 w-72">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">
                search
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по карточкам…"
                className="w-full bg-surface-elevated rounded-xl pl-9 pr-3 py-2 text-sm text-on-surface border border-border-dim focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        </div>
      </header>

      {tab === "cards" && (
        <div className="flex flex-1 overflow-hidden">
          {/* ── Sidebar (desktop only) ── */}
          <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-border-dim sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-6 px-4 space-y-6">
            {/* Tag filter */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-1">
                Тема
              </p>
              <div className="space-y-1">
                <button
                  onClick={() => setTagFilter(null)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    !tagFilter ? "bg-primary/10 text-primary font-bold" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-elevated"
                  }`}
                >
                  Все темы
                </button>
                {TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setTagFilter(tag === tagFilter ? null : tag)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${
                      tagFilter === tag ? "bg-primary/10 text-primary font-bold" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-elevated"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-border-dim" />

            {/* Status filter */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-1">
                Статус
              </p>
              <div className="space-y-1">
                {(["all", "approved", "draft", "rejected"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      statusFilter === s ? "bg-primary/10 text-primary font-bold" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-elevated"
                    }`}
                  >
                    {s === "all" ? "Все" : s === "approved" ? "Approved" : s === "draft" ? "Draft" : "Rejected"}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-border-dim" />

            {/* Student filter */}
            {students.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant px-1">
                  Ученик
                </p>
                <div className="space-y-1">
                  <button
                    onClick={() => setStudentFilter(null)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      !studentFilter ? "bg-primary/10 text-primary font-bold" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-elevated"
                    }`}
                  >
                    Все ученики
                  </button>
                  {students.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setStudentFilter(s.id === studentFilter ? null : s.id)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors truncate ${
                        studentFilter === s.id ? "bg-primary/10 text-primary font-bold" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-elevated"
                      }`}
                    >
                      {s.full_name ?? "—"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {hasFilters && (
              <button
                onClick={() => { setSearch(""); setTagFilter(null); setStatusFilter("all"); setStudentFilter(null); }}
                className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-on-surface transition-colors px-1"
              >
                <span className="material-symbols-outlined text-sm">close</span>
                Сбросить фильтры
              </button>
            )}
          </aside>

          {/* ── Main content ── */}
          <main className="flex-1 overflow-y-auto">
            {/* Mobile search */}
            <div className="md:hidden px-5 pt-4">
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
            </div>

            {/* Mobile filter chips */}
            <div className="md:hidden flex gap-2 px-5 pt-3 pb-1 overflow-x-auto scrollbar-hide">
              {TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setTagFilter(tag === tagFilter ? null : tag)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest min-h-[32px] ${
                    tagFilter === tag ? "bg-primary text-on-primary" : "bg-surface-card text-on-surface-variant border border-border-dim"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Summary bar */}
            <div className="flex items-center justify-between px-5 md:px-8 py-4 border-b border-border-dim">
              <p className="text-xs text-on-surface-variant">
                {filtered.length === templates.length
                  ? `${templates.length} карточек`
                  : `${filtered.length} из ${templates.length}`}
              </p>
              {hasFilters && (
                <button
                  onClick={() => { setSearch(""); setTagFilter(null); setStatusFilter("all"); setStudentFilter(null); }}
                  className="text-xs text-secondary font-bold flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                  Сбросить
                </button>
              )}
            </div>

            {/* Card grid */}
            <div className="p-5 md:p-8 pb-36">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-4">
                    search_off
                  </span>
                  <p className="text-sm text-on-surface-variant">
                    {hasFilters ? "Нет карточек по фильтрам" : "Нет карточек в библиотеке"}
                  </p>
                </div>
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
      )}

      {/* ── Collections tab ── */}
      {tab === "collections" && (
        <main className="flex-1 p-5 md:p-8 pb-36 max-w-2xl">
          {/* Create */}
          <div className="flex gap-3 mb-6">
            <input
              value={newCollName}
              onChange={(e) => setNewCollName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateCollection()}
              placeholder="Название новой коллекции…"
              className="flex-1 bg-surface-card rounded-2xl px-4 py-3 text-sm text-on-surface border border-border-dim focus:border-primary focus:outline-none min-h-[44px]"
            />
            <button
              onClick={handleCreateCollection}
              disabled={!newCollName.trim()}
              className="px-5 rounded-2xl kinetic-gradient text-on-primary text-sm font-bold disabled:opacity-40 min-h-[44px]"
            >
              Создать
            </button>
          </div>

          {collections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-4">
                bookmarks
              </span>
              <p className="text-sm text-on-surface-variant">
                Создай коллекцию, чтобы группировать карточки
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {collections.map((col) => (
                <div key={col.id} className="rounded-2xl bg-surface-card border border-border-dim overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4">
                    <div>
                      <p className="font-bold text-sm text-on-surface">{col.name}</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {col.card_count ?? col.template_ids.length} карточек
                      </p>
                    </div>
                    <button
                      onClick={() => startCollectionApply(col.id, col.name)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl kinetic-gradient text-on-primary text-xs font-bold min-h-[44px]"
                    >
                      <span className="material-symbols-outlined text-sm">send</span>
                      Применить к ученику
                    </button>
                  </div>
                  {col.template_ids.length > 0 && (
                    <div className="border-t border-border-dim">
                      {templates
                        .filter((t) => col.template_ids.includes(t.template_id ?? t.id))
                        .map((t) => (
                          <div key={t.id} className="flex items-center gap-3 px-5 py-3 border-b border-border-dim last:border-0">
                            <span className="material-symbols-outlined text-on-surface-variant text-sm">
                              drag_indicator
                            </span>
                            <p className="flex-1 text-sm text-on-surface truncate">{t.title}</p>
                            <button
                              onClick={() => handleRemoveFromCollection(col.id, t.template_id ?? t.id)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <span className="material-symbols-outlined text-sm">close</span>
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

      {/* Collection apply sheet */}
      {collApplyState && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end justify-center"
          onClick={() => { setCollApplyState(null); setCollApplyResult(null); }}
        >
          <div
            className="bg-surface-card rounded-t-3xl w-full max-w-[430px] mx-auto p-6 pb-10 space-y-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black tracking-tight">«{collApplyState.name}»</h3>
              <button
                onClick={() => { setCollApplyState(null); setCollApplyResult(null); }}
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
                  onClick={() => { setCollApplyState(null); setCollApplyResult(null); }}
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
                    className="w-full flex items-center gap-3 rounded-2xl bg-surface-elevated p-4 text-left min-h-[56px] active:opacity-80"
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
                  className="flex items-center gap-1 text-xs text-secondary font-bold mb-2"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  Другой ученик
                </button>
                {collApplySessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => applyCollectionToSession(s.id)}
                    className="w-full flex items-center gap-3 rounded-2xl bg-surface-elevated p-4 text-left min-h-[56px] active:opacity-80"
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
