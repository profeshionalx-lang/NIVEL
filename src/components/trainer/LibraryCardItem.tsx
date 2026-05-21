"use client";

import { useEffect, useRef, useState } from "react";
import type { CardTemplate, InsightCollection, InsightCard } from "@/lib/types";
import { EditAiCardModal } from "@/components/insights/EditAiCardModal";
import { ApplyCardSheet } from "./ApplyCardSheet";

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  техника: { bg: "bg-blue-50", text: "text-blue-700" },
  тактика: { bg: "bg-amber-50", text: "text-amber-700" },
  физика:  { bg: "bg-emerald-50", text: "text-emerald-700" },
  менталка: { bg: "bg-purple-50", text: "text-purple-700" },
};

const FLIP_HINT_KEY = "nivel:library-flip-hint-seen";

const SIDE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  защита:  { bg: "bg-sky-50", text: "text-sky-700", label: "Защита" },
  defense: { bg: "bg-sky-50", text: "text-sky-700", label: "Защита" },
  атака:   { bg: "bg-rose-50", text: "text-rose-700", label: "Атака" },
  attack:  { bg: "bg-rose-50", text: "text-rose-700", label: "Атака" },
};

const STATUS_META: Record<string, { text: string; label: string }> = {
  approved: { text: "text-emerald-600", label: "Approved" },
  draft:    { text: "text-amber-600",   label: "Draft" },
  rejected: { text: "text-red-500",     label: "Rejected" },
};

function titleFontSize(title: string): string {
  const len = title.length;
  if (len < 45)  return "text-[20px] leading-snug";
  if (len < 70)  return "text-[17px] leading-snug";
  if (len < 100) return "text-[14px] leading-snug";
  if (len < 140) return "text-[12px] leading-snug";
  return "text-[11px] leading-snug";
}

