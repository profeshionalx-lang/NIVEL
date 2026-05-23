"use client";

import { useState, type ReactNode } from "react";
import ProgressBar from "@/components/ui/ProgressBar";

interface Skill {
  skill_id: number;
  skill_name: string;
  points_in_level: number;
  level: number;
}

interface Props {
  skills: Skill[];
  deltas: Record<number, number>;
  newIds: number[];
  label: string;
  addButton?: ReactNode;
}

export default function SkillProgressSection({ skills, deltas, newIds, label, addButton }: Props) {
  const updated = skills.filter((s) => deltas[s.skill_id] || newIds.includes(s.skill_id));
  const rest = skills.filter((s) => !deltas[s.skill_id] && !newIds.includes(s.skill_id));

  // Toggle только когда есть и новые, и старые скиллы
  const hasToggle = updated.length > 0 && rest.length > 0;
  const [showAll, setShowAll] = useState(false);

  return (
    <section className="bg-surface-high rounded-3xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">
          {label}
        </h3>
        {addButton}
      </div>

      {skills.length === 0 && (
        <p className="text-sm text-on-surface-variant">Скилы ещё не добавлены.</p>
      )}

      {/* Updated skills — always visible */}
      <div className="space-y-5">
        {updated.map((sp, i) => (
          <ProgressBar
            key={sp.skill_id}
            label={sp.skill_name}
            value={sp.points_in_level}
            max={10}
            variant={i % 2 === 0 ? "secondary" : "primary"}
            sublabel={`${sp.points_in_level}/10 · Lv.${sp.level}`}
            delta={deltas[sp.skill_id]}
            isNew={newIds.includes(sp.skill_id)}
          />
        ))}
      </div>

      {/* Rest — collapsible only when there are also updated skills */}
      {rest.length > 0 && (
        <div
          className="grid transition-[grid-template-rows] duration-300 ease-out"
          style={{ gridTemplateRows: !hasToggle || showAll ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden min-h-0">
            {/* Divider between updated and earlier skills */}
            {updated.length > 0 && (
              <div className="flex items-center gap-3 pt-5">
                <span className="h-px flex-1 bg-surface-elevated" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-on-surface-variant">
                  Ранее
                </span>
                <span className="h-px flex-1 bg-surface-elevated" />
              </div>
            )}
            <div className="space-y-5 pt-5">
              {rest.map((sp, i) => (
                <ProgressBar
                  key={sp.skill_id}
                  label={sp.skill_name}
                  value={sp.points_in_level}
                  max={10}
                  variant={i % 2 === 0 ? "secondary" : "primary"}
                  sublabel={`${sp.points_in_level}/10 · Lv.${sp.level}`}
                  delta={deltas[sp.skill_id]}
                  isNew={newIds.includes(sp.skill_id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {hasToggle && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-5 w-full flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant"
        >
          <span className="material-symbols-outlined text-sm">
            {showAll ? "expand_less" : "expand_more"}
          </span>
          {showAll ? "Скрыть" : `Все скиллы (${rest.length})`}
        </button>
      )}
    </section>
  );
}
