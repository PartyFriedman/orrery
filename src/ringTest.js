// Mønsterprøve: Saturns ring. Åpnes på /orrery/rings.html med `npm run dev`.
// Fire varianter side om side, hver med Saturn i sekskantmønsteret i midten og
// ringen i ekvatorplanet, med 26,7° helning (planets.saturn.ring.tilt). Hver
// variant vises stor, og under i samme størrelse på skjermen som i modellen
// (fra modellkameraets avstand til Saturn, i samme vindu). Kameraet går sakte
// rundt i alle rutene samtidig, så ringen sees fra kanten, ovenfra og nedenfra.
// Tallene står i saturnRing i config.js. Klikk stopper og starter; dra for å snu.
// ?t=15 i adressen starter 15 sekunder ut i runden, og &stop står stille der.
import * as THREE from 'three';
import { planets, planetSize, bodies, look, saturnRing as S } from './config.js';
import { createPanelGeometry } from './panels.js';
import { ringLayout, createAnnulus, createGlassMaterials } from './ring.js';
import { createRenderer, createLitScene } from './scene.js';
import { createMaterials, lookOf } from './materials.js';
import { reach as armReach, armLengths } from './mechanism.js';

const degrees = THREE.MathUtils.degToRad;
const R = planetSize('saturn');
const tilt = degrees(planets.saturn.ring.tilt);
const layout = ringLayout(R, S);
const { renderer, environment } = createRenderer();
const base = createMaterials();

// --- Materialene ---
const satin = new THREE.MeshPhysicalMaterial({
  color: S.satin.color, roughness: S.satin.roughness, metalness: 0,
  clearcoat: S.satin.gloss, clearcoatRoughness: S.satin.glossRoughness,
});
const instrumentMetal = new THREE.MeshPhysicalMaterial({
  color: S.instrument.color, metalness: S.instrument.metalness, roughness: S.instrument.roughness,
});
const gapMetal = new THREE.MeshPhysicalMaterial({
  color: S.mix.gapColor, metalness: S.mix.gapMetalness, roughness: S.mix.gapRoughness,
});
// Glasset er det samme som i modellen, med kantlys (createGlassMaterials i ring.js).
const glassTones = createGlassMaterials(S);
const glassFor = (band) => glassTones[Math.min(band.index, glassTones.length - 1)];

// --- Delene ---
function addRing(parent, inner, outer, thickness, material) {
  const mesh = new THREE.Mesh(createAnnulus(inner, outer, thickness, S.chamfer), material);
  mesh.castShadow = !material.transmission; // glasset stenger ikke lyset helt
  mesh.receiveShadow = true;
  parent.add(mesh);
}

function addSaturn(parent) {
  const { geometry, coreRadius } = createPanelGeometry({
    radius: R, ...lookOf('saturn'),
  });
  const mesh = new THREE.Mesh(geometry, [base.white, base.metal]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  const core = new THREE.Mesh(new THREE.SphereGeometry(coreRadius, 48, 24), base.metal);
  core.receiveShadow = true;
  parent.add(core);
}

const variants = [
  {
    title: 'A: satengmatt hvit',
    note: 'hel skive, Cassinidelingen som åpen spalte',
    build(group) {
      for (const p of layout.parts) addRing(group, p.inner, p.outer, S.thickness, satin);
    },
  },
  {
    title: 'B: instrument',
    note: `${S.instrument.rings} tynne ringer i mørkt metall`,
    build(group) {
      // Ringene fordeles på de to delene etter bredden, med en ring helt ytterst og innerst i hver.
      const { ringWidth: w, thickness } = S.instrument;
      const widths = layout.parts.map((p) => p.outer - p.inner);
      const inside = Math.max(2, Math.round((S.instrument.rings * widths[0]) / (widths[0] + widths[1])));
      const counts = [inside, Math.max(2, S.instrument.rings - inside)];
      layout.parts.forEach((p, i) => {
        const n = counts[i];
        for (let k = 0; k < n; k++) {
          const start = p.inner + (k * (p.outer - p.inner - w)) / (n - 1);
          addRing(group, start, start + w, thickness, instrumentMetal);
        }
      });
    },
  },
  {
    title: 'C: frostet glass',
    note: `${layout.bands.length} bånd med hver sin tone, åpen spalte`,
    build(group) {
      for (const b of layout.bands) addRing(group, b.inner, b.outer, S.thickness, glassFor(b));
    },
  },
  {
    title: 'D: glass og hvitt',
    note: 'glass innerst, satengmatt hvitt ytterst, mørk spalte',
    build(group) {
      for (const b of layout.bands) {
        addRing(group, b.inner, b.outer, S.thickness, b.index < S.mix.glassBands ? glassFor(b) : satin);
      }
      addRing(group, layout.gap.inner, layout.gap.outer, S.thickness * S.mix.gapDepth, gapMetal);
    },
  },
];

// Hver variant får sin egen scene med sola og skyggen som i modellen, og to
// kameraer: ett nært og ett fra modellens avstand.
for (const v of variants) {
  v.scene = createLitScene(environment, layout.outer * 1.15);
  const system = new THREE.Group();
  system.rotation.z = tilt; // aksen og ringen heller mot -x; rett forfra sees ringen fra kanten
  v.scene.add(system);
  addSaturn(system);
  v.build(system);
  v.large = new THREE.PerspectiveCamera(30, 1, 1, 100);
  v.model = new THREE.PerspectiveCamera(10, 1, 1, 1000);
}
const ringNormal = new THREE.Vector3(0, 1, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), tilt);

