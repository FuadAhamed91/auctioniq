// 2D room: a CSS ring of ten tables around the big screen, driven by the same replay events as 3D.
import { tweener, retrigger } from '../dom.js';
import { moneyParts } from '../format.js';
import { screenModel, screenHTML, leadLine } from './screen.js';
import { captionModel } from './caption.js';
import { teamDot, teamVars } from '../teams.js';

const GAVEL = '<svg viewBox="0 0 48 48" aria-hidden="true"><g class="r2-gavel-head"><rect x="13" y="7" width="22" height="11" rx="3" transform="rotate(-35 24 12)"/><path d="M27 17l12 15" /></g><rect x="8" y="38" width="24" height="5" rx="2" class="r2-gavel-block"/></svg>';

export function mountRoom2D(el, ctx) {
  const { replay, codes } = ctx;
  const root = document.createElement('div');
  root.className = 'room2d';
  root.innerHTML = `
    <div class="r2-glow" aria-hidden="true"></div>
    <div class="r2-screen"><div class="r2-card"></div><div class="caption caption-2d" aria-hidden="true"></div></div>
    <div class="r2-gavel">${GAVEL}</div>
    ${codes.map((c, i) => `
      <button class="r2-table" type="button" data-team="${i}" data-state="idle" style="${teamVars(c)}" aria-label="${c}: hear its analyst" title="${c} · hear its analyst">
        <span class="r2-paddle" aria-hidden="true"><i></i></span>
        <span class="r2-desk"><span class="r2-lamp" aria-hidden="true"></span><span class="r2-code mono">${teamDot(c)}${c}</span></span>
      </button>`).join('')}`;
  el.append(root);
  const screenBox = root.querySelector('.r2-screen');
  const screen = root.querySelector('.r2-card');
  const caption = root.querySelector('.caption');
  const gavel = root.querySelector('.r2-gavel');
  const tables = [...root.querySelectorAll('.r2-table')];
  let shownKey = '';

  function layout() {
    const w = root.clientWidth, h = root.clientHeight;
    if (!w || !h) return;
    const narrow = w < 560;
    const cx = w / 2, cy = h * (narrow ? 0.40 : 0.38);
    const rx = w * (narrow ? 0.40 : 0.40), ry = h * (narrow ? 0.44 : 0.47);
    const a0 = (narrow ? 160 : 166) * (Math.PI / 180), a1 = (narrow ? 380 : 374) * (Math.PI / 180);
    tables.forEach((t, i) => {
      const a = a0 + ((a1 - a0) * i) / (tables.length - 1);
      t.style.left = `${(cx + rx * Math.cos(a)).toFixed(1)}px`;
      t.style.top = `${(cy - ry * Math.sin(a)).toFixed(1)}px`;
    });
    screenBox.style.left = `${cx}px`;
    screenBox.style.top = `${cy - h * 0.04}px`;
    gavel.style.left = `${cx + Math.min(w * 0.27, 250)}px`;
    gavel.style.top = `${cy - h * 0.2}px`;
  }
  const ro = new ResizeObserver(layout);
  ro.observe(root);

  const price = tweener(0, (v) => {
    const node = screen.querySelector('.scr-price.is-bid span');
    if (node) node.textContent = moneyParts(Math.round(v / 5) * 5).num; // roll through real-looking amounts
  });

  function paintScreen(animatePrice) {
    const m = screenModel(replay.state, ctx);
    // re-render only when the screen changes mode; during bidding the price and leader update in place
    const key = [m.mode, m.name, m.open, m.note, m.sub, m.reason, m.split, m.corner, m.median].join('|');
    if (key !== shownKey) {
      shownKey = key;
      screen.innerHTML = screenHTML(m, m.mode === 'bid' ? price.value || m.price : m.price);
      screen.dataset.mode = m.mode;
    }
    if (m.mode === 'bid' && m.price != null) {
      const unit = screen.querySelector('.scr-price.is-bid small');
      if (unit) unit.textContent = moneyParts(m.price).unit;
      const lead = screen.querySelector('.scr-lead');
      if (lead) lead.innerHTML = leadLine(m);
      if (animatePrice && price.value) price.to(m.price, 240); else price.set(m.price);
    }
    const cap = captionModel(replay.state, codes);
    caption.innerHTML = cap?.html || '';
    caption.dataset.tone = cap?.tone || 'plain';
    caption.classList.toggle('is-on', !!cap);
  }

  function paintTables() {
    replay.state.status.forEach((st, i) => { tables[i].dataset.state = st.state; });
  }

  const offs = [
    replay.on('lot', () => { price.set(0); shownKey = ''; paintTables(); paintScreen(false); }),
    replay.on('phase', () => paintScreen(false)),
    replay.on('step', (step) => {
      paintTables();
      paintScreen(!step.instant);
      if (step.type === 'sold' && !step.instant) {
        retrigger(gavel, 'is-striking', true);
        retrigger(tables[step.team], 'is-flash', true);
      }
    }),
  ];
  const offSelect = ctx.onSelectTeam((ti) => tables.forEach((t, i) => t.classList.toggle('is-selected', i === ti)));
  root.addEventListener('click', (e) => {
    const t = e.target.closest('.r2-table');
    if (t) ctx.openTeam(Number(t.dataset.team));
  });

  layout();
  paintTables();
  paintScreen(false);

  return {
    destroy() {
      offs.forEach((off) => off());
      offSelect();
      ro.disconnect();
      root.remove();
    },
  };
}
