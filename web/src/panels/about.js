// About / Method drawer: how the numbers are made, and how the model did on the 2024 auction.
import { esc } from '../dom.js';
import { money, int, pct, date, plural, signed } from '../format.js';
import { coverage, mountCalibration } from './backtest.js';

const KEYS = [['Space', 'Play / pause (after a single lot: carry on with the auction)'], ['0 · 1 · 3', 'Speed: slow · 1× · 3×'],
  ['S or →', 'Finish lot (again: next lot)'], ['←', 'Previous lot'], ['N', 'Show another run'], ['/ or Ctrl K', 'Search players'], ['Esc', 'Close panels']];

// [key, header, value format, interval format, difference format, name in a difference line]
const dec = (d) => (x) => (x == null ? '—' : x.toFixed(d));
const pc = (x) => (x == null ? '—' : `${Math.round(x * 100)}`);
const ratio = (lo, hi) => `${dec(2)(lo)}–${dec(2)(hi)}`;
const share = (lo, hi) => `${pc(lo)}–${pc(hi)}%`;
const diff3 = (x) => signed(x, 3);
const pts = (x) => `${signed(x == null ? x : x * 100, 1)} pts`;
// what the model does best first, price error last
const METRICS = [
  ['auc', 'AUC', dec(3), ratio, diff3, 'AUC'],
  ['top3', 'Top-3', pct, share, pts, 'top-3'],
  ['cover80', '80% cover', pct, share, pts, '80% cover'],
  ['spearman', 'Spearman', dec(3), ratio, diff3, 'Spearman'],
  ['mae', 'MAE <small>(log price)</small>', dec(3), ratio, diff3, 'MAE'],
];
const DOT = '<i class="dot" aria-hidden="true"> · </i>';

/** "Δ MAE −0.044 (−0.090 to ±0.000) · Δ top-3 +4.2 pts (…)" from delta = { metric: [diff, lo, hi] }. */
function deltaLine(delta) {
  const parts = METRICS.filter(([k]) => Array.isArray(delta?.[k])).map(([k, , , , fmt, name]) => {
    const [d, lo, hi] = delta[k];
    return `Δ ${name} <span class="mono">${fmt(d)}</span> <span class="muted">(<span class="mono">${fmt(lo)}</span> to <span class="mono">${fmt(hi)}</span>)</span>`;
  });
  return parts.length ? `${parts.join(DOT)} <span class="muted">against the model it would replace</span>` : '';
}

function validationRow(r) {
  const tag = r.kept === true ? '<span class="vtag is-kept">kept</span>' : r.kept === false ? '<span class="vtag">dropped</span>' : '';
  const cells = METRICS.map(([k, , fmt, ci]) => {
    const iv = r.ci?.[k];
    return `<td><span class="mono">${fmt(r[k])}</span>${iv ? `<span class="ci mono">${ci(iv[0], iv[1])}</span>` : ''}</td>`;
  }).join('');
  const delta = deltaLine(r.delta);
  const cls = [r.mode === 'baseline' && 'is-baseline', delta && 'has-delta'].filter(Boolean).join(' ');
  return `<tr${cls ? ` class="${cls}"` : ''}><th scope="row">${esc(r.model)}${tag}</th>${cells}<td class="mono col-n">${int(r.n)}</td></tr>${
    delta ? `<tr class="delta-row"><td colspan="${METRICS.length + 2}">${delta}</td></tr>` : ''}`;
}

function validationTable(v) {
  if (!v?.rows?.length) return '<p class="muted">No back-test results in this export.</p>';
  const baselines = v.rows.filter((r) => r.mode === 'baseline');
  const models = v.rows.filter((r) => r.mode !== 'baseline');
  const group = (label) => `<tr class="vgroup"><th scope="rowgroup" colspan="${METRICS.length + 2}">${label}</th></tr>`;
  const body = baselines.length
    ? `${group('Baselines')}${baselines.map(validationRow).join('')}${group('Simulation, one factor at a time')}${models.map(validationRow).join('')}`
    : models.map(validationRow).join('');
  return `<div class="table-wrap"><table class="vtable">
      <thead><tr><th scope="col">Model</th>${METRICS.map(([, h]) => `<th scope="col">${h}</th>`).join('')}<th scope="col" class="col-n">n</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>
    <p class="fine">AUC: how well P(sold) separates sold from unsold players. Top-3: the real buyer was among the three likeliest. 80% cover: real
      prices inside the simulation's 80% range. Spearman: rank correlation of simulated and real prices. MAE (log price): mean absolute error of the
      natural log of price.${baselines.length ? ' Baselines take the base price, or his last IPL price, as the prediction.' : ''}
      Small figures are 95% intervals; Δ is the paired difference against the model a row would replace, with its 95% interval
      (for MAE below zero is better, for top-3 above zero is better).</p>
    ${v.kept?.length || v.dropped?.length ? `<p class="fine">Kept after the ablation: ${esc((v.kept || []).join(', ') || '—')}. Dropped: ${esc((v.dropped || []).join(', ') || '—')}.</p>` : ''}`;
}

