"use client";

import { useState } from "react";
import { submitStudentInsight, submitTrainerNotes } from "@/lib/actions/sessions";
import { useRouter } from "next/navigation";

interface InsightFormProps {
  sessionId: string;
  type: "student" | "trainer";
  placeholder: string;
}

export default function InsightForm({
  sessionId,
  type,
  placeholder,
}: InsightFormProps) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);

    const result =
      type === "student"
        ? await submitStudentInsight(sessionId, text.trim())
        : await submitTrainerNotes(sessionId, text.trim());

    if (result.success) {
      router.refresh();
    } else {
      alert(result.error || "Ошибка");
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-surface-card rounded-2xl p-4 space-y-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
        {type === "student" ? "Твой инсайт" : "Заметки тренера"}
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full bg-surface-elevated rounded-xl p-3 text-sm text-on-surface placeholder-on-surface-variant/50 resize-none border border-border/40 focus:border-primary focus:outline-none transition-colors"
      />
      <button
        onClick={handleSubmit}
        disabled={!text.trim() || submitting}
        className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
          text.trim()
            ? "kinetic-gradient text-on-primary active:scale-[0.98]"
            : "bg-surface-elevated text-on-surface-variant opacity-50 cursor-not-allowed"
        }`}
      >
        {submitting ? "Отправляем..." : "Отправить"}
      </button>
    </div>
  );
}
