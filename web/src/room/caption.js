// The auctioneer's caption under the big screen: one short, plain sentence for every moment of a lot —
// who is interested and why, who is bidding, why each team quits, and the result. Team codes only.
import { esc } from '../dom.js';
import { money, int, setName } from '../format.js';

const an = (word) => (/^[aeiou]/i.test(word) ? 'an' : 'a');
const price = (lakhs, cls = 'mono') => `<span class="${cls}">${money(lakhs)}</span>`;

/** A gate-open chip ("Need · wrist spinner", "Upgrade · finisher", "Filling the squad") as a reason. */
function reasonOf(chip) {
  const [kind, what] = String(chip || '').split(' · ');
  if (/^need/i.test(kind) && what) return { key: `need ${what}`, one: `they need ${an(what)} ${what}`, many: (n) => `${n} need ${an(what)} ${what}` };
  if (/^upgrade/i.test(kind) && what) return { key: `upgrade ${what}`, one: `he would be an upgrade at ${what}`, many: (n) => `${n} see him as an upgrade at ${what}` };
  if (/^filling/i.test(kind)) return { key: 'fill', one: 'they still have squad places to fill', many: (n) => `${n} still have squad places to fill` };
  return { key: chip || '', one: esc(chip || 'they have room for him'), many: (n) => `${n} for other reasons` };
}

/** "6 teams want him — 4 need a wrist spinner", from the gates that opened. */
function interest(opens, codes) {
  if (!opens.length) return 'No team wants him at his base price.';
  if (opens.length === 1) return `Only ${codes[opens[0].team]} want him — ${reasonOf(opens[0].text).one}.`;
  const groups = new Map();
  for (const o of opens) {
    const r = reasonOf(o.text);
    const g = groups.get(r.key) || { r, n: 0 };
    g.n += 1;
    groups.set(r.key, g);
  }
  const top = [...groups.values()].sort((a, b) => b.n - a.n)[0];
  const who = top.n === opens.length ? (opens.length === 2 ? 'both' : 'all') : int(top.n);
  return `${int(opens.length)} teams want him — ${top.r.many(who)}.`;
}

/** Why a team pulled out, from its drop chip ("Walk-away ₹7.10 Cr", "Values him at ₹1.05 Cr", "Purse limit ₹9.00 Cr"). */
function dropLine(entry, codes) {
  const team = codes[entry.team];
  const amount = /₹[\d.]+\s*(?:L|Cr)/.exec(entry.text || '')?.[0];
  const at = amount ? `<span class="mono">${amount}</span>` : '';
  if (/^walk-away/i.test(entry.text || '') && at) return `${team} drop out — their limit was ${at}.`;
  if (/^values him/i.test(entry.text || '') && at) return `${team} pass — they value him at only ${at}.`;
  if (/^purse/i.test(entry.text || '') && at) return `${team} drop out — their purse stops at ${at}.`;
  return `${team} drop out.`;
}

function bidLine(bids, codes) {
  const last = bids[bids.length - 1];
  const team = codes[last.team];
  const amount = price(last.price, 'cap-bid mono');
  if (bids.length === 1) return `${amount} with ${team}… any advance?`;
  if (last.entry) return `${amount} — ${team} join the bidding.`;
  const rival = bids.findLast((x) => x.team !== last.team);
  return `${amount} with ${team}${rival ? `… against ${codes[rival.team]}` : ''}`;
}

/** { html, tone } for the current moment, or null when the auctioneer is silent. tone: plain | bid | sold */
export function captionModel(state, codes) {
  const p = state.player;
  if (!p) return null;
  const lastEntry = state.ladder[state.ladder.length - 1];
  switch (state.phase) {
    case 'intro': {
      const set = setName(p.setCode);
      const where = state.round ? `Accelerated round ${int(state.round)}` : `Lot ${int(p.lot)}`;
      const kind = !state.round && set ? ` · ${set.kind}` : '';
      return { tone: 'plain', html: `${where} · <b>${esc(p.name)}</b>${kind} · base ${price(state.app?.start ?? p.base)}` };
    }
    case 'open':
      if (lastEntry?.type === 'drop') return { tone: 'plain', html: dropLine(lastEntry, codes) };
      return lastEntry?.type === 'open' ? { tone: 'plain', html: `${codes[lastEntry.team]} are in — ${reasonOf(lastEntry.text).one}.` } : null;
    case 'interest':
      if (lastEntry?.type === 'drop') return { tone: 'plain', html: dropLine(lastEntry, codes) };
      return { tone: 'plain', html: interest(state.ladder.filter((x) => x.type === 'open'), codes) };
    case 'bidding': {
      if (lastEntry?.type === 'drop') return { tone: 'plain', html: dropLine(lastEntry, codes) };
      const bids = state.ladder.filter((x) => x.type === 'bid');
      return bids.length ? { tone: 'bid', html: bidLine(bids, codes) } : null;
    }
    case 'going':
      return { tone: 'bid', html: `${price(state.price, 'cap-bid mono')} with ${codes[state.leader] || '—'} — fair warning… going once… going twice…` };
    case 'sold': {
      const { split } = state.result;
      return {
        tone: 'sold',
        html: `SOLD to ${codes[state.result.team]} for ${price(state.result.price)}${split
          ? `<span class="cap-sub">He keeps ${price(split.keeps)} (the overseas cap); the other ${price(split.bcci)} goes to the BCCI.</span>` : ''}`,
      };
    }
    case 'unsold': {
      const why = state.result?.reason;
      const line = !why ? '' : /no bid at base/i.test(why) ? ` — no team bid his base price of ${price(state.app?.start ?? p.base)}.` : ` — ${esc(why)}.`;
      return { tone: 'plain', html: `<b>UNSOLD</b>${line}` };
    }
    default:
      return null;
  }
}