interface Student {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Props {
  template: CardTemplate & { student_ids: string[] };
  students: Student[];
  collections: (InsightCollection & { template_ids: string[] })[];
  onAddToCollection: (collectionId: string, templateId: string) => void;
  onRemoveFromCollection: (collectionId: string, templateId: string) => void;
  isHintCard?: boolean;
}

export function LibraryCardItem({
  template,
  students,
  collections,
  onAddToCollection,
  onRemoveFromCollection,
  isHintCard,
}: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isHintCard) return;
    if (localStorage.getItem(FLIP_HINT_KEY)) return;
    const on  = setTimeout(() => setFlipped(true),  600);
    const off = setTimeout(() => {
      setFlipped(false);
      localStorage.setItem(FLIP_HINT_KEY, "1");
    }, 2100);
    return () => { clearTimeout(on); clearTimeout(off); };
  }, [isHintCard]);

  useEffect(() => {
    if (!collectionsOpen) return;
    function onDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setCollectionsOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [collectionsOpen]);

  const mainTag  = template.tags?.[0];
  const sideTag  = template.tags?.[1];
  const tagStyle  = mainTag ? TAG_COLORS[mainTag]  : undefined;
  const sideStyle = sideTag ? SIDE_COLORS[sideTag] : undefined;
  const statusStyle = STATUS_META[template.trainer_status];
  const tid = template.template_id ?? template.id;
  const inAnyCollection = collections.some((c) => c.template_ids.includes(tid));

  const body  = template.body  ?? "";
  const quote = template.quote ?? "";
  const total = body.length + quote.length;
  const bodySize =
    total > 520 ? "text-[12px] leading-snug"    :
    total > 320 ? "text-[13px] leading-snug"    :
    total > 160 ? "text-[14px] leading-relaxed" :
    "text-[15px] leading-relaxed";
  const quoteSize = total > 320 ? "text-[11px]" : "text-[12px]";

  const pseudoCard: InsightCard = {
    id: template.id,
    session_id: "",
    student_id: "",
    trainer_id: "",
    problem_id: null,
    category_id: null,
    front_text: template.title ?? "",
    context_text: template.body,
    title: template.title,
    body: template.body,
    quote: template.quote,
    tags: template.tags,
    source: "ai-paste",
    trainer_status: template.trainer_status,
    student_decision: null,
    student_edited_text: null,
    position: 0,
    created_at: template.created_at,
    decided_at: null,
    template_id: template.template_id,
  };

  return (
    <>
      <article className="relative h-[300px]">
        <div className="absolute inset-0" style={{ perspective: "1400px" }}>
          <div
            className="absolute inset-0"
            style={{
              transformStyle: "preserve-3d",
              transition: "transform 0.55s cubic-bezier(0.2, 1, 0.3, 1)",
              transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            }}
          >
            {/* ── Front face ── */}
            <div
              className="absolute inset-0 rounded-2xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-md transition-shadow overflow-hidden flex flex-col"
              style={{ backfaceVisibility: "hidden" }}
            >
              {/* Clickable body (flips card) */}
              <div
                className="flex-1 p-5 flex flex-col cursor-pointer min-h-0"
                onClick={() => setFlipped(true)}
              >
                {/* Tags row + status */}
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  {mainTag && tagStyle && (
                    <span className={`text-[10px] font-semibold rounded-md px-2 py-0.5 capitalize ${tagStyle.bg} ${tagStyle.text}`}>
                      {mainTag}
                    </span>
                  )}
                  {sideStyle && (
                    <span className={`text-[10px] font-semibold rounded-md px-2 py-0.5 ${sideStyle.bg} ${sideStyle.text}`}>
                      {sideStyle.label}
                    </span>
                  )}
                  {statusStyle && (
                    <span className={`ml-auto text-[10px] font-semibold ${statusStyle.text}`}>
                      {statusStyle.label}
                    </span>
                  )}
                </div>

                {/* Title — full text, adaptive size */}
                <h3 className={`font-black text-gray-900 tracking-tight ${titleFontSize(template.title ?? "")}`}>
                  {template.title ?? "—"}
                </h3>
              </div>

              {/* Footer — action buttons, never flips */}
              <div className="border-t border-gray-100 bg-gray-50 px-4 py-2.5 flex items-center gap-2 shrink-0">
                {/* Student count */}
                <div className="flex items-center gap-1 flex-1 min-w-0 text-[12px] text-gray-400">
                  <span className="material-symbols-outlined text-[15px]">person</span>
                  <span className="tabular-nums">
                    {template.student_count > 0 ? template.student_count : 0}
                  </span>
                </div>

                {/* Collections bookmark */}
                {collections.length > 0 && (
                  <div className="relative" ref={popoverRef}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setCollectionsOpen((v) => !v); }}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                        inAnyCollection
                          ? "text-gray-700 bg-gray-200"
                          : "text-gray-400 hover:text-gray-700 hover:bg-gray-200"
                      }`}
                      aria-label="Добавить в коллекцию"
                    >
                      <span className={`material-symbols-outlined text-[17px] ${inAnyCollection ? "fill-icon" : ""}`}>
                        bookmark
                      </span>
                    </button>
                    {collectionsOpen && (
                      <div className="absolute bottom-10 right-0 z-30 w-60 rounded-2xl bg-white border border-gray-200 shadow-2xl p-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-2.5 py-1.5">
                          Коллекции
                        </p>
                        <div className="max-h-56 overflow-y-auto">
                          {collections.map((col) => {
                            const inCol = col.template_ids.includes(tid);
                            return (
                              <button
                                key={col.id}
                                type="button"
                                onClick={() => {
                                  if (inCol) onRemoveFromCollection(col.id, tid);
                                  else onAddToCollection(col.id, tid);
                                  setCollectionsOpen(false);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-gray-50 text-left transition-colors"
                              >
                                <span className={`material-symbols-outlined text-[16px] ${inCol ? "text-gray-900 fill-icon" : "text-gray-300"}`}>
                                  {inCol ? "check_circle" : "radio_button_unchecked"}
                                </span>
                                <span className="text-[13px] text-gray-800 truncate flex-1">{col.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Edit */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
                  aria-label="Редактировать"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                </button>

                {/* Assign */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setApplyOpen(true); }}
                  className="inline-flex items-center gap-1 h-8 px-3 rounded-lg kinetic-gradient text-on-primary text-[12px] font-bold hover:shadow-md transition-all"
                  aria-label="Применить к ученику"
                >
                  Assign
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            </div>

            {/* ── Back face ── */}
            <div
              className="absolute inset-0 rounded-2xl bg-white border border-gray-100 overflow-hidden cursor-pointer"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              onClick={() => setFlipped(false)}
            >
              <div className="h-full p-5 flex flex-col">
                <div className="flex items-center gap-2 text-gray-400 mb-3 shrink-0">
                  <span className="material-symbols-outlined text-base">flip_to_front</span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Разбор</span>
                </div>

                {body ? (
                  <p className={`text-gray-800 whitespace-pre-line ${bodySize}`}>{body}</p>
                ) : null}

                <div className="flex-1" />

                {quote ? (
                  <p className={`text-gray-500 italic border-l-2 border-amber-400 pl-3 mt-3 shrink-0 ${quoteSize}`}>
                    «{quote}»
                  </p>
                ) : null}

                {!body && !quote && (
                  <p className="text-[13px] text-gray-400">Описание не добавлено.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </article>

      {editOpen && <EditAiCardModal card={pseudoCard} onClose={() => setEditOpen(false)} />}
      {applyOpen && (
        <ApplyCardSheet
          templateId={tid}
          templateTitle={template.title}
          students={students}
          onClose={() => setApplyOpen(false)}
        />
      )}
    </>
  );
}
