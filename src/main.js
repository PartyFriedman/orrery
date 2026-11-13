import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
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

// Renderer (tegneflaten) med myke skygger. Den er gjennomsiktig, så
// bakgrunnsgradienten bak (fra siden selv) synes uten noen gulvkant.
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
// Tonemapping demper de lyseste flatene i stedet for å brenne dem ut til ren hvit.
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = look.exposure;
document.querySelector('#app').appendChild(renderer.domElement);

document.body.style.background =
  `linear-gradient(to bottom, ${look.backgroundTop}, ${look.backgroundBottom})`;

// Scene med miljøkart: et mykt "rom" som gir lys og refleksjoner fra alle kanter.
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = look.environmentIntensity;

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

// Hovedlys: lavt fra siden, så det streifer toppflaten og fanger tennene.
// Et spotlys med helt myk kant gir en glidende overgang fra lyst til mørkere
// over flatene. Fyll-lyset kommer fra miljøkartet.
const lightDistance = 140;
const sun = new THREE.SpotLight('#ffffff', look.lightIntensity);
sun.decay = 0;     // lyset svekkes ikke med avstanden, bare mot kanten av lyskjeglen
sun.penumbra = 1;  // helt myk kant
sun.angle = Math.atan((totalWidth / 2) * look.lightSpread / lightDistance);
const height = THREE.MathUtils.degToRad(look.lightHeight);
const around = THREE.MathUtils.degToRad(look.lightDirection);
sun.position.set(
  Math.cos(height) * Math.cos(around) * lightDistance,
  Math.sin(height) * lightDistance,
  -Math.cos(height) * Math.sin(around) * lightDistance
);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.radius = look.shadowSoftness;
sun.shadow.blurSamples = 16;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.05; // hindrer stripete skygge når lyset kommer lavt inn
sun.shadow.camera.near = 10;
sun.shadow.camera.far = lightDistance * 2;
scene.add(sun);
scene.add(sun.target); // lyset peker mot midten av scenen

// Usynlig gulv som bare viser skyggen, så det ikke finnes noen gulvkant.
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.ShadowMaterial({ opacity: look.shadowStrength })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Tannhjulene, løftet litt over gulvet.
// Satengmatt hvit lakk: halvmatt grunnfarge med et tynt, mykt klarlakklag oppå.
const gearMaterial = new THREE.MeshPhysicalMaterial({
  color: look.gearColor,
  roughness: look.roughness,
  metalness: 0,
  clearcoat: look.gloss,
  clearcoatRoughness: look.glossRoughness,
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
