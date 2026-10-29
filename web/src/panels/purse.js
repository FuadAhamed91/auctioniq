// Purse strip: every franchise's purse, slots and overseas slots in this run, coloured by lot state.
import { tweener, retrigger } from '../dom.js';
import { money, moneyParts, plural } from '../format.js';
import { teamDot, teamVars } from '../teams.js';

export function mountPurseStrip(el, ctx) {
  const { replay, meta, codes } = ctx;
  el.innerHTML = codes.map((code, i) => `
    <button class="pcell" type="button" data-team="${i}" data-state="idle" style="${teamVars(code)}" aria-label="${code}: open decision panel">
      <span class="pc-top"><span class="pc-code mono">${teamDot(code)}${code}</span><span class="pc-dot" aria-hidden="true"></span></span>
      <span class="pc-purse mono"></span>
      <span class="pc-bar" aria-hidden="true"><i></i></span>
      <span class="pc-meta mono"></span>
    </button>`).join('');

  const cells = [...el.querySelectorAll('.pcell')].map((node, i) => {
    const purseEl = node.querySelector('.pc-purse');
    const bar = node.querySelector('.pc-bar i');
    const metaEl = node.querySelector('.pc-meta');
    const full = meta.teams[i].purse || 1;
    const shown = tweener(meta.teams[i].purse, (v) => {
      const { num, unit } = moneyParts(Math.round(v));
      purseEl.innerHTML = `${num}<small>${unit}</small>`;
    });
    shown.set(meta.teams[i].purse);
    return { node, bar, metaEl, full, shown };
  });

  function paintEcon(animate, changed) {
    replay.state.econ.forEach((e, i) => {
      const c = cells[i];
      c.shown.to(e.purse, animate ? (i === changed ? 900 : 650) : 0);
      c.bar.style.transform = `scaleX(${Math.max(0, Math.min(1, e.purse / c.full)).toFixed(4)})`;
      c.metaEl.innerHTML = `${e.slots}<span class="pm-w"> slot${e.slots === 1 ? '' : 's'}</span> · ${e.os} OS`;
      c.node.title = `${codes[i]}: ${money(e.purse)} left · ${plural(e.slots, 'slot')} · ${plural(e.os, 'overseas slot')}`;
    });
  }

  function paintStatus() {
    replay.state.status.forEach((s, i) => {
      if (cells[i].node.dataset.state !== s.state) cells[i].node.dataset.state = s.state;
    });
  }

  el.addEventListener('click', (e) => {
    const btn = e.target.closest('.pcell');
    if (btn) ctx.openTeam(Number(btn.dataset.team));
  });

  replay.on('econ', ({ animate, changed }) => {
    paintEcon(animate, changed);
    if (changed != null) retrigger(cells[changed].node, 'is-flash', true);
  });
  replay.on('lot', paintStatus);
  replay.on('step', paintStatus);
  ctx.onSelectTeam((ti) => cells.forEach((c, i) => c.node.classList.toggle('is-selected', i === ti)));
  paintEcon(false);
}
