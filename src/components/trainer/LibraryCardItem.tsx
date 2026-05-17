"use client";

import { useEffect, useRef, useState } from "react";
import type { CardTemplate, InsightCollection, InsightCard } from "@/lib/types";
import { EditAiCardModal } from "@/components/insights/EditAiCardModal";
import { ApplyCardSheet } from "./ApplyCardSheet";

const STATUS_META: Record<string, { text: string; label: string }> = {
  approved: { text: "text-emerald-600", label: "Approved" },
  draft: { text: "text-amber-600", label: "Draft" },
  rejected: { text: "text-red-500", label: "Rejected" },
};

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
}

export function LibraryCardItem({
  template,
  students,
  collections,
  onAddToCollection,
  onRemoveFromCollection,
}: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

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

  const mainTag = template.tags?.[0];
  const statusStyle = STATUS_META[template.trainer_status];
  const tid = template.template_id ?? template.id;
  const inAnyCollection = collections.some((c) => c.template_ids.includes(tid));

  const body = template.body ?? "";
  const quote = template.quote ?? "";
  const total = body.length + quote.length;
  const bodySize =
    total > 520 ? "text-[12px] leading-snug" :
    total > 320 ? "text-[13px] leading-snug" :
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
      {/* Fixed-height flip card */}
      <article className="relative h-[280px]">
        {/* perspective wrapper */}
        <div className="absolute inset-0" style={{ perspective: "1400px" }}>
          {/* flip inner */}
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
              className="absolute inset-0 rounded-2xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-md transition-shadow overflow-hidden cursor-pointer"
              style={{ backfaceVisibility: "hidden" }}
              onClick={() => setFlipped(true)}
            >
              <div className="h-full p-5 flex flex-col">
                {/* Top: tag + "…" menu */}
                <div className="flex items-start justify-between mb-3">
                  <p className="text-[11px] font-medium text-gray-400 capitalize">
                    {mainTag ?? statusStyle?.label ?? "—"}
                  </p>

                  <div className="relative -mt-0.5 -mr-1" ref={popoverRef}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCollectionsOpen((v) => !v);
                      }}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                        inAnyCollection
                          ? "text-gray-700 bg-gray-100"
                          : "text-gray-300 hover:text-gray-600 hover:bg-gray-100"
                      }`}
                      aria-label="Коллекции"
                      aria-expanded={collectionsOpen}
                    >
                      <span className="material-symbols-outlined text-[18px]">more_horiz</span>
                    </button>

                    {collectionsOpen && (
                      <div className="absolute top-8 right-0 z-30 w-60 rounded-2xl bg-white border border-gray-200 shadow-2xl p-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-2.5 py-1.5">
                          Коллекции
                        </p>
                        {collections.length === 0 ? (
                          <p className="text-[12px] text-gray-400 px-2.5 py-2">Нет коллекций</p>
                        ) : (
                          <div className="max-h-56 overflow-y-auto">
                            {collections.map((col) => {
                              const inCol = col.template_ids.includes(tid);
                              return (
                                <button
                                  key={col.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (inCol) onRemoveFromCollection(col.id, tid);
                                    else onAddToCollection(col.id, tid);
                                    setCollectionsOpen(false);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-gray-50 text-left transition-colors"
                                >
                                  <span
                                    className={`material-symbols-outlined text-[16px] ${
                                      inCol ? "text-gray-900 fill-icon" : "text-gray-300"
                                    }`}
                                  >
                                    {inCol ? "check_circle" : "radio_button_unchecked"}
                                  </span>
                                  <span className="text-[13px] text-gray-800 truncate flex-1">
                                    {col.name}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Title */}
                <h3 className="flex-1 text-[22px] font-black text-gray-900 leading-tight tracking-tight line-clamp-3">
                  {template.title ?? "—"}
                </h3>

                {/* Bottom: assign + edit */}
                <div className="flex items-end justify-between mt-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setApplyOpen(true);
                    }}
                    className="text-[12px] font-semibold text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    {template.student_count > 0
                      ? `${template.student_count} ${template.student_count === 1 ? "ученик" : "учеников"}`
                      : "Assign..."}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditOpen(true);
                    }}
                    className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center hover:bg-gray-700 active:scale-95 transition-all"
                    aria-label="Редактировать"
                  >
                    <span className="material-symbols-outlined text-white text-[18px]">edit</span>
                  </button>
                </div>
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
                  <p
                    className={`text-gray-500 italic border-l-2 border-amber-400 pl-3 mt-3 shrink-0 ${quoteSize}`}
                  >
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
