// 3D auction room: loads room.glb (Draco), lights it, and drives lamps, paddles, hammer and screen from the replay.
import {
  Box3, CanvasTexture, Color, DirectionalLight, HalfFloatType, HemisphereLight, MathUtils, Mesh, MeshBasicMaterial, NeutralToneMapping,
  Object3D, PCFShadowMap, PerspectiveCamera, PMREMGenerator, Quaternion, Raycaster, Scene, ShaderMaterial, SpotLight, SRGBColorSpace,
  Vector2, Vector3, WebGLRenderer, WebGLRenderTarget,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { reducedMotion, tweener, easeOutCubic, easeInOut } from '../dom.js';
import { COLORS, screenModel, paintScreen } from './screen.js';
import { createLabels } from './labels.js';
import { captionModel } from './caption.js';
import { teamColors } from '../teams.js';

const BAT = new Set(['pp_opener', 'anchor', 'finisher']);
const BOWL = new Set(['pp_pacer', 'death_pacer', 'wrist_spin', 'finger_spin']);
/** Keeper tag wins; batting roles -> Batter, bowling roles -> Bowler, all-rounders by role2 (bowler if none). */
function silhouetteFor(p) {
  if (p.tags?.includes('wk')) return 'Keeper';
  if (BAT.has(p.role)) return 'Batter';
  if (BOWL.has(p.role)) return 'Bowler';
  return BAT.has(p.role2) ? 'Batter' : 'Bowler';
}

// Lamp colour and glow per table state (the only room colours the app drives; the GLB owns the rest). Idle and
// out lamps sit dark in their white rims, so the lit states stand out in the hall.
const LAMP = { idle: ['#6E7787', 0.12], open: [COLORS.teal, 1.3], leading: [COLORS.brass, 1.6], out: ['#3A414E', 0], won: [COLORS.red, 1.9] };
const BACKDROP = '#0B0E1A'; // the hall's own dark, also behind the canvas while it loads
// Emissive materials that bloom, and how much: lamps fully (state must read), the big LED backdrop and the
// warm strips only a touch so the glow stays a halo rather than a haze over the screen.
const GLOW = [[/^M_Lamp_/, 1], [/^M_(Lens|Teal)/, 0.7], [/^M_Flood/, 0.35], [/^M_LED_/, 0.15]];
const GLOW_LAYER = 1;
const UP = new Vector3(0, 1, 0);
const HAMMER_HIT = 0.61; // rad about the hammer's local X from its raised rest to the block (room.glb rig)

function loadFonts() {
  const want = ['700 40px "Bricolage Grotesque"', '800 40px "Bricolage Grotesque"', '600 40px "Bricolage Grotesque"',
    '500 20px "IBM Plex Mono"', '600 20px "IBM Plex Mono"', '500 20px "IBM Plex Sans"'];
  const all = Promise.all(want.map((f) => document.fonts.load(f))).catch(() => {});
  return Promise.race([all, new Promise((r) => setTimeout(r, 2500))]);
}

/** A thin white rim all round every mesh under `node`, so the lamp's state colour never sits directly on a
 * team colour (SOLD red on the PBKS and RCB desks, brass on CSK yellow or an orange nameplate). The rim is a copy
 * grown by `margin` metres that is drawn after the room without writing depth, and the lamp is drawn over it. */
const HALO = new MeshBasicMaterial({ color: 0xffffff, toneMapped: false, depthWrite: false });
HALO.name = 'M_LampHalo';
function addHalo(node, margin) {
  node?.traverse((o) => {
    if (!o.isMesh || o.material === HALO) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    const size = bb.getSize(new Vector3()), mid = bb.getCenter(new Vector3());
    const grow = new Vector3(1, 1, 1).addScaledVector(new Vector3(1 / Math.max(size.x, 1e-3), 1 / Math.max(size.y, 1e-3), 1 / Math.max(size.z, 1e-3)), 2 * margin);
    const halo = new Mesh(o.geometry, HALO);
    halo.renderOrder = 1;
    o.renderOrder = 2;
    halo.scale.copy(grow);
    halo.position.copy(mid).multiply(new Vector3(1, 1, 1).sub(grow)); // grown about the strip's own centre
    o.add(halo);
  });
}

/** Every material under `node`, made unique to it so per-team changes never leak to other teams. */
function ownMaterials(node, seen) {
  const out = [];
  node?.traverse((o) => {
    if (!o.isMesh) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const mine = list.map((m) => {
      if (seen.has(m)) { const c = m.clone(); out.push(c); return c; }
      seen.add(m); out.push(m); return m;
    });
    o.material = Array.isArray(o.material) ? mine : mine[0];
  });
  return out;
}

export async function mountRoom3D(el, ctx, { onProgress, onLost } = {}) {
  const { replay, codes } = ctx;
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = NeutralToneMapping; // keeps whites white and brand colours true
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.shadowMap.autoUpdate = false; // refreshed once per frame, not again for the AO and glow passes
  renderer.debug.checkShaderErrors = false; // no per-program info-log round trips (and no ANGLE precision chatter)
  renderer.domElement.className = 'room3d';
  // a broadcast window inside the white panel: its own dark ground and the panel's corner radius
  Object.assign(renderer.domElement.style, { background: BACKDROP, borderRadius: 'var(--r)' });

  // WASM decoder only (every WebGL2 browser has WebAssembly); without it DRACOLoader throws and we fall back to 2D.
  const dracoDir = new URL('draco/', document.baseURI);
  const draco = new DRACOLoader().setDecoderPath({
    js: new URL('draco_wasm_wrapper.js', dracoDir).href,
    wasm: new URL('draco_decoder.wasm', dracoDir).href,
  });
  const loader = new GLTFLoader().setDRACOLoader(draco);
  let gltf;
  try {
    [gltf] = await Promise.all([
      loader.loadAsync(new URL('assets/room.glb', document.baseURI).href, (e) => e.total && onProgress?.(e.loaded / e.total)),
      loadFonts(),
    ]);
  } finally {
    draco.dispose();
  }
  const root = gltf.scene;
  const find = (name) => root.getObjectByName(name);
  const scene = new Scene();
  scene.background = new Color(BACKDROP);
  scene.add(root);

  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.3; // reflections and a little fill; the hall's light comes from the rig below
  pmrem.dispose();

  // ---- shadows (materials stay exactly as authored); the ceiling, walls and rig never cast, or the key light,
  // which sits above the ceiling, would put the whole hall in shadow ----
  const noCast = /^(Floor|Carpet|Inlay|Wall|Slats|Ceiling|Truss|Fixtures|LEDWall|LEDColumns|EdgeLight|LightBlades|ScreenPanel|Screen)/;
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.receiveShadow = true;
    o.castShadow = !noCast.test(o.name);
  });

  // ---- teams ----
  // The team code printed on each desk's nameplate, in white or ink, whichever reads better on the
  // team's secondary colour; redrawn once the display font has loaded.
  function paintNameplate(mesh, code, bg) {
    if (!mesh) return;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 78;
    const tex = new CanvasTexture(canvas);
    tex.flipY = false;
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
    const ink = contrast(bg, '#0F1218') > contrast(bg, '#FFFFFF') ? '#0F1218' : '#FFFFFF';
    const draw = () => {
      const g = canvas.getContext('2d');
      g.fillStyle = bg;
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.fillStyle = ink;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = '800 52px "Bricolage Grotesque", "IBM Plex Sans", sans-serif';
      if ('letterSpacing' in g) g.letterSpacing = '8px';
      g.fillText(code, canvas.width / 2, canvas.height / 2 + 2);
      tex.needsUpdate = true;
    };
    draw();
    document.fonts?.load('800 52px "Bricolage Grotesque"').then(draw, () => {});
    mesh.material = mesh.material.clone();
    mesh.material.map = tex;
    mesh.material.color.set('#ffffff');
  }
  const seen = new Set();
  const teams = codes.map((code, ti) => {
    const table = find(`Table_${code}`);
    const paddle = find(`Paddle_${code}`);
    // identity: desk body and paddle blade in the team's primary, nameplate in its secondary (true brand
    // colours, the GLB's finish kept); state is carried by the haloed lamp strip, the paddle's lift and the labels
    const [primary, secondary] = teamColors(code);
    const tints = {
      [`M_Desk_${code}`]: primary, [`M_Plate_${code}`]: secondary, [`M_Paddle_${code}`]: primary,
      [`M_Jersey_${code}`]: primary, [`M_Sleeve_${code}`]: secondary, // the franchise reps wear the team kit
    };
    table?.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (tints[m.name]) m.color.set(tints[m.name]);
    });
    paintNameplate(find(`PlateText_${code}`), code, secondary);
    const lampNode = find(`Lamp_${code}`);
    const lamps = ownMaterials(lampNode, seen);
    addHalo(lampNode, 0.025);
    return {
      ti, code, table, paddle, lamps,
      anchor: find(`Anchor_${code}`) || table || root,
      rest: paddle ? paddle.position.clone() : null,
      liftBy: paddle ? new Box3().setFromObject(paddle).getSize(new Vector3()).y * 0.75 : 0,
      lift: 0, vel: 0, target: 0,
      color: new Color(LAMP.idle[0]), goal: new Color(LAMP.idle[0]), power: LAMP.idle[1], goalPower: LAMP.idle[1], flash: -1,
    };
  });

  // ---- hammer: rests raised; +HAMMER_HIT rad about local X puts the head on the block ----
  const hammer = find('Hammer');
  const hammerRest = hammer ? hammer.rotation.x : 0;
  let strike = -1, onImpact = null;

  // ---- silhouettes ----
  const silhouettes = { Batter: find('Silhouette_Batter'), Bowler: find('Silhouette_Bowler'), Keeper: find('Silhouette_Keeper') };

  // ---- big screen (canvas texture on ScreenPanel) ----
  const panel = find('ScreenPanel');
  let screen = null;
  if (panel) {
    const size = new Box3().setFromObject(panel).getSize(new Vector3());
    const aspect = MathUtils.clamp(Math.max(size.x, size.z) / Math.max(1e-3, size.y), 1, 3);
    const canvas = document.createElement('canvas');
    canvas.height = 720;
    canvas.width = Math.round(720 * aspect);
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.flipY = false; // glTF UV convention
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const mat = new MeshBasicMaterial({ map: tex, toneMapped: false }); // the LED wall shows its colours exactly
    mat.name = 'M_Screen';
    panel.traverse((o) => { if (o.isMesh) { o.material = mat; o.castShadow = false; o.receiveShadow = false; } });
    screen = { canvas, g: canvas.getContext('2d'), tex, key: '', dirty: true, price: null };
  }

  // ---- lights (the GLB carries none) ----
  const box = new Box3().setFromObject(find('Floor') || root);
  const span = box.getSize(new Vector3());
  const camNode = find('Cam_Main');
  const glCam = camNode?.isCamera ? camNode : camNode?.getObjectByProperty('isCamera', true) || gltf.cameras?.[0];
  if (!glCam) throw new Error('room.glb has no Cam_Main camera');
  glCam.updateWorldMatrix(true, false);
  const basePos = glCam.getWorldPosition(new Vector3());
  const baseQuat = glCam.getWorldQuaternion(new Quaternion());
  const forward = new Vector3(0, 0, -1).applyQuaternion(baseQuat);

  // hall recipe: a low cool-sky / warm-ground fill, a strong warm key on the desks and stage with soft shadows,
  // warm spots from the truss on the podium and the plinth, and a cool rim from behind the stage
  scene.add(new HemisphereLight(0x5b6aa6, 0x3b3027, 0.55));
  const key = new DirectionalLight(0xffe4c4, 3.2);
  key.position.set(-6, 12, 13);
  key.target.position.set(0, 0, 2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const r = Math.max(span.x, span.z) * 0.55;
  Object.assign(key.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 0.5, far: 80 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  key.shadow.intensity = 0.8;
  const rim = new DirectionalLight(0x9db4ff, 1.4);
  rim.position.set(0, 9, -14);
  rim.target.position.set(0, 0, 8);
  scene.add(key, key.target, rim, rim.target);
  const rig = new Box3().setFromObject(find('Truss') || root); // spots hang from its front beam, over the stage edge
  for (const [name, candela, cone] of [['Podium', 90, 0.3], ['Plinth', 70, 0.24]]) {
    const node = find(name);
    if (!node) continue;
    const at = new Box3().setFromObject(node).getCenter(new Vector3());
    const spot = new SpotLight(0xffe2bd, candela, 0, cone, 0.55, 2);
    spot.position.set(at.x, rig.min.y - 0.4, rig.min.z);
    spot.target.position.copy(at).add(new Vector3(0, 0.8, 0));
    scene.add(spot, spot.target);
  }

  // ---- camera: Cam_Main's position and aim; the frustum is fitted to the tables, their labels and the
  // screen for whatever aspect the stage has (an off-centre projection, so nothing is wasted or cropped) ----
  const camera = new PerspectiveCamera(glCam.fov, 1, Math.max(0.05, glCam.near), glCam.far);
  camera.position.copy(basePos);
  camera.quaternion.copy(baseQuat);
  camera.updateMatrixWorld(true);
  const keyPoints = [];
  for (const t of teams) {
    if (t.table) {
      const b = new Box3().setFromObject(t.table);
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) keyPoints.push(new Vector3(x, y, z));
    }
    keyPoints.push(t.anchor.getWorldPosition(new Vector3()).add(new Vector3(0, 0.45, 0))); // room for the label
  }
  const screenBox = new Box3().setFromObject(find('Screen') || panel || root);
  keyPoints.push(screenBox.min, screenBox.max);
  const ext = { u0: Infinity, u1: -Infinity, v0: Infinity, v1: -Infinity };
  for (const p of keyPoints) {
    const c = p.clone().applyMatrix4(camera.matrixWorldInverse);
    if (c.z > -0.1) continue;
    const u = c.x / -c.z, v = c.y / -c.z;
    ext.u0 = Math.min(ext.u0, u); ext.u1 = Math.max(ext.u1, u);
    ext.v0 = Math.min(ext.v0, v); ext.v1 = Math.max(ext.v1, v);
  }
  const focusDist = Math.max(1, screenBox.getCenter(new Vector3()).sub(basePos).dot(forward) * 0.6);
  const focusPoint = basePos.clone().addScaledVector(forward, focusDist);
  function fitCamera(aspect) {
    const w = ext.u1 - ext.u0, h = ext.v1 - ext.v0;
    let u0 = ext.u0 - w * 0.04, u1 = ext.u1 + w * 0.04, v0 = ext.v0 - h * 0.05, v1 = ext.v1 + h * 0.06;
    const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
    let fw = u1 - u0, fh = v1 - v0;
    if (fw / fh > aspect) fh = fw / aspect; else fw = fh * aspect;
    u0 = cu - fw / 2; u1 = cu + fw / 2; v0 = cv - fh / 2; v1 = cv + fh / 2;
    const n = camera.near;
    camera.aspect = aspect;
    camera.fov = MathUtils.radToDeg(2 * Math.atan(fh / 2));
    camera.projectionMatrix.makePerspective(u0 * n, u1 * n, v1 * n, v0 * n, n, camera.far);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
  const yawQ = new Quaternion();
  function placeCamera(t) {
    const still = reducedMotion();
    yawQ.setFromAxisAngle(UP, still ? 0 : Math.sin(t * 0.07) * 0.014);
    camera.position.copy(basePos).sub(focusPoint).applyQuaternion(yawQ).add(focusPoint);
    if (!still) camera.position.y += Math.sin(t * 0.11) * 0.04;
    camera.quaternion.copy(yawQ).multiply(baseQuat);
  }

  // ---- frame: the room (4× MSAA), ambient occlusion for the contact shadows (GTAO, ~1 m reach), the glow,
  // then tone mapping and sRGB in the output pass ----
  const composer = new EffectComposer(renderer, new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 }));
  const ao = new GTAOPass(scene, camera, 1, 1, undefined, { radius: 1, distanceExponent: 1.5, thickness: 1, scale: 1, samples: 16 });
  ao.blendIntensity = 0.85;
  // Selective bloom: only the glowing meshes (on their own layer, with the few objects that stand in front of the
  // LED wall drawn black so it glows around them), re-rendered at half size as their emissive colour, blurred and
  // added before tone mapping. Lamps keep their state colour and lit white desk tops never bloom.
  const glowComposer = new EffectComposer(renderer, new WebGLRenderTarget(1, 1, { type: HalfFloatType }));
  glowComposer.renderToScreen = false;
  const bloom = new UnrealBloomPass(new Vector2(1, 1), 0.55, 0.35, 0);
  glowComposer.addPass(new RenderPass(scene, camera));
  glowComposer.addPass(bloom);
  const mix = new ShaderPass(new ShaderMaterial({
    uniforms: { baseTexture: { value: null }, glowTexture: { value: glowComposer.renderTarget2.texture } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D baseTexture; uniform sampler2D glowTexture; varying vec2 vUv;\n'
      + 'void main() { gl_FragColor = texture2D(baseTexture, vUv) + texture2D(glowTexture, vUv); }',
  }), 'baseTexture');
  const passes = [new RenderPass(scene, camera), ao, mix, new OutputPass()];
  passes.forEach((p) => composer.addPass(p));
  const glowing = [], blockers = []; // [mesh, weight] and meshes drawn black
  root.traverse((o) => {
    if (!o.isMesh) return;
    const weight = GLOW.find(([re]) => re.test(o.material.name))?.[1];
    if (weight) glowing.push([o, weight]);
    else if (/^(Screen|Podium|Auctioneer|Plinth|Silhouette_)/.test(o.name)) blockers.push(o);
    else return;
    o.layers.enable(GLOW_LAYER);
  });
  const BLACK = new MeshBasicMaterial({ color: 0x000000 });
  const glowOf = new Map(), swaps = [];
  let glowOn = true;
  function renderGlow() {
    for (const [o, weight] of glowing) {
      const src = o.material;
      let g = glowOf.get(src);
      if (!g) glowOf.set(src, (g = new MeshBasicMaterial()));
      g.color.copy(src.emissive).multiplyScalar(src.emissiveIntensity * weight);
      swaps.push(o, src);
      o.material = g;
    }
    for (const o of blockers) { swaps.push(o, o.material); o.material = BLACK; }
    const bg = scene.background;
    scene.background = null;
    camera.layers.set(GLOW_LAYER);
    glowComposer.render();
    camera.layers.set(0);
    scene.background = bg;
    for (let i = 0; i < swaps.length; i += 2) swaps[i].material = swaps[i + 1];
    swaps.length = 0;
  }

  // ---- DOM ----
  el.append(renderer.domElement);
  const captionAnchor = new Object3D(); // the auctioneer's caption hangs just under the screen
  captionAnchor.position.set(screenBox.getCenter(new Vector3()).x, screenBox.min.y - 0.12, screenBox.max.z + 0.05);
  scene.add(captionAnchor);
  const labels = createLabels(el, teams, captionAnchor);
  const anchorPoints = teams.map((t) => t.anchor.getWorldPosition(new Vector3()));
  function resize() {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    glowComposer.setPixelRatio(1);
    glowComposer.setSize(Math.ceil(w / 2), Math.ceil(h / 2));
    labels.setSize(w, h);
    fitCamera(w / h);
    placeCamera(0);
    camera.updateMatrixWorld(true);
    labels.setSides(anchorPoints.map((p) => {
      const x = p.clone().project(camera).x;
      return x < -0.42 ? 'right' : x > 0.42 ? 'left' : 'below'; // chips hang inward, over the empty floor
    }));
  }
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  resize();

  // ---- picking ----
  const pickables = [];
  teams.forEach((t) => t.table?.traverse((o) => { if (o.isMesh) { o.userData.team = t.ti; pickables.push(o); } }));
  const ray = new Raycaster();
  const ndc = new Vector2();
  let pointer = null, hovered = null;
  function pick(x, y) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    return hit ? hit.object.userData.team : null;
  }
  const canvasEl = renderer.domElement;
  canvasEl.addEventListener('pointermove', (e) => { pointer = [e.clientX, e.clientY]; });
  canvasEl.addEventListener('pointerleave', () => { pointer = null; });
  canvasEl.addEventListener('click', (e) => { const ti = pick(e.clientX, e.clientY); if (ti != null) ctx.openTeam(ti); });
  labels.element.addEventListener('click', (e) => {
    const b = e.target.closest('.tlabel');
    if (b) ctx.openTeam(Number(b.dataset.team));
  });
  const offSelect = ctx.onSelectTeam((ti) => labels.setSelected(ti));

  // ---- state -> visuals ----
  const price = tweener(0, (v) => { if (screen) { screen.price = Math.round(v / 5) * 5; screen.dirty = true; } });
  function applyStatus(instant) {
    const s = replay.state;
    s.status.forEach((st, i) => {
      const t = teams[i];
      if (!t) return;
      const [col, pow] = LAMP[st.state] || LAMP.idle;
      if (st.state === 'won' && t.flash < 0 && !instant) return; // the hammer's impact turns it red
      t.goal.set(col);
      t.goalPower = pow;
      t.target = st.state === 'leading' || st.state === 'won' ? 1 : 0;
      if (instant) { t.color.copy(t.goal); t.power = pow; }
    });
    labels.update(s, codes);
  }
  function paintScreenNow() {
    if (!screen) return;
    const m = screenModel(replay.state, ctx);
    screen.key = JSON.stringify(m);
    paintScreen(screen.g, screen.canvas.width, screen.canvas.height, m, m.mode === 'bid' ? screen.price ?? m.price : m.price);
    screen.tex.needsUpdate = true;
    screen.dirty = false;
  }
  function refreshScreen() {
    if (!screen) return;
    const m = screenModel(replay.state, ctx);
    if (JSON.stringify(m) !== screen.key) screen.dirty = true;
  }
  function showSilhouette() {
    const p = replay.state.player;
    const kind = p ? silhouetteFor(p) : null;
    for (const [k, node] of Object.entries(silhouettes)) if (node) node.visible = k === kind;
  }
  function sync() {
    showSilhouette();
    teams.forEach((t) => { t.flash = -1; });
    applyStatus(true);
    price.set(replay.state.price || 0);
    screen && (screen.dirty = true);
    labels.setCaption(captionModel(replay.state, codes));
  }

  const offs = [
    replay.on('lot', sync),
    replay.on('phase', () => {
      labels.setCaption(captionModel(replay.state, codes));
      refreshScreen();
    }),
    replay.on('step', (step) => {
      if (step.type === 'bid') {
        if (step.instant || !price.value) price.set(step.price); else price.to(step.price, 260);
      }
      if (step.type === 'sold' && !step.instant && hammer && !reducedMotion()) {
        strike = 0;
        onImpact = () => { const t = teams[step.team]; if (t) { t.flash = 0; applyStatus(false); } };
        applyStatus(false);
      } else {
        if (step.type === 'sold') teams[step.team] && (teams[step.team].flash = 0);
        applyStatus(step.instant);
      }
      labels.setCaption(captionModel(replay.state, codes));
      refreshScreen();
    }),
  ];

  // ---- frame loop ----
  let running = true, visible = true, last = performance.now();
  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
  io.observe(el);
  const perf = { n: 0, sum: 0, level: 0, wait: performance.now() + 3000 };
  function degrade() {
    perf.level += 1;
    if (perf.level === 1) { renderer.setPixelRatio(1); composer.setPixelRatio(1); resize(); }
    else if (perf.level === 2) { renderer.shadowMap.enabled = false; key.castShadow = false; ao.enabled = false; }
    else if (perf.level === 3) { glowOn = false; mix.enabled = false; } // the glow goes last: the hall's look rests on it
  }

  function update(dt, time) {
    for (const t of teams) {
      // paddle: under-damped spring for a little pop
      t.vel += (t.target - t.lift) * 140 * dt - t.vel * 15 * dt;
      t.lift += t.vel * dt;
      if (reducedMotion()) { t.lift = t.target; t.vel = 0; }
      if (t.paddle && t.rest) {
        t.paddle.position.y = t.rest.y + t.lift * t.liftBy;
        t.paddle.rotation.z = t.lift * 0.08;
      }
      const k = 1 - Math.exp(-dt * 9);
      t.color.lerp(t.goal, k);
      t.power += (t.goalPower - t.power) * k;
      let pulse = 1;
      if (t.flash >= 0) {
        t.flash += dt;
        pulse = 1 + 0.9 * Math.exp(-t.flash * 2.2) * (0.6 + 0.4 * Math.cos(t.flash * 14));
        if (t.flash > 3) t.flash = -2; // done, but remember it already flashed
      }
      for (const m of t.lamps) {
        m.color.copy(t.color);
        if (m.emissive) { m.emissive.copy(t.color); m.emissiveIntensity = t.power * pulse; }
      }
    }
    if (hammer && strike >= 0) {
      // lift a touch, slam onto the block, a small rebound, then back up to rest
      strike += dt;
      let a;
      if (strike < 0.16) a = -0.16 * easeOutCubic(strike / 0.16);
      else if (strike < 0.27) a = -0.16 + (HAMMER_HIT + 0.16) * ((strike - 0.16) / 0.11) ** 2;
      else if (strike < 0.42) a = HAMMER_HIT - 0.05 * Math.sin(((strike - 0.27) / 0.15) * Math.PI);
      else if (strike < 0.85) a = HAMMER_HIT * (1 - easeInOut((strike - 0.42) / 0.43));
      else { a = 0; strike = -1; }
      if (onImpact && strike >= 0.27) { onImpact(); onImpact = null; }
      hammer.rotation.x = hammerRest + a;
    }
    if (screen?.dirty) paintScreenNow();
    placeCamera(time);
    if (pointer) {
      const ti = pick(pointer[0], pointer[1]);
      if (ti !== hovered) {
        hovered = ti;
        canvasEl.style.cursor = ti == null ? '' : 'pointer';
        labels.setHover(ti);
      }
    }
  }

  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);
    const dtMs = now - last;
    last = now;
    if (document.hidden || !visible) return;
    update(Math.min(0.05, dtMs / 1000), now / 1000);
    if (glowOn) renderGlow();
    renderer.shadowMap.needsUpdate = true;
    composer.render();
    labels.render(scene, camera);
    if (now > perf.wait && perf.level < 3) {
      perf.n += 1;
      perf.sum += dtMs;
      if (perf.n === 90) {
        if (perf.sum / perf.n > 25) { degrade(); perf.wait = now + 1500; }
        perf.n = 0;
        perf.sum = 0;
      }
    }
  }

  canvasEl.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    running = false;
    onLost?.();
  });

  sync();
  paintScreenNow();
  requestAnimationFrame(loop);

  return {
    destroy() {
      running = false;
      offs.forEach((off) => off());
      offSelect();
      ro.disconnect();
      io.disconnect();
      labels.element.remove();
      renderer.domElement.remove();
      passes.forEach((p) => p.dispose());
      composer.dispose();
      bloom.dispose();
      glowComposer.dispose();
      glowOf.forEach((m) => m.dispose());
      BLACK.dispose();
      renderer.dispose();
    },
  };
}


/** WCAG contrast ratio between two hex colours. */
function contrast(a, b) {
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
