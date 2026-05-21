"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { addSkillToStudent, createAndAddSkill } from "@/lib/actions/skills";

interface Props {
  studentId: string;
  allSkills: { id: number; name: string }[];
  existingSkills: { skill_id: number; points: number }[];
}

export default function InlineSkillAdder({ studentId, allSkills, existingSkills }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"library" | "new">("library");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [points, setPoints] = useState(1);
  const [nameRu, setNameRu] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const existingMap = new Map(existingSkills.map((s) => [s.skill_id, s.points]));

  const filtered = allSkills.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  function handleClose() {
    setOpen(false);
    setMode("library");
    setSearch("");
    setSelectedId(null);
    setPoints(1);
    setNameRu("");
    setNameEn("");
    setError(null);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      let result;
      if (mode === "new") {
        result = await createAndAddSkill(studentId, nameRu, nameEn, points);
      } else {
        if (!selectedId) { setError("Выбери скил"); return; }
        result = await addSkillToStudent(studentId, selectedId, points);
      }
      if ("error" in result) {
        setError(result.error);
      } else {
        router.refresh();
        handleClose();
      }
    });
  }

  const existingPointsForSelected = selectedId ? existingMap.get(selectedId) : undefined;
  const canSave = mode === "new" ? nameRu.trim().length > 0 : selectedId !== null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-on-surface-variant"
      >
        <span className="material-symbols-outlined text-sm">add</span>
        скил
      </button>
    );
  }

  const content = (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end justify-center"
      onClick={handleClose}
    >
      <div
        className="bg-surface-card rounded-t-3xl w-full max-w-[430px] mx-auto p-6 pb-10 space-y-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black tracking-tight">Добавить скил</h3>
          <button
            onClick={handleClose}
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-surface-elevated text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setMode("library")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold min-h-[44px] transition-colors ${
              mode === "library"
                ? "kinetic-gradient text-on-primary"
                : "bg-surface-elevated text-on-surface-variant"
            }`}
          >
            Из библиотеки
          </button>
          <button
            onClick={() => setMode("new")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold min-h-[44px] transition-colors ${
              mode === "new"
                ? "kinetic-gradient text-on-primary"
                : "bg-surface-elevated text-on-surface-variant"
            }`}
          >
            Новый скил
          </button>
        </div>

        {mode === "library" ? (
          <>
            <input
              type="text"
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-elevated rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant outline-none min-h-[44px]"
            />
            <div className="space-y-2">
              {filtered.map((skill) => {
                const existingPts = existingMap.get(skill.id);
                const selected = selectedId === skill.id;
                return (
                  <button
                    key={skill.id}
                    onClick={() => setSelectedId(skill.id)}
                    className={`w-full flex items-center gap-3 rounded-2xl p-4 text-left min-h-[56px] transition-colors ${
                      selected
                        ? "bg-primary/15 border border-primary/40"
                        : "bg-surface-elevated active:bg-surface-card"
                    }`}
                  >
                    <span className="font-bold text-sm text-on-surface flex-1">{skill.name}</span>
                    {existingPts !== undefined && (
                      <span className="text-[11px] text-on-surface-variant shrink-0">
                        {existingPts} pts
                      </span>
                    )}
                    {selected && (
                      <span className="material-symbols-outlined text-primary text-base shrink-0 fill-icon">
                        check_circle
                      </span>
                    )}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="text-sm text-on-surface-variant text-center py-4">Ничего не найдено</p>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Название (рус) *"
              value={nameRu}
              onChange={(e) => setNameRu(e.target.value)}
              maxLength={40}
              className="w-full bg-surface-elevated rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant outline-none min-h-[44px]"
            />
            <input
              type="text"
              placeholder="Name (eng) — необязательно"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              maxLength={40}
              className="w-full bg-surface-elevated rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant outline-none min-h-[44px]"
            />
          </div>
        )}

        {/* Points stepper */}
        <div className="flex items-center gap-3 bg-surface-elevated rounded-2xl px-4 py-3">
          <div className="flex-1">
            <p className="text-xs font-black uppercase tracking-widest text-on-surface-variant">
              Баллов
            </p>
            {existingPointsForSelected !== undefined && (
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                +{points} к существующим {existingPointsForSelected}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPoints((p) => Math.max(1, p - 1))}
              className="w-11 h-11 rounded-xl bg-surface-card text-on-surface flex items-center justify-center active:opacity-70"
            >
              <span className="material-symbols-outlined text-base">remove</span>
            </button>
            <span className="text-xl font-black w-6 text-center tabular-nums">{points}</span>
            <button
              onClick={() => setPoints((p) => Math.min(10, p + 1))}
              className="w-11 h-11 rounded-xl bg-surface-card text-on-surface flex items-center justify-center active:opacity-70"
            >
              <span className="material-symbols-outlined text-base">add</span>
            </button>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 rounded-xl p-3">{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={isPending || !canSave}
          className="w-full py-4 rounded-2xl kinetic-gradient text-on-primary font-black text-sm min-h-[44px] disabled:opacity-40 transition-opacity"
        >
          {isPending ? "Сохранение..." : "Добавить скил"}
        </button>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
