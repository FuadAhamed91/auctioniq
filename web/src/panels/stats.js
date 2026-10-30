// "Across 1,000 runs": P(sold), his median price with the spread of prices behind it, and who buys him.
// Sealed while his lot is live; when the hammer falls, this run is marked against them.
import { esc } from '../dom.js';
import { money, int, pct } from '../format.js';
import { teamDot, teamVars } from '../teams.js';
import { runLine } from '../analyst.js';

const W = 320, H = 132, PAD_T = 8, PAD_B = 22, PLOT_H = H - PAD_T - PAD_B;
const NICE = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000];

function binWidth(hist) {
  let w = Infinity;
  for (let i = 1; i < hist.length; i++) w = Math.min(w, hist[i][0] - hist[i - 1][0]);
  return Number.isFinite(w) && w > 0 ? w : 25;
}

/** x domain: the sold-price bins, stretched to show base and model value when they are near. */
function histScale(p) {
  const hist = p.sim.hist, w = binWidth(hist);
  let x0 = hist[0][0], x1 = hist[hist.length - 1][0] + w;
  const span = x1 - x0;
  for (const v of [p.base, p.value?.mid]) {
    if (v != null && v >= x0 - span * 0.75 && v <= x1 + span * 0.75) { x0 = Math.min(x0, v); x1 = Math.max(x1, v); }
  }
  const pad = (x1 - x0) * 0.04;
  x0 = Math.max(0, x0 - pad);
  x1 += pad;
  return { w, x0, x1, sx: (v) => ((Math.max(x0, Math.min(x1, v)) - x0) / (x1 - x0)) * W };
}

function histogram(p, runs) {
  const { hist, price } = p.sim;
  const { w, x0, x1, sx } = histScale(p);
  const max = Math.max(...hist.map(([, n]) => n));
  const bars = hist.map(([edge, n]) => {
    const x = sx(edge), bw = Math.max(1, sx(edge + w) - x - 1.5), h = (n / max) * PLOT_H;
    return `<rect class="hbar" x="${x.toFixed(1)}" y="${(PAD_T + PLOT_H - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="1"><title>${money(edge)}–${money(edge + w)}: ${int(n)} runs</title></rect>`;
  }).join('');
  const step = NICE.find((s) => (x1 - x0) / s <= 3.2) || 10000;
  const ticks = [];
  for (let v = Math.ceil(x0 / step) * step; v <= x1; v += step) ticks.push(v);
  const axis = ticks.map((v, i) => {
    const x = sx(v), anchor = i === 0 && x < 30 ? 'start' : x > W - 30 ? 'end' : 'middle';
    return `<line class="htick" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${PAD_T + PLOT_H}" y2="${PAD_T + PLOT_H + 4}"/><text class="hlabel" x="${x.toFixed(1)}" y="${H - 4}" text-anchor="${anchor}">${money(v)}</text>`;
  }).join('');
  const marker = (cls, v) => {
    if (v == null) return '';
    const off = v < x0 || v > x1, x = sx(v).toFixed(1);
    if (off) return `<path class="hm ${cls} off" d="M${v < x0 ? `6 ${PAD_T + 4} l-5 4 l5 4` : `${W - 6} ${PAD_T + 4} l5 4 l-5 4`}"/>`;
    return `<line class="hm ${cls}" x1="${x}" x2="${x}" y1="${PAD_T - 4}" y2="${PAD_T + PLOT_H}"/>`;
  };
  const midX = p.value?.mid != null && p.value.mid >= x0 && p.value.mid <= x1 ? sx(p.value.mid) : null;
  return `<svg class="hist-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Price if sold across ${int(runs)} runs: median ${money(price.median)}">
      ${bars}
      <line class="hbase-line" x1="0" x2="${W}" y1="${PAD_T + PLOT_H + 0.5}" y2="${PAD_T + PLOT_H + 0.5}"/>
      ${axis}
      ${marker('m-base', p.base)}
      ${marker('m-median', price.median)}
      ${midX != null ? `<path class="hm m-model" d="M${midX.toFixed(1)} ${PAD_T + PLOT_H - 5} l4.5 5 l-4.5 5 l-4.5 -5z"/>` : marker('m-model', p.value?.mid)}
      <g class="m-run" hidden><line class="hm" x1="0" x2="0" y1="${PAD_T - 6}" y2="${PAD_T + PLOT_H}"/><circle r="3" cx="0" cy="${PAD_T - 6}"/></g>
    </svg>`;
}

