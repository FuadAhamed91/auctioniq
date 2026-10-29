// Table reason chips, shared by the 3D labels and the 2D room. Chips stay up for the leader and the
// winner; a gate-open or drop-out chip shows for a few seconds, then fades (the ladder keeps them all).
import { money } from '../format.js';

const FRESH_MS = 3200;

export function chipText(st, state) {
  if (st.state === 'won') return `SOLD ${money(state.result?.price)}`;
  if (st.state === 'out') return st.chip ? `Out · ${st.chip}` : 'Out';
  if (st.entry) return `Enters at ${money(st.entry)}`; // a late entry into the bidding war
  return st.state === 'idle' ? '' : st.chip;
}

/** Returns mark(text): flags `el` as fresh for a while whenever its chip text changes. */
export function freshness(el) {
  let timer = 0;
  return (text) => {
    clearTimeout(timer);
    el.classList.toggle('is-fresh', !!text);
    if (text) timer = setTimeout(() => el.classList.remove('is-fresh'), FRESH_MS);
  };
}
