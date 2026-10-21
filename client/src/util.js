// Client mirror of server/src/utils/regno.js for instant feedback while typing.
export const STATE_CODES = [
  'AN', 'AP', 'AR', 'AS', 'BR', 'CH', 'CG', 'DD', 'DL', 'DN', 'GA', 'GJ', 'HR', 'HP', 'JK', 'JH', 'KA', 'KL',
  'LA', 'LD', 'MP', 'MH', 'MN', 'ML', 'MZ', 'NL', 'OD', 'OR', 'PY', 'PB', 'RJ', 'SK', 'TN', 'TS', 'TR', 'UP',
  'UK', 'UA', 'WB',
];
const STD = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/;
const BH = /^(\d{2})BH(\d{4})([A-Z]{1,2})$/;

export const cleanRegNo = (s = '') => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);

export function validateRegNo(input) {
  const raw = cleanRegNo(input);
  if (BH.test(raw)) return { ok: true, regNo: raw };
  const m = raw.match(STD);
  if (!m) return { ok: false, error: 'format' };
  if (!STATE_CODES.includes(m[1])) return { ok: false, error: 'state' };
  return { ok: true, regNo: `${m[1]}${m[2].padStart(2, '0')}${m[3]}${m[4].padStart(4, '0')}` };
}

/** Pretty-print while typing: "MH08AB1234" -> "MH 08 AB 1234". */
export function displayRegNo(s = '') {
  const raw = cleanRegNo(s);
  if (/^\d{2}BH/.test(raw)) return raw.replace(/^(\d{2})(BH)(\d{0,4})([A-Z]{0,2})$/, (_, a, b, c, d) => [a, b, c, d].filter(Boolean).join(' '));
  const m = raw.match(/^([A-Z]{0,2})(\d{0,2})([A-Z]{0,3})(\d{0,4})$/);
  if (!m) return raw;
  return [m[1], m[2], m[3], m[4]].filter(Boolean).join(' ');
}

const DAY = 86400000;
export function daysUntil(date) {
  if (!date) return null;
  const d = new Date(date);
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const n = new Date();
  const b = Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
  return Math.round((a - b) / DAY);
}

export function fmtDate(d) {
  if (!d) return '';
  const x = new Date(d);
  return `${String(x.getDate()).padStart(2, '0')}-${String(x.getMonth() + 1).padStart(2, '0')}-${x.getFullYear()}`;
}

export const toInputDate = (d) => {
  if (!d) return '';
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export function insuranceEnd(start) {
  const x = new Date(start);
  x.setFullYear(x.getFullYear() + 1);
  x.setDate(x.getDate() - 1);
  return x;
}

export function pucEnd(start, { fuel = '', norms = '' } = {}) {
  const modern = /BS-?(IV|4|VI|6)|BHARATSTAGE(IV|VI)/.test(norms.toUpperCase().replace(/\s/g, ''));
  const months = modern && !/CNG|LPG/i.test(fuel) ? 12 : 6;
  const x = new Date(start);
  x.setMonth(x.getMonth() + months);
  x.setDate(x.getDate() - 1);
  return x;
}

export function statusOf(days) {
  if (days === null || days === undefined) return 'none';
  if (days < 0) return 'expired';
  if (days <= 7) return 'due7';
  if (days <= 15) return 'due15';
  if (days <= 30) return 'due30';
  return 'active';
}

export const telLink = (p = '') => `tel:${String(p).replace(/[^\d+]/g, '')}`;

export function waLink(phone = '', text = '') {
  let d = String(phone).replace(/\D/g, '');
  if (d.length === 10) d = `91${d}`;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function timeAgo(d, lang = 'en') {
  const rtf = new Intl.RelativeTimeFormat(lang === 'en' ? 'en-IN' : `${lang}-IN`, { numeric: 'auto' });
  const diff = (new Date(d) - Date.now()) / 1000;
  const units = [['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [u, s] of units) if (Math.abs(diff) >= s) return rtf.format(Math.round(diff / s), u);
  return rtf.format(Math.round(diff), 'second');
}

export const VEHICLE_TYPES = ['2W', 'car', 'pickup', 'dumper', 'truck', 'bus', 'tractor', 'jcb', 'auto', 'other'];
export const VEHICLE_DOC_TYPES = ['insurance', 'puc', 'fitness', 'permit', 'road_tax', 'green_tax', 'speed_governor', 'vltd', 'reflective_tape', 'fastag', 'rc'];
export const PERSONAL_DOC_TYPES = ['health', 'life', 'driving_licence'];
