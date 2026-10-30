// Command palette: find any player by name, country or role and fast-forward to his lot.
import { esc } from '../dom.js';
import { money, int } from '../format.js';

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function mountPalette(root, ctx) {
  const { players, replay } = ctx;
  const index = players.map((p) => ({
    p,
    name: norm(p.name),
    hay: norm([p.name, p.country, ctx.roleLabel(p.role), p.role2 ? ctx.roleLabel(p.role2) : '', p.setCode,
      ...(p.tags || []).map((t) => ctx.tagLabel(t))].join(' ')),
  }));

  const wrap = document.createElement('div');
  wrap.className = 'palette-wrap';
  wrap.hidden = true;
  wrap.innerHTML = `
    <div class="palette-scrim" data-close></div>
    <div class="palette" role="dialog" aria-modal="true" aria-label="Search players">
      <div class="pal-input-row">
        <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.75"/><path d="M13 13l4.25 4.25"/></svg>
        <input class="pal-input" type="text" placeholder="Search by name, country or role" autocomplete="off" spellcheck="false"
          role="combobox" aria-expanded="true" aria-controls="pal-list" aria-autocomplete="list" />
        <kbd>Esc</kbd>
      </div>
      <div class="pal-cols" aria-hidden="true"><span>Lot</span><span>Player</span><span>Role</span><span class="r">Base</span><span class="r">Last IPL</span></div>
      <ul class="pal-list" id="pal-list" role="listbox" aria-label="Players"></ul>
      <div class="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> choose</span><span><kbd>Enter</kbd> fast-forward to his lot</span><span class="pal-count mono"></span></div>
    </div>`;
  root.append(wrap);
  const input = wrap.querySelector('.pal-input');
  const list = wrap.querySelector('.pal-list');
  const count = wrap.querySelector('.pal-count');
  let results = [], active = 0, lastFocus = null;

  function search(q) {
    const tokens = norm(q).split(/\s+/).filter(Boolean);
    if (!tokens.length) return index.map((x) => x.p);
    const hits = [];
    for (const x of index) {
      if (!tokens.every((t) => x.hay.includes(t))) continue;
      const first = tokens[0];
      const score = x.name.startsWith(first) ? 0 : x.name.split(/\s+/).some((w) => w.startsWith(first)) ? 1 : x.name.includes(first) ? 2 : 3;
      hits.push([score, x.p]);
    }
    return hits.sort((a, b) => a[0] - b[0] || a[1].id - b[1].id).map(([, p]) => p);
  }

  function highlight(name, q) {
    const t = norm(q).split(/\s+/).filter(Boolean)[0];
    const i = t ? norm(name).indexOf(t) : -1;
    if (i < 0) return esc(name);
    return `${esc(name.slice(0, i))}<mark>${esc(name.slice(i, i + t.length))}</mark>${esc(name.slice(i + t.length))}`;
  }

  function render() {
    const q = input.value;
    results = search(q);
    active = Math.min(active, Math.max(0, results.length - 1));
    list.innerHTML = results.length ? results.map((p, i) => `
      <li class="pal-row${i === active ? ' is-active' : ''}${replay.state.player === p ? ' is-current' : ''}" role="option" id="pal-opt-${p.id}" data-id="${p.id}" aria-selected="${i === active}">
        <span class="mono pr-lot">${int(p.lot)}</span>
        <span class="pr-name"><span class="pr-n">${highlight(p.name, q)}</span><span class="pr-country">${esc(p.country)}</span></span>
        <span class="pr-role">${esc(ctx.roleLabel(p.role))}</span>
        <span class="mono r">${money(p.base)}</span>
        <span class="mono r">${p.prev ? money(p.prev.price) : '—'}</span>
      </li>`).join('') : `<li class="pal-empty">No player matches “${esc(q)}”.</li>`;
    count.textContent = `${int(results.length)} of ${int(players.length)}`;
    sync();
  }

  function sync(scroll = true) {
    list.querySelectorAll('.pal-row.is-active').forEach((r) => { r.classList.remove('is-active'); r.setAttribute('aria-selected', 'false'); });
    const row = results[active] && list.querySelector(`#pal-opt-${results[active].id}`);
    if (!row) { input.removeAttribute('aria-activedescendant'); return; }
    row.classList.add('is-active');
    row.setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', row.id);
    if (scroll) row.scrollIntoView({ block: 'nearest' });
  }

  function choose(i) {
    const p = results[i];
    if (!p) return;
    close();
    ctx.selectPlayer(p.id);
  }

  function open() {
    if (!wrap.hidden) { input.select(); return; }
    lastFocus = document.activeElement;
    wrap.hidden = false;
    input.value = '';
    const cur = replay.state.player;
    active = cur ? cur.id : 0;
    render();
    requestAnimationFrame(() => { wrap.classList.add('is-open'); input.focus(); sync(); });
  }
  function close() {
    if (wrap.hidden) return;
    wrap.classList.remove('is-open');
    wrap.hidden = true;
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }

  input.addEventListener('input', () => { active = 0; render(); list.scrollTop = 0; });
  input.addEventListener('keydown', (e) => {
    const move = { ArrowDown: 1, ArrowUp: -1, PageDown: 8, PageUp: -8 }[e.key];
    if (move) {
      e.preventDefault();
      if (!results.length) return;
      active = Math.abs(move) === 1 ? (active + move + results.length) % results.length : Math.max(0, Math.min(results.length - 1, active + move));
      sync();
    } else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  });
  list.addEventListener('mousemove', (e) => {
    const row = e.target.closest('.pal-row');
    if (!row) return;
    const i = results.findIndex((p) => p.id === Number(row.dataset.id));
    if (i >= 0 && i !== active) { active = i; sync(false); }
  });
  list.addEventListener('click', (e) => {
    const row = e.target.closest('.pal-row');
    if (row) choose(results.findIndex((p) => p.id === Number(row.dataset.id)));
  });
  wrap.addEventListener('click', (e) => { if (e.target.matches('[data-close]')) close(); });

  return { open, close, get isOpen() { return !wrap.hidden; } };
}
