// Stage overlays: run chip, fast-forward ticker, accelerated-round interstitial, the single-player result card,
// and loading / end / error states.
import { esc, retrigger } from '../dom.js';
import { int, money, pct, runNo, plural } from '../format.js';

/** "Across 1,000 runs: sold 96% · median ₹15.75 Cr · KKR buys him 28%" */
function acrossRuns(p, s, meta) {
  const sim = p.sim || {};
  const head = `Across ${int(meta.runs)} runs:`;
  if (!sim.price) return `${head} never sold.`;
  const buyers = sim.buyers || [];
  const team = s.result?.type === 'sold' ? meta.teams[s.result.team]?.code : null;
  const share = team ? buyers.find(([code]) => code === team)?.[1] || 0 : null;
  const buys = team ? `${team} buys him ${pct(share)}` : buyers[0] ? `${buyers[0][0]} buys him most (${pct(buyers[0][1])})` : '';
  return [`${head} sold ${pct(sim.pSold)}`, `median ${money(sim.price.median)}`, buys].filter(Boolean).join(' · ');
}

export function mountHud(el, ctx) {
  const { replay, meta } = ctx;
  el.innerHTML = `
    <div class="hud-run" id="hud-run"></div>
    <div class="ticker" id="ticker" hidden>
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5l6 5-6 5z" class="fill"/><path d="M10 5l6 5-6 5z" class="fill"/></svg>
      <span class="ticker-text"></span>
      <i class="ticker-bar"></i>
    </div>
    <div class="interstitial" id="interstitial" hidden>
      <span class="kicker">Unsold in the main auction</span>
      <strong class="inter-title"></strong>
    </div>
    <section class="result-card" id="result-card" aria-label="Result of this lot" hidden>
      <p class="rc-verdict"></p>
      <p class="rc-runs"></p>
      <div class="rc-actions">
        <button class="btn btn-quiet" type="button" data-act="replay">Replay lot</button>
        <button class="btn btn-quiet" type="button" data-act="another">Show another run</button>
        <button class="btn btn-primary" type="button" data-act="next">Next lot →</button>
      </div>
    </section>
    <div class="hud-note" id="hud-note" hidden></div>`;
  const run = el.querySelector('#hud-run');
  const ticker = el.querySelector('#ticker');
  const inter = el.querySelector('#interstitial');
  const card = el.querySelector('#result-card');
  const note = el.querySelector('#hud-note');
  let tickTimer = 0, loadTimer = 0;

  replay.on('run', (s) => {
    run.innerHTML = s.run != null
      ? `<span class="mono">Run ${runNo(s.run)}</span><span class="muted"> of ${int(meta.runs)}</span>${s.feature?.tag ? `<i class="dot" aria-hidden="true"> · </i>${esc(s.feature.tag)}` : ''}`
      : '<span class="muted">Not called in any run</span>';
  });

  replay.on('ff', ({ count, run: r }) => {
    clearTimeout(tickTimer);
    ticker.querySelector('.ticker-text').innerHTML = `Run <b class="mono">${runNo(r)}</b> · fast-forwarding <b class="mono">${int(count)}</b> earlier ${count === 1 ? 'lot' : 'lots'}`;
    ticker.style.setProperty('--ff', `${Math.round(1100 / replay.state.speed + 200)}ms`);
    ticker.hidden = false;
    retrigger(ticker, 'is-running');
    tickTimer = setTimeout(() => { ticker.hidden = true; }, Math.round(1700 / replay.state.speed + 600));
  });

  replay.on('interstitial', ({ round, kind, brk }) => {
    inter.querySelector('.kicker').textContent = kind === 'break' || brk ? 'Break — franchises submit names' : 'Unsold in the main auction';
    inter.querySelector('.inter-title').textContent = kind === 'break' ? `Accelerated round ${round}` : `Returns in accelerated round ${round}`;
    inter.hidden = false;
    retrigger(inter, 'is-in');
  });

  // single-player focus: the lot has told its story; sum it up and offer the next move
  replay.on('ended', (ended) => {
    card.hidden = !ended;
    if (!ended) return;
    const s = replay.state, p = s.player;
    const r = s.result;
    const verdict = card.querySelector('.rc-verdict');
    verdict.dataset.tone = r?.type || 'none';
    verdict.innerHTML = r?.type === 'sold'
      ? `SOLD to ${esc(ctx.codes[r.team])} <span class="mono">· ${money(r.price)}</span>`
      : r?.type === 'unsold' ? 'UNSOLD' : s.phase === 'never' ? 'Never called' : 'Not called in this run';
    card.querySelector('.rc-runs').textContent = acrossRuns(p, s, meta);
    const n = p.sim?.feature?.length || 0;
    card.querySelector('[data-act="another"]').disabled = !(n > 1 || (n === 1 && s.featureIdx < 0));
    card.querySelector('[data-act="next"]').disabled = p.id + 1 >= ctx.players.length;
    retrigger(card, 'is-in');
  });
  card.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    ({ replay: () => replay.replayLot(), another: () => replay.anotherRun(), next: () => replay.next() })[act]?.();
  });

  replay.on('phase', (phase) => {
    if (phase !== 'interstitial' && phase !== 'break') inter.hidden = true;
    clearTimeout(loadTimer);
    if (phase === 'loading') {
      loadTimer = setTimeout(() => { note.textContent = 'Loading lot…'; note.hidden = false; }, 280);
      return;
    }
    if (phase === 'end') {
      note.innerHTML = `End of the auction list · ${plural(ctx.players.length, 'lot')} <button type="button" class="btn btn-quiet" data-restart>Back to lot 1</button>`;
      note.hidden = false;
    } else if (phase === 'error') {
      note.textContent = `Could not load the auction data (${replay.state.error}).`;
      note.hidden = false;
    } else note.hidden = true;
  });
  note.addEventListener('click', (e) => { if (e.target.closest('[data-restart]')) replay.goTo(0, 0, { play: true, focus: false }); });
}
