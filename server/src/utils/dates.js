const DAY = 24 * 60 * 60 * 1000;
const IST_OFFSET_MIN = 330;

/** Midnight of the given instant's calendar day in IST, as a UTC Date. */
export function istDayStart(d = new Date()) {
  const shifted = new Date(new Date(d).getTime() + IST_OFFSET_MIN * 60000);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - IST_OFFSET_MIN * 60000);
}

/** Whole days from today (IST) until `date`; negative when past. */
export function daysUntil(date, now = new Date()) {
  if (!date) return null;
  return Math.round((istDayStart(date) - istDayStart(now)) / DAY);
}

export function addDays(d, n) {
  return new Date(new Date(d).getTime() + n * DAY);
}

export function addMonths(d, n) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

/** Insurance: start + 1 year - 1 day. */
export function insuranceEnd(start) {
  const x = new Date(start);
  x.setFullYear(x.getFullYear() + 1);
  return addDays(x, -1);
}

/**
 * PUC validity: BS-IV / BS-VI vehicles get 12 months, CNG/LPG and older norms 6 months.
 * Always editable in the UI; this is just the default.
 */
export function pucEnd(start, { fuel = '', norms = '' } = {}) {
  const f = fuel.toUpperCase();
  const n = norms.toUpperCase().replace(/\s/g, '');
  const modern = /BS-?(IV|4|VI|6)|BHARATSTAGE(IV|VI)/.test(n);
  const months = modern && !/CNG|LPG/.test(f) ? 12 : 6;
  return addDays(addMonths(start, months), -1);
}

/** Parse provider dates: "2025-03-14", "14-Mar-2025", "14/03/2025". */
export function parseLooseDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  const MON = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
  m = s.toUpperCase().match(/^(\d{1,2})-([A-Z]{3})-(\d{4})$/);
  if (m && m[2] in MON) return new Date(Date.UTC(+m[3], MON[m[2]], +m[1]));
  m = s.match(/^(\d{1,2})\/(\d{4})$/); // MM/YYYY manufacturing date
  if (m) return new Date(Date.UTC(+m[2], +m[1] - 1, 1));
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
