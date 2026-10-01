import { addDays } from './dates';

export interface Preset {
  key: string;
  label: string;
  from: string;
  to: string;
}

const monthName = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { month: 'long' });
// Three letters ("Sep"), whatever the ICU build's en-GB abbreviation ("Sept").
const monthShort = (iso: string) => monthName(iso).slice(0, 3);

/** Period presets counting back from `ref`. Against the sample data
 * (ref 30 Sep 2026) these are the design's: Last 7 days, September,
 * Aug – Sep, Last 90 days. */
export function presets(ref: string): Preset[] {
  const monthStart = ref.slice(0, 8) + '01';
  const prevMonthStart = addDays(monthStart, -1).slice(0, 8) + '01';
  return [
    { key: '7', label: 'Last 7 days', from: addDays(ref, -6), to: ref },
    { key: 'month', label: monthName(ref), from: monthStart, to: ref },
    { key: '2m', label: `${monthShort(prevMonthStart)} – ${monthShort(ref)}`, from: prevMonthStart, to: ref },
    { key: '90', label: 'Last 90 days', from: addDays(ref, -89), to: ref },
  ];
}

/** This month so far, or the last 7 days when the month is younger than that. */
export function defaultPreset(ref: string): Preset {
  const all = presets(ref);
  return Number(ref.slice(8)) >= 7 ? all[1] : all[0];
}
