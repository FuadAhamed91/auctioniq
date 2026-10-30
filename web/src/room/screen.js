// The big screen: one content model, drawn as HTML (2D room) or onto a canvas texture (3D room).
import { esc } from '../dom.js';
import { money, moneyParts, int, runNo } from '../format.js';

export const COLORS = { ink: '#0F1218', stand: '#171C25', rail: '#2C3442', flood: '#EDE8DC', haze: '#9AA3B2', brass: '#E0A63C', teal: '#3FC1B0', red: '#E25A4C' };

/** What the screen should say for the current replay state. */
export function screenModel(state, ctx) {
  const p = state.player;
  if (!p) return { mode: 'blank' };
  const m = {
    kicker: `${p.setCode} · LOT ${int(p.lot)}`,
    corner: state.run != null ? `RUN ${runNo(state.run)}` : '',
    name: p.name,
    role: `${ctx.roleLabel(p.role)} · ${p.country}`,
    base: money(p.base),
    round: state.round,
  };
  const open = state.status.filter((s) => s.state !== 'idle').length;
  switch (state.phase) {
    case 'bidding':
    case 'going':
      return { ...m, mode: 'bid', price: state.price, team: ctx.codes[state.leader] || '', going: state.phase === 'going' };
    case 'sold':
      return { ...m, mode: 'sold', price: state.result.price, team: ctx.codes[state.result.team] };
    case 'unsold':
      return { ...m, mode: 'unsold', reason: /no bid at base/i.test(state.result?.reason || '') ? 'No bid at his base price' : state.result?.reason || '' };
    case 'interstitial':
      return { ...m, mode: 'inter', note: `Returns in accelerated round ${state.apps[state.appIdx + 1]?.round ?? 1}` };
    case 'break':
      return { ...m, mode: 'inter', note: 'Break — franchises submit names', sub: `Accelerated round ${state.round} next` };
    case 'never':
      return { ...m, mode: 'never', note: `Not called in any of the ${int(ctx.meta.runs)} runs` };
    case 'notcalled':
      return { ...m, mode: 'never', note: 'Not called in this run', sub: 'No team nominated him' };
    default:
      return { ...m, mode: 'intro', note: state.round ? `Accelerated round ${state.round}` : '', open };
  }
}

/** The leader line under the price while bidding (HTML). */
export const leadLine = (m) => `<b class="mono">${esc(m.team)}</b> ${m.going ? '<span class="scr-going">going once · going twice</span>' : 'leading'}`;

/** HTML version (2D room). `price` is the tweened number currently shown. */
export function screenHTML(m, price) {
  if (m.mode === 'blank') return '';
  const top = `<div class="scr-top mono"><span>${esc(m.kicker)}</span><span>${esc(m.corner)}</span></div>`;
  const big = (lakhs, cls) => {
    const { num, unit } = moneyParts(lakhs);
    return `<div class="scr-price ${cls}"><span>${num}</span><small>${unit}</small></div>`;
  };
  let body;
  switch (m.mode) {
    case 'bid':
      body = `<div class="scr-name scr-name-sm">${esc(m.name)}</div>${big(price ?? m.price, 'is-bid')}
        <div class="scr-line scr-lead">${leadLine(m)}</div>`;
      break;
    case 'sold':
      body = `<div class="scr-name scr-name-sm">${esc(m.name)}</div><div class="scr-stamp is-sold">SOLD</div>${big(m.price, 'is-sold')}
        <div class="scr-line">to <b class="mono">${esc(m.team)}</b></div>`;
      break;
    case 'unsold':
      body = `<div class="scr-name scr-name-sm">${esc(m.name)}</div><div class="scr-stamp">UNSOLD</div>${m.reason ? `<div class="scr-line">${esc(m.reason)}</div>` : ''}`;
      break;
    case 'inter':
    case 'never':
      body = `<div class="scr-name scr-name-sm">${esc(m.name)}</div><div class="scr-note">${esc(m.note)}</div>${m.sub ? `<div class="scr-role">${esc(m.sub)}</div>` : ''}`;
      break;
    default:
      body = `${m.note ? `<div class="scr-kick">${esc(m.note)}</div>` : ''}<div class="scr-name">${esc(m.name)}</div><div class="scr-role">${esc(m.role)}</div>
        <div class="scr-line">Base <b class="mono">${esc(m.base)}</b>${m.open ? ` <i class="dot" aria-hidden="true"> · </i> <span class="scr-teal">${m.open} ${m.open === 1 ? 'team' : 'teams'} interested</span>` : ''}</div>`;
  }
  return `<div class="scr" data-mode="${m.mode}">${top}<div class="scr-body">${body}</div></div>`;
}

