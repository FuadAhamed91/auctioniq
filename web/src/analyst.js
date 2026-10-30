// The analysts: deterministic sentences, cricket first and then the auction, built from the exported
// decisions (no AI and no formulas; rupee amounts only as judgement). teamAnalyst() speaks for one table on
// the current lot, priceAnalyst() explains the hammer price (or why nobody bid) once the lot is over.
import { money, int, pct, ordinal, plural } from './format.js';

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const words = (n) => WORDS[Math.round(n)] ?? int(n);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const an = (w) => (/^[aeiou]/i.test(w) ? 'an' : 'a');
/** 'an 85th', 'an 11th', 'a 52nd': the article as the number is spoken. */
const anNum = (n) => (/^8/.test(String(n)) || n === 11 || n === 18 ? 'an' : 'a');
const surname = (name) => String(name).trim().split(/\s+/).pop();
const MIN_BALLS = 60;
const rated = (s) => s && s.pct != null && s.balls >= MIN_BALLS;

/** A rupee judgement, rounded the way a scout would say it: "about ₹19.50 Cr". */
function about(lakhs) {
  const step = lakhs >= 1000 ? 50 : lakhs >= 300 ? 25 : lakhs >= 100 ? 10 : 5;
  return money(Math.max(step, Math.round(lakhs / step) * step));
}

/** 0.33 -> "a third"; otherwise a whole percentage. */
function share(x) {
  for (const [v, w] of [[0.25, 'a quarter'], [1 / 3, 'a third'], [0.5, 'half'], [2 / 3, 'two-thirds'], [0.75, 'three-quarters']]) {
    if (Math.abs(x - v) <= 0.03) return w;
  }
  return `${Math.round(x * 100)}%`;
}

function roleWords(ctx, key) {
  if (!key || key === 'wk' || key === 'keeper') return { one: 'keeper', many: 'keepers' };
  const one = String(ctx.roleLabel(key) || key).toLowerCase();
  return { one, many: /s$/.test(one) ? one : `${one}s` };
}
const count = (n, r) => `${words(n)} ${Math.round(n) === 1 ? r.one : r.many}`;
/** "two pace all-rounders and a part-timer", "a part-time pace all-rounder", "no pace all-rounder". */
function squadCount(have, r) {
  const full = Math.floor(have + 1e-9), part = have - full >= 0.25;
  if (!full) return part ? `a part-time ${r.one}` : `no ${r.one}`;
  return `${words(full)} ${full === 1 ? r.one : r.many}${part ? ' and a part-timer' : ''}`;
}
const usual = (u) => words(Math.max(1, Math.round(u)));

/** The role he would fill for a team: its stated reason first, then his main role. */
function roleFor(ctx, p, d) {
  if (d?.why?.role) return d.why.role;
  const m = /^([^:·]+?)(?::|\s+gap)/.exec(d?.gate?.find(([k]) => k === 'need')?.[2] || '');
  const key = m && (/keeper/i.test(m[1]) ? 'wk' : ctx.meta.roles.find((r) => r.label.toLowerCase() === m[1].trim().toLowerCase())?.key);
  return key || p.role;
}

// ---- the cricket ----

/** Why the team wants him: the gap in its squad. */
function gapLine(ctx, p, d, before) {
  const w = d.why, r = roleWords(ctx, roleFor(ctx, p, d));
  if (w) {
    switch (w.kind) {
      case 'depth': {
        if (w.usual == null) return `They are short of ${r.many}.`;
        const have = w.have ?? 0;
        if (have < 1 && have >= 0.25 && w.best) return `${w.best} is their only ${r.one}, and only part-time; most squads carry ${usual(w.usual)}.`;
        return `They have ${squadCount(have, r)}; most squads carry ${usual(w.usual)}.`;
      }
      case 'upgrade': return w.best ? `${w.best} is their best ${r.one} now; ${surname(p.name)} would ${w.better === false ? 'add cover' : 'be an upgrade'}.` : `${surname(p.name)} would be an upgrade at ${r.one}.`;
      case 'keeper': return w.keepers ? `Only ${count(w.keepers, { one: 'keeper', many: 'keepers' })} on the books.` : 'No keeper on the books.';
      case 'weakness': return `Their ${r.many} are a weak spot in the line-up, and he would shore it up.`;
      case 'fill': return `${cap(words(before?.slots ?? 0))} ${before?.slots === 1 ? 'place' : 'places'} still to fill, so a sound player at a fair price will do.`;
      default: break;
    }
  }
  const need = d.gate?.find(([k]) => k === 'need')?.[2] || '';
  if (/upgrade/i.test(need)) return `${surname(p.name)} would be an upgrade at ${r.one}.`;
  if (/keeper/i.test(need)) return 'They need another keeper.';
  if (/filling/i.test(need)) return 'They are filling the last places in the squad, so a sound player at a fair price will do.';
  return `They are short of ${r.many}.`;
}

