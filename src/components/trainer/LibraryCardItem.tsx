"use client";

import { useEffect, useRef, useState } from "react";
import type { CardTemplate, InsightCollection, InsightCard } from "@/lib/types";
import { EditAiCardModal } from "@/components/insights/EditAiCardModal";
import { ApplyCardSheet } from "./ApplyCardSheet";

// Tag color palette — soft, distinguishable, accessible on white
const TAG_COLORS: Record<string, { dot: string; bg: string; text: string; border: string }> = {
  техника: { dot: "bg-blue-500", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-100" },
  тактика: { dot: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-100" },
  физика: { dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
  менталка: { dot: "bg-purple-500", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-100" },
};

const STATUS_META: Record<string, { dot: string; text: string; bg: string; label: string }> = {
  approved: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", label: "Approved" },
  draft: { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", label: "Draft" },
  rejected: { dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50", label: "Rejected" },
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
  const sideTag = template.tags?.[1];
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
                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2.5 py-1 ${tagStyle.bg} ${tagStyle.text} border ${tagStyle.border}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${tagStyle.dot}`} />
                <span className="capitalize">{mainTag}</span>
              </span>
            )}
            {sideTag && (
              <span className="inline-flex items-center text-[11px] font-medium text-gray-500 rounded-full px-2 py-1 bg-gray-50 border border-gray-100 capitalize">
                {sideTag}
              </span>
            )}
            {statusStyle && (
              <span
                className={`ml-auto inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 ${statusStyle.bg} ${statusStyle.text}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                {statusStyle.label}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-[15px] font-bold text-gray-900 leading-snug line-clamp-2">
            {template.title ?? "—"}
          </h3>

          {/* Body */}
          {template.body && (
            <p className="text-[13px] text-gray-500 leading-relaxed line-clamp-3">
              {template.body}
            </p>
          )}

          {/* Quote */}
          {template.quote && (
            <blockquote className="text-[12px] text-gray-600 italic border-l-2 border-gray-200 pl-3 line-clamp-2 leading-relaxed">
              «{template.quote}»
            </blockquote>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-2.5 flex items-center gap-3">
          {/* Stats */}
          <div className="flex items-center gap-3 flex-1 min-w-0 text-[12px] text-gray-500">
            <span className="inline-flex items-center gap-1" title="Учеников">
              <span className="material-symbols-outlined text-[15px] text-gray-400">group</span>
              <span className="font-medium tabular-nums">{template.student_count}</span>
            </span>
            {template.taken_count > 0 && (
              <span className="inline-flex items-center gap-1 text-emerald-600" title="Принято">
                <span className="material-symbols-outlined text-[15px]">check</span>
                <span className="font-medium tabular-nums">{template.taken_count}</span>
              </span>
            )}
            {template.skipped_count > 0 && (
              <span className="inline-flex items-center gap-1" title="Пропущено">
                <span className="material-symbols-outlined text-[15px] text-gray-400">arrow_forward</span>
                <span className="font-medium tabular-nums">{template.skipped_count}</span>
              </span>
            )}
            {template.pending_count > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-600" title="Ожидает">
                <span className="material-symbols-outlined text-[15px]">schedule</span>
                <span className="font-medium tabular-nums">{template.pending_count}</span>
              </span>
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
