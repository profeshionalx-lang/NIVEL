"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createSession } from "@/lib/actions/sessions";
import Link from "next/link";

interface ExerciseRow {
  name: string;
  skillNames: string[];
  currentSkillInput: string;
}

export default function NewSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <NewSessionContent />
    </Suspense>
  );
}

function NewSessionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const goalId = searchParams.get("goalId") || "";
  const studentId = searchParams.get("studentId") || "";

  const [exercises, setExercises] = useState<ExerciseRow[]>([
    { name: "", skillNames: [], currentSkillInput: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);

  // Autocomplete suggestions
  const [exerciseSuggestions, setExerciseSuggestions] = useState<string[]>([]);
  const [skillSuggestions, setSkillSuggestions] = useState<string[]>([]);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState<number | null>(
    null
  );
  const [activeSkillIndex, setActiveSkillIndex] = useState<number | null>(null);

  const supabase = createClient();

  const searchExercises = async (query: string) => {
    if (query.length < 2) {
      setExerciseSuggestions([]);
      return;
    }
    const { data } = await supabase
      .from("exercises")
      .select("name")
      .ilike("name", `%${query}%`)
      .limit(5);
    setExerciseSuggestions((data || []).map((e) => e.name));
  };

  const searchSkills = async (query: string) => {
    if (query.length < 2) {
      setSkillSuggestions([]);
      return;
    }
    const { data } = await supabase
      .from("skills")
      .select("name")
      .ilike("name", `%${query}%`)
      .limit(5);
    setSkillSuggestions((data || []).map((s) => s.name));
  };

  const updateExercise = (index: number, updates: Partial<ExerciseRow>) => {
    setExercises((prev) =>
      prev.map((e, i) => (i === index ? { ...e, ...updates } : e))
    );
  };

  const addExercise = () => {
    setExercises((prev) => [
      ...prev,
      { name: "", skillNames: [], currentSkillInput: "" },
    ]);
  };

  const removeExercise = (index: number) => {
    if (exercises.length <= 1) return;
    setExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const addSkillToExercise = (exerciseIndex: number, skillName: string) => {
    const trimmed = skillName.trim();
    if (!trimmed) return;
    updateExercise(exerciseIndex, {
      skillNames: [
        ...new Set([...exercises[exerciseIndex].skillNames, trimmed]),
      ],
      currentSkillInput: "",
    });
    setSkillSuggestions([]);
  };

  const removeSkillFromExercise = (
    exerciseIndex: number,
    skillName: string
  ) => {
    updateExercise(exerciseIndex, {
      skillNames: exercises[exerciseIndex].skillNames.filter(
        (s) => s !== skillName
      ),
    });
  };

  const canSubmit =
    exercises.every((e) => e.name.trim()) && exercises.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    const exerciseData = exercises.map((e) => ({
      name: e.name.trim(),
      skillNames: e.skillNames,
    }));

    const result = await createSession(goalId, studentId, exerciseData);

    if (result.success) {
      router.push(`/trainer/students/${studentId}`);
    } else {
      alert(result.error || "Ошибка при создании занятия");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass-nav flex items-center justify-between px-6 h-16">
        <Link
          href={`/trainer/students/${studentId}`}
          className="text-on-surface-variant"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <span className="text-lg font-black text-primary uppercase italic tracking-tight">
          Новое занятие
        </span>
        <div className="w-10" />
      </header>

      <main className="px-5 pt-6 pb-36 max-w-lg mx-auto space-y-6">
        <div>
          <p className="text-secondary font-black text-[10px] tracking-[0.2em] uppercase mb-2">
            Упражнения
          </p>
          <p className="text-on-surface-variant text-sm">
            Добавьте упражнения и привяжите к ним скилы
          </p>
        </div>

        {/* Exercise list */}
        <div className="space-y-4">
          {exercises.map((exercise, exIdx) => (
            <div
              key={exIdx}
              className="bg-surface-card rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  Упражнение {exIdx + 1}
                </span>
                {exercises.length > 1 && (
                  <button
                    onClick={() => removeExercise(exIdx)}
                    className="text-error text-xs"
                  >
                    <span className="material-symbols-outlined text-base">
                      delete
                    </span>
                  </button>
                )}
              </div>

              {/* Exercise name */}
              <div className="relative">
                <input
                  type="text"
                  value={exercise.name}
                  onChange={(e) => {
                    updateExercise(exIdx, { name: e.target.value });
                    setActiveExerciseIndex(exIdx);
                    searchExercises(e.target.value);
                  }}
                  onFocus={() => setActiveExerciseIndex(exIdx)}
                  onBlur={() =>
                    setTimeout(() => setActiveExerciseIndex(null), 200)
                  }
                  placeholder="Название упражнения..."
                  className="w-full bg-surface-elevated rounded-xl px-4 py-3 text-sm text-on-surface placeholder-on-surface-variant/50 border border-border/40 focus:border-primary focus:outline-none"
                />
                {activeExerciseIndex === exIdx &&
                  exerciseSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-surface-elevated rounded-xl border border-border overflow-hidden">
                      {exerciseSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          onMouseDown={() => {
                            updateExercise(exIdx, { name: suggestion });
                            setExerciseSuggestions([]);
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm text-on-surface hover:bg-surface-high transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
              </div>

              {/* Skills */}
              <div>
                <p className="text-[10px] font-bold text-on-surface-variant mb-2">
                  Скилы:
                </p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {exercise.skillNames.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg bg-primary/15 text-primary"
                    >
                      {skill}
                      <button
                        onClick={() =>
                          removeSkillFromExercise(exIdx, skill)
                        }
                        className="hover:text-error"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={exercise.currentSkillInput}
                    onChange={(e) => {
                      updateExercise(exIdx, {
                        currentSkillInput: e.target.value,
                      });
                      setActiveSkillIndex(exIdx);
                      searchSkills(e.target.value);
                    }}
                    onFocus={() => setActiveSkillIndex(exIdx)}
                    onBlur={() =>
                      setTimeout(() => setActiveSkillIndex(null), 200)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSkillToExercise(
                          exIdx,
                          exercise.currentSkillInput
                        );
                      }
                    }}
                    placeholder="Добавить скил (Enter)..."
                    className="w-full bg-surface-elevated rounded-lg px-3 py-2 text-xs text-on-surface placeholder-on-surface-variant/50 border border-border/30 focus:border-secondary focus:outline-none"
                  />
                  {activeSkillIndex === exIdx &&
                    skillSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-surface-elevated rounded-xl border border-border overflow-hidden">
                        {skillSuggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            onMouseDown={() =>
                              addSkillToExercise(exIdx, suggestion)
                            }
                            className="w-full text-left px-3 py-2 text-xs text-on-surface hover:bg-surface-high transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add exercise button */}
        <button
          onClick={addExercise}
          className="w-full py-3 rounded-xl border border-dashed border-border text-on-surface-variant text-sm font-semibold hover:border-primary hover:text-primary transition-colors"
        >
          + Добавить упражнение
        </button>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className={`w-full py-4 rounded-2xl font-black text-lg transition-all ${
            canSubmit
              ? "kinetic-gradient text-on-primary active:scale-[0.98]"
              : "bg-surface-elevated text-on-surface-variant opacity-50 cursor-not-allowed"
          }`}
          style={
            canSubmit
              ? {
                  boxShadow:
                    "0 10px 30px rgba(202,253,0,0.25), 0 4px 12px rgba(0,0,0,0.4)",
                }
              : undefined
          }
        >
          {submitting ? "Создаём..." : "Создать занятие"}
        </button>
      </main>
    </div>
  );
}
