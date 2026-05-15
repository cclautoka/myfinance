import { type InputHTMLAttributes, useEffect, useState } from 'react';

type OmitValueProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'defaultValue' | 'onChange'
>;

function parseAmountInput(raw: string, opts?: { min?: number; max?: number }): number {
  const t = raw.trim().replace(/,/g, '');
  if (t === '' || t === '.' || t === '-' || t === '-.') return 0;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n)) return 0;
  let x = Math.round(n * 100) / 100;
  if (opts?.min !== undefined) x = Math.max(opts.min, x);
  if (opts?.max !== undefined) x = Math.min(opts.max, x);
  return x;
}

function blurredAmountDraft(v: number, hideZeroWhenBlurred: boolean): string {
  if (!Number.isFinite(v)) return '';
  if (hideZeroWhenBlurred && v === 0) return '';
  return String(v);
}

export type NumericAmountInputProps = OmitValueProps & {
  value: number;
  onValueChange: (n: number) => void;
  /** When blurred, render empty instead of “0” (fields where zero is rarely meaningful). */
  hideZeroWhenBlurred?: boolean;
  /**
   * `blur` (default): parent updates when the field loses focus — best for Household-style saved state.
   * `live`: parent updates on each change so submit/add buttons see the digits before blur.
   */
  commit?: 'blur' | 'live';
};

/**
 * Currency-style amount: string draft while typing; commits parsed number on blur (default) or on each change (`live`).
 * Clearing `live` submits 0 to the parent; clearing then blurring in `blur` mode commits 0 on blur.
 */
export function NumericAmountInput({
  value,
  onValueChange,
  hideZeroWhenBlurred = true,
  commit = 'blur',
  className,
  min,
  max,
  onBlur,
  onFocus,
  ...rest
}: NumericAmountInputProps) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() => blurredAmountDraft(value, hideZeroWhenBlurred));

  useEffect(() => {
    if (!focused) setDraft(blurredAmountDraft(value, hideZeroWhenBlurred));
  }, [value, focused, hideZeroWhenBlurred]);

  const minNum = min !== undefined && min !== '' ? Number(min) : undefined;
  const maxNum = max !== undefined && max !== '' ? Number(max) : undefined;
  const live = commit === 'live';

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={className}
      value={focused ? draft : blurredAmountDraft(value, hideZeroWhenBlurred)}
      onFocus={(e) => {
        setFocused(true);
        if (!Number.isFinite(value)) setDraft('');
        else if (hideZeroWhenBlurred && value === 0) setDraft('');
        else setDraft(String(value));
        onFocus?.(e);
      }}
      onChange={(e) => {
        const next = e.target.value.replace(/[^0-9.,-]/g, '');
        setDraft(next);
        if (live)
          onValueChange(parseAmountInput(next, { min: minNum, max: maxNum }));
      }}
      onBlur={(e) => {
        const n = parseAmountInput(draft, { min: minNum, max: maxNum });
        onValueChange(n);
        setFocused(false);
        onBlur?.(e);
      }}
    />
  );
}

function integerDraftFromValue(v: number, hideZeroWhenBlurred: boolean): string {
  if (!Number.isFinite(v)) return '';
  if (hideZeroWhenBlurred && v === 0) return '';
  return String(Math.trunc(v));
}

export type NumericIntegerInputProps = OmitValueProps & {
  value: number;
  onValueChange: (n: number) => void;
  min?: number;
  max?: number;
  hideZeroWhenBlurred?: boolean;
  /** If true, blur on an empty field leaves the persisted value untouched (shows last value again). */
  emptyBlurRestoresCurrent?: boolean;
};

/** Monthly bill due-day (optional); empty means app default (e.g. 15th). */
export function OptionalMonthDayInput({
  value,
  onValueChange,
  className,
  placeholder = '15',
  title,
  onFocus,
  onBlur,
  ...rest
}: OmitValueProps & {
  value: number | undefined;
  onValueChange: (n: number | undefined) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() => (value != null ? String(value) : ''));

  useEffect(() => {
    if (!focused) setDraft(value != null ? String(value) : '');
  }, [value, focused]);

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      title={title}
      placeholder={placeholder}
      className={className}
      value={focused ? draft : value != null ? String(value) : ''}
      onFocus={(e) => {
        setFocused(true);
        setDraft(value != null ? String(value) : '');
        onFocus?.(e);
      }}
      onChange={(e) => {
        const next = e.target.value.replace(/\D/g, '');
        setDraft(next);
      }}
      onBlur={(e) => {
        const t = draft.replace(/\D/g, '');
        if (t === '') onValueChange(undefined);
        else {
          const n = Number.parseInt(t, 10);
          if (!Number.isFinite(n)) onValueChange(undefined);
          else onValueChange(Math.min(31, Math.max(1, n)));
        }
        setFocused(false);
        onBlur?.(e);
      }}
    />
  );
}

function parseIntegerDraft(
  raw: string,
  min?: number,
  max?: number,
): number | null {
  const t = raw.replace(/\D/g, '');
  if (t === '') return null;
  let n = Number.parseInt(t, 10);
  if (!Number.isFinite(n)) return null;
  if (min !== undefined) n = Math.max(min, n);
  if (max !== undefined) n = Math.min(max, n);
  return n;
}

/**
 * Whole numbers only; optional restore on blur when empty (e.g. required due-day).
 */
export function NumericIntegerInput({
  value,
  onValueChange,
  min,
  max,
  hideZeroWhenBlurred = false,
  emptyBlurRestoresCurrent = false,
  className,
  onBlur,
  onFocus,
  ...rest
}: NumericIntegerInputProps) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() => integerDraftFromValue(value, hideZeroWhenBlurred));

  useEffect(() => {
    if (!focused) setDraft(integerDraftFromValue(value, hideZeroWhenBlurred));
  }, [value, focused, hideZeroWhenBlurred]);

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={className}
      value={focused ? draft : integerDraftFromValue(value, hideZeroWhenBlurred)}
      onFocus={(e) => {
        setFocused(true);
        if (!Number.isFinite(value)) setDraft('');
        else if (hideZeroWhenBlurred && value === 0) setDraft('');
        else setDraft(String(Math.trunc(value)));
        onFocus?.(e);
      }}
      onChange={(e) => {
        const next = e.target.value.replace(/\D/g, '');
        setDraft(next);
      }}
      onBlur={(e) => {
        const parsed = parseIntegerDraft(draft, min, max);
        if (parsed === null) {
          if (emptyBlurRestoresCurrent) {
            setFocused(false);
            setDraft(integerDraftFromValue(value, hideZeroWhenBlurred));
            onBlur?.(e);
            return;
          }
          onValueChange(0);
          setFocused(false);
          onBlur?.(e);
          return;
        }
        onValueChange(parsed);
        setFocused(false);
        onBlur?.(e);
      }}
    />
  );
}