/** What he brings, from the numbers a scout would quote for his role. */
function strengthLine(ctx, p, roleKey) {
  const bat = p.skills?.bat, bowl = p.skills?.bowl;
  if (!bat && !bowl) return 'No ball-by-ball record, so teams go on reputation.';
  const sr = rated(bat) ? bat.sr.toFixed(0) : null;
  const econ = rated(bowl) ? bowl.econ.toFixed(1) : null;
  const lap = p.tags?.includes('lap') ? ', and left-arm pace adds variety' : '';
  const fast = p.tags?.includes('fast_start') ? ', and he starts fast' : '';
  const peers = (s) => (s.pct >= 99 ? 'the best among his peers' : `${ordinal(s.pct)} percentile among his peers`);
  switch (roleKey) {
    case 'death_pacer':
      if (!econ) break;
      return bowl.death != null ? `${cap(share(bowl.death))} of his overs come at the death, at ${econ} an over${lap}.` : `He bowls at ${econ} an over, ${peers(bowl)}${lap}.`;
    case 'pp_pacer':
      if (!econ) break;
      return bowl.pp != null ? `${cap(share(bowl.pp))} of his overs come in the powerplay, at ${econ} an over${lap}.` : `He bowls at ${econ} an over, ${peers(bowl)}${lap}.`;
    case 'pp_opener':
      if (!sr) break;
      return bat.pp != null ? `He faces ${share(bat.pp)} of his balls in the powerplay and strikes at ${sr}${fast}.` : `He opens at a strike rate of ${sr}, ${peers(bat)}${fast}.`;
    case 'finisher':
      if (!sr) break;
      return bat.death != null ? `He strikes at ${sr}, with ${share(bat.death)} of his balls at the death.` : `He finishes at a strike rate of ${sr}, ${peers(bat)}.`;
    case 'anchor':
      if (!sr) break;
      return `${bat.pct >= 99 ? 'A top-percentile' : `${cap(anNum(bat.pct))} ${ordinal(bat.pct)}-percentile`} batter who holds an innings together, striking at ${sr}${fast}.`;
    case 'wrist_spin':
    case 'finger_spin':
      if (!econ) break;
      return `He goes at ${econ} an over, ${peers(bowl)}.`;
    case 'pace_ar':
    case 'spin_ar':
      if (sr && econ) return `He bats at a strike rate of ${sr} and bowls at ${econ} an over${lap}.`;
      break;
    case 'wk':
      if (sr) return `He keeps wicket and bats at a strike rate of ${sr}.`;
      break;
    default:
      break;
  }
  if (sr) return `He bats at a strike rate of ${sr}, ${peers(bat)}${fast}.`;
  if (econ) return `He bowls at ${econ} an over, ${peers(bowl)}${lap}.`;
  const balls = (bat?.balls || 0) + (bowl?.balls || 0);
  return `Little top-level evidence on him (${plural(balls, 'ball')}), so teams go partly on reputation.`;
}

// ---- the auction ----

function moneyLine(p, before, f) {
  if (!before) return null;
  const head = `${money(before.purse)} for ${plural(before.slots, 'place')}${p.overseas ? ` and ${plural(before.os, 'overseas slot')}` : ''}`;
  if (f?.pressure > 1.1) return `${head}: they can push.`;
  if (f?.pressure < 0.9) return `Money's tight: ${head}.`;
  return null;
}

function marketLine(ctx, market, roleKey) {
  if (!market) return null;
  const r = roleWords(ctx, roleKey), { alike, short } = market;
  if (alike === 0) return `No other ${r.one} like him is left, with ${words(short)} ${short === 1 ? 'team' : 'teams'} short of one.`;
  if (alike <= 2 || alike < short) return `Only ${count(alike, { one: `similar ${r.one}`, many: `similar ${r.many}` })} left and ${words(short)} ${short === 1 ? 'team' : 'teams'} short of one: no time to wait.`;
  if (alike >= 6 && alike >= 2 * short) return `Plenty more ${r.many} to come, so no need to overpay.`;
  return null;
}

