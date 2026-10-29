// Bid ladder: the last few events, newest on top. The teams that opened share one line, drop-outs are one
// muted line each, and the sale stands out in red (with the overseas fee split when the cap bites).
import { esc } from '../dom.js';
import { money, feeSplit } from '../format.js';
import { teamDot } from '../teams.js';

const KEEP = 8; // rows on show; the oldest fade out at the bottom

export function mountLadder(el, ctx) {
  const { replay, codes, meta } = ctx;
  el.innerHTML = `
    <h3 class="panel-title ladder-title">Bids</h3>
    <ol class="ladder-list" aria-live="off"></ol>
    <p class="ladder-empty">Waiting for the auctioneer…</p>`;
  const list = el.querySelector('.ladder-list');
  const empty = el.querySelector('.ladder-empty');
  let interest = null, opened = [], lastBid = null;

  const code = (t) => (t != null && t >= 0 ? codes[t] : '');
  const team = (t) => `<span class="lcode mono">${teamDot(code(t))}${code(t)}</span>`;
  const lower = (text) => (text ? text[0].toLowerCase() + text.slice(1) : '');

  function add(cls, html, step) {
    const li = document.createElement('li');
    li.className = `lrow ${cls}${step.instant ? ' no-anim' : ''}`;
    li.innerHTML = html;
    list.prepend(li);
    while (list.children.length > KEEP) list.lastElementChild.remove();
    empty.hidden = true;
    return li;
  }

  function reset(text) {
    list.replaceChildren();
    interest = null;
    opened = [];
    lastBid = null;
    empty.hidden = false;
    empty.textContent = text;
  }

  replay.on('lot', () => {
    reset(replay.state.logged ? 'Waiting for the auctioneer…' : 'No bid-by-bid log was exported for this run; showing the outcome only.');
  });
  replay.on('phase', (phase) => {
    if (phase === 'never') reset('Not called in any of the simulated runs.');
    if (phase === 'notcalled') reset('Not called in this run — no team nominated him. Purses show the end of the run.');
  });
  replay.on('step', (step) => {
    switch (step.type) {
      case 'open': {
        opened.push(code(step.team));
        const html = `<span class="ltext">${opened.length} team${opened.length === 1 ? '' : 's'} interested: ${opened.join(', ')}</span>`;
        if (interest?.isConnected) interest.innerHTML = html;
        else interest = add('lrow-open', html, step);
        break;
      }
      case 'bid':
        lastBid?.classList.remove('is-current');
        lastBid = add('lrow-bid is-current', `${team(step.team)}<span class="ltext">${step.entry ? 'enters' : ''}</span><span class="lprice mono">${money(step.price)}</span>`, step);
        break;
      case 'drop':
        add('lrow-drop', `<span class="ltext">${code(step.team)} out · ${esc(lower(step.text))}</span>`, step);
        break;
      case 'sold': {
        lastBid?.classList.remove('is-current');
        const split = feeSplit(replay.state.player, step.price, meta.rules?.overseasFeeCap);
        add('lrow-sold', `${team(step.team)}<span class="ltext">Sold</span><span class="lprice mono">${money(step.price)}</span>${split
          ? `<span class="lsplit">Overseas cap: he keeps <span class="mono">${money(split.keeps)}</span>, <span class="mono">${money(split.bcci)}</span> goes to the BCCI</span>` : ''}`, step);
        break;
      }
      case 'unsold':
        add('lrow-unsold', `<span class="ltext">Unsold${step.text ? ` · ${esc(lower(step.text))}` : ''}</span>`, step);
        break;
      default:
    }
  });
}
