// First-load overlay: what this is, two ways in, and the auction at a glance.
import { esc } from '../dom.js';
import { money, int, pct, date } from '../format.js';
import { logoHTML } from '../ui/logo.js';

function glance(meta, players) {
  const h = meta.highlights;
  if (!h) return '';
  const col = (title, unit, rows, fmt, hint) => {
    const items = (rows || []).filter(([id]) => players[id]).slice(0, 5);
    if (!items.length) return '';
    return `<div class="glance-col">
        <div class="glance-head"><span class="k">${title}</span><span class="glance-unit">${unit}</span></div>
        <ol class="glance-list">${items.map(([id, v]) => `
          <li><button type="button" data-player="${id}" title="${esc(hint(players[id], v))}">
            <span class="g-name">${esc(players[id].name)}</span><span class="g-val mono">${fmt(v)}</span>
          </button></li>`).join('')}</ol>
      </div>`;
  };
  // prices stay for the hammer: the big buys are named here, not priced
  const cols = [
    col('Most wanted', 'teams ready to bid', h.contested, (v) => v.toFixed(1), (p, v) => `${p.name}: on average ${v.toFixed(1)} teams are ready to pay at least his base price when he comes up`),
    col('Likely big buys', 'price at the hammer', h.priciest, () => '', (p) => `${p.name}: base ${money(p.base)}; watch his lot for the price`),
    col('Coin flips', 'P(sold)', h.coinFlips, pct, (p, v) => `${p.name}: sold in ${pct(v)} of ${int(meta.runs)} runs`),
  ].join('');
  return cols ? `<section class="glance" aria-label="Auction at a glance"><p class="glance-title">The auction at a glance · ${int(meta.runs)} runs</p><div class="glance-cols">${cols}</div></section>` : '';
}

export function mountIntro(root, ctx, { onStart, onPick, onPlayer }) {
  const { meta, players } = ctx;
  const slots = meta.teams.reduce((a, t) => a + t.slots, 0);
  const purse = meta.teams.reduce((a, t) => a + t.purse, 0);
  const el = document.createElement('div');
  el.className = 'intro';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'intro-title');
  el.innerHTML = `
    <div class="intro-card">
      ${logoHTML('logo-xl')}
      <h1 class="intro-title" id="intro-title">The ${esc(meta.title)}, simulated ${int(meta.runs)} times with only what was known on the morning of ${esc(date(meta.date))}.</h1>
      <p class="intro-facts mono">${int(players.length)} players<i class="dot" aria-hidden="true"> · </i>${meta.teams.length} franchises<i class="dot" aria-hidden="true"> · </i>${int(slots)} slots<i class="dot" aria-hidden="true"> · </i>${money(purse)} to spend</p>
      <div class="intro-actions">
        <button class="btn btn-primary" type="button" data-act="start">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.5 4.5v11l9-5.5z" class="fill"/></svg>Start the auction
        </button>
        <button class="btn btn-outline" type="button" data-act="pick">Pick a player<kbd>/</kbd></button>
      </div>
      ${glance(meta, players)}
      <p class="intro-foot">Unofficial — not affiliated with the IPL or BCCI.</p>
    </div>`;
  root.append(el);

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 450);
  }
  el.addEventListener('click', (e) => {
    const player = e.target.closest('[data-player]');
    if (player) { close(); onPlayer(Number(player.dataset.player)); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    close();
    if (act === 'start') onStart(); else onPick();
  });
  requestAnimationFrame(() => el.querySelector('[data-act="start"]').focus({ preventScroll: true }));
  return { close, get isOpen() { return !closed; } };
}
