/** Fixed en-US + narrow $ so phones never show "USD" / "US$" from device locale. */
const moneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Currency with cents — always `$1,234.56` (symbol only, not a currency code). */
export const formatMoney = (n: number): string =>
  moneyFormatter.format(Number.isFinite(n) ? n : 0);

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
