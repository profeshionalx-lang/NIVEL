import Link from "next/link";
import type { InsightCardWithRelations } from "@/lib/types";

interface Props {
  cards: InsightCardWithRelations[];
  totalCount: number;
}

export default function VaultPreview({ cards, totalCount }: Props) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            Insight vault
          </p>
          <h2 className="text-lg font-black text-on-surface">
            {totalCount} {totalCount === 1 ? "card" : "cards"}
          </h2>
        </div>
        <Link
          href="/insights"
          className="text-xs font-bold uppercase tracking-wider text-primary"
        >
          Open vault →
        </Link>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-2xl bg-surface-card p-4 text-sm text-on-surface-variant">
          Your vault is empty. Take insights from sessions to fill it.
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-1">
          {cards.map((card) => (
            <Link
              key={card.id}
              href="/insights"
              className="shrink-0 w-44 rounded-2xl bg-surface-card border border-border-dim p-3 flex flex-col gap-2"
            >
              {card.category && (
                <span className="text-[10px] uppercase tracking-widest text-secondary font-bold">
                  {card.category.name}
                </span>
              )}
              <p className="text-xs font-bold text-on-surface leading-snug line-clamp-4">
                {card.student_edited_text || card.front_text}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
