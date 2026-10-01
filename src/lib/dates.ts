// ISO dates (YYYY-MM-DD) are parsed as local midnight, never UTC, so a day
// never shifts by one in time zones ahead of UTC (such as IST).

const parse = (iso: string) => new Date(iso + 'T00:00:00');

/** "28 Sep" (short) or "28 Sep 2026". */
export function fmtDate(iso: string, short = false): string {
  return parse(iso).toLocaleDateString(
    'en-GB',
    short ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' },
  );
}

export function addDays(iso: string, n: number): string {
  const d = parse(iso);
  d.setDate(d.getDate() + n);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join(
    '-',
  );
}

/** Whole days from `b` to `a`. */
export function dayDiff(a: string, b: string): number {
  return Math.round((parse(a).getTime() - parse(b).getTime()) / 864e5);
}

export function rangeLabel(from: string, to: string): string {
  return `${fmtDate(from, true)} – ${fmtDate(to)}`;
}

/** Today's local date. */
export function today(): string {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join(
    '-',
  );
}
