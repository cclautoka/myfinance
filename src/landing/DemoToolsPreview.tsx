export function DemoToolsPreview() {
  return (
    <div className="space-y-4 p-3 text-sm">
      <section className="space-y-2">
        <h3 className="font-display text-base font-bold text-slate-900 dark:text-moss-fg">Household &amp; sync</h3>
        <p className="text-xs leading-relaxed text-slate-600 dark:text-moss-subtle">
          Notification emails, server sign-in, magic links, partner invites, pairing codes, and API keys — same panel as
          the app&apos;s Tools tab.
        </p>
        <ul className="space-y-2 text-slate-700 dark:text-moss-subtle">
          <li className="rounded-lg border border-teal-200/70 bg-teal-50/50 px-3 py-2 dark:border-teal-900/40 dark:bg-teal-950/25">
            Notify relay · test email · recipient list
          </li>
          <li className="rounded-lg border border-slate-200/80 bg-white/90 px-3 py-2 dark:border-moss-border dark:bg-moss-surface/80">
            Household sign-in · reload from server
          </li>
        </ul>
      </section>

      <section className="rounded-xl border border-red-300/60 bg-red-50/40 p-3 dark:border-red-900/45 dark:bg-red-950/25">
        <h3 className="font-display text-sm font-bold text-red-900 dark:text-red-200">Danger zone</h3>
        <p className="mt-1 text-xs text-slate-700 dark:text-moss-subtle">
          Replay guided tour · reset worksheet · export CSV from Past months first.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-lg border border-slate-300/90 bg-white px-2 py-1 text-[10px] font-bold text-slate-800 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg">
            Replay tour
          </span>
          <span className="rounded-lg border border-slate-300/90 bg-white px-2 py-1 text-[10px] font-bold text-slate-800 dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg">
            Reset worksheet
          </span>
        </div>
      </section>
    </div>
  );
}
