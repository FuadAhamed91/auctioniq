// Lot card: who is under the hammer and what the model thinks he is worth; the deeper numbers wait behind "More stats".
import { esc } from '../dom.js';
import { money, moneyRange, int, ordinal, per100, plural, shortBowlerType, setName } from '../format.js';

const TAGS = ['overseas', 'uncapped', 'wk', 'lap', 'lhb']; // the tags worth a pill, most telling first; at most three
const MIN_BALLS = 60; // below this a skill shows its ball count but no percentile
const DOT = '<i class="dot" aria-hidden="true"> · </i>';

const BUZZ = { watch: 'One to watch', trial: 'Trials', league: 'State league' };

/** "Pre-auction buzz": what was said about him before the auction, one line per kind, with sources. */
function buzzBlock(p) {
  const lines = Object.entries(BUZZ).map(([kind, label]) => {
    const rows = (p.buzz || []).filter((b) => b.signal === kind);
    if (!rows.length) return '';
    const what = kind === 'trial' ? [...new Set(rows.flatMap((b) => String(b.team).split(';')).filter(Boolean))].join(', ')
      : rows.find((b) => b.detail)?.detail || '';
    const src = rows.slice(0, 3).map((b) => (/^https?:\/\//.test(b.url)
      ? `<a href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.outlet)}</a>` : esc(b.outlet))).join(', ');
    return `<li><b>${label}</b>${what ? ` · ${esc(what)}` : ''} <span class="muted">(${src})</span></li>`;
  }).join('');
  return lines ? `<div class="lc-buzz"><span class="k">Pre-auction buzz</span><ul>${lines}</ul></div>` : '';
}

const pctOf = (x, max) => `${Math.max(0, Math.min(100, (x / max) * 100)).toFixed(2)}%`;
const rated = (s) => s?.pct != null && s.balls >= MIN_BALLS;

/** Thin bar under the model value: the 80% range as a band, the value as a tick. */
function rangeBar({ lo, mid, hi }) {
  const max = hi * 1.06;
  const label = `80% range ${moneyRange(lo, hi)}`;
  return `<span class="vrange" role="img" aria-label="${esc(label)}" title="${esc(label)}">
      <i class="vr-band" style="left:${pctOf(lo, max)};width:calc(${pctOf(hi, max)} - ${pctOf(lo, max)})"></i><i class="vr-mid" style="left:${pctOf(mid, max)}"></i>
    </span>`;
}

/** "Batting · 87th pct · 813 balls" over a slim percentile bar. */
function skillLine(label, s) {
  if (!s) return `<div class="sk is-none"><span class="k">${label}</span><span class="sk-ev">no record</span></div>`;
  const ok = rated(s);
  const ev = ok ? `${ordinal(s.pct)} pct${DOT}${plural(s.balls, 'ball')}` : `too few balls (${int(s.balls)})`;
  return `<div class="sk${ok ? '' : ' is-unrated'}">
      <span class="k">${label}</span><span class="sk-ev">${ev}</span>
      <span class="pbar"${ok ? ` role="img" aria-label="${ordinal(s.pct)} percentile"` : ' aria-hidden="true"'}>${ok ? `<i style="width:${Math.max(1.5, s.pct)}%"></i>` : ''}</span>
    </div>`;
}

function matchups(p, ctx) {
  const vs = p.skills?.vs || [];
  const faced = (v) => v.balls > 0 && v.rv != null;
  if (!vs.some(faced)) return '';
  const max = Math.max(0.15, ...vs.filter(faced).map((v) => Math.abs(v.rv)));
  const cells = vs.map((v) => {
    const label = ctx.btLabel(v.type);
    if (!faced(v)) {
      return `<div class="mu-cell is-empty" title="${esc(label)}: no balls faced"><span class="mu-type">${esc(shortBowlerType(label))}</span><span class="mu-bar"></span><span class="mu-v mono">—</span><span class="mu-n mono">0 b</span></div>`;
    }
    const h = Math.max(0.06, Math.abs(v.rv) / max);
    return `<div class="mu-cell" title="${esc(label)}: ${per100(v.rv)} runs per 100 balls, from ${int(v.balls)} balls">
        <span class="mu-type">${esc(shortBowlerType(label))}</span>
        <span class="mu-bar"><i class="${v.rv >= 0 ? 'up' : 'down'}" style="--h:${h.toFixed(3)}"></i></span>
        <span class="mu-v mono">${per100(v.rv)}</span><span class="mu-n mono">${int(v.balls)} b</span>
      </div>`;
  }).join('');
  return `<div class="mu"><div class="sec-head"><span class="k">Batting vs bowler type</span><span class="muted">per 100 balls</span></div><div class="mu-row">${cells}</div></div>`;
}

