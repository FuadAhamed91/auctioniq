// Playback state machine: player -> featured run -> appearances -> events, on a virtual clock.
import { UNSOLD } from './data.js';

// Durations in ms at 1×; 5× divides them, `min` keeps a real-time floor so results stay readable.
const T = {
  intro: 1700, ff: 1200, open: 240, openTail: 700, dropRun: 170, drop: 420,
  bidFirst: 950, bidMin: 170, bidDecay: 0.88,
  going: 1200, sold: 3200, unsold: 2400, skipHold: 1600, interstitial: 2100, brk: 1900, never: 2600,
};
const MIN = { going: 380, sold: 1300, unsold: 1000, interstitial: 1000, never: 1200 };
// Accelerated rounds are rapid-fire on the day: their lots run at this fraction of the normal pace.
const ACCEL = { steps: 0.5, hold: 0.7 };

export function createReplay({ meta, players, store }) {
  const codes = meta.teams.map((t) => t.code);
  const teamIndex = (code) => codes.indexOf(code);
  const listeners = new Map();
  const emit = (type, payload) => (listeners.get(type) || []).forEach((fn) => fn(payload));

  const state = {
    player: null, feature: null, featureIdx: 0, run: null,
    apps: [], appIdx: 0, app: null, logged: true, seq: 0, round: 0,
    econ: [], status: [], price: null, leader: -1, ladder: [], result: null,
    phase: 'idle', playing: false, speed: 1, error: null,
  };

  let queue = [], wait = 0, busy = false, token = 0, outcomes = null, last = performance.now();
  let lastRound = 0; // round of the last appearance shown: the break before round 1 plays once, on the way in

  const idleStatus = () => codes.map(() => ({ state: 'idle', chip: '' }));
  const startEcon = () => meta.teams.map((t) => ({ purse: t.purse, slots: t.slots, os: t.overseasSlots, size: t.squadSize, bought: [] }));
  state.econ = startEcon();
  state.status = idleStatus();

  function setPhase(phase) {
    if (state.phase === phase) return;
    state.phase = phase;
    emit('phase', phase);
  }
  function setPlaying(on) {
    if (state.playing === on) return;
    state.playing = on;
    emit('playing', on);
  }

  // ---- event application (shared by live playback and instant skip) ----
  function applyOpen([, code, chip], instant) {
    const t = teamIndex(code);
    if (t < 0) return;
    state.status[t] = { state: 'open', chip: chip || '' };
    state.ladder.push({ type: 'open', team: t, text: chip });
    if (state.phase === 'intro') setPhase('open');
    emit('step', { type: 'open', team: t, text: chip, instant });
  }
  function applyBid([, code, price], instant) {
    const t = teamIndex(code);
    if (t < 0) return;
    const prev = state.leader;
    // A team's first paddle after others have bid is a late entry ("new bidder").
    const entry = state.ladder.some((x) => x.type === 'bid') && !state.ladder.some((x) => x.type === 'bid' && x.team === t);
    if (prev >= 0 && prev !== t && state.status[prev].state === 'leading') state.status[prev] = { ...state.status[prev], state: 'open', entry: null };
    state.status[t] = { state: 'leading', chip: state.status[t].chip, entry: entry ? price : null };
    state.leader = t;
    state.price = price;
    state.ladder.push({ type: 'bid', team: t, price, entry });
    setPhase('bidding');
    emit('step', { type: 'bid', team: t, price, prev, entry, instant });
  }
  function applyDrop([, code, price, chip], instant) {
    const t = teamIndex(code);
    if (t < 0) return;
    state.status[t] = { state: 'out', chip: chip || '' };
    if (state.leader === t) state.leader = -1;
    state.ladder.push({ type: 'drop', team: t, price, text: chip });
    emit('step', { type: 'drop', team: t, price, text: chip, instant });
  }
  function applySold([, code, price], instant) {
    const t = teamIndex(code);
    if (t < 0) return;
    const e = state.econ[t];
    e.purse -= price;
    e.slots -= 1;
    e.size += 1;
    if (state.player.overseas) e.os -= 1;
    e.bought.push({ id: state.player.id, price, seq: state.seq, round: state.round });
    if (state.leader >= 0 && state.leader !== t) state.status[state.leader] = { ...state.status[state.leader], state: 'open' };
    state.status[t] = { state: 'won', chip: state.status[t].chip };
    state.leader = t;
    state.price = price;
    state.result = { type: 'sold', team: t, price };
    state.ladder.push({ type: 'sold', team: t, price });
    setPhase('sold');
    emit('step', { type: 'sold', team: t, price, instant });
    emit('econ', { animate: !instant, changed: t });
  }
  function applyUnsold([, reason], instant) {
    if (state.leader >= 0) state.status[state.leader] = { ...state.status[state.leader], state: 'open' };
    state.leader = -1;
    state.result = { type: 'unsold', reason: reason || null };
    state.ladder.push({ type: 'unsold', text: reason || null });
    setPhase('unsold');
    emit('step', { type: 'unsold', text: reason, instant });
  }

  function buildSteps(events, pace) {
    const steps = [];
    const k = pace.steps, h = pace.hold;
    let bids = 0;
    events.forEach((ev, i) => {
      const next = events[i + 1]?.[0];
      switch (ev[0]) {
        case 'open':
          steps.push({ dur: (next === 'open' ? T.open : T.openTail) * k, fn: (inst) => applyOpen(ev, inst) });
          break;
        case 'bid':
          steps.push({ dur: Math.max(T.bidMin * k, T.bidFirst * k * T.bidDecay ** bids++), fn: (inst) => applyBid(ev, inst) });
          break;
        case 'drop':
          steps.push({ dur: (next === 'drop' ? T.dropRun : T.drop) * k, fn: (inst) => applyDrop(ev, inst) });
          break;
        case 'sold':
          steps.push({ dur: T.going * h, min: MIN.going, fn: (inst) => { if (!inst) setPhase('going'); } });
          steps.push({ dur: T.sold * h, min: MIN.sold, final: true, fn: (inst) => applySold(ev, inst) });
          break;
        case 'unsold':
          steps.push({ dur: T.unsold * h, min: MIN.unsold, final: true, fn: (inst) => applyUnsold(ev, inst) });
          break;
        default:
          break;
      }
    });
    return steps;
  }

  // ---- lots ----
  function startApp(i, ffFrom, newPlayer, breakShown = false) {
    const app = state.apps[i];
    Object.assign(state, {
      appIdx: i, app, seq: app.seq, round: app.round,
      econ: outcomes.stateAt(state.run, app.seq), status: idleStatus(),
      price: null, leader: -1, ladder: [], result: null,
    });
    const count = Math.max(0, app.seq - ffFrom);
    const pace = app.round > 0 ? ACCEL : { steps: 1, hold: 1 };
    const brk = app.round > 0 && lastRound === 0 && !breakShown;
    lastRound = app.round;
    emit('lot', { newPlayer });
    if (count > 0) emit('ff', { count, run: state.run });
    emit('econ', { animate: true });
    const intro = (count > 0 ? Math.max(T.intro, T.ff + 500) : T.intro) * pace.steps;
    queue = buildSteps(app.events || [], pace);
    if (brk) {
      // the one-off break before the accelerated round: franchises hand in the names they want
      setPhase('break');
      emit('interstitial', { round: app.round, kind: 'break' });
      queue.unshift({ dur: intro, fn: () => setPhase('intro') });
      wait = T.brk;
    } else {
      setPhase('intro');
      wait = intro;
    }
  }

  function fromOutcome(run, seq, player) {
    const r = outcomes.rec(run, seq);
    const events = r.team === UNSOLD || !codes[r.team] ? [['unsold', null]] : [['sold', codes[r.team], r.price]];
    return { seq, round: r.round, start: player.base, teams: null, events };
  }

  /** No lot to play: never called in any run ('never'), or not called in this run ('notcalled'). */
  function showAbsent(phase, newPlayer, ffFrom = 0) {
    const end = phase === 'notcalled' ? outcomes.count[state.run] : 0;
    Object.assign(state, {
      apps: [], appIdx: 0, app: null, seq: end, round: 0, status: idleStatus(),
      econ: phase === 'notcalled' ? outcomes.stateAt(state.run, end) : startEcon(),
      price: null, leader: -1, ladder: [], result: null,
    });
    emit('lot', { newPlayer });
    if (end - ffFrom > 0) emit('ff', { count: end - ffFrom, run: state.run });
    emit('econ', { animate: true });
    setPhase(phase);
    queue = [];
    wait = Math.max(T.never, MIN.never * state.speed);
  }

  /** Play player `id` in his featured run `featureIdx`, or in any run via opts.run (deep links). */
  async function goTo(id, featureIdx = 0, opts = {}) {
    if (!players.length) return;
    id = Math.min(players.length - 1, Math.max(0, id));
    const my = ++token;
    queue = [];
    wait = 0;
    busy = true;
    if (opts.play !== undefined) setPlaying(opts.play);
    const player = players[id];
    const features = player.sim?.feature || [];
    let fi = features.length ? ((featureIdx % features.length) + features.length) % features.length : 0;
    let feature = features[fi] || null;
    if (Number.isInteger(opts.run) && opts.run >= 0 && opts.run < meta.runs) {
      fi = features.findIndex((f) => f.run === opts.run);
      feature = fi >= 0 ? features[fi] : { run: opts.run, tag: null };
    }
    const prev = { run: state.run, seq: state.seq, player: state.player };
    const newPlayer = prev.player !== player;
    Object.assign(state, { player, feature, featureIdx: fi, run: feature ? feature.run : null, error: null });
    emit('run', state);
    setPhase('loading');

    let log = null;
    try {
      [outcomes, log] = await Promise.all([store.outcomes(), feature ? store.lot(id).catch(() => null) : null]);
    } catch (err) {
      if (my !== token) return;
      state.error = err.message;
      busy = false;
      setPlaying(false);
      setPhase('error');
      emit('error', err);
      return;
    }
    if (my !== token) return;
    store.prefetch(id + 1);
    busy = false;

    if (!feature || !outcomes.has(feature.run)) { showAbsent('never', newPlayer); return; }
    // A logged run may be [] (never called in it); a run without a log falls back to outcomes.bin.
    let apps = log?.runs?.[feature.run];
    state.logged = Array.isArray(apps) && apps.length > 0;
    if (!Array.isArray(apps)) apps = outcomes.seqsOf(feature.run, id).map((seq) => fromOutcome(feature.run, seq, player));
    const sameRunFrom = (seq) => (prev.run === feature.run && prev.seq < seq ? prev.seq + 1 : 0);
    if (!apps.length) { showAbsent('notcalled', newPlayer, sameRunFrom(outcomes.count[feature.run])); return; }
    state.apps = [...apps].sort((a, b) => a.seq - b.seq);
    startApp(0, sameRunFrom(state.apps[0].seq), newPlayer);
  }

  function advance() {
    if (busy || state.phase === 'end' || state.phase === 'error' || !state.player) return;
    if (state.app && state.appIdx + 1 < state.apps.length) {
      const nextApp = state.apps[state.appIdx + 1];
      setPhase('interstitial');
      emit('interstitial', { round: nextApp.round, kind: 'return', brk: nextApp.round > 0 && lastRound === 0 });
      queue = [{ dur: 0, fn: () => startApp(state.appIdx + 1, state.app.seq + 1, false, true) }];
      wait = Math.max(T.interstitial, MIN.interstitial * state.speed);
      return;
    }
    if (state.player.id + 1 >= players.length) {
      setPlaying(false);
      setPhase('end');
      return;
    }
    goTo(state.player.id + 1, 0);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(64, now - last);
    last = now;
    if (!state.playing || busy) return;
    wait -= dt * state.speed;
    for (let guard = 0; wait <= 0 && guard < 400 && !busy; guard++) {
      const step = queue.shift();
      if (!step) { advance(); break; }
      step.fn(false);
      wait += Math.max(step.dur, (step.min || 0) * state.speed);
    }
  }
  requestAnimationFrame(frame);

  return {
    state,
    codes,
    on(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
      return () => listeners.get(type).delete(fn);
    },
    goTo,
    play() {
      if (state.phase === 'end') { goTo(0, 0, { play: true }); return; }
      setPlaying(true);
    },
    pause() { setPlaying(false); },
    toggle() { if (state.playing) setPlaying(false); else this.play(); },
    setSpeed(speed) {
      if (state.speed === speed) return;
      state.speed = speed;
      emit('speed', speed);
    },
    /** Finish the current lot instantly; if it is already finished, move on. */
    skip() {
      if (busy || state.phase === 'loading') return;
      if (queue.some((s) => s.final)) {
        while (queue.length) queue.shift().fn(true);
        wait = T.skipHold;
      } else if (queue.length) {
        queue.shift().fn(false);
      } else {
        wait = 0;
        advance();
      }
    },
    prev() { if (state.player) goTo(state.player.id - 1, 0); },
    next() { if (state.player) goTo(state.player.id + 1, 0); },
    anotherRun() {
      const n = state.player?.sim?.feature?.length || 0;
      if (n > 1 || (n === 1 && state.featureIdx < 0)) goTo(state.player.id, state.featureIdx + 1);
    },
  };
}
