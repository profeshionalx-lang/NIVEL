"use client";

import { useState } from "react";
import type { CardTemplate, InsightCollection } from "@/lib/types";
import { EditAiCardModal } from "@/components/insights/EditAiCardModal";
import { ApplyCardSheet } from "./ApplyCardSheet";
import type { InsightCard } from "@/lib/types";

const TAG_COLORS: Record<string, string> = {
  техника: "text-blue-400 bg-blue-500/10",
  тактика: "text-amber-400 bg-amber-500/10",
  физика: "text-green-400 bg-green-500/10",
  менталка: "text-purple-400 bg-purple-500/10",
};

const STATUS_LABELS: Record<string, string> = {
  approved: "Approved",
  draft: "Draft",
  rejected: "Rejected",
};
const STATUS_COLORS: Record<string, string> = {
  approved: "text-green-400 bg-green-500/10",
  draft: "text-amber-400 bg-amber-500/10",
  rejected: "text-red-400 bg-red-500/10",
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
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);

  const mainTag = template.tags?.[0];
  const sideTag = template.tags?.[1];
  const tagColor = mainTag ? TAG_COLORS[mainTag] ?? "text-on-surface-variant bg-surface-elevated" : "";

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
      <div className="rounded-2xl bg-surface-card border border-border-dim overflow-hidden">
        {/* Header row */}
        <button
          className="w-full flex items-start gap-3 p-4 text-left"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {mainTag && (
                <span className={`text-[10px] font-black uppercase tracking-widest rounded-full px-2 py-0.5 ${tagColor}`}>
                  {mainTag}
                </span>
              )}
              {sideTag && (
                <span className="text-[10px] font-black uppercase tracking-widest rounded-full px-2 py-0.5 text-on-surface-variant bg-surface-elevated">
                  {sideTag}
                </span>
              )}
              <span className={`text-[10px] font-black uppercase tracking-widest rounded-full px-2 py-0.5 ${STATUS_COLORS[template.trainer_status]}`}>
                {STATUS_LABELS[template.trainer_status]}
              </span>
            </div>
            <p className="text-sm font-bold text-on-surface line-clamp-2">
              {template.title ?? template.body ?? "—"}
            </p>
            {/* Stats */}
            <p className="text-[11px] text-on-surface-variant">
              <span className="mr-2">👤 {template.student_count}</span>
              <span className="mr-2">✅ {template.taken_count}</span>
              {template.skipped_count > 0 && <span className="mr-2">⏭ {template.skipped_count}</span>}
              {template.pending_count > 0 && <span>⏳ {template.pending_count}</span>}
            </p>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant text-base mt-0.5 flex-shrink-0">
            {expanded ? "expand_less" : "expand_more"}
          </span>
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="px-4 pb-4 space-y-3 border-t border-border-dim">
            {template.body && (
              <p className="text-sm text-on-surface pt-3">{template.body}</p>
            )}
            {template.quote && (
              <p className="text-xs text-on-surface-variant italic border-l-2 border-primary/40 pl-3">
                «{template.quote}»
              </p>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-1 flex-wrap">
              <button
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-elevated text-on-surface text-xs font-bold min-h-[44px] border border-border-dim"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                Редактировать
              </button>
              <button
                onClick={() => setApplyOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl kinetic-gradient text-on-primary text-xs font-bold min-h-[44px]"
              >
                <span className="material-symbols-outlined text-sm">person_add</span>
                Применить
              </button>
              {collections.length > 0 && (
                <button
                  onClick={() => setCollectionsOpen((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-elevated text-on-surface-variant text-xs font-bold min-h-[44px] border border-border-dim"
                >
                  <span className="material-symbols-outlined text-sm">bookmark</span>
                  В коллекцию
                </button>
              )}
            </div>

            {/* Collections picker */}
            {collectionsOpen && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  Коллекции
                </p>
                {collections.map((col) => {
                  const inCollection = col.template_ids.includes(template.template_id ?? template.id);
                  return (
                    <button
                      key={col.id}
                      onClick={() =>
                        inCollection
                          ? onRemoveFromCollection(col.id, template.template_id ?? template.id)
                          : onAddToCollection(col.id, template.template_id ?? template.id)
                      }
                      className="w-full flex items-center gap-2 rounded-xl bg-surface-elevated px-3 py-2.5 text-sm min-h-[44px]"
                    >
                      <span className={`material-symbols-outlined text-base ${inCollection ? "text-primary" : "text-on-surface-variant"}`}>
                        {inCollection ? "bookmark" : "bookmark_border"}
                      </span>
                      <span className="font-medium text-on-surface">{col.name}</span>
                      {inCollection && (
                        <span className="ml-auto text-[10px] text-primary font-black uppercase">Добавлено</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {editOpen && (
        <EditAiCardModal card={pseudoCard} onClose={() => setEditOpen(false)} />
      )}
      {applyOpen && (
        <ApplyCardSheet
          templateId={template.template_id ?? template.id}
          templateTitle={template.title}
          students={students}
          onClose={() => setApplyOpen(false)}
        />
      )}
    </>
  );
}