const styleLine = (f) => (f?.style > 1.05 ? "They've paid above the market before." : f?.style < 0.95 ? 'They rarely overpay.' : null);

/** The main reason a team let him go: tight money, a modest gap or plenty of alternatives. */
function letGoReason(d, market) {
  if (d.f?.pressure < 0.95) return ', with money tight';
  if (market && market.alike >= 5) return ', with plenty of alternatives still to come';
  if (d.why?.kind === 'fill' || (d.f && d.f.need < 1.05)) return '; the gap was not big enough';
  return '';
}

/** What the team did on this lot, as far as the replay has got. */
function outcomeLine(state, ti, d) {
  const mine = state.ladder.filter((x) => x.team === ti);
  const lastBid = mine.filter((x) => x.type === 'bid').pop();
  const drop = mine.find((x) => x.type === 'drop');
  const start = state.app?.start ?? state.player.base;
  if (state.result?.type === 'sold' && state.result.team === ti) {
    const price = money(state.result.price);
    if (d.walk == null) return `Got him at ${price}.`;
    return about(d.walk) === price || d.walk <= state.result.price ? `Got him at ${price}, about as far as they'd go.` : `Got him at ${price}, inside the ${about(d.walk)} they'd go to.`;
  }
  if (drop) {
    if (d.walk != null && d.walk < start) {
      const rated = about(d.walk) === money(start) || d.walk >= start - 5 ? 'just under' : `at about ${about(d.walk)}, under`;
      return `They rated him ${rated} his ${money(start)} base, so they passed.`;
    }
    if (d.cap != null && d.walk === d.cap) return `Had to stop at ${money(drop.price)} to keep money for the rest of the squad.`;
    const worth = d.walk == null || about(d.walk) === money(drop.price) ? ', about their limit' : `; he wasn't worth more than about ${about(d.walk)} to them`;
    return `${lastBid ? 'They let him go' : 'They never raised the paddle and let him go'} at ${money(drop.price)}${worth}${letGoReason(d, state.app?.market)}.`;
  }
  if (state.status[ti]?.state === 'leading') return `They hold the bid at ${money(state.price)}${d.walk != null ? ` and would go to about ${about(d.walk)}` : ''}.`;
  if (!state.result && d.walk != null) return d.walk < start ? `They rate him at about ${about(d.walk)}, under his base: expect them to pass.` : `They would go to about ${about(d.walk)}.`;
  return null;
}

/** A closed gate, said plainly. */
function closedLine(ctx, p, d) {
  const gate = Object.fromEntries((d.gate || []).map(([k, ok]) => [k, ok]));
  if (gate.need === false) {
    const w = d.why, r = roleWords(ctx, roleFor(ctx, p, d));
    if (w?.have != null && w.have >= 1) return `Already well stocked: ${squadCount(w.have, r)}${w.best ? `, led by ${w.best}` : ''}.`;
    return `No real gap for ${an(r.one)} ${r.one}.`;
  }
  if (gate.slot === false) return 'Their squad is full.';
  if (gate.overseas === false) return 'No overseas slot left.';
  if (gate.purse === false) return "They can't cover his base and still fill the squad.";
  return 'Not in the market for him.';
}

// ---- franchise habits (background only: they did not pick mini-auction buyers better than chance) ----