export function mountStats(el, ctx) {
  const { replay, meta } = ctx;
  let shown = null, open = false; // open: his numbers are on show (the hammer has fallen on him)
  let scale = null;

  function seal() {
    el.innerHTML = `
      <h3 class="panel-title stats-title">Across ${int(meta.runs)} runs</h3>
      <div class="sealed">
        <p class="sealed-head">Sealed until the hammer falls</p>
        <p class="sealed-sub">Watch this run first, then see where its price sits against all ${int(meta.runs)} runs.</p>
      </div>`;
    scale = null;
  }

  function render(p) {
    const s = p.sim || {};
    const runs = meta.runs;
    const price = s.price;
    const buyers = (s.buyers || []).slice(0, 5);
    const rest = (s.buyers || []).slice(5).reduce((a, [, x]) => a + x, 0);
    el.innerHTML = `
      <h3 class="panel-title stats-title">Across ${int(runs)} runs</h3>
      <div class="kpis">
        <div class="kpi">
          <span class="k">Sold</span>
          <span class="kpi-v mono">${pct(s.pSold)}</span>
          <span class="kpi-s">${s.pCalled != null && s.pCalled < 1 ? `called in ${pct(s.pCalled)} of runs` : ''}</span>
        </div>
        <div class="kpi">
          <span class="k">Median if sold</span>
          <span class="kpi-v mono">${price ? money(price.median) : '—'}</span>
          <span class="kpi-s">${price ? '' : 'never sold'}</span>
        </div>
      </div>
      <p class="run-vs" hidden></p>
      ${price && s.hist?.length ? `
        <figure class="hist">
          ${histogram(p, runs)}
          <figcaption class="legend">
            <span class="lg"><i class="sw sw-median"></i>Median</span>
            <span class="lg"><i class="sw sw-base"></i>Base</span>
            <span class="lg"><i class="sw sw-model"></i>Model value</span>
            <span class="lg lg-run" hidden><i class="sw sw-run"></i>This run</span>
          </figcaption>
        </figure>` : `<p class="empty-note">${s.pCalled ? `Unsold every time he was called (${pct(s.pCalled)} of runs).` : 'Never called in any simulated run.'}</p>`}
      ${buyers.length ? `
        <div class="buyers">
          <div class="sec-head"><span class="k">Who buys him</span></div>
          ${buyers.map(([code, share]) => `
            <div class="brow" data-code="${esc(code)}">
              <span class="mono bcode">${teamDot(code)}${esc(code)}</span>
              <span class="bbar" style="${teamVars(code)}"><i style="width:${(share * 100).toFixed(2)}%"></i></span>
              <span class="mono bval">${pct(share)}</span>
            </div>`).join('')}
          ${rest > 0 ? `<div class="brow brow-rest"><span class="mono bcode">Other</span><span class="bbar"><i style="width:${(rest * 100).toFixed(2)}%"></i></span><span class="mono bval">${pct(rest)}</span></div>` : ''}
        </div>` : ''}
      ${s.noNeeds ? `<p class="nn-line" title="The same player when teams bid on value alone (no role needs, matchups or home fit), from a separate set of runs.">
        Bidding on value alone: median <b class="mono">${s.noNeeds.median != null ? money(s.noNeeds.median) : 'never sold'}</b><i class="dot" aria-hidden="true"> · </i>P(sold) <b class="mono">${pct(s.noNeeds.pSold)}</b></p>` : ''}`;

    scale = price && s.hist?.length ? histScale(p).sx : null;
  }

  function showRun() {
    const st = replay.state;
    const runMark = el.querySelector('.m-run');
    const runLegend = el.querySelector('.lg-run');
    const vs = el.querySelector('.run-vs');
    el.querySelectorAll('.brow.is-run').forEach((b) => b.classList.remove('is-run'));
    if (vs) {
      vs.textContent = st.player ? runLine(st.player, st.result) : '';
      vs.hidden = !vs.textContent;
    }
    if (!runMark || !runLegend) return;
    const r = st.result;
    const sold = r?.type === 'sold' && !!scale;
    // an SVG element has no .hidden property, so the marker's attribute is toggled directly
    runMark.toggleAttribute('hidden', !sold);
    runLegend.hidden = !sold;
    if (sold) {
      runMark.setAttribute('transform', `translate(${scale(r.price).toFixed(1)} 0)`);
      el.querySelector(`.brow[data-code="${ctx.codes[r.team]}"]`)?.classList.add('is-run');
    }
  }

  function paint() {
    const p = replay.state.player;
    if (!p) return;
    if (p !== shown || replay.state.revealed !== open) {
      shown = p;
      open = replay.state.revealed;
      if (open) render(p); else seal();
    }
    showRun();
  }

  replay.on('lot', paint);
  replay.on('reveal', paint);
  replay.on('step', (step) => { if (step.type === 'sold' || step.type === 'unsold') showRun(); });
  seal();
}
