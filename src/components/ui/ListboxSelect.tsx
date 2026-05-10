import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

type ListboxSelectCommonProps = {
  value: string;
  options: { value: string; label: string }[];
  onChange: (next: string) => void;
  /** Extra Tailwind/classes for trigger (density, width, etc.). */
  buttonClassName?: string;
  /** Use when inside `overflow-*` traps (e.g. horizontal scroll tables): menu is `fixed` below the trigger. */
  popoverFixed?: boolean;
  /** When true, any scroll (capture) closes the menu. Default false so table scroll does not kill the panel. */
  closeOnScroll?: boolean;
  disabled?: boolean;
};

export type ListboxSelectProps = ListboxSelectCommonProps &
  (
    | { label: string; ariaLabel?: string }
    | { label?: undefined; ariaLabel: string }
  );

export function ListboxSelect({
  label,
  ariaLabel,
  value,
  options,
  onChange,
  buttonClassName = '',
  popoverFixed = false,
  closeOnScroll = false,
  disabled,
}: ListboxSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listUid = useId();

  const listboxName = ariaLabel ?? label ?? 'Choose option';

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const [highlight, setHighlight] = useState(selectedIndex);
  const [fixStyle, setFixStyle] = useState({ top: 0, left: 0, width: 176 });

  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => listRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !popoverFixed || !triggerRef.current) return;
    const measure = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = Math.round(Math.max(r.width, 176));
      let top = Math.round(r.bottom + 6);
      const left = Math.round(r.left);
      const listH = listRef.current?.offsetHeight ?? 220;
      const pad = 8;
      if (top + listH > window.innerHeight - pad && r.top > listH + pad) {
        top = Math.round(r.top - listH - 6);
      }
      setFixStyle({ top: Math.max(pad, top), left, width });
    };
    measure();
    const t = window.requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(t);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, popoverFixed, options.length]);

  useEffect(() => {
    if (!open || !closeOnScroll) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [open, closeOnScroll]);

  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (popoverFixed && listRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onDocPointer);
    return () => document.removeEventListener('pointerdown', onDocPointer);
  }, [open, popoverFixed]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const pick = useCallback(
    (v: string) => {
      onChange(v);
      setOpen(false);
      triggerRef.current?.focus();
    },
    [onChange],
  );

  const activeLabel = options[selectedIndex]?.label ?? options[0]?.label ?? '—';

  const openMenu = useCallback(() => {
    setHighlight(selectedIndex);
    setOpen(true);
  }, [selectedIndex]);

  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || options.length === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) openMenu();
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (!open) {
        e.preventDefault();
        openMenu();
      }
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(options[highlight]?.value ?? value);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  /** min-w-0 so grid columns can shrink; width comes from container (use min-w-* on buttonClassName if needed). */
  const baseTrigger =
    'flex min-w-0 w-full items-center justify-between gap-2 rounded-xl border border-sage-300 bg-white px-3 py-2 text-left text-sm font-normal text-sage-900 shadow-sm outline-none transition-colors hover:border-sage-400 focus-visible:ring-2 focus-visible:ring-moss-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-moss-border dark:bg-moss-bg dark:text-moss-fg dark:hover:border-moss-muted dark:focus-visible:ring-offset-moss-bg';

  const triggerButton = (
    <button
      ref={triggerRef}
      type="button"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={`${listUid}-list`}
      aria-label={label ? undefined : ariaLabel}
      disabled={disabled || options.length === 0}
      className={`${baseTrigger} disabled:cursor-not-allowed disabled:opacity-50 ${buttonClassName}`}
      onClick={() => {
        if (disabled || options.length === 0) return;
        setOpen((prev) => {
          const next = !prev;
          if (next) setHighlight(selectedIndex);
          return next;
        });
      }}
      onKeyDown={onTriggerKeyDown}
    >
      <span className="truncate">{activeLabel}</span>
      <ChevronDown
        className={`shrink-0 text-sage-500 transition-transform dark:text-moss-muted ${open ? 'rotate-180' : ''}`}
      />
    </button>
  );

  const listbox =
    open && options.length > 0 ? (
      <ul
        ref={listRef}
        id={`${listUid}-list`}
        role="listbox"
        aria-label={listboxName}
        tabIndex={0}
        aria-activedescendant={`${listUid}-opt-${highlight}`}
        onKeyDown={onListKeyDown}
        style={
          popoverFixed
            ? {
                position: 'fixed',
                top: fixStyle.top,
                left: fixStyle.left,
                width: fixStyle.width,
                zIndex: 10000,
              }
            : undefined
        }
        className={`max-h-60 overflow-auto rounded-xl border border-sage-200 bg-white py-1 shadow-lg outline-none ring-1 ring-black/5 dark:border-moss-border dark:bg-moss-elevated dark:ring-white/10 ${
          popoverFixed ? '' : 'absolute right-0 top-[calc(100%+6px)] z-[100] min-w-full'
        }`}
      >
        {options.map((o, i) => (
          <li key={o.value} role="presentation" className="px-1">
            <button
              id={`${listUid}-opt-${i}`}
              type="button"
              role="option"
              aria-selected={o.value === value}
              className={`flex w-full rounded-lg px-3 py-2 text-left text-sm outline-none transition-colors focus-visible:bg-sage-100 dark:focus-visible:bg-moss-surface ${
                i === highlight ? 'bg-sage-100/90 dark:bg-moss-surface/90' : ''
              } ${
                o.value === value
                  ? 'font-semibold text-sage-900 dark:text-moss-fg'
                  : 'font-normal text-sage-800 hover:bg-sage-50 dark:text-moss-subtle dark:hover:bg-moss-bg'
              }`}
              onClick={() => pick(o.value)}
              onMouseEnter={() => setHighlight(i)}
            >
              {o.label}
            </button>
          </li>
        ))}
      </ul>
    ) : null;

  const portaledList =
    popoverFixed && listbox && typeof document !== 'undefined'
      ? createPortal(listbox, document.body)
      : null;

  return (
    <div ref={rootRef} className="relative min-w-0 w-full">
      {label ? (
        <label className="flex w-full flex-col gap-1 text-sm font-medium text-sage-900 dark:text-moss-fg">
          {label}
          {triggerButton}
        </label>
      ) : (
        triggerButton
      )}
      {popoverFixed ? portaledList : listbox}
    </div>
  );
}