// ---- canvas version (3D room) ----
function fit(g, text, font, size, maxW) {
  let s = size;
  g.font = font(s);
  while (g.measureText(text).width > maxW && s > 8) { s -= 2; g.font = font(s); }
  return s;
}

/** Paints the screen into a 2D canvas context of size w × h. */
export function paintScreen(g, w, h, m, price) {
  const C = COLORS, u = h / 100, padX = w * 0.07;
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#161B26');
  grad.addColorStop(1, '#0B0E13');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = C.rail;
  g.lineWidth = Math.max(2, u * 0.6);
  g.strokeRect(u * 1.6, u * 1.6, w - u * 3.2, h - u * 3.2);
  if (m.mode === 'blank') return;

  const mono = (wt) => (s) => `${wt} ${s}px "IBM Plex Mono", ui-monospace, monospace`;
  const display = (wt) => (s) => `${wt} ${s}px "Bricolage Grotesque", "IBM Plex Sans", sans-serif`;
  const sans = (wt) => (s) => `${wt} ${s}px "IBM Plex Sans", sans-serif`;
  g.textBaseline = 'alphabetic';

  // top row
  g.fillStyle = C.haze;
  g.font = mono(500)(u * 5.2);
  g.textAlign = 'left';
  g.fillText(m.kicker, padX, u * 13);
  g.textAlign = 'right';
  g.fillText(m.corner, w - padX, u * 13);
  g.textAlign = 'center';
  const cx = w / 2, maxW = w - padX * 2;

  const bigPrice = (lakhs, color, y, size) => {
    const { num, unit } = moneyParts(lakhs);
    const s = fit(g, `${num} ${unit}`, display(700), size, maxW);
    g.font = display(700)(s);
    const nw = g.measureText(num).width;
    g.font = display(600)(s * 0.5);
    const uw = g.measureText(` ${unit}`).width;
    const x0 = cx - (nw + uw) / 2;
    g.fillStyle = color;
    g.textAlign = 'left';
    g.font = display(700)(s);
    g.fillText(num, x0, y);
    g.font = display(600)(s * 0.5);
    g.fillText(` ${unit}`, x0 + nw, y);
    g.textAlign = 'center';
  };
  const line = (text, color, y, size, font = sans(500)) => {
    fit(g, text, font, size, maxW);
    g.fillStyle = color;
    g.fillText(text, cx, y);
  };

  switch (m.mode) {
    case 'bid':
      line(m.name, C.haze, u * 30, u * 8, display(600));
      bigPrice(price ?? m.price, C.brass, u * 67, u * 34);
      line(m.going ? `${m.team} · going once, going twice` : `${m.team} leading`, C.flood, u * 85, u * 7.5, mono(600));
      break;
    case 'sold':
      line(m.name, C.haze, u * 28, u * 8, display(600));
      line('SOLD', C.red, u * 48, u * 17, display(800));
      bigPrice(m.price, C.red, u * 74, u * 24);
      line(`to ${m.team}`, C.flood, u * 88, u * 7.5, mono(600));
      break;
    case 'unsold':
      line(m.name, C.haze, u * 33, u * 8, display(600));
      line('UNSOLD', C.flood, u * 60, u * 19, display(800));
      if (m.reason) line(m.reason, C.haze, u * 78, u * 7, sans(500));
      break;
    case 'inter':
    case 'never':
      line(m.name, C.haze, u * 36, u * 8, display(600));
      line(m.note, C.flood, u * 58, u * 9.5, display(700));
      if (m.sub) line(m.sub, C.haze, u * 72, u * 6.5, sans(500));
      break;
    default:
      if (m.note) line(m.note.toUpperCase(), C.haze, u * 27, u * 5, mono(600));
      line(m.name, C.flood, u * 50, u * 17, display(700));
      line(m.role, C.haze, u * 64, u * 7, sans(500));
      line(`Base ${m.base}`, C.flood, u * 79, u * 7, mono(600));
      if (m.open) line(`${m.open} ${m.open === 1 ? 'team' : 'teams'} interested`, C.teal, u * 90, u * 5.2, mono(600));
  }
}
