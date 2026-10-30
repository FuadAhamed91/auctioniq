// Team panel: the table's analyst on the current lot (cricket first, then the auction), the numbers behind
// it on request, and how the franchise's auction is going.
import { esc } from '../dom.js';
import { money, int, pct, runNo } from '../format.js';
import { teamDot, teamVars } from '../teams.js';
import { teamAnalyst, habitLines } from '../analyst.js';

/** "2025-11-16" -> "Nov 2025" */
const monthYear = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const safeUrl = (url) => (/^https?:\/\//i.test(url || '') ? url : null);

const GATE_LABEL = { need: 'Need', slot: 'Squad slot', overseas: 'Overseas', purse: 'Purse' };
// [key in decision.f, label, what it is]
const FACTORS = [
  ['need', 'Need', 'How badly the squad needs his role'],
  ['scarcity', 'Scarcity', 'Teams chasing his role against comparable players still to come'],
  ['pressure', 'Purse pressure', 'Money per open slot against the auction average'],
  ['home', 'Home fit', 'How his game suits the home ground'],
  ['style', 'Style', 'How this franchise has paid against the model in past auctions'],
  ['market', 'Room rating', 'How the whole room rates him in this run: one draw, the same for all ten teams'],
  ['noise', 'Noise', "This team's own random read on him, on top of the room rating"],
];
const ICON_OK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>';
const ICON_NO = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>';

const pctW = (v, max) => `${Math.max(0, Math.min(100, (v / max) * 100)).toFixed(2)}%`;

function waterfall(d, price) {
  const f = d.f;
  const rows = [];
  let run = f.value;
  rows.push({ cls: 'base', label: 'Model value', factor: '', from: 0, to: run });
  for (const [k, label, tip] of FACTORS) {
    if (f[k] == null) continue;
    const next = run * f[k];
    rows.push({ cls: next >= run ? 'up' : 'down', label: `× ${label}`, tip, factor: f[k].toFixed(2), from: run, to: next });
    run = next;
  }
  const capped = d.cap != null && d.walk === d.cap && run > d.walk + 0.5;
  if (capped) rows.push({ cls: 'down cap', label: 'Capped by purse', factor: '', from: run, to: d.walk });
  const floored = d.floor != null && d.walk === d.floor && run < d.walk - 0.5;
  if (floored) rows.push({ cls: 'up cap', label: 'Raised to his base', factor: '', from: run, to: d.walk });
  const max = Math.max(...rows.map((r) => Math.max(r.from, r.to)), d.walk, price || 0) * 1.04;
  const body = rows.map((r) => {
    const lo = Math.min(r.from, r.to), hi = Math.max(r.from, r.to);
    return `<div class="wf-row ${r.cls}"${r.tip ? ` title="${esc(r.tip)}"` : ''}>
        <span class="wf-label">${r.label}</span><span class="wf-factor mono">${r.factor}</span>
        <span class="wf-track"><i class="wf-run" style="width:${pctW(lo, max)}"></i><i class="wf-delta" style="left:${pctW(lo, max)};width:${pctW(hi - lo, max)}"></i></span>
        <span class="wf-val mono">${money(r.to)}</span>
      </div>`;
  }).join('');
  const tick = price != null ? `<i class="wf-price" style="left:${pctW(price, max)}" title="Current bid ${esc(money(price))}"></i>` : '';
  return `<div class="waterfall" role="table" aria-label="Walk-away price build-up">
      ${body}
      <div class="wf-row final">
        <span class="wf-label">= Walk-away</span><span class="wf-factor mono"></span>
        <span class="wf-track"><i class="wf-run" style="width:${pctW(d.walk, max)}"></i>${tick}</span>
        <span class="wf-val mono">${money(d.walk)}</span>
      </div>
      ${capped ? `<p class="wf-note">Capped by purse: ${money(d.cap)} is the most this team can bid while keeping its squad reserve.</p>` : ''}
      ${d.floor != null ? '<p class="wf-note">Raised to his base: filling the squad in the last round.</p>' : ''}
      ${price != null ? '<p class="wf-note"><i class="wf-key"></i>current bid</p>' : ''}
    </div>`;
}

export function mountTeamPanel(el, ctx) {
  const { replay, meta, players, codes } = ctx;
  let ti = null, closeTimer = 0;
  el.tabIndex = -1;
  el.innerHTML = `
    <header class="tp-head">
      <div><span class="kicker">Franchise</span><h3 class="tp-code mono" id="tp-code"></h3><p class="tp-sub" id="tp-sub"></p></div>
      <button class="icon-btn tp-close" type="button" aria-label="Close team panel (Esc)">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15"/></svg>
      </button>
    </header>
    <div class="tp-scroll">
      <div class="tp-now" id="tp-now"></div>
      <section class="tp-sec tp-analyst" id="tp-analyst" aria-live="polite"></section>
      <section class="tp-sec tp-habits" id="tp-habits"></section>
      <section class="tp-sec" id="tp-decision"></section>
      <section class="tp-sec" id="tp-needs"></section>
      <section class="tp-sec" id="tp-squad"></section>
      <section class="tp-sec" id="tp-sim"></section>
    </div>`;
  const part = (id) => el.querySelector(`#${id}`);
  const ui = { code: part('tp-code'), sub: part('tp-sub'), now: part('tp-now'), analyst: part('tp-analyst'), habits: part('tp-habits'), decision: part('tp-decision'), needs: part('tp-needs'), squad: part('tp-squad'), sim: part('tp-sim') };
  let numbersOpen = false; // "The numbers behind it" stays as the viewer left it

  const squadOf = (t) => {
    const T = meta.teams[t];
    const bought = (replay.state.econ[t]?.bought || []).map((b) => ({ ...players[b.id], price: b.price, isNew: true }));
    return [...T.retained.map((r) => ({ ...r, isNew: false })), ...bought];
  };

  function renderNow() {
    const T = meta.teams[ti], e = replay.state.econ[ti], s = replay.state;
    ui.code.innerHTML = `${teamDot(T.code)}${T.code}`;
    el.style.cssText = teamVars(T.code);
    const home = (T.home || []).map((h) => h.city || h.venue).filter(Boolean).join(' / ');
    const style = T.style > 1.05 ? 'pays above the market' : T.style < 0.95 ? 'rarely overpays' : 'pays around the market';
    ui.sub.textContent = `${home ? `Home: ${home} · ` : ''}${style}`;
    const where = !s.player ? '' : s.run == null ? 'Before the auction'
      : s.phase === 'notcalled' ? `Run ${runNo(s.run)} · end of the run` : `Run ${runNo(s.run)} · before lot ${int(s.player.lot)} (${s.player.name})`;
    ui.now.innerHTML = `
      <div class="fact"><span class="k">Purse left</span><span class="v mono">${money(e.purse)}</span><span class="s">of ${money(T.purse)}</span></div>
      <div class="fact"><span class="k">Slots left</span><span class="v mono">${int(e.slots)}</span><span class="s">squad ${int(e.size)} / ${int(meta.rules.maxSquad)}</span></div>
      <div class="fact"><span class="k">Overseas left</span><span class="v mono">${int(e.os)}</span><span class="s">of ${int(T.overseasSlots)} at start</span></div>
      <p class="tp-context">${esc(where)}</p>`;
  }

  function renderAnalyst() {
    const a = teamAnalyst(ctx, replay.state, ti);
    ui.analyst.innerHTML = a ? `<h4 class="analyst-head">${esc(a.title)}<span class="muted"> on ${esc(replay.state.player.name)}</span></h4>
      <div class="analyst">${a.lines.map((line) => `<p>${esc(line)}</p>`).join('')}</div>` : '';
  }

  /** The franchise's buying habits and cited background: information only, the bidding does not use them. */
  function renderHabits() {
    const T = meta.teams[ti], h = habitLines(T);
    if (!h) { ui.habits.innerHTML = ''; return; }
    const notes = (T.notes || []).filter((n) => n.note).map((n) => {
      const url = safeUrl(n.url), src = [n.outlet, n.date && monthYear(n.date)].filter(Boolean).join(', ');
      return `<li>${esc(n.note)}${src ? ` ${url ? `<a class="note-src" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(src)}</a>` : `<span class="note-src">${esc(src)}</span>`}` : ''}</li>`;
    }).join('');
    ui.habits.innerHTML = `<h4 class="habits-head">How ${esc(T.code)} usually build</h4>
      <p class="habits-since">${esc(h.head)}</p>
      <ul class="habits">${[...h.items, h.star].filter(Boolean).map((line) => `<li>${esc(line)}</li>`).join('')}</ul>
      ${notes ? `<ul class="habit-notes">${notes}</ul>` : ''}
      <p class="habits-foot">Background only: these habits did not pick mini-auction buyers better than chance, so the bidding runs on each team's current gaps and money.</p>`;
  }

  function renderDecision() {
    const s = replay.state, d = s.player && s.app?.teams?.[meta.teams[ti].code];
    if (!d) { ui.decision.innerHTML = ''; return; }
    const gates = (d.gate || []).map(([kind, ok, text]) => `
      <li class="gate ${ok ? 'ok' : 'no'}"><span class="gate-i">${ok ? ICON_OK : ICON_NO}</span><span class="gate-k">${esc(GATE_LABEL[kind] || kind)}</span><span class="gate-t">${esc(text)}</span></li>`).join('');
    const showPrice = s.price != null && !s.result ? s.price : null;
    // the build-up starts from the model's value and ends at their walk-away price, either of which would
    // give the lot away, so it waits for the hammer (the analyst still says why they backed out)
    const limit = d.open && d.f && d.walk != null
      ? (s.revealed ? waterfall(d, showPrice) : '<p class="wf-note">How far they would go opens when the hammer falls.</p>')
      : '';
    ui.decision.innerHTML = `<details class="tp-numbers"${numbersOpen ? ' open' : ''}>
        <summary>The numbers behind it</summary>
        <ul class="gates">${gates}</ul>
        ${limit}
      </details>`;
    ui.decision.querySelector('details').addEventListener('toggle', (e) => { numbersOpen = e.target.open; });
  }

  function renderNeeds() {
    const T = meta.teams[ti], p = replay.state.player;
    const squad = squadOf(ti).filter((x) => x.isNew);
    const max = Math.max(1, ...T.needs.map((n) => n.score));
    ui.needs.innerHTML = `
      <div class="sec-head"><span class="k">Pre-auction needs</span><span class="muted">score</span></div>
      <ul class="needs">${T.needs.map((n) => {
        const match = p && (p.role === n.role || p.role2 === n.role);
        const got = squad.filter((x) => x.role === n.role).length;
        return `<li class="need${match ? ' is-match' : ''}">
          <div class="need-top"><span class="need-role">${esc(n.role ? ctx.roleLabel(n.role) : n.kind === 'keeper' ? 'Keeper' : 'Squad')}</span><span class="chip chip-quiet">${esc(n.kind)}</span>${match ? '<span class="chip chip-teal">this lot</span>' : ''}<span class="mono need-score">${n.score.toFixed(1)}</span></div>
          <span class="need-bar"><i style="width:${pctW(n.score, max)}"></i></span>
          <p class="need-text">${esc(n.text)}${got ? ` · <span class="flood">${got} bought this run</span>` : ''}</p>
        </li>`;
      }).join('') || '<li class="muted small">No needs flagged.</li>'}</ul>`;
  }

  function renderSquad() {
    const T = meta.teams[ti];
    const squad = squadOf(ti);
    const unit = 100 / 5;
    ui.squad.innerHTML = `
      <div class="sec-head"><span class="k">Squad vs template</span><span class="muted">${int(squad.length)} players · template for ${int(meta.rules.maxSquad)}</span></div>
      <div class="squad">${meta.roles.map(({ key, label }) => {
        const members = squad.filter((x) => x.role === key);
        const tpl = T.template?.[key] ?? 0;
        const segs = members.slice(0, 5).map((m, i) => `<i class="${m.isNew ? 'new' : ''}" style="left:${i * unit}%;width:${unit}%"></i>`).join('');
        const names = members.map((m) => (m.isNew ? `<b>${esc(m.name)} <span class="mono">${money(m.price)}</span></b>` : esc(m.name))).join(', ');
        return `<div class="sq-row">
            <div class="sq-top"><span class="sq-role">${esc(label)}</span><span class="mono sq-count">${members.length} <span class="muted">/ ${tpl.toFixed(1)}</span></span></div>
            <span class="sq-bar">${segs}<b class="sq-tpl" style="left:${Math.min(100, tpl * unit).toFixed(2)}%"></b></span>
            ${names ? `<p class="sq-names">${names}</p>` : ''}
          </div>`;
      }).join('')}</div>
      <p class="muted small sq-key"><i class="sq-key-old"></i>retained <i class="sq-key-new"></i>bought in this run <i class="sq-key-tpl"></i>template</p>`;
  }

  function renderSim() {
    const T = meta.teams[ti], sim = T.sim || {};
    const targets = (sim.topTargets || []).filter(([id]) => players[id]);
    ui.sim.innerHTML = `
      <div class="sec-head"><span class="k">Across ${int(meta.runs)} runs</span><span class="muted">medians</span></div>
      <div class="kpis kpis-4">
        <div class="kpi"><span class="k">Spend</span><span class="kpi-v mono">${money(sim.spend?.median)}</span></div>
        <div class="kpi"><span class="k">Purse left</span><span class="kpi-v mono">${money(sim.purseLeft?.median)}</span></div>
        <div class="kpi"><span class="k">Players bought</span><span class="kpi-v mono">${int(sim.bought?.median)}</span></div>
        <div class="kpi"><span class="k">Needs filled</span><span class="kpi-v mono">${pct(sim.needsFilled?.median)}</span></div>
      </div>
      ${targets.length ? `<div class="targets">
        <div class="sec-head"><span class="k">Top targets</span><span class="muted">P(${esc(T.code)} buys him)</span></div>
        ${targets.map(([id, share]) => `<button type="button" class="trow" data-id="${id}" title="Jump to ${esc(players[id].name)}">
            <span class="tname">${esc(players[id].name)}</span><span class="tbar"><i style="width:${(share * 100).toFixed(2)}%"></i></span><span class="mono tval">${pct(share)}</span>
          </button>`).join('')}
      </div>` : ''}`;
  }

  function renderAll() {
    if (ti == null) return;
    renderNow(); renderAnalyst(); renderHabits(); renderDecision(); renderNeeds(); renderSquad(); renderSim();
  }

  function open(t) {
    clearTimeout(closeTimer);
    const same = ti === t && !el.hidden;
    ti = t;
    ctx.emitSelectTeam(t);
    if (same) return;
    el.hidden = false;
    renderAll();
    el.querySelector('.tp-scroll').scrollTop = 0;
    requestAnimationFrame(() => el.classList.add('is-open'));
  }
  function close() {
    if (ti == null) return;
    ti = null;
    ctx.emitSelectTeam(null);
    el.classList.remove('is-open');
    closeTimer = setTimeout(() => { el.hidden = true; }, 320);
  }

  el.addEventListener('click', (e) => {
    if (e.target.closest('.tp-close')) { close(); return; }
    const row = e.target.closest('.trow');
    if (row) ctx.selectPlayer(Number(row.dataset.id));
  });

  replay.on('lot', () => { if (ti != null) renderAll(); });
  replay.on('econ', () => { if (ti != null) { renderNow(); renderNeeds(); renderSquad(); } });
  replay.on('step', () => { if (ti != null) { renderAnalyst(); renderDecision(); } });
  replay.on('phase', () => { if (ti != null) { renderAnalyst(); renderDecision(); } });
  replay.on('reveal', () => { if (ti != null) { renderAnalyst(); renderDecision(); } });

  return { open, close, get team() { return ti; } };
}
