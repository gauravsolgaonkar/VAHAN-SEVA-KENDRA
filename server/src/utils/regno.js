// Indian vehicle registration number helpers.
export const STATE_CODES = [
  'AN', 'AP', 'AR', 'AS', 'BR', 'CH', 'CG', 'DD', 'DL', 'DN', 'GA', 'GJ', 'HR', 'HP', 'JK', 'JH', 'KA', 'KL',
  'LA', 'LD', 'MP', 'MH', 'MN', 'ML', 'MZ', 'NL', 'OD', 'OR', 'PY', 'PB', 'RJ', 'SK', 'TN', 'TS', 'TR', 'UP',
  'UK', 'UA', 'WB',
];

const STD = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/;
const BH = /^(\d{2})BH(\d{4})([A-Z]{1,2})$/;

/** Strip spaces/dashes and uppercase. */
export function cleanRegNo(input = '') {
  return String(input).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Normalise to canonical form, e.g. "mh 8 ab 1234" -> "MH08AB1234".
 * Returns { ok, regNo, error }.
 */
export function normalizeRegNo(input) {
  const raw = cleanRegNo(input);
  if (!raw) return { ok: false, error: 'empty' };
  const bh = raw.match(BH);
  if (bh) return { ok: true, regNo: raw, series: 'BH' };
  const m = raw.match(STD);
  if (!m) return { ok: false, error: 'format' };
  const [, state, rto, series, num] = m;
  if (!STATE_CODES.includes(state)) return { ok: false, error: 'state' };
  if (Number(rto) === 0 || Number(num) === 0) return { ok: false, error: 'format' };
  return { ok: true, regNo: `${state}${rto.padStart(2, '0')}${series}${num.padStart(4, '0')}`, state };
}

/** "MH08AB1234" -> "MH 08 AB 1234" */
export function displayRegNo(regNo = '') {
  const m = regNo.match(STD);
  if (!m) return regNo;
  return [m[1], m[2], m[3], m[4]].filter(Boolean).join(' ');
}
