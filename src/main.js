// Siden: scene, kamera og lys, fokus og panelene, og animasjonen. Delene
// bygges i model.js.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { bodies } from './config.js';
import { createRenderer, createLitScene, addShadowFloor, setGradientBackground } from './scene.js';
import { updateBlur, setBlurLevel } from './blur.js';
import { reach as armReach, dateAt } from './mechanism.js';
import * as model from './model.js';
import { daysPerYear } from './ephemeris.js';
import { createTimeControl } from './timeControl.js';
import { createFocus } from './focus.js';
import { createPicking } from './picking.js';
import { createFocusPanel } from './focusPanel.js';
import { createDriveView } from './driveView.js';
import { createBodyLift } from './bodyLift.js';

// Hvor langt ut og opp modellen rekker, så kamera og lys kan tilpasses.
const reach = Math.max(...Object.values(armReach).map((r) => r.outer));
const modelHeight = bodies.height + bodies.sunRadius;

// Renderer, miljøkart og hovedlys (scene.js), og sidens gradient som bakgrunn,
// så glasset i ringene har noe å se gjennom.
const { renderer, environment } = createRenderer();
const scene = createLitScene(environment, reach, 4096);
setGradientBackground(scene);

// Kamera skrått ovenfra, trukket så langt tilbake at hele modellen får plass
// mens armen går rundt.
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 4000);
const cameraTarget = new THREE.Vector3(0, modelHeight * 0.1, 0);
const cameraDirection = new THREE.Vector3(55, 65, 75).normalize();
function fitCamera() {
  // Litt mindre enn en kule rundt alt: sett skrått ovenfra tar sirkelen armen
  // feier over mindre plass enn kula.
  const fitRadius = Math.hypot(reach, modelHeight / 2) * 0.9;
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const distance = fitRadius / Math.sin(Math.min(vFov, hFov) / 2);
  camera.position.copy(cameraDirection).multiplyScalar(distance).add(cameraTarget);
}
fitCamera();
const home = { target: cameraTarget.clone(), position: camera.position.clone() }; // startbildet (focus.js)

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(cameraTarget);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.05; // ikke under gulvet

addShadowFloor(scene, reach);
scene.add(model.root);

// Tilpass ved endring av vindusstørrelse.
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Fokus: klikk eller trykk på en kule, så glir kameraet over til den og følger
// den (focus.js), og navnet vises øverst (focusPanel.js). Sola eller × i
// panelet gir tilbake til startbildet. Bryteren «Drive» i panelet viser bare
// drivet til kroppen (driveView.js); den huskes når man bytter kropp.
const cameraFocus = createFocus({ camera, controls, bodies: model.spheres, home });
const driveView = createDriveView(model.root);
setBlurLevel(driveView.levelOf);
let driveOn = false;
const selectBody = (name) => {
  cameraFocus.select(name);
  focusPanel.show(cameraFocus.selected);
  driveView.set(driveOn, cameraFocus.selected);
};
const setDriveView = (on) => {
  driveOn = on;
  focusPanel.setDrive(on);
  driveView.set(driveOn, cameraFocus.selected);
};
const focusPanel = createFocusPanel({ onClose: () => selectBody('sun'), onDrive: setDriveView });
// Kulene åpner seg litt under musepekeren, og ved et trykk på mobil (bodyLift.js).
const bodyLift = createBodyLift(model.spheres);
const picking = createPicking(camera, renderer.domElement, model.spheres, (name, pointerType) => {
  selectBody(name);
  if (pointerType !== 'mouse') bodyLift.pulse(name);
}, { onHover: bodyLift.hover });

// Animasjon: tiden går med farten fra glidebryteren, og inngangsvinkelen
// følger av den. Hver del får vinkelen mekanismen regner ut fra tanntallene.
const timeControl = createTimeControl();
let lastTime = null;
let years = 0; // år siden startdatoen
let shownYears = null; // tiden delene sist ble stilt etter
renderer.setAnimationLoop((time) => {
  // Høyst 0,1 s per bilde, så modellen ikke hopper etter at fanen har vært skjult.
  const seconds = lastTime === null ? 0 : Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;
  years += (timeControl.daysPerSecond() * seconds) / daysPerYear;
  timeControl.show(dateAt(years));

  // Står tiden stille, står alle delene der de står; da trengs ingen ny utregning.
  if (years !== shownYears) {
    shownYears = years;
    model.update(years);
  }
  // Kula under pekeren åpner seg (før plexus-kulene, som leser hvor åpne de er).
  picking.update();
  bodyLift.update(seconds);
  // Plexus-kulene driver i vanlig tid, uansett hvor fort modellen går.
  for (const update of model.plexusUpdates) update(time / 1000);
  // Lysspor, vifter og glatte former for det som går fort (blur i config). Kalles
  // også når tiden står stille, så sporene forsvinner.
  updateBlur();

  // Kameraet følger kroppen i fokus, etter at delene har fått sine vinkler.
  cameraFocus.update(seconds);
  driveView.update(seconds);
  controls.update();
  renderer.render(scene, camera);
});
