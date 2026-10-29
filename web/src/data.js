// Loads the engine export (docs/DATA_CONTRACT.md) and reconstructs auction state from outcomes.bin.

export const UNSOLD = 65535;
const dataUrl = (file) => new URL(`data/${file}`, document.baseURI).href;

async function fetchBuffer(file, onProgress) {
  const res = await fetch(dataUrl(file));
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  if (!onProgress || !res.body || !total) return res.arrayBuffer();
  const reader = res.body.getReader();
  const out = new Uint8Array(total);
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (got + value.length > out.length) return new Blob([out.subarray(0, got), value]).arrayBuffer(); // compressed size lied
    out.set(value, got);
    got += value.length;
    onProgress(got / total);
  }
  return out.buffer.slice(0, got);
}

async function fetchJSON(file, onProgress) {
  const buf = await fetchBuffer(file, onProgress);
  const text = new TextDecoder().decode(buf);
  if (/^\s*</.test(text)) throw new Error(`${file}: not found`); // dev-server HTML fallback
  return JSON.parse(text);
}

/** meta.json + players.json, with combined progress (players.json dominates). */
export async function loadCore(onProgress = () => {}) {
  const parts = [0, 0];
  const report = (i, w) => (p) => { parts[i] = p * w; onProgress(parts[0] + parts[1]); };
  const [meta, players] = await Promise.all([
    fetchJSON('meta.json', report(0, 0.1)),
    fetchJSON('players.json', report(1, 0.9)),
  ]);
  if (!Array.isArray(meta.teams) || meta.teams.length !== 10 || !Array.isArray(players)) {
    throw new Error('meta.json / players.json do not match the data contract');
  }
  onProgress(1);
  return { meta, players };
}

/** Decoded outcomes.bin: the sale order of every run. */
class Outcomes {
  constructor(buffer, meta, players) {
    const n = buffer.byteLength >> 1;
    const u = new Uint16Array(n);
    const dv = new DataView(buffer);
    for (let i = 0; i < n; i++) u[i] = dv.getUint16(i * 2, true);
    this.u = u;
    this.meta = meta;
    this.players = players;
    this.runs = u[0];
    this.start = new Uint32Array(this.runs);
    this.count = new Uint16Array(this.runs);
    let k = 2;
    for (let r = 0; r < this.runs; r++) {
      this.count[r] = u[k];
      this.start[r] = k + 1;
      k += 1 + u[k] * 4;
    }
    if (k !== n) throw new Error('outcomes.bin length does not match its run counts');
  }

  // Run numbers are 0-based indices into outcomes.bin (run 0 = first run stored).
  has(run) { return run >= 0 && run < this.runs; }

  rec(run, seq) {
    const k = this.start[run] + seq * 4, u = this.u;
    return { id: u[k], team: u[k + 1], price: u[k + 2], round: u[k + 3] };
  }

  /** Every seq at which player `id` was called in `run`. */
  seqsOf(run, id) {
    const out = [];
    if (!this.has(run)) return out;
    const base = this.start[run], u = this.u;
    for (let s = 0, c = this.count[run]; s < c; s++) if (u[base + s * 4] === id) out.push(s);
    return out;
  }

  /** Every team's purse / slots / overseas slots / buys just before record `seq` of `run`. */
  stateAt(run, seq) {
    const teams = this.meta.teams.map((t) => ({ purse: t.purse, slots: t.slots, os: t.overseasSlots, size: t.squadSize, bought: [] }));
    if (!this.has(run)) return teams;
    const base = this.start[run], u = this.u;
    for (let s = 0, end = Math.min(seq, this.count[run]); s < end; s++) {
      const k = base + s * 4, team = u[k + 1];
      if (team === UNSOLD || !teams[team]) continue;
      const id = u[k], price = u[k + 2], t = teams[team];
      t.purse -= price;
      t.slots -= 1;
      t.size += 1;
      if (this.players[id]?.overseas) t.os -= 1;
      t.bought.push({ id, price, seq: s, round: u[k + 3] });
    }
    return teams;
  }
}

/** Lazy access to outcomes.bin and lots/{id}.json, cached, with prefetch. */
export function createStore(meta, players) {
  let outcomes = null;
  const lots = new Map();
  return {
    outcomes() {
      outcomes ??= fetchBuffer('outcomes.bin').then((buf) => new Outcomes(buf, meta, players));
      return outcomes;
    },
    lot(id) {
      if (!lots.has(id)) {
        lots.set(id, fetchJSON(`lots/${id}.json`).catch((err) => { lots.delete(id); throw err; }));
      }
      return lots.get(id);
    },
    prefetch(id) {
      if (id >= 0 && id < players.length) this.lot(id).catch(() => {});
    },
  };
}
