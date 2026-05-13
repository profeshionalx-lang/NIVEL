"use client";

import { useState } from "react";
import { AiInsightCard } from "./AiInsightCard";
import { EditAiCardModal } from "./EditAiCardModal";
import type { InsightCard } from "@/lib/types";

interface Props {
  cards: InsightCard[];
  isTrainer: boolean;
}

export function DraftCardsList({ cards, isTrainer }: Props) {
  const [editingCard, setEditingCard] = useState<InsightCard | null>(null);

  return (
    <>
      {cards.map((c) => (
        <AiInsightCard
          key={c.id}
          card={c}
          isTrainer={isTrainer}
          onEdit={setEditingCard}
        />
      ))}

      {editingCard && (
        <EditAiCardModal
          card={editingCard}
          onClose={() => setEditingCard(null)}
        />
      )}
    </>
  );
}
