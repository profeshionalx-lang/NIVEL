"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { createGoal } from "@/lib/actions/goals";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ProblemCategory {
  id: number;
  name: string;
  sort_order: number;
}

interface Problem {
  id: number;
  category_id: number;
  name: string;
}

const SESSION_OPTIONS = [4, 6, 8, 10, 12];

export default function NewGoalPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<ProblemCategory[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedProblems, setSelectedProblems] = useState<number[]>([]);
  const [sessionCount, setSessionCount] = useState<number>(8);
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchProblems() {
      const supabase = createClient();
      const [catRes, probRes] = await Promise.all([
        supabase.from("problem_categories").select("*").order("sort_order"),
        supabase.from("problems").select("*").order("sort_order"),
      ]);
      if (catRes.data) setCategories(catRes.data);
      if (probRes.data) setProblems(probRes.data);
      setLoading(false);
    }
    fetchProblems();
  }, []);

  const toggleProblem = (id: number) => {
    setSelectedProblems((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const result = await createGoal(selectedProblems, sessionCount);
    if (result.success) {
      router.push("/dashboard");
    } else {
      setSubmitting(false);
      alert(result.error || "Ошибка при создании цели");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-nav flex justify-between items-center px-6 h-16">
        <span className="text-lg font-black text-primary uppercase italic tracking-tight">
          Nivel
        </span>
        <Link href="/dashboard" className="text-on-surface-variant">
          <span className="material-symbols-outlined">close</span>
        </Link>
      </header>

      <main className="px-6 pt-6 pb-36">
        {/* Progress */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <div
              className={`h-1.5 flex-1 rounded-full ${
                step >= 1 ? "bg-primary glow-primary" : "bg-surface-elevated"
              }`}
            />
            <div
              className={`h-1.5 flex-1 rounded-full ${
                step >= 2 ? "bg-primary glow-primary" : "bg-surface-elevated"
              }`}
            />
          </div>
          <p className="text-secondary font-black text-[10px] tracking-[0.2em] uppercase mb-2">
            Шаг {step} / 2
          </p>
          <h1 className="text-3xl font-black italic uppercase leading-tight tracking-tighter">
            {step === 1 ? (
              <>
                Выбери{" "}
                <span className="kinetic-text">проблемы.</span>
              </>
            ) : (
              <>
                Сколько{" "}
                <span className="kinetic-text">занятий?</span>
              </>
            )}
          </h1>
        </div>

        {step === 1 && (
          <>
            {/* Selection counter */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-on-surface-variant text-sm">
                Выбрано: <span className="text-primary font-bold">{selectedProblems.length}</span> / 3
              </p>
              {selectedProblems.length >= 3 && (
                <span className="text-primary text-xs font-bold">Максимум</span>
              )}
            </div>

            {/* Categories accordion */}
            <div className="space-y-3">
              {categories.map((category) => {
                const catProblems = problems.filter(
                  (p) => p.category_id === category.id
                );
                const isExpanded = expandedCategory === category.id;
                const selectedInCategory = catProblems.filter((p) =>
                  selectedProblems.includes(p.id)
                ).length;

                return (
                  <div
                    key={category.id}
                    className="bg-surface-card rounded-2xl overflow-hidden"
                  >
                    <button
                      onClick={() =>
                        setExpandedCategory(isExpanded ? null : category.id)
                      }
                      className="w-full flex items-center justify-between p-4"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-on-surface">
                          {category.name}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-elevated text-on-surface-variant">
                          {catProblems.length}
                        </span>
                        {selectedInCategory > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/20 text-primary">
                            {selectedInCategory} выбрано
                          </span>
                        )}
                      </div>
                      <span
                        className={`material-symbols-outlined text-on-surface-variant transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      >
                        expand_more
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-2">
                        {catProblems.map((problem) => {
                          const isSelected = selectedProblems.includes(
                            problem.id
                          );
                          const isDisabled =
                            !isSelected && selectedProblems.length >= 3;

                          return (
                            <button
                              key={problem.id}
                              onClick={() =>
                                !isDisabled && toggleProblem(problem.id)
                              }
                              className={`w-full text-left flex items-start gap-3 p-3 rounded-xl transition-all ${
                                isSelected
                                  ? "bg-primary/10 border border-primary/30"
                                  : isDisabled
                                  ? "opacity-40"
                                  : "bg-surface-elevated hover:bg-surface-high"
                              }`}
                            >
                              <div
                                className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                  isSelected
                                    ? "bg-primary"
                                    : "border border-border"
                                }`}
                              >
                                {isSelected && (
                                  <span className="material-symbols-outlined text-on-primary text-sm">
                                    check
                                  </span>
                                )}
                              </div>
                              <span
                                className={`text-sm leading-snug ${
                                  isSelected
                                    ? "text-primary-text font-medium"
                                    : "text-on-surface-variant"
                                }`}
                              >
                                {problem.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Next button */}
            <div className="mt-8">
              <button
                onClick={() => setStep(2)}
                disabled={selectedProblems.length === 0}
                className={`w-full py-4 rounded-2xl font-black text-lg transition-all ${
                  selectedProblems.length > 0
                    ? "kinetic-gradient text-on-primary active:scale-[0.98]"
                    : "bg-surface-elevated text-on-surface-variant opacity-50 cursor-not-allowed"
                }`}
                style={
                  selectedProblems.length > 0
                    ? {
                        boxShadow:
                          "0 10px 30px rgba(202,253,0,0.25), 0 4px 12px rgba(0,0,0,0.4)",
                      }
                    : undefined
                }
              >
                Далее
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            {/* Selected problems summary */}
            <div className="mb-8">
              <p className="text-on-surface-variant text-[10px] uppercase tracking-[0.2em] font-black mb-3">
                Выбранные проблемы
              </p>
              <div className="space-y-2">
                {selectedProblems.map((id) => {
                  const problem = problems.find((p) => p.id === id);
                  return (
                    <div
                      key={id}
                      className="bg-surface-card rounded-xl px-4 py-3 text-sm text-on-surface"
                    >
                      {problem?.name}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Session count */}
            <div className="mb-8">
              <p className="text-on-surface-variant text-[10px] uppercase tracking-[0.2em] font-black mb-4">
                Количество занятий
              </p>
              <div className="grid grid-cols-5 gap-3">
                {SESSION_OPTIONS.map((count) => (
                  <button
                    key={count}
                    onClick={() => setSessionCount(count)}
                    className={`py-4 rounded-xl text-center font-black text-lg transition-all ${
                      sessionCount === count
                        ? "bg-primary text-on-primary"
                        : "bg-surface-card text-on-surface-variant border border-border/40 hover:border-primary"
                    }`}
                    style={
                      sessionCount === count
                        ? { boxShadow: "0 4px 14px rgba(202,253,0,0.3)" }
                        : undefined
                    }
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3 mt-8">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-4 rounded-2xl font-black text-lg kinetic-gradient text-on-primary active:scale-[0.98] transition-transform disabled:opacity-50"
                style={{
                  boxShadow:
                    "0 10px 30px rgba(202,253,0,0.25), 0 4px 12px rgba(0,0,0,0.4)",
                }}
              >
                {submitting ? "Создаём..." : "Создать цель"}
              </button>
              <button
                onClick={() => setStep(1)}
                className="w-full py-3 rounded-xl text-on-surface-variant font-semibold text-sm"
              >
                Назад
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
