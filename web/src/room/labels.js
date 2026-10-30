// CSS2D overlays for the 3D room: one label per table (its code, ringed in the table's state colour) and
// the auctioneer's caption under the screen. Reasons are not shown over the desks; each table's analyst
// gives them in the team panel.
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
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
    el.setAttribute('aria-label', `${t.code}: hear its analyst`);
    el.title = `${t.code} · hear its analyst`;
    el.innerHTML = `<span class="tl-code mono">${teamDot(t.code)}${t.code}</span>`;
    const obj = new CSS2DObject(el);
    obj.center.set(0.5, 1);
    t.anchor.add(obj);
    return el;
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
    update(state) {
      state.status.forEach((st, i) => { if (items[i] && items[i].dataset.state !== st.state) items[i].dataset.state = st.state; });
    },
    setCaption(model) {
      caption.innerHTML = model?.html || '';
      caption.dataset.tone = model?.tone || 'plain';
      caption.classList.toggle('is-on', !!model);
    },
    /** The 3D room passes where each label has open space; with no chips over the desks there is nothing to place. */
    setSides() {},
    setSelected(ti) { items.forEach((el, i) => el.classList.toggle('is-selected', i === ti)); },
    setHover(ti) { items.forEach((el, i) => el.classList.toggle('is-hover', i === ti)); },
    get element() { return renderer.domElement; },
  };
}
