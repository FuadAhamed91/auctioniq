// AuctionIQ boot: load the export, build the panels, start the replay, then upgrade the room to 3D.
import { loadCore, createStore } from './data.js';
import { createReplay } from './replay.js';
import { $, esc } from './dom.js';
import { date, int, money, runNo } from './format.js';
import { logoHTML } from './ui/logo.js';
import { mountPalette } from './ui/palette.js';
import { mountControls, bindKeys } from './ui/controls.js';
import { mountHud } from './ui/hud.js';
import { mountLotCard } from './panels/lotcard.js';
import { mountLadder } from './panels/ladder.js';
import { mountPurseStrip } from './panels/purse.js';
import { mountStats } from './panels/stats.js';
import { mountTeamPanel } from './panels/team.js';
import { mountAbout } from './panels/about.js';
import { mountIntro } from './panels/intro.js';
import { mountRoom2D } from './room/room2d.js';

function webgl2Available() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

function mountRoom(el, ctx) {
  let room = mountRoom2D(el, ctx);
  if (new URLSearchParams(location.search).has('2d') || !webgl2Available()) {
    el.classList.add('is-2d');
    return;
  }
  el.classList.add('is-loading-3d');
  const fallback = () => {
    el.classList.remove('is-3d', 'is-loading-3d');
    el.classList.add('is-2d');
    room.destroy();
    room = mountRoom2D(el, ctx);
  };
  import('./room/scene.js')
    .then(({ mountRoom3D }) => mountRoom3D(el, ctx, { onLost: fallback }))
    .then((room3d) => {
      const old = room;
      room = room3d;
      el.classList.remove('is-loading-3d');
      el.classList.add('is-3d');
      setTimeout(() => old.destroy(), 700);
    })
    .catch((err) => {
      el.classList.remove('is-loading-3d');
      el.classList.add('is-2d');
      console.info(`AuctionIQ: 3D room unavailable (${err.message}); showing the 2D room.`);
    });
}