const SPIN = new Set(['wrist_spin', 'finger_spin', 'spin_ar']);
const PACE = new Set(['pp_pacer', 'death_pacer', 'pace_ar']);
const ALLROUND = new Set(['pace_ar', 'spin_ar']);
/** Per habit key: how to say it either way, which players fit it, and the history it points to. */
const HABITS = {
  vet: { more: 'More veterans', fewer: 'Fewer veterans', what: 'of their buys were 30 or older', fits: (p) => p.age >= 30, record: 'they have leaned on players aged 30 and over' },
  youth: { more: 'More young Indian talent', fewer: 'Less young Indian talent', what: 'were uncapped Indians aged 23 or under', fits: (p) => p.age <= 23 && !p.capped && !p.overseas, record: 'they have often backed young uncapped Indians' },
  overseas: { more: 'More overseas buys', fewer: 'Fewer overseas buys', what: 'of their buys were overseas players', fits: (p) => p.overseas, record: 'they have bought more overseas players than most' },
  capped: { more: 'More capped players', fewer: 'Fewer capped players', what: 'of their buys were capped internationals', fits: (p) => p.capped, record: 'they have favoured capped internationals' },
  spin: { more: 'More spinners', fewer: 'Fewer spinners', what: 'of their buys were spin bowlers', fits: (p) => SPIN.has(p.role), record: 'they have bought more spinners than most' },
  pace: { more: 'More pace bowlers', fewer: 'Fewer pace bowlers', what: 'of their buys were pace bowlers', fits: (p) => PACE.has(p.role), record: 'they have bought more pace bowlers than most' },
  allround: { more: 'More all-rounders', fewer: 'Fewer all-rounders', what: 'of their buys were all-rounders', fits: (p) => ALLROUND.has(p.role), record: 'they have bought more all-rounders than most' },
  keeper: { more: 'More keepers', fewer: 'Fewer keepers', what: 'of their buys were wicketkeepers', fits: (p) => p.tags?.includes('wk'), record: 'they have bought more keepers than most' },
  former: { more: 'More reunions', fewer: 'Fewer reunions', what: 'of their buys were their own former players, bought back', fits: (p, code) => p.prev?.team === code, record: 'they have often brought back their own former players' },
  star: { more: 'More stars', fewer: 'Fewer stars', what: "of their buys were among the auction's top 10% of prices" },
};
const STAR_GAP = 0.08; // the money-on-stars line shows only when it is this far from the league

/** "How CSK usually build": the head line, one line per clear habit, and the money-on-stars line. */
export function habitLines(team) {
  const h = team?.habits;
  if (!h) return null;
  const age = Number.isInteger(h.medianAge) ? int(h.medianAge) : h.medianAge?.toFixed(1);
  const items = (h.items || []).filter((it) => HABITS[it.key]).map((it) => {
    const w = HABITS[it.key];
    return `${it.share > it.league ? w.more : w.fewer}: ${pct(it.share)} ${w.what} (league ${pct(it.league)})`;
  });
  const [mine, league] = h.starSpend || [];
  const star = mine != null && league != null && Math.abs(mine - league) >= STAR_GAP
    ? `${pct(mine)} of their auction money went on top-priced buys (league ${pct(league)})` : null;
  return {
    head: `Since ${h.since}: ${plural(h.buys, 'buy')}, median age ${age}.`,
    items: items.length ? items : [`No buying habit stands out from the league since ${h.since}.`],
    star,
  };
}

/** One sentence of history when the player fits a habit the team has leaned towards (never the reason to bid). */
function habitLine(team, p) {
  const fit = (team?.habits?.items || []).find((it) => it.share > it.league && HABITS[it.key]?.fits?.(p, team.code));
  return fit ? `It fits their record: ${HABITS[fit.key].record}.` : null;
}

/** Lines for a run without a logged decision: the team's pre-auction needs and what happened. */
function fallbackLines(ctx, state, ti) {
  const T = ctx.meta.teams[ti];
  const needs = (T.needs || []).slice(0, 2).map((n) => roleWords(ctx, n.role)).map((r) => `${an(r.one)} ${r.one}`);
  const lines = needs.length ? [`Before the auction they were short of ${needs.join(' and ')}.`] : [];
  const habit = habitLine(T, state.player);
  if (habit) lines.push(habit);
  const r = state.result;
  if (r?.type === 'sold') lines.push(r.team === ti ? `They bought him for ${money(r.price)}.` : 'Not their buy in this run.');
  lines.push('Full reasons are recorded for the featured runs.');
  return lines;
}

