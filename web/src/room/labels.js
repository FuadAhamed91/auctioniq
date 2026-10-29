// CSS2D overlays for the 3D room: one label per table (code + reason chip) and the auctioneer's caption under the screen.
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { chipText, freshness } from './chips.js';
import { teamDot } from '../teams.js';

export function createLabels(container, teams, captionAnchor) {
  const renderer = new CSS2DRenderer();
  renderer.domElement.className = 'labels-layer';
  container.append(renderer.domElement);

  const items = teams.map((t) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'tlabel';
    el.dataset.team = t.ti;
    el.dataset.state = 'idle';
    el.setAttribute('aria-label', `${t.code}: open decision panel`);
    el.innerHTML = `<span class="tl-code mono">${teamDot(t.code)}${t.code}</span><span class="tl-chip"></span>`;
    const obj = new CSS2DObject(el);
    obj.center.set(0.5, 1);
    t.anchor.add(obj);
    return { el, chip: el.querySelector('.tl-chip'), fresh: freshness(el) };
  });

  const caption = document.createElement('div');
  caption.className = 'caption caption-3d';
  caption.setAttribute('aria-hidden', 'true');
  const capObj = new CSS2DObject(caption);
  capObj.center.set(0.5, 0);
  captionAnchor.add(capObj);

  return {
    render: (scene, camera) => renderer.render(scene, camera),
    setSize: (w, h) => renderer.setSize(w, h),
    /** Mirror the replay's per-team state onto the labels. */
    update(state, codes) {
      state.status.forEach((st, i) => {
        const it = items[i];
        if (!it) return;
        const text = chipText(st, state);
        if (it.el.dataset.state !== st.state) it.el.dataset.state = st.state;
        if (it.chip.textContent !== text) { it.chip.textContent = text; it.fresh(text); }
        it.el.title = text ? `${codes[i]} · ${text}` : codes[i];
      });
    },
    setCaption(model) {
      caption.innerHTML = model?.html || '';
      caption.dataset.tone = model?.tone || 'plain';
      caption.classList.toggle('is-on', !!model);
    },
    /** Where each table's chip hangs: 'left', 'right' or 'below' its code pill. */
    setSides(sides) { items.forEach((it, i) => { it.el.dataset.side = sides[i]; }); },
    setSelected(ti) { items.forEach((it, i) => it.el.classList.toggle('is-selected', i === ti)); },
    setHover(ti) { items.forEach((it, i) => it.el.classList.toggle('is-hover', i === ti)); },
    get element() { return renderer.domElement; },
  };
}
