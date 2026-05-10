/** Currency with cents — keeps payroll-style amounts honest (492.76, etc.). */
export const formatMoney = (n: number, currency = 'USD'): string =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

export const formatMoneyDetailed = formatMoney;

export const formatPct = (n: number): string =>
  `${Math.round(n * 10) / 10}%`;

export const formatShortDate = (d: Date): string =>
  d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** Like `formatShortDate`, but includes the year when it differs from `ref` so backlog dates are not read as “this year”. */
export const formatTimelineDateLabel = (d: Date, ref = new Date()): string => {
  const y = d.getFullYear();
  const ry = ref.getFullYear();
  const base = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return y !== ry ? `${base} ${y}` : base;
};

export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));
