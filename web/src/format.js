// Pure formatting. Money is always an integer number of lakhs (₹1 Cr = 100 L).

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** ₹75 L below 100 lakhs, ₹1.25 Cr from 100 up (two decimals kept). */
export function money(lakhs) {
  if (lakhs == null || !Number.isFinite(lakhs)) return '—';
  return Math.round(lakhs) < 100 ? `₹${Math.round(lakhs)} L` : `₹${(lakhs / 100).toFixed(2)} Cr`;
}

/** Same as money() but split so the unit can be styled separately. */
export function moneyParts(lakhs) {
  if (lakhs == null || !Number.isFinite(lakhs)) return { num: '—', unit: '' };
  return Math.round(lakhs) < 100
    ? { num: `₹${Math.round(lakhs)}`, unit: 'L' }
    : { num: `₹${(lakhs / 100).toFixed(2)}`, unit: 'Cr' };
}

/** Lakhs range in one unit when both ends share it: ₹14.50–24.50 Cr. */
export function moneyRange(lo, hi) {
  if (Math.round(lo) === Math.round(hi)) return money(lo);
  const a = moneyParts(lo), b = moneyParts(hi);
  return a.unit === b.unit ? `${a.num}–${b.num.slice(1)} ${a.unit}` : `${money(lo)}–${money(hi)}`;
}

export const int = (n) => (n == null ? '—' : Math.round(n).toLocaleString('en-US'));

export function pct(p) {
  if (p == null || !Number.isFinite(p)) return '—';
  if (p > 0 && p < 0.005) return '<1%';
  if (p < 1 && p >= 0.995) return '>99%';
  return `${Math.round(p * 100)}%`;
}

export function signed(x, digits = 2) {
  if (x == null || !Number.isFinite(x)) return '—';
  const s = Math.abs(x).toFixed(digits);
  if (Number(s) === 0) return `±${s}`;
  return `${x > 0 ? '+' : '−'}${s}`;
}

/** Skill rv is runs added per ball; the UI shows runs per 100 balls, one decimal, signed. */
export const per100 = (rv) => signed(rv == null ? rv : rv * 100, 1);

/** Run numbers are 0-based in the data and 1-based on screen. */
export const runNo = (run) => int(run + 1);

export function ordinal(n) {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
  return `${n}${suffix}`;
}

/** "2025-12-16" -> "16 Dec 2025" (no time-zone shifts). */
export function date(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export const plural = (n, one, many = `${one}s`) => `${int(n)} ${n === 1 ? one : many}`;

const SET_KINDS = { BA: 'batters', AL: 'all-rounders', WK: 'wicketkeepers', FA: 'fast bowlers', SP: 'spinners' };

/** "UFA2" -> { kind: "Uncapped fast bowlers", n: 2 }; null for codes outside the official scheme. */
export function setName(code) {
  const m = /^(U?)(BA|AL|WK|FA|SP)(\d+)$/.exec(String(code));
  return m ? { kind: `${m[1] ? 'Uncapped' : 'Capped'} ${SET_KINDS[m[2]]}`, n: Number(m[3]) } : null;
}

/** Overseas fee cap: the team pays the full price, the player keeps at most `cap`, the BCCI gets the rest. */
export function feeSplit(player, price, cap) {
  if (!player?.overseas || !cap || price == null || price <= cap) return null;
  return { keeps: cap, bcci: price - cap };
}

/** "Left-arm orthodox" -> "LA orth": short labels for the six bowler types. */
export function shortBowlerType(label) {
  return label
    .replace(/^Right-arm/i, 'RA')
    .replace(/^Left-arm/i, 'LA')
    .replace(/orthodox/i, 'orth')
    .replace(/wrist-spin/i, 'wrist');
}
