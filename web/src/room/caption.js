// The auctioneer's caption under the big screen: only what he says — the lot, each bid, going once, and
// the hammer. The reasons live with each table's analyst. Team codes only.
import { esc } from '../dom.js';
import { money, int, setName } from '../format.js';

const price = (lakhs, cls = 'mono') => `<span class="${cls}">${money(lakhs)}</span>`;

/** { html, tone } for the current moment, or null when the auctioneer is silent. tone: plain | bid | sold */
export function captionModel(state, codes) {
  const p = state.player;
  if (!p) return null;
  switch (state.phase) {
    case 'intro':
    case 'open':
    case 'interest': {
      const set = setName(p.setCode);
      const where = state.round ? `Accelerated round ${int(state.round)}` : `Lot ${int(p.lot)}`;
      const kind = !state.round && set ? `<span class="cap-kind"> · ${esc(set.kind)}</span>` : ''; // dropped on a phone
      return { tone: 'plain', html: `${where} · <b>${esc(p.name)}</b>${kind} · base ${price(state.app?.start ?? p.base)}` };
    }
    case 'bidding': {
      const last = state.ladder.findLast((x) => x.type === 'bid');
      return last ? { tone: 'bid', html: `${price(last.price, 'cap-bid mono')} — ${codes[last.team]}` } : null;
    }
    case 'going':
      return { tone: 'bid', html: `${price(state.price, 'cap-bid mono')} — ${codes[state.leader] || '—'}… going once… going twice…` };
    case 'sold':
      return { tone: 'sold', html: `SOLD to ${codes[state.result.team]} · ${price(state.result.price)}` };
    case 'unsold':
      return { tone: 'plain', html: '<b>UNSOLD</b>' };
    default:
      return null;
  }
}
