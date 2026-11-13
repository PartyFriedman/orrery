import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { gear, bigGear, smallGear, look } from './config.js';
import { createGearGeometry } from './gear.js';

// Geometri for de to hjulene: avstanden mellom sentrene følger av tanntallene.
const centerDistance = (gear.module * (bigGear.teeth + smallGear.teeth)) / 2;
const bigTipRadius = (gear.module * bigGear.teeth) / 2 + gear.module;
const smallTipRadius = (gear.module * smallGear.teeth) / 2 + gear.module;
const totalWidth = bigTipRadius + centerDistance + smallTipRadius;
const bigX = bigTipRadius - totalWidth / 2; // midtstill paret i bildet
const smallX = bigX + centerDistance;
const ratio = bigGear.teeth / smallGear.teeth; // lille hjul går så mange ganger fortere

// Renderer (tegneflaten) med myke skygger.
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.querySelector('#app').appendChild(renderer.domElement);

// Scene og bakgrunn.
const scene = new THREE.Scene();
scene.background = new THREE.Color(look.background);

// Kamera skrått ovenfra, trukket så langt tilbake at begge hjulene får plass.
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 2000);
const cameraDirection = new THREE.Vector3(55, 65, 75).normalize(); // samme vinkel som før
function fitCamera() {
  const fitRadius = (totalWidth / 2) * 1.15;
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const distance = fitRadius / Math.sin(Math.min(vFov, hFov) / 2);
  camera.position.copy(cameraDirection).multiplyScalar(distance);
}
fitCamera();

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.05; // ikke under gulvet

// Lys: mykt fyll-lys + ett hovedlys som kaster skygge.
scene.add(new THREE.HemisphereLight('#ffffff', '#9a9a9a', 1.6));

const sun = new THREE.DirectionalLight('#ffffff', 2.2);
sun.position.set(30, 60, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.radius = 6;
sun.shadow.blurSamples = 16;
sun.shadow.bias = -0.0005;
const s = sun.shadow.camera;
// Skyggeområdet må dekke begge hjulene.
const shadowSize = totalWidth / 2 + 10;
s.left = s.bottom = -shadowSize;
s.right = s.top = shadowSize;
s.near = 1;
s.far = 200;
scene.add(sun);

// Gulv i samme farge som bakgrunnen, så bare skyggen synes.
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshStandardMaterial({ color: look.background, roughness: 1 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Tannhjulene, løftet litt over gulvet.
const gearMaterial = new THREE.MeshStandardMaterial({
  color: look.gearColor,
  roughness: 0.85,
  metalness: 0,
});
function addGear(settings, x) {
  const mesh = new THREE.Mesh(createGearGeometry({ ...gear, ...settings }), gearMaterial);
  mesh.position.set(x, 2, 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}
const bigMesh = addGear(bigGear, bigX);
const smallMesh = addGear(smallGear, smallX);

// Startvinkel for det lille hjulet: vri det en halv tann, så det har et mellomrom
// der det store hjulet har en tann (der de møtes).
const smallStartAngle = Math.PI + Math.PI / smallGear.teeth;

// Tilpass ved endring av vindusstørrelse.
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animasjon: det store hjulet roterer med valgt fart. Det lille følger av
// tannforholdet, og går motsatt vei.
let lastTime = null;
let bigAngle = 0;
renderer.setAnimationLoop((time) => {
  const seconds = lastTime === null ? 0 : (time - lastTime) / 1000;
  lastTime = time;

  bigAngle += (gear.speed / 60) * Math.PI * 2 * seconds;
  bigMesh.rotation.y = bigAngle;
  smallMesh.rotation.y = smallStartAngle - bigAngle * ratio;

  controls.update();
  renderer.render(scene, camera);
});
