"use client";

import { useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { createGoal } from "@/lib/actions/goals";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchProblems = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      setHasSearched(false);
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
    setHasSearched(true);
    setIsSearching(false);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchProblems(value), 300);
  };

  const handleSelect = (problem: SearchResult) => {
    setSelectedProblem(problem);
    setSearchQuery("");
    setSearchResults([]);
    setHasSearched(false);
  };

  const handleDeselect = () => {
    setSelectedProblem(null);
  };

  const handleSubmit = async () => {
    if (!selectedProblem) return;
    setSubmitting(true);
    const result = await createGoal(selectedProblem.id);
    if (result.success) {
      router.push("/dashboard");
    } else {
      setSubmitting(false);
      alert(result.error || "Ошибка при создании цели");
    }
  };

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

        {/* Selected problem */}
        {selectedProblem && (
          <div className="mb-6">
            <div className="bg-primary/10 border border-primary/30 rounded-2xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-primary-text">
                  {selectedProblem.name}
                </p>
                <p className="text-[10px] font-bold text-on-surface-variant mt-0.5">
                  {selectedProblem.category_name}
                </p>
              </div>
              <button
                onClick={handleDeselect}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-lg">
                  close
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Search input */}
        {!selectedProblem && (
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

            {/* Hint */}
            {searchQuery.length > 0 && searchQuery.length < 3 && (
              <p className="text-on-surface-variant text-xs mt-2 px-1">
                Введи минимум 3 символа для поиска
              </p>
            )}
          </div>
        )}

        {/* Search results */}
        {!selectedProblem && searchResults.length > 0 && (
          <div className="space-y-2">
            {searchResults.map((problem) => (
              <button
                key={problem.id}
                onClick={() => handleSelect(problem)}
                className="w-full text-left bg-surface-card rounded-xl px-4 py-3 hover:bg-surface-high active:bg-surface-elevated transition-colors"
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

        {/* No results */}
        {!selectedProblem &&
          hasSearched &&
          !isSearching &&
          searchResults.length === 0 &&
          searchQuery.length >= 3 && (
            <p className="text-on-surface-variant text-sm text-center py-8">
              Ничего не найдено. Попробуй другие слова.
            </p>
          )}

        {/* Submit button */}
        <div className="mt-8">
          <button
            onClick={handleSubmit}
            disabled={!selectedProblem || submitting}
            className={`w-full py-4 rounded-2xl font-black text-lg transition-all ${
              selectedProblem
                ? "kinetic-gradient text-on-primary active:scale-[0.98]"
                : "bg-surface-elevated text-on-surface-variant opacity-50 cursor-not-allowed"
            }`}
            style={
              selectedProblem
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
      </main>
    </div>
  );
}