/** "CSK's analyst" on the current lot: 2–5 short sentences, or null before a lot is loaded. */
export function teamAnalyst(ctx, state, ti) {
  const p = state.player, code = ctx.codes[ti];
  if (!p || state.phase === 'loading') return null;
  const title = `${code}'s analyst`;
  if (state.phase === 'never') return { title, lines: ['Never called in any of the runs, so nobody had to decide on him.'] };
  if (state.phase === 'notcalled') return { title, lines: ['Not called in this run: no team nominated him.'] };
  const d = state.app?.teams?.[code];
  if (!d) return { title, lines: fallbackLines(ctx, state, ti) };
  const role = roleFor(ctx, p, d);
  const habit = habitLine(ctx.meta.teams[ti], p);
  if (!d.open) return { title, lines: [closedLine(ctx, p, d), habit, 'So they sit this one out.'].filter(Boolean) };
  const before = state.before?.[ti];
  const cricket = [gapLine(ctx, p, d, before), strengthLine(ctx, p, role)];
  const outcome = outcomeLine(state, ti, d);
  const dynamics = [moneyLine(p, before, d.f), marketLine(ctx, state.app?.market, p.role), styleLine(d.f)].filter(Boolean);
  return { title, lines: [...cricket, habit, ...dynamics.slice(0, outcome ? 1 : 2), outcome].filter(Boolean) };
}

// ---- why this price ----

const DRIVERS = {
  history: (p, up) => (p.prev ? (up ? `franchises paid ${money(p.prev.price)} for him in ${p.prev.year}` : `his last IPL price was ${money(p.prev.price)} (${p.prev.year})`) : 'no IPL auction price on record'),
  pedigree: (p, up) => (up ? 'a proven international' : p.capped ? 'few international caps' : 'uncapped, so less proven'),
  form: (p, up) => {
    const s = [p.skills?.bat, p.skills?.bowl].filter(rated).sort((a, b) => b.pct - a.pct)[0];
    if (!s) return up ? 'a good recent record' : 'little top-level evidence';
    return up ? (s.pct >= 99 ? 'top-percentile form' : `${ordinal(s.pct)}-percentile form`) : `modest recent numbers (${ordinal(s.pct)} percentile)`;
  },
  role: (p, up, ctx) => { const r = roleWords(ctx, p.role); return up ? `${r.many} are in demand` : `${r.many} rarely command big fees`; },
  age: (p, up) => {
    if (up) return p.age <= 29 ? `at ${p.age} he has years ahead` : `at ${p.age}, experience counts`;
    return p.age >= 31 ? `at ${p.age}, buyers think short-term` : p.age <= 23 ? `at ${p.age}, still raw` : 'his age counts slightly against him';
  },
  list: (p, up) => (up ? 'among the first names on the official list' : 'deep in the official list'),
  base: (p, up, ctx) => (up ? `he set ${p.base >= ctx.maxBase ? 'the top base price' : 'a high base price'}` : 'a low base price'),
  overseas: (p, up) => (up ? 'overseas stars draw a premium' : 'he competes for scarce overseas slots'),
  buzz: (p, up) => (up && p.buzz?.length ? 'tipped before the auction as an uncapped player to watch' : null),
};

function worthLine(ctx, p) {
  const top = (p.drivers || []).filter(([g]) => DRIVERS[g]).map(([g, v]) => DRIVERS[g](p, v >= 0, ctx)).filter(Boolean).slice(0, 3);
  const phrases = top.length ? top
    : [DRIVERS.history(p, !!p.prev), DRIVERS.pedigree(p, p.capped), DRIVERS.form(p, Math.max(p.skills?.bat?.pct ?? 0, p.skills?.bowl?.pct ?? 0) >= 50)];
  return `His worth: ${phrases.join('; ')}.`;
}

function demandLine(ctx, state) {
  const p = state.player, app = state.app;
  const open = Object.entries(app?.teams || {}).filter(([, d]) => d.open);
  if (!app?.teams) return null;
  if (!open.length) return 'Demand: no team came in for him.';
  const roles = new Map();
  for (const [, d] of open) { const k = roleFor(ctx, p, d); roles.set(k, (roles.get(k) || 0) + 1); }
  const [mainRole, n] = [...roles.entries()].sort((a, b) => b[1] - a[1])[0];
  const r = roleWords(ctx, mainRole);
  const who = open.length === 1 ? `only ${open[0][0]} came in, short of ${an(r.one)} ${r.one}`
    : `${words(open.length)} teams came in, ${n === open.length ? 'all' : `${words(n)} of them`} short of ${an(r.one)} ${r.one}`;
  const m = app.market;
  const mine = roleWords(ctx, p.role), shortOf = `${words(m?.short)} ${m?.short === 1 ? 'team' : 'teams'} short of one`;
  const market = !m ? '' : m.alike === 0 ? `; no other ${mine.one} like him was left, with ${shortOf}`
    : `; ${count(m.alike, { one: `similar ${mine.one}`, many: `similar ${mine.many}` })} ${m.alike === 1 ? 'was' : 'were'} left, with ${shortOf}`;
  return `Demand: ${who}${market}.`;
}

