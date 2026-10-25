import type { GhostKind } from './contract';

// Number and label formatting. Copy rule: hyphen-minus only, never en or em dashes.

const NF = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const NF1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 12480 -> "12,480". */
export function fmt(n: number): string {
  return NF.format(Math.round(n));
}

/** Non-breaking space, so "34 m" never wraps between number and unit. */
export const NBSP = ' ';

export function metres(n: number): string {
  return fmt(n) + NBSP + 'm';
}

export function ordinal(n: number): string {
  const t = n % 100;
  if (t >= 11 && t <= 13) return n + 'th';
  const o = n % 10;
  return n + (o === 1 ? 'st' : o === 2 ? 'nd' : o === 3 ? 'rd' : 'th');
}

export function seconds(s: number): string {
  return NF1.format(s) + NBSP + 's';
}

const PF = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 0 });

/** 12 -> "12%" (takes whole percent points). */
export function percent(points: number): string {
  return PF.format(points / 100);
}

// The player's own locale for dates; the key is a UTC day, so it formats in UTC.
const DF = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "2026-10-24" -> "Oct 24" (in the player's locale). Anything unparseable passes through. */
export function dailyDate(key: string): string {
  const t = Date.parse(key + 'T00:00:00Z');
  return Number.isNaN(t) ? key : DF.format(t);
}

/** CSS class carrying the ghost colour role: mint (pool, friend, daily), rose (grudge), gold-white (you). */
export function kindCls(kind: GhostKind): string {
  return kind === 'grudge' ? 'k-grudge' : kind === 'you' ? 'k-you' : 'k-ghost';
}
