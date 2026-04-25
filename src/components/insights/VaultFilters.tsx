import Link from "next/link";
import type { ProblemCategory } from "@/lib/types";

interface Props {
  categories: ProblemCategory[];
  activeCategoryId?: number;
}

export default function VaultFilters({ categories, activeCategoryId }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
      <Chip href="/insights" active={!activeCategoryId} label="All" />
      {categories.map((c) => (
        <Chip
          key={c.id}
          href={`/insights?category=${c.id}`}
          active={activeCategoryId === c.id}
          label={c.name}
        />
      ))}
    </div>
  );
}

function Chip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
        active ? "chip-active" : "chip-inactive"
      }`}
    >
      {label}
    </Link>
  );
}