function priceLine(ctx, state) {
  const r = state.result, app = state.app, winner = ctx.codes[r.team];
  const bids = (app?.events || []).filter((e) => e[0] === 'bid');
  if (!bids.length) return `The price: he went to ${winner} for ${money(r.price)}.`;
  const rivals = bids.filter((e) => e[1] !== winner);
  const fill = app.teams?.[winner]?.why?.kind === 'fill' ? `, a final-round fill for ${winner}` : '';
  if (!rivals.length) return `The price: only ${winner} bid, so he went at ${r.price === app.start ? 'his base' : money(r.price)}${fill}.`;
  const rival = rivals[rivals.length - 1];
  const d = app.teams?.[rival[1]];
  const walk = d?.walk != null && d.walk < r.price && about(d.walk) !== money(r.price) ? about(d.walk) : null;
  const stop = d?.cap != null && d.walk === d.cap ? `ran out of room at ${money(rival[2])}` : walk ? `stopped at about ${walk}` : `stopped at ${money(rival[2])}`;
  const duel = bids.length >= 6 ? 'went toe to toe' : 'both bid';
  return `The price: ${winner} and ${rival[1]} ${duel}; ${rival[1]} ${stop}, so the hammer fell one bid later at ${money(r.price)}${fill}.`;
}

function unsoldLine(ctx, state) {
  const p = state.player, app = state.app;
  if (!app?.teams) return 'The price: no team bid his base.';
  const start = app.start ?? p.base, r = roleWords(ctx, p.role);
  const tally = { need: 0, under: 0, overseas: 0, slot: 0, purse: 0 };
  for (const d of Object.values(app.teams)) {
    if (d.open) { if (d.walk != null && d.walk < start) tally.under += 1; continue; }
    const first = (d.gate || []).find(([, ok]) => !ok)?.[0];
    if (first in tally) tally[first] += 1;
  }
  const parts = [
    tally.need && `${words(tally.need)} had no need for ${an(r.one)} ${r.one}`,
    tally.under && `${words(tally.under)} rated him under ${money(start)}`,
    tally.overseas && `${words(tally.overseas)} had no overseas slot`,
    tally.slot && `${words(tally.slot)} had full squads`,
    tally.purse && `${words(tally.purse)} couldn't afford his base`,
  ].filter(Boolean);
  return `No team had both the gap and the room${parts.length ? `: ${parts.join(', ')}` : ''}.`;
}

/** "Across 1,000 runs: sold 99% · median … · 80% between … and …" */
function acrossRuns(meta, p) {
  const s = p.sim || {}, head = `Across ${int(meta.runs)} runs:`;
  if (!s.price) return `${head} never sold.`;
  return `${head} sold ${pct(s.pSold)} · median ${money(s.price.median)} · 80% between ${money(s.price.p10)} and ${money(s.price.p90)}.`;
}

/** "Why this price?": 4–6 lines once the lot is over. */
export function priceAnalyst(ctx, state) {
  const p = state.player;
  if (!p) return [];
  const result = state.result?.type === 'sold' ? priceLine(ctx, state) : state.result?.type === 'unsold' ? unsoldLine(ctx, state) : null;
  const note = state.logged ? null : 'Full reasons are recorded for the featured runs.';
  return [worthLine(ctx, p), demandLine(ctx, state), result, note, acrossRuns(ctx.meta, p)].filter(Boolean);
}

// ---- the spread ----

/** "This run ₹X · across 1,000 runs, 80% of prices between ₹A and ₹B" (and how often he sells, if not here) */
export function spreadLine(meta, p, result) {
  const s = p.sim || {}, runs = `across ${int(meta.runs)} runs`;
  const range = s.price ? `80% of prices between ${money(s.price.p10)} and ${money(s.price.p90)}` : '';
  if (result?.type === 'sold') return `This run ${money(result.price)} · ${runs}, ${range}`;
  return s.price ? `Unsold this run · ${runs} he sells ${pct(s.pSold)} of the time; ${range}` : `Unsold this run · ${runs} he never sells`;
}