// --- Modellens kamera: hvor langt unna Saturn er, og hvor stort det tegnes ---
// Som fitCamera i main.js, med det samme vinduet. Avstanden er snittet over
// en runde Saturn tar rundt sola.
function modelDistance() {
  const reach = Math.max(...Object.values(armReach).map((r) => r.outer));
  const modelHeight = bodies.height + bodies.sunRadius;
  const vFov = degrees(40);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (window.innerWidth / window.innerHeight));
  const distance = (Math.hypot(reach, modelHeight / 2) * 0.9) / Math.sin(Math.min(vFov, hFov) / 2);
  const camera = new THREE.Vector3(55, 65, 75).normalize().multiplyScalar(distance).add({ x: 0, y: modelHeight * 0.1, z: 0 });
  const L = armLengths.saturn;
  let sum = 0;
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    sum += camera.distanceTo({ x: L * Math.cos(a), y: bodies.height, z: L * Math.sin(a) });
  }
  return sum / 72;
}

// --- Rutene på skjermen og tekstene ---
const textColor = look.gearColor;
const overlay = document.createElement('div');
document.body.appendChild(overlay);
const makeText = (html, style) => {
  const el = document.createElement('div');
  el.innerHTML = html;
  Object.assign(el.style, {
    position: 'fixed', pointerEvents: 'none', color: textColor, textShadow: '0 1px 3px #000',
    font: '500 14px/1.3 system-ui, sans-serif', ...style,
  });
  overlay.appendChild(el);
  return el;
};
for (const v of variants) {
  v.titleEl = makeText(`${v.title}<br><small style="opacity:.7">${v.note}</small>`, { textAlign: 'center', transform: 'translate(-50%, 0)' });
  v.largeEl = makeText('Stor', { font: '12px system-ui, sans-serif', opacity: 0.55 });
  v.modelEl = makeText('', { font: '12px system-ui, sans-serif', opacity: 0.55 });
  v.lineEl = makeText('', { height: '1px', background: `color-mix(in srgb, ${textColor} 12%, transparent)`, textShadow: 'none' });
}
const footer = makeText('', {
  left: '50%', bottom: '14px', transform: 'translate(-50%, 0)', font: '12px system-ui, sans-serif', opacity: 0.7,
  fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
});

const header = 52;
let distanceInModel = modelDistance();
function placeCells() {
  const W = window.innerWidth, H = window.innerHeight;
  const columns = W >= H ? 4 : 2;
  const rows = variants.length / columns;
  const cellW = W / columns, cellH = (H - 36) / rows; // plass til linja nederst
  variants.forEach((v, i) => {
    const x = (i % columns) * cellW, y = Math.floor(i / columns) * cellH;
    const inner = cellH - header;
    v.largeRect = { x, y: y + header, w: cellW, h: inner * 0.7 };
    v.modelRect = { x, y: y + header + inner * 0.7, w: cellW, h: inner * 0.3 };
    Object.assign(v.titleEl.style, { left: `${x + cellW / 2}px`, top: `${y + 10}px` });
    Object.assign(v.largeEl.style, { left: `${x + 14}px`, top: `${v.largeRect.y + 4}px` });
    Object.assign(v.modelEl.style, { left: `${x + 14}px`, top: `${v.modelRect.y + 6}px` });
    Object.assign(v.lineEl.style, { left: `${x + 14}px`, top: `${v.modelRect.y}px`, width: `${cellW - 28}px` });
    v.modelEl.textContent = `Som i modellen (fra ${Math.round(distanceInModel)} mm)`;
  });
}
placeCells();
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  distanceInModel = modelDistance();
  placeCells();
});

