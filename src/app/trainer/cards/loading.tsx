export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass-nav flex items-center justify-between px-6 h-16">
        <div className="w-10" />
        <div className="h-5 w-32 rounded-lg bg-surface-card animate-pulse" />
        <div className="w-10" />
      </header>
      <main className="px-5 pt-6 pb-36 max-w-[430px] mx-auto md:max-w-none md:px-8 space-y-4">
        <div className="h-10 rounded-2xl bg-surface-card animate-pulse" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-20 rounded-full bg-surface-card animate-pulse" />
          ))}
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-surface-card animate-pulse" />
        ))}
      </main>
    </div>
  );
}
