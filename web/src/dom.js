// Tiny DOM + motion helpers shared by every view.

export const $ = (sel, root = document) => root.querySelector(sel);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
export const reducedMotion = () => motionQuery.matches;

export const easeOutCubic = (t) => 1 - (1 - t) ** 3;
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Animate a number with rAF. Returns a cancel function.
 * Jumps straight to the end when reduced motion is requested or ms <= 0.
 */
export function tween(from, to, ms, onUpdate, ease = easeOutCubic) {
  if (ms <= 0 || from === to || reducedMotion()) {
    onUpdate(to, 1);
    return () => {};
  }
  let raf = 0;
  const t0 = performance.now();
  const frame = (now) => {
    const t = Math.min(1, (now - t0) / ms);
    onUpdate(from + (to - from) * ease(t), t);
    if (t < 1) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

/** Keeps one running tween per key and starts the next from the value last shown. */
export function tweener(initial, onUpdate) {
  let value = initial, cancel = () => {};
  return {
    get value() { return value; },
    to(target, ms) {
      cancel();
      cancel = tween(value, target, ms, (v, t) => { value = v; onUpdate(v, t); });
    },
    set(target) { cancel(); value = target; onUpdate(target, 1); },
  };
}

/** Restart a CSS animation class on an element; with `once`, the class drops off when its animation ends. */
export function retrigger(el, cls, once = false) {
  el.classList.remove(cls);
  void el.offsetWidth; // force reflow so the animation restarts
  el.classList.add(cls);
  if (!once) return;
  const done = (e) => { if (e.target === el) { el.classList.remove(cls); el.removeEventListener('animationend', done); } };
  el.addEventListener('animationend', done);
}
