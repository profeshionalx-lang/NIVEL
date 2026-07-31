"use client";

import Image from "next/image";
import { useState } from "react";

interface InsightFramesRowProps {
  /** Signed URL for the "before" frame, or null/undefined if none was attached. */
  beforeUrl?: string | null;
  /** Signed URL for the "after" frame, or null/undefined if none was attached. */
  afterUrl?: string | null;
  /** `next/image` `sizes` hint — tune per call site, defaults suit a ~400px card body. */
  sizes?: string;
  className?: string;
}

const DEFAULT_SIZES = "(min-width: 431px) 200px, 45vw";

/**
 * Shared "before/after" video-frame pair for insight cards (NIVEL#242, part
 * of the video-insights epic #235). No web scrubber — this only displays
 * frames the trainer already picked on the phone (S6, #241).
 *
 * Layout contract (see issue #242 acceptance):
 * - 0 urls → renders nothing at all, so a card with no frames looks exactly
 *   like it did before this feature (no reserved space, no empty box).
 * - 1 url  → the single frame keeps a half-row slot via `grid-cols-2` (the
 *   empty cell is just never filled) rather than stretching full-width, so
 *   it never reads as "this is the whole before/after pair". Still labeled
 *   with which moment it is.
 * - 2 urls → side-by-side, "До"/"После" captions — mandatory, a bare 16:9
 *   crop doesn't say which moment it is on its own.
 *
 * Each slot is a fixed 16:9 (`aspect-video`) box reserved before the image
 * ever loads, so InsightTinder's swipe/flip animation never jumps mid-load.
 * A broken/expired signed URL (Storage TTL is 24h, see
 * src/lib/core/frames.ts) degrades that one frame away via `onError` rather
 * than breaking the card — if both are broken the row disappears entirely,
 * same as the 0-frame case.
 */
export function InsightFramesRow({
  beforeUrl,
  afterUrl,
  sizes = DEFAULT_SIZES,
  className,
}: InsightFramesRowProps) {
  const [beforeBroken, setBeforeBroken] = useState(false);
  const [afterBroken, setAfterBroken] = useState(false);

  const showBefore = !!beforeUrl && !beforeBroken;
  const showAfter = !!afterUrl && !afterBroken;

  if (!showBefore && !showAfter) return null;

  return (
    <div className={`grid grid-cols-2 gap-2 ${className ?? ""}`}>
      {showBefore && (
        <Frame
          label="До"
          url={beforeUrl as string}
          sizes={sizes}
          onBroken={() => setBeforeBroken(true)}
        />
      )}
      {showAfter && (
        <Frame
          label="После"
          url={afterUrl as string}
          sizes={sizes}
          onBroken={() => setAfterBroken(true)}
        />
      )}
    </div>
  );
}

function Frame({
  label,
  url,
  sizes,
  onBroken,
}: {
  label: string;
  url: string;
  sizes: string;
  onBroken: () => void;
}) {
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-black/5">
      <Image
        src={url}
        alt={`Кадр «${label}»`}
        fill
        sizes={sizes}
        className="object-cover"
        onError={onBroken}
      />
      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-black/65 text-white text-[9px] font-black uppercase tracking-wider leading-none pointer-events-none">
        {label}
      </span>
    </div>
  );
}