/** "a mini and a mega auction" when each row is a different kind, otherwise "2 past auctions". */
function auctionsPhrase(rows) {
  const kinds = rows.map((r) => String(r.kind || ''));
  if (kinds.every(Boolean) && new Set(kinds).size === kinds.length) {
    const each = kinds.map((k) => `${/^[aeiou]/i.test(k) ? 'an' : 'a'} ${k}`);
    return `${each.length > 1 ? `${each.slice(0, -1).join(', ')} and ${each[each.length - 1]}` : each[0]} auction`;
  }
  return `${int(rows.length)} past auctions`;
}

/** The value model alone (no simulation) on past auctions, each row fitted only on earlier auctions of its kind. */
function valueTable(rows) {
  if (!rows?.length) return '';
  const body = rows.map((r) => `<tr>
      <th scope="row" title="${esc(`${plural(r.n, 'player')}, ${int(r.n_sold)} sold`)}">${esc(r.auction)} · ${esc(r.kind)}</th>
      <td class="mono">${esc((r.train || []).join(', ') || '—')}</td>
      <td class="mono">${dec(2)(r.auc)}</td><td class="mono">${dec(2)(r.spearman)}</td><td class="mono">${dec(2)(r.mae)}</td>
    </tr>`).join('');
  return `<h4 class="vt-title">The value model alone, on ${esc(auctionsPhrase(rows))}</h4>
    <p class="fine vt-note">Each fitted only on earlier auctions of the same kind; no simulation.</p>
    <div class="table-wrap"><table class="vtable vt-value">
      <thead><tr><th scope="col">Auction</th><th scope="col">Trained on</th><th scope="col">Sold / unsold <small>AUC</small></th>
        <th scope="col">Price rank <small>Spearman</small></th><th scope="col">Price error <small>MAE, log price</small></th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>`;
}

function backtest(v) {
  const points = v?.points || [];
  const cov = coverage(points);
  return `<p>The same pipeline, run with only what was known before the ${esc(v?.auction || '2024 auction')}, scored against what really happened.</p>
    ${cov.n ? `<p class="cal-note"><b class="mono">${pct(cov.inside / cov.n)}</b> of real prices fell inside the simulated 80% range <span class="muted">(${int(cov.inside)} of ${int(cov.n)} sold players)</span>.</p>` : ''}
    ${v?.needHit?.top3 != null ? `<p class="cal-note"><b class="mono">${pct(v.needHit.top3)}</b> of real buys went to one of the three teams with the greatest pre-auction need for the player <span class="muted">(30% by chance${v.needHit.n ? `; ${plural(v.needHit.n, 'buy')}` : ''})</span>.</p>` : ''}
    ${cov.n ? '<figure class="cal"></figure>' : ''}
    ${validationTable(v)}
    ${valueTable(v?.valueBacktests)}`;
}

/** "+₹5 L up to ₹1.00 Cr, +₹10 L to ₹2.00 Cr, … +₹25 L above" from rules.increments. */
function increments(rules) {
  return (rules.increments || []).map(([upTo, step], i) => (upTo == null ? `+${money(step)} above` : `+${money(step)} ${i ? 'to' : 'up to'} ${money(upTo)}`)).join(', ');
}