async function boot() {
  const loader = $('#loader');
  const fill = $('#loader-fill');
  let core;
  try {
    core = await loadCore((p) => { fill.style.transform = `scaleX(${p.toFixed(3)})`; });
  } catch (err) {
    loader.classList.add('is-error');
    $('#loader-msg').textContent = `Could not load the auction data (${err.message}).`;
    return;
  }
  const { meta, players } = core;
  const store = createStore(meta, players);
  store.outcomes().catch(() => {}); // start the big download now; the replay awaits it
  const replay = createReplay({ meta, players, store });

  const roles = Object.fromEntries(meta.roles.map((r) => [r.key, r.label]));
  const bowlerTypes = Object.fromEntries(meta.bowlerTypes.map((b) => [b.key, b.label]));
  const selectListeners = new Set();
  let teamPanel, palette, about, intro;
  const layout = $('#layout');

  const ctx = {
    meta, players, replay, store, codes: replay.codes,
    roleLabel: (k) => roles[k] || k,
    tagLabel: (k) => meta.tags?.[k] || k,
    btLabel: (k) => bowlerTypes[k] || k,
    onSelectTeam(fn) { selectListeners.add(fn); return () => selectListeners.delete(fn); },
    emitSelectTeam(ti) { selectListeners.forEach((fn) => fn(ti)); },
    openTeam(ti) { teamPanel.open(ti); },
    /** A player picked from search, the intro or a link plays on his own and stops on his result. */
    selectPlayer(id) {
      teamPanel.close();
      replay.goTo(id, 0, { play: true, focus: true });
    },
    openPalette() { intro?.close(); about.close(); palette.open(); },
    modalOpen: () => !!(intro?.isOpen || palette.isOpen || about.isOpen),
    escape() {
      if (intro?.isOpen) { intro.close(); return true; }
      if (palette.isOpen) { palette.close(); return true; }
      if (about.isOpen) { about.close(); return true; }
      if (teamPanel.team != null) { teamPanel.close(); return true; }
      return false;
    },
  };

  // header & footer
  $('#brand').innerHTML = logoHTML();
  $('#event-line').innerHTML = [esc(meta.title), esc(date(meta.date)), esc(meta.city)].join('<i class="dot" aria-hidden="true"> · </i>');
  $('#foot-data').textContent = `Data to ${date(meta.asOf)}`;
  const runChip = $('#run-chip');
  const another = $('#another-run');
  replay.on('run', (s) => {
    runChip.innerHTML = s.run != null
      ? `<span class="mono">Run ${runNo(s.run)}</span><span class="muted mono">/${int(meta.runs)}</span>${s.feature?.tag ? `<i class="dot" aria-hidden="true"> · </i><span class="run-tag">${esc(s.feature.tag)}</span>` : ''}`
      : '<span class="muted">Not called in any run</span>';
    const n = s.player?.sim?.feature?.length || 0;
    another.disabled = !(n > 1 || (n === 1 && s.featureIdx < 0));
    another.title = another.disabled ? 'No other featured run for this player'
      : s.featureIdx < 0 ? 'Show his featured runs (N)' : `Show another run (N) · featured run ${s.featureIdx + 1} of ${n}`;
  });
  another.addEventListener('click', () => replay.anotherRun());
  $('#search-btn').addEventListener('click', () => ctx.openPalette());

  // panels
  const overlays = $('#overlays');
  teamPanel = mountTeamPanel($('#team-panel'), ctx);
  palette = mountPalette(overlays, ctx);
  about = mountAbout(overlays, ctx);
  $('#about-btn').addEventListener('click', () => about.open());
  mountLotCard($('#lot-card'), ctx);
  mountLadder($('#ladder'), ctx);
  mountStats($('#stats'), ctx);
  mountPurseStrip($('#purse-strip'), ctx);
  mountControls($('#controls'), ctx);
  mountHud($('#stage-hud'), ctx);
  mountRoom($('#room'), ctx);
  bindKeys(ctx);

  // mobile tabs
  $('#tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    layout.dataset.tab = b.dataset.tab;
    $('#tabs').querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  });

  // screen-reader announcements for results
  const announcer = $('#announcer');
  replay.on('step', (step) => {
    const p = replay.state.player;
    if (step.instant || !p) return;
    if (step.type === 'sold') announcer.textContent = `${p.name} sold to ${ctx.codes[step.team]} for ${money(step.price)}.`;
    if (step.type === 'unsold') announcer.textContent = `${p.name} unsold.`;
  });

  // deep links: #p=<player id>&r=<0-based run>, kept in sync with whatever is on screen
  const parseLink = () => {
    const q = new URLSearchParams(location.hash.slice(1));
    const p = Number(q.get('p')), r = q.has('r') ? Number(q.get('r')) : NaN;
    if (!q.has('p') || !Number.isInteger(p) || p < 0 || p >= players.length) return null;
    return { p, run: Number.isInteger(r) && r >= 0 && r < meta.runs ? r : undefined };
  };
  replay.on('run', (s) => {
    if (!s.player) return;
    const hash = `#p=${s.player.id}${s.run != null ? `&r=${s.run}` : ''}`;
    if (location.hash !== hash) history.replaceState(null, '', hash);
  });
  window.addEventListener('hashchange', () => {
    const link = parseLink();
    const s = replay.state;
    if (!link || (s.player?.id === link.p && (link.run === undefined || s.run === link.run))) return;
    intro?.close();
    palette.close();
    teamPanel.close();
    replay.goTo(link.p, 0, { run: link.run, play: true, focus: true });
  });

  // hand over from the loader: straight to a linked lot, otherwise the intro over lot 1
  $('#app').removeAttribute('aria-hidden');
  loader.classList.add('is-done');
  setTimeout(() => loader.remove(), 600);
  const link = parseLink();
  if (link) {
    replay.goTo(link.p, 0, { run: link.run, play: true, focus: true });
    return;
  }
  replay.goTo(0, 0, { play: false });
  intro = mountIntro(overlays, ctx, {
    onStart: () => replay.startAuction(),
    onPick: () => palette.open(),
    onPlayer: (id) => ctx.selectPlayer(id),
  });
}

boot();
