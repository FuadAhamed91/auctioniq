// The auctioneer's caption line under the big screen, in his cadence. Team codes only.
import { esc } from '../dom.js';
import { money, int, setName } from '../format.js';

/** { html, tone } for the current moment, or null when the auctioneer is silent. tone: plain | bid | sold */
export function captionModel(state, codes) {
  const p = state.player;
  if (!p) return null;
  switch (state.phase) {
    case 'intro':
    case 'open': {
      const set = setName(p.setCode);
      return { tone: 'plain', html: `Lot ${int(p.lot)} · Set <span class="mono">${esc(p.setCode)}</span>${set ? ` · ${set.kind}` : ''} — base <span class="mono">${money(state.app?.start ?? p.base)}</span>` };
    }
    case 'bidding': {
      const bids = state.ladder.filter((x) => x.type === 'bid');
      const last = bids[bids.length - 1];
      if (!last) return null;
      const price = `<b class="cap-bid mono">${money(last.price)}</b>`;
      const team = codes[last.team];
      if (bids.length === 1) return { tone: 'bid', html: `${price} with ${team}… any advance?` };
      if (last.entry) return { tone: 'bid', html: `${price} — new bidder, ${team}` };
      const rival = bids.findLast((x) => x.team !== last.team);
      return { tone: 'bid', html: `${price} with ${team}${rival ? `… against ${codes[rival.team]}` : ''}` };
    }
    case 'going':
      return { tone: 'plain', html: 'Fair warning… going once… going twice…' };
    case 'sold':
      return { tone: 'sold', html: `SOLD to ${codes[state.result.team]} · <span class="mono">${money(state.result.price)}</span>` };
    case 'unsold':
      return { tone: 'plain', html: 'UNSOLD' };
    default:
      return null;
  }
}
