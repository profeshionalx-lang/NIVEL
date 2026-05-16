"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { applyTemplateToStudent, getStudentSessions } from "@/lib/actions/insightCards";
import type { StudentSessionOption } from "@/lib/actions/insightCards";

interface Student {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Props {
  templateId: string;
  templateTitle: string | null;
  students: Student[];
  onClose: () => void;
}

export function ApplyCardSheet({ templateId, templateTitle, students, onClose }: Props) {
  const [step, setStep] = useState<"student" | "session">("student");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [sessions, setSessions] = useState<StudentSessionOption[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function selectStudent(student: Student) {
    setSelectedStudent(student);
    setLoadingSessions(true);
    setError(null);
    const result = await getStudentSessions(student.id);
    setSessions(result);
    setLoadingSessions(false);
    setStep("session");
  }

  function applyToSession(sessionId: string) {
    setError(null);
    startTransition(async () => {
      const result = await applyTemplateToStudent(templateId, sessionId);
      if (!result.success) {
        setError(result.error);
      } else {
        setSuccessMsg(`Карточка добавлена в сессию`);
      }
    });
  }

  const content = (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="bg-surface-card rounded-t-3xl w-full max-w-[430px] mx-auto p-6 pb-10 space-y-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black tracking-tight">
            {step === "student" ? "Выбери ученика" : `Выбери сессию — ${selectedStudent?.full_name}`}
          </h3>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-surface-elevated text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {templateTitle && (
          <p className="text-xs text-on-surface-variant bg-surface-elevated rounded-xl px-3 py-2 line-clamp-2">
            {templateTitle}
          </p>
        )}

        {successMsg ? (
          <div className="text-center py-6 space-y-3">
            <span className="material-symbols-outlined text-4xl text-primary">check_circle</span>
            <p className="font-bold text-on-surface">{successMsg}</p>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl kinetic-gradient text-on-primary font-bold text-sm min-h-[44px]"
            >
              Готово
            </button>
          </div>
        ) : step === "student" ? (
          <div className="space-y-2">
            {students.map((s) => (
              <button
                key={s.id}
                onClick={() => selectStudent(s)}
                className="w-full flex items-center gap-3 rounded-2xl bg-surface-elevated p-4 text-left min-h-[56px] active:bg-surface-card"
              >
                <span className="material-symbols-outlined text-on-surface-variant">person</span>
                <span className="font-bold text-sm text-on-surface">{s.full_name ?? "—"}</span>
                <span className="material-symbols-outlined text-on-surface-variant ml-auto text-base">
                  chevron_right
                </span>
              </button>
            ))}
          </div>
        ) : loadingSessions ? (
          <div className="py-8 flex justify-center">
            <span className="material-symbols-outlined text-on-surface-variant animate-spin">
              progress_activity
            </span>
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-on-surface-variant text-center py-6">
            У ученика нет сессий
          </p>
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => setStep("student")}
              className="flex items-center gap-1 text-xs text-secondary font-bold"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Другой ученик
            </button>
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => applyToSession(s.id)}
                disabled={isPending}
                className="w-full flex items-center gap-3 rounded-2xl bg-surface-elevated p-4 text-left min-h-[56px] active:bg-surface-card disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-on-surface-variant text-sm">
                  fitness_center
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-on-surface">
                    Сессия {s.session_number}
                    {s.trainer_notes ? ` — ${s.trainer_notes}` : ""}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {new Date(s.scheduled_at ?? s.created_at).toLocaleDateString("ru-RU", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                {isPending ? (
                  <span className="material-symbols-outlined text-on-surface-variant text-sm animate-spin">
                    progress_activity
                  </span>
                ) : (
                  <span className="material-symbols-outlined text-primary text-sm">add_circle</span>
                )}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 rounded-xl p-3">{error}</p>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
