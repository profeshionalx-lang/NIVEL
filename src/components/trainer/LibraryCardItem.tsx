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
      <article
        className="group relative flex flex-col rounded-2xl bg-white border border-gray-200 shadow-sm hover:shadow-xl hover:-translate-y-0.5 hover:border-gray-300 transition-all duration-200 overflow-hidden"
      >
        {/* ── Card body ── */}
        <div className="flex-1 p-5 space-y-3">
          {/* Top row: tag + status */}
          <div className="flex items-center gap-2">
            {mainTag && tagStyle && (
              <span
                className={`inline-flex items-center text-[11px] font-semibold rounded-md px-2 py-0.5 ${tagStyle.bg} ${tagStyle.text} border ${tagStyle.border} capitalize`}
              >
                {mainTag}
              </span>
            )}
            {statusStyle && (
              <span className={`ml-auto text-[11px] font-semibold ${statusStyle.text}`}>
                {statusStyle.label}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-[15px] font-bold text-gray-900 leading-snug line-clamp-3">
            {template.title ?? "—"}
          </h3>
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-2.5 flex items-center gap-3">
          {/* Student count */}
          <div className="flex items-center flex-1 min-w-0 text-[12px] text-gray-400">
            {template.student_count > 0 && (
              <span className="tabular-nums">{template.student_count} {template.student_count === 1 ? "ученик" : "учеников"}</span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-0.5">
            {collections.length > 0 && (
              <div className="relative" ref={popoverRef}>
                <button
                  type="button"
                  onClick={() => setCollectionsOpen((v) => !v)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                    inAnyCollection
                      ? "text-gray-700 bg-gray-100 hover:bg-gray-200"
                      : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  }`}
                  aria-label="Добавить в коллекцию"
                  aria-expanded={collectionsOpen}
                >
                  <span className={`material-symbols-outlined text-[17px] ${inAnyCollection ? "fill-icon" : ""}`}>
                    bookmark
                  </span>
                </button>
                {collectionsOpen && (
                  <div className="absolute bottom-10 right-0 z-30 w-60 rounded-xl bg-white border border-gray-200 shadow-2xl p-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-2.5 py-1.5">
                      Коллекции
                    </p>
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
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-gray-50 text-left transition-colors"
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
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Редактировать"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
            </button>
            <button
              type="button"
              onClick={() => setApplyOpen(true)}
              className="ml-1 inline-flex items-center gap-1 h-8 px-3 rounded-lg kinetic-gradient text-on-primary text-[12px] font-bold hover:shadow-md transition-all duration-200"
              aria-label="Применить к ученику"
            >
              Assign
              <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
            </button>
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
