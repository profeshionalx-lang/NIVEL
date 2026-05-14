"use client";

import { useRouter } from "next/navigation";

interface Props {
  fallbackHref: string;
  className?: string;
  ariaLabel?: string;
}

export default function BackButton({
  fallbackHref,
  className = "text-on-surface-variant",
  ariaLabel = "Назад",
}: Props) {
  const router = useRouter();

  function handleClick() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button type="button" onClick={handleClick} aria-label={ariaLabel} className={className}>
      <span className="material-symbols-outlined">arrow_back</span>
    </button>
  );
}