/** Runs per 100 balls with strike rate / economy, and the matchup row. */
function moreStats(p, ctx) {
  const { bat, bowl } = p.skills;
  const row = (label, s, extra) => (s ? `<div class="more-row"><span class="k">${label}</span>${rated(s)
    ? `<span class="mono">${per100(s.rv)}</span><span class="mono muted">${extra}</span>`
    : '<span class="muted">too few balls</span><span></span>'}</div>` : '');
  return `<details class="more">
      <summary>More stats</summary>
      <div class="more-body">
        <div class="sec-head"><span class="k">Skills</span><span class="muted">runs / 100 balls vs an average regular</span></div>
        ${row('Batting', bat, bat ? `SR ${bat.sr.toFixed(1)}` : '')}
        ${row('Bowling', bowl, bowl ? `Econ ${bowl.econ.toFixed(1)}` : '')}
        ${matchups(p, ctx)}
      </div>
    </details>`;
}

export function mountLotCard(el, ctx) {
  const { replay, players } = ctx;
  let shown = null;
  let moreOpen = false; // the disclosure stays as the viewer left it from lot to lot

  function render(p) {
    const roles = [p.role, p.role2].filter(Boolean).map((r) => esc(ctx.roleLabel(r))).join(' / ');
    const sub = [esc(p.country), p.age || '', roles].filter(Boolean).join(DOT);
    const tags = TAGS.filter((t) => p.tags?.includes(t)).slice(0, 3).map((t) => `<span class="tag">${esc(ctx.tagLabel(t))}</span>`).join('');
    const below = p.value && p.value.mid < p.base;
    const record = p.skills?.bat || p.skills?.bowl;
    el.innerHTML = `
      <header class="lc-head">
        <div class="lc-top"><span class="lc-set"></span><span class="lc-lot">Lot <span class="mono">${int(p.lot)}</span><span class="muted"> / ${int(players.length)}</span></span></div>
        <h2 class="lc-name">${esc(p.name)}</h2>
        <p class="lc-sub">${sub}</p>
        ${tags ? `<div class="tags">${tags}</div>` : ''}
        ${buzzBlock(p)}
      </header>
      <div class="facts">
        <div class="fact"><span class="k">Base</span><span class="v mono">${money(p.base)}</span></div>
        <div class="fact"><span class="k">Last IPL</span><span class="v mono">${p.prev ? money(p.prev.price) : '—'}</span>${p.prev ? `<span class="s">${esc(p.prev.team)} · ${esc(p.prev.year)}</span>` : ''}</div>
        <div class="fact"><span class="k">Model value</span><span class="v mono">${money(p.value?.mid)}</span>${p.value ? rangeBar(p.value) : ''}${below
          ? '<span class="s" title="The model expects him to go unsold unless a team needs him">below base</span>' : ''}</div>
      </div>
      ${record ? `<div class="skills">${skillLine('Batting', p.skills.bat)}${skillLine('Bowling', p.skills.bowl)}</div>${moreStats(p, ctx)}`
        : `<p class="lc-norecord" title="${p.capped ? '' : 'Uncapped, '}no Cricsheet data: role from the official list">No ball-by-ball record</p>`}`;
    const more = el.querySelector('.more');
    if (more) {
      more.open = moreOpen;
      more.addEventListener('toggle', () => { moreOpen = more.open; });
    }
    el.scrollTop = 0;
  }

  /** The top line names the set, or the accelerated round he came back in. */
  function paintSet() {
    const s = replay.state, p = s.player;
    const node = el.querySelector('.lc-set');
    if (!p || !node) return;
    const set = setName(p.setCode);
    const accelerated = s.round > 0 && s.app;
    node.classList.toggle('is-accel', !!accelerated);
    node.title = set ? `Set ${p.setCode}: ${set.kind}, set ${set.n}${p.set ? ` (set ${p.set} of the auction)` : ''}` : `Set ${p.setCode}`;
    const what = accelerated ? `Accelerated round ${int(s.round)}` : esc(set?.kind || '');
    node.innerHTML = `<b class="mono">${esc(p.setCode)}</b>${what ? `${DOT}${what}` : ''}`;
  }

  replay.on('lot', () => {
    const p = replay.state.player;
    if (p && p !== shown) { shown = p; render(p); }
    paintSet();
  });
}
