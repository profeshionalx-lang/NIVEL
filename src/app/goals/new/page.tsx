"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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

interface SearchResult {
  id: number;
  name: string;
  category_name: string;
}

export default function NewGoalPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedProblem, setSelectedProblem] = useState<SearchResult | null>(
    null
  );
  const [categories, setCategories] = useState<ProblemCategory[]>([]);
  const [allProblems, setAllProblems] = useState<Problem[]>([]);
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function fetchProblems() {
      const supabase = createClient();
      const [catRes, probRes] = await Promise.all([
        supabase.from("problem_categories").select("*").order("sort_order"),
        supabase.from("problems").select("*").order("sort_order"),
      ]);
      if (catRes.data) setCategories(catRes.data);
      if (probRes.data) setAllProblems(probRes.data);
      setLoading(false);
    }
    fetchProblems();
  }, []);

  const searchProblems = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("search_problems", {
      query_text: query,
    });

    if (!error && data) {
      setSearchResults(data as SearchResult[]);
    } else {
      setSearchResults([]);
    }
    setIsSearching(false);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setSelectedProblem(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchProblems(value), 300);
  };

  const handleSelect = (problem: SearchResult) => {
    setSelectedProblem(problem);
    setSearchQuery(problem.name);
    setSearchResults([]);
  };

  const handleSelectFromList = (problem: Problem) => {
    const category = categories.find((c) => c.id === problem.category_id);
    setSelectedProblem({
      id: problem.id,
      name: problem.name,
      category_name: category?.name || "",
    });
    setSearchQuery(problem.name);
    setSearchResults([]);
  };

  const handleSubmit = async () => {
    const text = searchQuery.trim();
    if (!text && !selectedProblem) return;

    setSubmitting(true);
    const result = await createGoal(
      selectedProblem?.id ?? null,
      text || null
    );
    if (result.success) {
      router.push("/dashboard");
    } else {
      setSubmitting(false);
      alert(result.error || "Ошибка при создании цели");
    }
  };

  const canSubmit = searchQuery.trim().length > 0 || selectedProblem;

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
        <div className="mb-8">
          <h1 className="text-3xl font-black italic uppercase leading-tight tracking-tighter">
            Найди свою{" "}
            <span className="kinetic-text">проблему.</span>
          </h1>
        </div>

        {/* Search input — always visible */}
        <div className="mb-4">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Опиши проблему..."
              autoFocus
              className="w-full bg-surface-card rounded-2xl pl-12 pr-4 py-4 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none border border-border/40 focus:border-primary/50 transition-colors"
            />
            {isSearching && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Search results */}
        {searchResults.length > 0 && (
          <div className="space-y-2 mb-6">
            {searchResults.map((problem) => (
              <button
                key={problem.id}
                onClick={() => handleSelect(problem)}
                className={`w-full text-left rounded-xl px-4 py-3 transition-colors ${
                  selectedProblem?.id === problem.id
                    ? "bg-primary/10 border border-primary/30"
                    : "bg-surface-card hover:bg-surface-high active:bg-surface-elevated"
                }`}
              >
                <p className="text-sm font-semibold text-on-surface">
                  {problem.name}
                </p>
                <p className="text-[10px] font-bold text-on-surface-variant mt-0.5">
                  {problem.category_name}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Submit button */}
        <div className="mb-10">
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
            {submitting ? "Создаём..." : "Создать цель"}
          </button>
        </div>

        {/* All problems list */}
        <div>
          <p className="text-on-surface-variant text-[10px] uppercase tracking-[0.2em] font-black mb-4">
            Все проблемы
          </p>
          <div className="space-y-3">
            {categories.map((category) => {
              const catProblems = allProblems.filter(
                (p) => p.category_id === category.id
              );
              const isExpanded = expandedCategory === category.id;

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
                        const isSelected = selectedProblem?.id === problem.id;

                        return (
                          <button
                            key={problem.id}
                            onClick={() => handleSelectFromList(problem)}
                            className={`w-full text-left p-3 rounded-xl transition-all ${
                              isSelected
                                ? "bg-primary/10 border border-primary/30"
                                : "bg-surface-elevated hover:bg-surface-high"
                            }`}
                          >
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
        </div>
      </main>
    </div>
  );
}
