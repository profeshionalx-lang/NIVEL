"use client";

import { useTransition, useState } from "react";
import { createMasterPlan, addSection, addItem, deleteSection, deleteItem } from "@/lib/actions/masterPlan";
import type { MasterPlan, MasterPlanCategory } from "@/lib/types";

const CATEGORY_LABELS: Record<MasterPlanCategory, string> = {
  strength: "Strengths",
  technique: "Technique",
  tactics: "Tactics",
  custom: "Other",
};

const CATEGORY_BORDER_CLASSES: Record<MasterPlanCategory, string> = {
  strength: "border-t-primary",
  technique: "border-t-secondary",
  tactics: "border-t-error",
  custom: "border-t-on-surface-variant",
};

const CATEGORY_TEXT_CLASSES: Record<MasterPlanCategory, string> = {
  strength: "text-primary",
  technique: "text-secondary",
  tactics: "text-error",
  custom: "text-on-surface-variant",
};

interface Props {
  studentId: string;
  plan: MasterPlan | null;
}

export default function MasterPlanEditor({ studentId, plan: initialPlan }: Props) {
  const [plan, setPlan] = useState(initialPlan);
  const [isPending, startTransition] = useTransition();
  const [addingSectionTo, setAddingSectionTo] = useState<string | null>(null);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionCategory, setNewSectionCategory] = useState<MasterPlanCategory>("technique");
  const [addingItemTo, setAddingItemTo] = useState<string | null>(null);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemImage, setNewItemImage] = useState("");

  function handleCreatePlan() {
    startTransition(async () => {
      const res = await createMasterPlan(studentId);
      if (res.success) {
        setPlan({ id: res.id, student_id: studentId, trainer_id: "", created_at: "", updated_at: "", sections: [] });
      }
    });
  }

  function handleAddSection(planId: string) {
    if (!newSectionTitle.trim()) return;
    const currentSortOrder = plan?.sections.length ?? 0;
    startTransition(async () => {
      const res = await addSection(planId, studentId, {
        title: newSectionTitle,
        category: newSectionCategory,
        sortOrder: currentSortOrder,
      });
      if (res.success) {
        setPlan((prev) => prev ? {
          ...prev,
          sections: [...prev.sections, { id: res.id, plan_id: planId, title: newSectionTitle, category: newSectionCategory, sort_order: prev.sections.length, items: [] }],
        } : prev);
        setNewSectionTitle("");
        setAddingSectionTo(null);
      }
    });
  }

  function handleDeleteSection(sectionId: string) {
    startTransition(async () => {
      const res = await deleteSection(sectionId, studentId);
      if (res.success) {
        setPlan((prev) => prev ? { ...prev, sections: prev.sections.filter((s) => s.id !== sectionId) } : prev);
      }
    });
  }

  function handleAddItem(sectionId: string) {
    if (!newItemTitle.trim()) return;
    const currentSortOrder = plan?.sections.find((s) => s.id === sectionId)?.items.length ?? 0;
    startTransition(async () => {
      const res = await addItem(sectionId, studentId, {
        title: newItemTitle,
        description: newItemDesc || null,
        imageUrl: newItemImage || null,
        sortOrder: currentSortOrder,
      });
      if (res.success) {
        setPlan((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            sections: prev.sections.map((s) =>
              s.id !== sectionId ? s : {
                ...s,
                items: [...s.items, { id: res.id, section_id: sectionId, title: newItemTitle, description: newItemDesc || null, image_url: newItemImage || null, sort_order: s.items.length }],
              }
            ),
          };
        });
        setNewItemTitle("");
        setNewItemDesc("");
        setNewItemImage("");
        setAddingItemTo(null);
      }
    });
  }

  function handleDeleteItem(sectionId: string, itemId: string) {
    startTransition(async () => {
      const res = await deleteItem(itemId, studentId);
      if (res.success) {
        setPlan((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            sections: prev.sections.map((s) =>
              s.id !== sectionId ? s : { ...s, items: s.items.filter((it) => it.id !== itemId) }
            ),
          };
        });
      }
    });
  }

  if (!plan) {
    return (
      <section>
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant mb-4">
          Master Plan
        </h3>
        <div className="bg-surface-card rounded-2xl p-6 flex flex-col items-center gap-3">
          <p className="text-on-surface-variant text-sm text-center">No master plan yet</p>
          <button
            onClick={handleCreatePlan}
            disabled={isPending}
            className="kinetic-gradient text-on-primary font-black py-2.5 px-6 rounded-xl text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            Create Master Plan
          </button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">
          Master Plan
        </h3>
        <button
          onClick={() => setAddingSectionTo(plan.id)}
          className="text-primary text-xs font-bold uppercase tracking-wider"
        >
          + Section
        </button>
      </div>

      <div className="space-y-4">
        {plan.sections.map((section) => (
          <div
            key={section.id}
            className={`bg-surface-card rounded-2xl p-4 border-t-[2px] ${CATEGORY_BORDER_CLASSES[section.category]}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className={`text-[10px] font-black uppercase tracking-widest ${CATEGORY_TEXT_CLASSES[section.category]}`}>
                  {CATEGORY_LABELS[section.category]}
                </span>
                <p className="font-bold text-sm mt-0.5">{section.title}</p>
              </div>
              <button
                onClick={() => handleDeleteSection(section.id)}
                disabled={isPending}
                className="text-error text-xs opacity-60 hover:opacity-100"
              >
                <span className="material-symbols-outlined text-base">delete</span>
              </button>
            </div>

            <div className="space-y-2 mb-3">
              {section.items.map((item) => (
                <div key={item.id} className="bg-surface-low rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{item.title}</p>
                      {item.description && (
                        <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">{item.description}</p>
                      )}
                      {item.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.image_url}
                          alt=""
                          className="mt-2 rounded-lg w-full object-cover max-h-48"
                        />
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteItem(section.id, item.id)}
                      disabled={isPending}
                      className="text-error opacity-40 hover:opacity-100 flex-shrink-0"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {addingItemTo === section.id ? (
              <div className="bg-surface-low rounded-xl p-3 space-y-2">
                <input
                  className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-on-surface-variant/50"
                  placeholder="Item title"
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  autoFocus
                />
                <textarea
                  className="w-full bg-transparent text-xs text-on-surface-variant outline-none resize-none placeholder:text-on-surface-variant/40"
                  placeholder="Description (optional)"
                  rows={2}
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                />
                <input
                  className="w-full bg-transparent text-xs text-on-surface-variant outline-none placeholder:text-on-surface-variant/40"
                  placeholder="Image URL (optional)"
                  value={newItemImage}
                  onChange={(e) => setNewItemImage(e.target.value)}
                />
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleAddItem(section.id)}
                    disabled={isPending || !newItemTitle.trim()}
                    className="text-xs font-black text-primary uppercase tracking-wider disabled:opacity-40"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setAddingItemTo(null); setNewItemTitle(""); setNewItemDesc(""); setNewItemImage(""); }}
                    className="text-xs text-on-surface-variant uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingItemTo(section.id)}
                className="text-xs text-on-surface-variant uppercase tracking-widest font-bold opacity-50 hover:opacity-100"
              >
                + Add item
              </button>
            )}
          </div>
        ))}
      </div>

      {addingSectionTo === plan.id && (
        <div className="mt-4 bg-surface-card rounded-2xl p-4 space-y-3">
          <input
            className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-on-surface-variant/50"
            placeholder="Section title (e.g. Volley technique)"
            value={newSectionTitle}
            onChange={(e) => setNewSectionTitle(e.target.value)}
            autoFocus
          />
          <select
            className="w-full bg-surface-low rounded-lg px-3 py-2 text-xs font-bold text-on-surface outline-none"
            value={newSectionCategory}
            onChange={(e) => setNewSectionCategory(e.target.value as MasterPlanCategory)}
          >
            <option value="strength">Strengths</option>
            <option value="technique">Technique</option>
            <option value="tactics">Tactics</option>
            <option value="custom">Other</option>
          </select>
          <div className="flex gap-3">
            <button
              onClick={() => handleAddSection(plan.id)}
              disabled={isPending || !newSectionTitle.trim()}
              className="text-xs font-black text-primary uppercase tracking-wider disabled:opacity-40"
            >
              Add Section
            </button>
            <button
              onClick={() => { setAddingSectionTo(null); setNewSectionTitle(""); }}
              className="text-xs text-on-surface-variant uppercase tracking-wider"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
