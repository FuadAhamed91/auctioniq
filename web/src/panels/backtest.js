// 2024 back-test calibration chart: simulated median (x) vs real price (y), log scales.
import { esc } from '../dom.js';
import { money, pct, int } from '../format.js';

const STEPS = [10, 30, 100, 300, 1000, 3000, 10000, 30000];

export function mountCalibration(fig, points) {
  const sold = points.filter((p) => p.sold && p.price > 0 && p.median > 0);
  const unsold = points.filter((p) => !p.sold && p.median > 0);
  const unplaced = points.filter((p) => !p.sold && !(p.median > 0)).length;
  fig.innerHTML = `<div class="cal-plot"></div><div class="cal-tip" hidden></div>
    <figcaption class="cal-legend">
      <span><i class="cal-dot"></i>real 2024 price</span>
      <span><i class="cal-diag"></i>simulated = real</span>
      ${unsold.length ? `<span><i class="cal-rug"></i>unsold in 2024 (${int(unsold.length)}), at simulated median${unplaced ? `; ${int(unplaced)} never sold in the simulation either` : ''}</span>` : ''}
    </figcaption>`;
  const plot = fig.querySelector('.cal-plot');
  const tip = fig.querySelector('.cal-tip');
  let marks = [], hot = null;

  function draw() {
    const W = Math.round(plot.clientWidth);
    if (!W || !sold.length) return;
    const H = Math.round(Math.min(400, Math.max(250, W * 0.7)));
    const m = { l: 62, r: 14, t: 12, b: unsold.length ? 58 : 34 };
    const vals = [...sold.flatMap((p) => [p.price, p.median]), ...unsold.map((p) => p.median)].filter((v) => v > 0);
    const lo = Math.min(...vals) * 0.8, hi = Math.max(...vals) * 1.2;
    const t = (v) => (Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
    const X = (v) => m.l + t(v) * (W - m.l - m.r);
    const Y = (v) => H - m.b - t(v) * (H - m.t - m.b);
    // decades always; the 3× steps in between only when a decade is wide enough to hold them
    const decade = ((W - m.l - m.r) * Math.log(10)) / (Math.log(hi) - Math.log(lo));
    const ticks = STEPS.filter((v) => v >= lo && v <= hi && (/^1/.test(String(v)) || (decade >= 170 && /^3/.test(String(v)))));
    const baseY = H - m.b;
    const grid = ticks.map((v) => `
      <line class="cal-grid" x1="${X(v).toFixed(1)}" x2="${X(v).toFixed(1)}" y1="${m.t}" y2="${baseY}"/>
      <line class="cal-grid" x1="${m.l}" x2="${W - m.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/>
      <text class="cal-label" x="${X(v).toFixed(1)}" y="${baseY + 16}" text-anchor="middle">${money(v)}</text>
      <text class="cal-label" x="${m.l - 8}" y="${(Y(v) + 3.5).toFixed(1)}" text-anchor="end">${money(v)}</text>`).join('');
    marks = [];
    const dots = sold.map((p) => {
      const x = X(p.median), y = Y(p.price);
      marks.push({ p, x, y });
      return `<circle class="cal-pt" data-i="${marks.length - 1}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6"/>`;
    }).join('');
    const rugY = baseY + 30;
    const rug = unsold.map((p) => {
      const x = X(p.median);
      marks.push({ p, x, y: rugY + 5 });
      return `<line class="cal-rug-tick" data-i="${marks.length - 1}" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${rugY}" y2="${rugY + 10}"/>`;
    }).join('');
    plot.innerHTML = `<svg class="cal-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img"
        aria-label="Back-test: simulated median price against the real 2024 price for ${int(sold.length)} sold players, log scales">
      ${grid}
      <line class="cal-axis" x1="${m.l}" x2="${W - m.r}" y1="${baseY}" y2="${baseY}"/>
      <line class="cal-diag-line" x1="${X(lo)}" y1="${Y(lo)}" x2="${X(hi)}" y2="${Y(hi)}"/>
      <text class="cal-title" x="${m.l + 6}" y="${m.t + 12}">Real 2024 price ↑</text>
      <text class="cal-title" x="${W - m.r}" y="${baseY - 8}" text-anchor="end">Simulated median →</text>
      ${dots}
      ${unsold.length ? `<text class="cal-label" x="${m.l - 8}" y="${rugY + 9}" text-anchor="end">Unsold</text>${rug}` : ''}
    </svg>`;
  }

  function showTip(i) {
    plot.querySelectorAll('.is-hot').forEach((n) => n.classList.remove('is-hot'));
    if (i == null) { tip.hidden = true; hot = null; return; }
    hot = i;
    const { p, x, y } = marks[i];
    plot.querySelector(`[data-i="${i}"]`)?.classList.add('is-hot');
    tip.innerHTML = `<b>${esc(p.name)}</b>
      <span>${p.sold ? `Real price <span class="mono">${money(p.price)}</span>` : 'Unsold in 2024'}</span>
      <span>Simulated median <span class="mono">${money(p.median)}</span></span>
      <span>P(sold) <span class="mono">${pct(p.pSold)}</span></span>`;
    tip.hidden = false;
    const w = plot.clientWidth, left = Math.min(Math.max(8, x + 14), w - tip.offsetWidth - 8);
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(4, y - tip.offsetHeight - 12)}px`;
  }

  plot.addEventListener('pointermove', (e) => {
    const r = plot.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    let best = null, bd = 16 * 16;
    marks.forEach((mk, i) => { const d = (mk.x - px) ** 2 + (mk.y - py) ** 2; if (d < bd) { bd = d; best = i; } });
    if (best !== hot) showTip(best);
  });
  plot.addEventListener('pointerleave', () => showTip(null));

  const ro = new ResizeObserver(() => { showTip(null); draw(); });
  ro.observe(plot);
  draw();
}
