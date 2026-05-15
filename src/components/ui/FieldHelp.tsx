import { useId, useState } from 'react';

export function FieldHelp({ label, children }: { label: string; children: React.ReactNode }) {
  const base = useId();
  const [open, setOpen] = useState(false);
  const panelId = `${base}-help`;

  return (
    <span className="relative inline-flex items-center align-middle">
      <button
        type="button"
        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[10px] font-black text-slate-600 hover:bg-slate-100 dark:border-moss-border dark:text-moss-subtle dark:hover:bg-moss-elevated"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        aria-label={`Help: ${label}`}
      >
        ?
      </button>
      {open ? (
        <span
          id={panelId}
          role="tooltip"
          className="absolute left-1/2 top-full z-20 mt-1 w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-700 shadow-lg dark:border-moss-border dark:bg-moss-surface dark:text-moss-fg"
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}
