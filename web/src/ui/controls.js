// Transport controls under the stage, and the global keyboard shortcuts.
import { int } from '../format.js';
import { SPEEDS } from '../replay.js';

const ICON = {
  prev: '<path d="M6 5v10" /><path d="M15 5l-7 5 7 5z" class="fill"/>',
  play: '<path d="M6.5 4.5v11l9-5.5z" class="fill"/>',
  pause: '<path d="M6.5 4.5h2.4v11H6.5zM11.1 4.5h2.4v11h-2.4z" class="fill"/>',
  skip: '<path d="M4 5l6 5-6 5z" class="fill"/><path d="M10 5l6 5-6 5z" class="fill"/>',
  next: '<path d="M14 5v10" /><path d="M5 5l7 5-7 5z" class="fill"/>',
};
const svg = (name) => `<svg viewBox="0 0 20 20" aria-hidden="true">${ICON[name]}</svg>`;
const SPEED_LABEL = { 0.5: '<span class="sp-long">Slow</span><span class="sp-short">½×</span>', 1: '1×', 3: '3×' };
const SPEED_TITLE = { 0.5: 'Slow: half speed (0)', 1: 'Presentation speed (1)', 3: 'Fast: three times (3)' };
const SPEED_KEY = { 0: 0.5, 1: 1, 3: 3 };
const PHASE = {
  idle: 'Ready', loading: 'Loading', intro: 'On the block', open: 'Who wants him', interest: 'Who wants him', bidding: 'Bidding', going: 'Going…',
  sold: 'Sold', unsold: 'Unsold', interstitial: 'Accelerated round', break: 'Break before the accelerated round',
  never: 'Never called', notcalled: 'Not called in this run',
  end: 'End of the list', error: 'Data error',
};

export function mountControls(el, ctx) {
  const { replay, players } = ctx;
  el.innerHTML = `
    <div class="ctl-progress" aria-hidden="true"><i></i></div>
    <div class="ctl-group">
      <button class="ctl" type="button" data-act="prev" title="Previous lot (←)" aria-label="Previous lot">${svg('prev')}</button>
      <button class="ctl ctl-play" type="button" data-act="toggle" title="Play / pause (Space)" aria-label="Play">${svg('play')}</button>
      <button class="ctl" type="button" data-act="skip" title="Finish lot (S or →)" aria-label="Finish lot">${svg('skip')}</button>
      <button class="ctl" type="button" data-act="next" title="Next lot" aria-label="Next lot">${svg('next')}</button>
    </div>
    <div class="ctl-status" aria-live="off">
      <span class="ctl-lot mono"></span>
      <span class="ctl-phase"></span>
    </div>
    <div class="speed" role="group" aria-label="Playback speed">
      ${SPEEDS.map((sp) => `<button type="button" data-speed="${sp}" aria-pressed="${sp === replay.state.speed}" title="${SPEED_TITLE[sp]}">${SPEED_LABEL[sp]}</button>`).join('')}
    </div>`;
  const play = el.querySelector('.ctl-play');
  const lot = el.querySelector('.ctl-lot');
  const phase = el.querySelector('.ctl-phase');
  const bar = el.querySelector('.ctl-progress i');

  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.speed) { replay.setSpeed(Number(b.dataset.speed)); return; }
    ({ prev: () => replay.prev(), toggle: () => replay.toggle(), skip: () => replay.skip(), next: () => replay.next() })[b.dataset.act]?.();
  });

  const paintPlay = () => {
    const { playing, ended } = replay.state;
    play.innerHTML = svg(playing ? 'pause' : 'play');
    play.setAttribute('aria-label', playing ? 'Pause' : ended ? 'Continue the auction' : 'Play');
    play.title = playing ? 'Pause (Space)' : ended ? 'Continue the auction from the next lot (Space)' : 'Play (Space)';
    play.classList.toggle('is-playing', playing);
  };
  const paintLot = () => {
    const p = replay.state.player;
    if (!p) return;
    lot.innerHTML = `<span class="ctl-lot-k">Lot </span>${int(p.lot)} / ${int(players.length)}`;
    bar.style.transform = `scaleX(${((p.id + 1) / players.length).toFixed(4)})`;
  };
  const paintPhase = (ph) => {
    const s = replay.state;
    phase.textContent = ph === 'interstitial' ? 'Next: accelerated round' : ph === 'intro' && s.round ? `Accelerated round ${s.round}` : PHASE[ph] || '';
    phase.dataset.phase = ph;
  };
  replay.on('playing', paintPlay);
  replay.on('ended', paintPlay);
  replay.on('run', paintLot);
  replay.on('phase', paintPhase);
  replay.on('speed', (sp) => el.querySelectorAll('[data-speed]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === sp))));
  paintPlay();
}

export function bindKeys(ctx) {
  const { replay } = ctx;
  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return;
    const t = e.target;
    const typing = t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ctx.openPalette(); return; }
    if (e.key === 'Escape') { if (ctx.escape()) e.preventDefault(); return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); ctx.openPalette(); return; }
    if (ctx.modalOpen()) return;
    switch (e.key) {
      case ' ':
        if (t instanceof HTMLElement && t.closest('button, a, [role="button"]')) return; // native activation
        e.preventDefault();
        replay.toggle();
        break;
      case '0': case '1': case '3': replay.setSpeed(SPEED_KEY[e.key]); break;
      case 's': case 'S': case 'ArrowRight': e.preventDefault(); replay.skip(); break;
      case 'ArrowLeft': e.preventDefault(); replay.prev(); break;
      case 'n': case 'N': replay.anotherRun(); break;
      default: break;
    }
  });
}