export function mountAbout(root, ctx) {
  const { meta } = ctx;
  const r = meta.rules;
  const wrap = document.createElement('div');
  wrap.className = 'drawer-wrap';
  wrap.hidden = true;
  wrap.innerHTML = `
    <div class="drawer-scrim" data-close></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="about-title" tabindex="-1">
      <header class="drawer-head">
        <h2 id="about-title">How AuctionIQ works</h2>
        <button class="icon-btn" type="button" data-close aria-label="Close (Esc)"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15"/></svg></button>
      </header>
      <div class="drawer-body">
        <section><h3>Data cut-off</h3>
          <p>Everything was frozen on the morning of the auction, ${esc(date(meta.date))} in ${esc(meta.city)}. Player form comes from ball-by-ball records of men's T20 matches up to ${esc(date(meta.asOf))}; squads, purses and the auction list are as published before the event. Nothing from the real auction leaks in.</p>
          <p class="fine">Ball-by-ball data: Cricsheet (ODC-By). Auction lists, purses and squads: official BCCI/IPL publications.</p></section>
        <section><h3>The auction</h3>
          <p>The engine follows the published procedure. There is no marquee set: capped sets come first, then uncapped sets, each in role order. The first 70 names are called set by set, with the order inside each set drawn at random; after that come accelerated rounds of names the franchises submit, repeated while squads are still filling. Bids move on the official price points (${esc(increments(r))}). An overseas player keeps at most ${money(r.overseasFeeCap)} and the rest goes to the BCCI. There is no Right to Match in a mini-auction.</p></section>
        <section><h3>Skills</h3>
          <p>Batting and bowling are measured as runs added per 100 balls, adjusted for the phase of the innings and the venue (a death-overs bowler is not punished for bowling at the death), and centred so that zero is an average T20 regular in the same role group. Every skill shows its percentile and the number of balls it rests on; matchups split batting by the six bowler types.</p></section>
        <section><h3>Value model</h3>
          <p>The model value is the price the model expects a player to fetch, with an 80% interval. The simulation turns it into a full distribution of prices, and the back-test below checks the simulation's 80% ranges against real prices: if they are calibrated, about four in five real prices land inside.</p></section>
        <section><h3>Franchise agents</h3>
          <p>Each franchise is a rule-based agent. When a lot opens it checks four gates: a squad need, a free slot (squads hold ${int(r.maxSquad)}), an overseas slot if needed (at most ${int(r.maxOverseas)}), and enough purse after keeping ${money(r.reservePerSlot)} back for every slot still missing from the ${int(r.minSquad)}-man minimum. If all pass it sets a walk-away price, model value × need × scarcity × purse pressure × home fit × spending style × room rating × its own noise, capped by its purse, and bids on the official price points until the price passes it. Click any table to hear its analyst on the current lot, in cricket terms; the gates are one click further, under “The numbers behind it”, and the walk-away build-up joins them when the hammer falls.</p></section>
        <section><h3>Monte Carlo</h3>
          <p>The whole auction is played ${int(meta.runs)} times (seed ${esc(meta.seed)}). Rules, squads and purses are identical in every run. Each run draws how the whole room rates each player that day (the room rating: one draw shared by all ten teams) on top of each team's own noise; the spread you see is the uncertainty in how the room behaves. For each player six runs are drawn at random and recorded bid by bid, and his lot plays one of them, so the price can land above or below his median as in a live auction. His model value and the 1,000-run numbers stay sealed until the hammer falls; then the result card says how this run compares with the median and the 80% range, and “Show another run” plays the next one.</p></section>
        <section><h3>Back-test: ${esc(meta.validation?.auction || '2024 auction')}</h3>
          ${backtest(meta.validation)}</section>
        <section><h3>Keyboard</h3>
          <dl class="keys">${KEYS.map(([k, v]) => `<div><dt><kbd>${esc(k)}</kbd></dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>
        <p class="fine">Unofficial — not affiliated with the IPL or BCCI. No logos, photos or likenesses are used; team colours are approximations of public team colours, for identification only.</p>
      </div>
    </aside>`;
  root.append(wrap);
  const fig = wrap.querySelector('.cal');
  if (fig) mountCalibration(fig, meta.validation.points);
  const drawer = wrap.querySelector('.drawer');
  let lastFocus = null, timer = 0;

  function open() {
    clearTimeout(timer);
    if (!wrap.contains(document.activeElement)) lastFocus = document.activeElement;
    wrap.hidden = false;
    requestAnimationFrame(() => { wrap.classList.add('is-open'); drawer.focus(); });
  }
  function close() {
    if (wrap.hidden) return;
    wrap.classList.remove('is-open');
    timer = setTimeout(() => { wrap.hidden = true; }, 300);
    // hand focus back outside the drawer, so the keyboard shortcuts keep working
    if (lastFocus && document.contains(lastFocus) && lastFocus !== document.body) lastFocus.focus();
    else document.activeElement?.blur?.();
  }
  wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  return { open, close, get isOpen() { return !wrap.hidden && wrap.classList.contains('is-open'); } };
}
