// Stage overlays: run chip, fast-forward ticker, accelerated-round interstitial, the analyst hint, the
// single-player result card (with "Why this price?" and the spread of runs), and loading / end / error states.
import { esc, retrigger } from '../dom.js';
import { int, money, runNo, plural } from '../format.js';
import { priceAnalyst, spreadLine } from '../analyst.js';

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
    <p class="hud-hint" id="hud-hint"><span class="hint-click">Click</span><span class="hint-tap">Tap</span> a table to hear its analyst</p>
    <section class="result-card" id="result-card" aria-label="Result of this lot" hidden>
      <p class="rc-verdict"></p>
      <p class="rc-split" hidden></p>
      <p class="rc-spread"></p>
      <div class="rc-actions">
        <button class="btn btn-quiet" type="button" data-act="why" aria-expanded="false" aria-controls="rc-why">Why this price?</button>
        <button class="btn btn-quiet" type="button" data-act="replay">Replay lot</button>
        <button class="btn btn-quiet" type="button" data-act="another">Show another run</button>
        <button class="btn btn-primary" type="button" data-act="next">Next lot →</button>
      </div>
      <div class="rc-why" id="rc-why" hidden><ul></ul></div>
    </section>
    <div class="hud-note" id="hud-note" hidden></div>`;
  const run = el.querySelector('#hud-run');
  const ticker = el.querySelector('#ticker');
  const inter = el.querySelector('#interstitial');
  const hint = el.querySelector('#hud-hint');
  const card = el.querySelector('#result-card');
  const why = card.querySelector('.rc-why');
  const whyBtn = card.querySelector('[data-act="why"]');
  const note = el.querySelector('#hud-note');
  let tickTimer = 0, loadTimer = 0, heardAnalyst = false;

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

  // the hint goes once someone has listened to an analyst
  const paintHint = () => { hint.hidden = heardAnalyst || !card.hidden || !replay.state.player; };
  ctx.onSelectTeam((ti) => { if (ti != null) heardAnalyst = true; paintHint(); });

  function setWhy(open) {
    why.hidden = !open;
    whyBtn.setAttribute('aria-expanded', String(open));
    if (!open) return;
    why.querySelector('ul').innerHTML = priceAnalyst(ctx, replay.state).map((line) => `<li>${esc(line)}</li>`).join('');
    why.scrollIntoView({ block: 'nearest' });
  }

  // single-player focus: the lot has told its story; sum it up and offer the next move
  replay.on('ended', (ended) => {
    card.hidden = !ended;
    setWhy(false);
    paintHint();
    if (!ended) return;
    const s = replay.state, p = s.player, r = s.result;
    const verdict = card.querySelector('.rc-verdict');
    verdict.dataset.tone = r?.type || 'none';
    verdict.innerHTML = r?.type === 'sold'
      ? `SOLD to ${esc(ctx.codes[r.team])} <span class="mono">· ${money(r.price)}</span>`
      : r?.type === 'unsold' ? 'UNSOLD' : s.phase === 'never' ? 'Never called' : 'Not called in this run';
    const split = card.querySelector('.rc-split');
    split.hidden = !r?.split;
    if (r?.split) split.textContent = `He keeps ${money(r.split.keeps)}, the overseas cap; the other ${money(r.split.bcci)} goes to the BCCI.`;
    card.querySelector('.rc-spread').textContent = spreadLine(meta, p, r);
    const features = p.sim?.feature || [];
    whyBtn.hidden = !r;
    whyBtn.textContent = r?.type === 'unsold' ? 'Why no bids?' : 'Why this price?';
    const n = features.length;
    card.querySelector('[data-act="another"]').disabled = !(n > 1 || (n === 1 && s.featureIdx < 0));
    card.querySelector('[data-act="next"]').disabled = p.id + 1 >= ctx.players.length;
    retrigger(card, 'is-in');
  });
  card.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'why') { setWhy(why.hidden); return; }
    ({ replay: () => replay.replayLot(), another: () => replay.anotherRun(), next: () => replay.next() })[act]?.();
  });

  replay.on('phase', (phase) => {
    if (phase !== 'interstitial' && phase !== 'break') inter.hidden = true;
    paintHint();
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
