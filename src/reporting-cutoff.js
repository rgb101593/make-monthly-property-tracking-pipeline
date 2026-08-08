import { monthIndex } from './month-mode.js';

export const MID_MONTH_DAY = 15;

export function cutoffMonth({ year, month, day }) {
  const monthsBack = day >= MID_MONTH_DAY ? 1 : 2;
  const index = year * 12 + (month - 1) - monthsBack;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function resolveEffectiveMonth({ businessDate, availableMonths }) {
  const limit = monthIndex(cutoffMonth(businessDate));
  const eligible = availableMonths.filter((m) => monthIndex(m) <= limit);

  if (eligible.length === 0) {
    throw new RangeError('no reportable month at or before the cutoff');
  }

  return eligible.reduce((latest, m) => (monthIndex(m) > monthIndex(latest) ? m : latest));
}
