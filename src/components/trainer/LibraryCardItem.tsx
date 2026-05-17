"use client";

import { useEffect, useRef, useState } from "react";
import type { CardTemplate, InsightCollection, InsightCard } from "@/lib/types";
import { EditAiCardModal } from "@/components/insights/EditAiCardModal";
import { ApplyCardSheet } from "./ApplyCardSheet";

const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  техника: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-100" },
  тактика: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-100" },
  физика: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
  менталка: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-100" },
};

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
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
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
  const tagStyle = mainTag ? TAG_COLORS[mainTag] : undefined;
  const statusStyle = STATUS_META[template.trainer_status];

  const tid = template.template_id ?? template.id;
  const inAnyCollection = collections.some((c) => c.template_ids.includes(tid));

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
      <article className="group relative flex flex-col rounded-2xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all duration-200 overflow-hidden min-h-[240px]">
        {/* ── Top: tag + menu ── */}
        <div className="flex items-start justify-between px-5 pt-5 pb-2">
          <div className="flex-1 min-w-0 pr-2">
            <p className="text-[11px] font-medium text-gray-400 mb-1.5 capitalize">
              {mainTag ?? statusStyle?.label ?? "—"}
            </p>
            <h3 className="text-[16px] font-bold text-gray-900 leading-snug line-clamp-2">
              {template.title ?? "—"}
            </h3>
          </div>

          {/* "..." menu */}
          <div className="relative" ref={popoverRef}>
            <button
              type="button"
              onClick={() => setCollectionsOpen((v) => !v)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
              aria-label="Действия с карточкой"
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
                  <div className="max-h-64 overflow-y-auto">
                    {collections.map((col) => {
                      const inCollection = col.template_ids.includes(tid);
                      return (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => {
                            if (inCollection) onRemoveFromCollection(col.id, tid);
                            else onAddToCollection(col.id, tid);
                            setCollectionsOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-gray-50 text-left transition-colors"
                        >
                          <span
                            className={`material-symbols-outlined text-[16px] ${
                              inCollection ? "text-gray-900 fill-icon" : "text-gray-300"
                            }`}
                          >
                            {inCollection ? "check_circle" : "radio_button_unchecked"}
                          </span>
                          <span className="text-[13px] text-gray-800 truncate flex-1">{col.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Body content ── */}
        <div className="flex-1 px-5 pb-4">
          {template.body ? (
            <p className="text-[13px] text-gray-400 leading-relaxed line-clamp-4">
              {template.body}
            </p>
          ) : (
            <p className="text-[13px] text-gray-200 italic">Нет описания...</p>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 pb-5 flex items-end justify-between">
          {/* Left: assign */}
          <button
            type="button"
            onClick={() => setApplyOpen(true)}
            className="text-[12px] font-semibold text-gray-400 hover:text-gray-700 transition-colors"
            aria-label="Применить к ученику"
          >
            {template.student_count > 0
              ? `${template.student_count} ${template.student_count === 1 ? "ученик" : "учеников"}`
              : "Assign..."}
          </button>

          {/* Right: dark circle edit button */}
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center hover:bg-gray-700 active:scale-95 transition-all"
            aria-label="Редактировать"
          >
            <span className="material-symbols-outlined text-white text-[18px]">edit</span>
          </button>
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