// --- Kameraene: sakte rundt, og opp og ned mellom lowest og highest ---
const query = new URLSearchParams(location.search);
let running = !query.has('stop'), time = Number(query.get('t')) || 0, turnOffset = 0, heightOffset = 0;
let press = null;
const canvas = renderer.domElement;
canvas.style.cursor = 'grab';
canvas.addEventListener('pointerdown', (e) => {
  press = { x: e.clientX, y: e.clientY, moved: false };
  canvas.setPointerCapture(e.pointerId);
  canvas.style.cursor = 'grabbing';
});
canvas.addEventListener('pointermove', (e) => {
  if (!press) return;
  const dx = e.clientX - press.x, dy = e.clientY - press.y;
  if (Math.hypot(dx, dy) > 4) press.moved = true;
  if (!press.moved) return;
  turnOffset -= dx * 0.4;
  heightOffset += dy * 0.3;
  press.x = e.clientX;
  press.y = e.clientY;
});
canvas.addEventListener('pointerup', () => {
  if (press && !press.moved) running = !running;
  press = null;
  canvas.style.cursor = 'grab';
});

const direction = new THREE.Vector3();
function aim(camera, rect, distance, fov, fitRadius) {
  camera.aspect = rect.w / rect.h;
  camera.fov = fov;
  camera.near = Math.max(0.1, distance - fitRadius * 3);
  camera.far = distance + fitRadius * 3;
  camera.updateProjectionMatrix();
  camera.position.copy(direction).multiplyScalar(distance);
  camera.lookAt(0, 0, 0);
}
// Bakgrunnen i hver rute: akkurat den biten av sidens gradient som ligger bak
// ruta. Glasset trenger noe bak seg å bryte; mot en gjennomsiktig bakgrunn
// blir det bare grått.
// (CSS blander fargene i sRGB, så det gjør vi også.)
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const pageColor = (y) => {
  const f = THREE.MathUtils.clamp(y / window.innerHeight, 0, 1);
  const [top, bottom] = [rgb(look.backgroundTop), rgb(look.backgroundBottom)];
  return `rgb(${top.map((c, i) => Math.round(c + (bottom[i] - c) * f)).join(' ')})`;
};
const backgrounds = new Map();
function backgroundFor(rect) {
  const key = `${rect.y}|${rect.h}`;
  if (!backgrounds.has(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, pageColor(rect.y));
    gradient.addColorStop(1, pageColor(rect.y + rect.h));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1, 256);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    backgrounds.set(key, texture);
  }
  return backgrounds.get(key);
}
window.addEventListener('resize', () => {
  for (const texture of backgrounds.values()) texture.dispose();
  backgrounds.clear();
});

function draw(scene, camera, rect) {
  const H = window.innerHeight;
  scene.background = backgroundFor(rect);
  renderer.setViewport(rect.x, H - rect.y - rect.h, rect.w, rect.h);
  renderer.setScissor(rect.x, H - rect.y - rect.h, rect.w, rect.h);
  renderer.render(scene, camera);
}

renderer.setScissorTest(true);
let last = null;
renderer.setAnimationLoop((now) => {
  const seconds = last === null ? 0 : Math.min((now - last) / 1000, 0.1);
  last = now;
  if (running) time += seconds;

  const { turn, bob, lowest, highest } = S.view;
  const around = degrees((360 * time) / turn + turnOffset);
  const swing = (1 - Math.cos((2 * Math.PI * time) / bob)) / 2;
  const height = degrees(THREE.MathUtils.clamp(lowest + (highest - lowest) * swing + heightOffset, -80, 89));
  direction.set(Math.cos(height) * Math.sin(around), Math.sin(height), Math.cos(height) * Math.cos(around));

  const opening = THREE.MathUtils.radToDeg(Math.asin(direction.dot(ringNormal)));
  const side = Math.abs(opening) < 1 ? 'fra kanten' : opening > 0 ? 'ovenfra' : 'nedenfra';
  footer.textContent = `Ringen sett ${side}, ${Math.abs(opening).toFixed(0)}° åpen · klikk stopper eller starter · dra for å snu`;

  const H = window.innerHeight;
  const fit = layout.outer * 1.08;
  for (const v of variants) {
    const large = v.largeRect;
    const vFov = degrees(30);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (large.w / large.h));
    aim(v.large, large, fit / Math.sin(Math.min(vFov, hFov) / 2), 30, fit);
    draw(v.scene, v.large, large);
    // Samme vinkel per piksel som modellkameraet (40° over hele vinduet).
    const modelFov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(degrees(20)) * (v.modelRect.h / H)));
    aim(v.model, v.modelRect, distanceInModel, modelFov, fit);
    draw(v.scene, v.model, v.modelRect);
  }
});
