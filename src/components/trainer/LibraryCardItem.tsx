"use client";

import { useState } from "react";
import type { CardTemplate, InsightCollection } from "@/lib/types";
import { EditAiCardModal } from "@/components/insights/EditAiCardModal";
import { ApplyCardSheet } from "./ApplyCardSheet";
import type { InsightCard } from "@/lib/types";

const TAG_COLORS: Record<string, string> = {
  техника: "text-blue-600 bg-blue-50 border-blue-200",
  тактика: "text-amber-600 bg-amber-50 border-amber-200",
  физика: "text-emerald-600 bg-emerald-50 border-emerald-200",
  менталка: "text-purple-600 bg-purple-50 border-purple-200",
};

const STATUS_COLORS: Record<string, string> = {
  approved: "text-emerald-700 bg-emerald-50 border-emerald-200",
  draft: "text-amber-600 bg-amber-50 border-amber-200",
  rejected: "text-red-600 bg-red-50 border-red-200",
};
const STATUS_LABELS: Record<string, string> = {
  approved: "Approved",
  draft: "Draft",
  rejected: "Rejected",
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

  const mainTag = template.tags?.[0];
  const sideTag = template.tags?.[1];
  const tagColor = mainTag
    ? TAG_COLORS[mainTag] ?? "text-on-surface-variant bg-surface-elevated border-border-dim"
    : "";

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

  const tid = template.template_id ?? template.id;

  return (
    <>
      <div className="group flex flex-col rounded-2xl bg-white border border-gray-200/80 hover:border-gray-300 transition-all duration-150 hover:shadow-[0_8px_32px_rgba(0,0,0,0.45)] overflow-hidden">
        {/* Card body */}
        <div className="flex-1 p-5 space-y-3">
          {/* Tags row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {mainTag && (
              <span className={`text-[10px] font-black uppercase tracking-widest border rounded-full px-2 py-0.5 ${tagColor}`}>
                {mainTag}
              </span>
            )}
            {sideTag && (
              <span className="text-[10px] font-black uppercase tracking-widest border border-gray-200 rounded-full px-2 py-0.5 text-gray-500 bg-gray-50">
                {sideTag}
              </span>
            )}
            <span className={`ml-auto text-[10px] font-black uppercase tracking-widest border rounded-full px-2 py-0.5 ${STATUS_COLORS[template.trainer_status]}`}>
              {STATUS_LABELS[template.trainer_status]}
            </span>
          </div>

          {/* Title */}
          <p className="text-sm font-bold text-gray-900 leading-snug">
            {template.title ?? "—"}
          </p>

          {/* Body preview */}
          {template.body && (
            <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">
              {template.body}
            </p>
          )}

          {/* Quote */}
          {template.quote && (
            <p className="text-[11px] text-gray-400 italic border-l-2 border-gray-200 pl-3 line-clamp-2">
              «{template.quote}»
            </p>
          )}
        </div>

        {/* Stats + actions footer */}
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 flex items-center gap-4">
          {/* Stats */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <span className="material-symbols-outlined text-[14px]">group</span>
              {template.student_count}
            </span>
            {template.taken_count > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-600">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                {template.taken_count}
              </span>
            )}
            {template.skipped_count > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                <span className="material-symbols-outlined text-[14px]">skip_next</span>
                {template.skipped_count}
              </span>
            )}
            {template.pending_count > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-amber-500">
                <span className="material-symbols-outlined text-[14px]">schedule</span>
                {template.pending_count}
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            {collections.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setCollectionsOpen((v) => !v)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  aria-label="Добавить в коллекцию"
                >
                  <span className="material-symbols-outlined text-[16px]">bookmark_border</span>
                </button>
                {collectionsOpen && (
                  <div className="absolute bottom-10 right-0 z-20 w-56 rounded-2xl bg-white border border-gray-200 shadow-2xl p-2 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-2 py-1">
                      Коллекции
                    </p>
                    {collections.map((col) => {
                      const inCollection = col.template_ids.includes(tid);
                      return (
                        <button
                          key={col.id}
                          onClick={() => {
                            inCollection
                              ? onRemoveFromCollection(col.id, tid)
                              : onAddToCollection(col.id, tid);
                            setCollectionsOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-gray-50 text-left min-h-[36px]"
                        >
                          <span className={`material-symbols-outlined text-[16px] ${inCollection ? "text-primary fill-icon" : "text-gray-400"}`}>
                            bookmark
                          </span>
                          <span className="text-sm text-gray-800 truncate">{col.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => setEditOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Редактировать"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
            </button>
            <button
              onClick={() => setApplyOpen(true)}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg kinetic-gradient text-on-primary text-[11px] font-black uppercase tracking-wide"
              aria-label="Применить к студенту"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              Дать
            </button>
          </div>
        </div>
      </div>

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
