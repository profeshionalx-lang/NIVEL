interface PageSkeletonProps {
  /** Number of placeholder rows/cards in the main area. */
  rows?: number;
  /** Render a tall hero block above the rows (used for dashboard-like pages). */
  hero?: boolean;
  /** Constrain main width to the mobile container. Defaults to true. */
  narrow?: boolean;
}

function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-surface-elevated ${className}`} />;
}

export default function PageSkeleton({
  rows = 4,
  hero = false,
  narrow = true,
}: PageSkeletonProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass-nav flex items-center justify-between px-6 h-16">
        <div className="h-6 w-6 animate-pulse rounded-md bg-surface-elevated" />
        <div className="h-5 w-28 animate-pulse rounded-md bg-surface-elevated" />
        <div className="h-6 w-6 animate-pulse rounded-md bg-surface-elevated" />
      </header>

      <main
        className={`px-5 pt-6 pb-36 ${narrow ? "max-w-[430px]" : "max-w-4xl"} mx-auto space-y-4`}
      >
        {hero && <Block className="h-40 w-full" />}
        {Array.from({ length: rows }).map((_, i) => (
          <Block key={i} className="h-24 w-full" />
        ))}
      </main>
    </div>
  );
}
