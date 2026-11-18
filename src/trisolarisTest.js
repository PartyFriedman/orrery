// Testsiden Trisolaris: tre like soler i åttetallsbanen på hver sin
// sleidemaskin, og en planet på en ring rundt alle tre (trisolaris i config.js,
// målene i trisolarisDesign.js, tegningen i trisolarisBuild.js). Åpnes på
// /orrery/trisolaris.html med `npm run dev`.
// Knappene A, B og C bytter variant (hvor mange korreksjonshjul), og «Bane»
// slår den eksakte banen av og på. Klikk stopper og starter; dra for å snu.
// I adressen: ?v=B (varianten), ?t=12 (sekunder ut i runden), &stop (står
// stille), &cam=x,y,z&target=x,y,z (kameraet), &trace=0 (uten banen).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { trisolaris as T, look, accent } from './config.js';
import { createRenderer, createLitScene, addShadowFloor, setGradientBackground } from './scene.js';
import { buildTrisolaris } from './trisolarisBuild.js';
import { variants, exactPoint, H, summary, drive } from './trisolarisDesign.js';

const query = new URLSearchParams(location.search);
const vector = (text) => (text ? new THREE.Vector3(...text.split(',').map(Number)) : null);
const comma = (x, digits) => x.toFixed(digits).replace('.', ',');

// --- Scenen, kameraet og lyset ---
const { renderer, environment } = createRenderer();
const reach = summary.reach;
const scene = createLitScene(environment, reach, 4096);
setGradientBackground(scene);
addShadowFloor(scene, reach);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 4000);
const target = vector(query.get('target')) ?? new THREE.Vector3(0, H * 0.6, 4);
const direction = new THREE.Vector3(0.45, 0.3, 1).normalize();
function fitCamera() {
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const distance = (Math.hypot(reach, summary.height / 2) * 0.78) / Math.sin(Math.min(vFov, hFov) / 2);
  camera.position.copy(direction).multiplyScalar(distance).add(target);
}
const cameraAt = vector(query.get('cam'));
if (cameraAt) camera.position.copy(cameraAt);
else fitCamera();
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(target);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.05;
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Den eksakte banen, som en tynn linje gjennom sentrum av solene ---
const tracePoints = [];
for (let i = 0; i < 720; i++) {
  const p = exactPoint((2 * Math.PI * i) / 720);
  tracePoints.push(new THREE.Vector3(p.x, H, p.z));
}
const trace = new THREE.Mesh(
  new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tracePoints, true), 720, T.trace.radius, 6, true),
  new THREE.MeshBasicMaterial({ color: T.trace.color })
);
trace.visible = query.has('trace') ? query.get('trace') !== '0' : T.trace.show;
scene.add(trace);

// --- Modellen, bygget på nytt når varianten byttes ---
let variant = variants[query.get('v')] ? query.get('v') : T.variant;
let model = null;
function dispose(object) {
  object.traverse((o) => {
    o.geometry?.dispose();
    for (const m of [o.material].flat()) m?.dispose?.();
  });
}

// --- Panelet øverst: variantene, banen og tallene ---
const panel = document.createElement('div');
panel.className = 'tri-panel';
panel.style.setProperty('--metal', look.seamColor);
panel.style.setProperty('--white', look.gearColor);
panel.style.setProperty('--accent', accent.color);
const head = document.createElement('div');
head.className = 'tri-row';
const title = document.createElement('span');
title.className = 'tri-title';
title.textContent = 'Trisolaris';
head.append(title);
const buttons = {};
for (const key of Object.keys(variants)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'tri-button';
  b.textContent = key;
  b.title = `${variants[key].title}: ${variants[key].note}`;
  b.addEventListener('click', () => setVariant(key));
  buttons[key] = b;
  head.append(b);
}
const traceButton = document.createElement('button');
traceButton.type = 'button';
traceButton.className = 'tri-button';
traceButton.textContent = 'Bane';
traceButton.title = 'Den eksakte åttetallsbanen';
traceButton.addEventListener('click', () => {
  trace.visible = !trace.visible;
  traceButton.setAttribute('aria-pressed', String(trace.visible));
});
traceButton.setAttribute('aria-pressed', String(trace.visible));
head.append(traceButton);
const info = document.createElement('div');
info.className = 'tri-info';
info.setAttribute('aria-live', 'polite');
panel.append(head, info);
document.body.appendChild(panel);

const hint = document.createElement('div');
hint.className = 'tri-hint';
hint.textContent = 'Klikk stopper eller starter · dra for å snu';
document.body.appendChild(hint);

const kindNames = [['hjul', 'hjul'], ['aksel', 'aksler og tapper'], ['sleide', 'sleider og skinner'], ['arm', 'armer og skiver'], ['ramme', 'rammedeler']];
function showInfo() {
  const v = variants[variant];
  const total = Object.values(model.counts).reduce((s, n) => s + n, 0);
  const parts = kindNames.map(([k, label]) => `${model.counts[k] ?? 0} ${label}`).join(', ');
  info.innerHTML = [
    `<strong>${v.title}</strong> (${v.note}) · største feil ${comma(v.error, 2)} mm, ${comma((100 * v.error) / T.halfWidth, 1)} % av halve bredden`,
    `${total} deler: ${parts}`,
    `Planeten går én runde per ${comma(drive.planetPeriod, 1)} runder i åttetallet · 7θ og 8θ bygges ikke (senteravstand under 0,4 mm)`,
  ].join('<br>');
  for (const [key, b] of Object.entries(buttons)) b.setAttribute('aria-pressed', String(key === variant));
}

let time = Number(query.get('t')) || 0;
function setVariant(key) {
  if (model) {
    scene.remove(model.root);
    dispose(model.root);
  }
  variant = key;
  model = buildTrisolaris(key);
  scene.add(model.root);
  model.update((2 * Math.PI * time) / T.roundTime, time);
  showInfo();
}
setVariant(variant);

// --- Klikk stopper og starter (et dra snur kameraet) ---
let running = !query.has('stop');
let press = null;
const canvas = renderer.domElement;
canvas.addEventListener('pointerdown', (e) => { press = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', (e) => {
  if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 5) running = !running;
  press = null;
});

let last = null;
renderer.setAnimationLoop((now) => {
  const seconds = last === null ? 0 : Math.min((now - last) / 1000, 0.1);
  last = now;
  if (running) time += seconds;
  model.update((2 * Math.PI * time) / T.roundTime, time);
  controls.update();
  renderer.render(scene, camera);
});
