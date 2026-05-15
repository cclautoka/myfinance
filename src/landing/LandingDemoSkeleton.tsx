export function LandingDemoSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col animate-pulse" aria-hidden>
      <div className="mb-3 shrink-0 space-y-2">
        <div className="h-3 w-24 rounded bg-slate-200/90 dark:bg-moss-border" />
        <div className="h-8 w-4/5 max-w-md rounded bg-slate-200/90 dark:bg-moss-border" />
        <div className="h-4 w-full max-w-2xl rounded bg-slate-100 dark:bg-moss-elevated" />
      </div>
      <div className="mb-4 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-8 flex-1 rounded-lg bg-slate-200/80 dark:bg-moss-border" />
        ))}
      </div>
      <div className="min-h-[280px] flex-1 rounded-2xl border border-slate-200/80 bg-white/60 dark:border-moss-border dark:bg-moss-surface/50 md:min-h-[360px]" />
    </div>
  );
}
