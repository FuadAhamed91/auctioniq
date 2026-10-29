// Team colours: approximations of the franchises' public colours, used for identification only
// (no logos, no affiliation). Identity only — state always stays in the semantic colours
// (teal = gate open / need, brass = bidding, red = sold), never in a team colour alone.

/** [primary, secondary] per team code. */
export const TEAM_COLORS = {
  CSK: ['#F9CD05', '#F15C19'],
  DC: ['#2561AE', '#D71921'],
  GT: ['#1B2133', '#DBBE6E'],
  KKR: ['#3A225D', '#F2C028'],
  LSG: ['#0057E2', '#F28B00'],
  MI: ['#005FA2', '#F79433'],
  PBKS: ['#ED1D24', '#A7A9AC'],
  RCB: ['#EC1C24', '#252829'],
  RR: ['#EA1A85', '#254AA5'],
  SRH: ['#F26522', '#1D1D1B'],
};

const NEUTRAL = ['#8A93A1', '#D6D9DF'];
export const teamColors = (code) => TEAM_COLORS[code] || NEUTRAL;

/** Inline custom properties (--t1 primary, --t2 secondary) for CSS stripes, bars and dots. */
export const teamVars = (code) => {
  const [a, b] = teamColors(code);
  return `--t1:${a};--t2:${b}`;
};

/** The two-colour dot shown next to a team code. */
export const teamDot = (code) => `<i class="tdot" style="${teamVars(code)}" aria-hidden="true"></i>`;
