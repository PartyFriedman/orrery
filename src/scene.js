// Felles for modellen og testsidene: renderer, miljøkart, hovedlys og
// bakgrunnen (look i config.js).
import './style.css';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { look } from './config.js';

// Renderer med myke skygger. Den er gjennomsiktig, så bakgrunnsgradienten bak
// (fra siden selv) synes uten noen gulvkant. Tonemapping demper de lyseste
// flatene i stedet for å brenne dem ut til ren hvit. Miljøkartet er et mykt
// «rom» som gir lys og refleksjoner fra alle kanter.
export function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = look.exposure;
  document.querySelector('#app').appendChild(renderer.domElement);
  document.body.style.background = `linear-gradient(to bottom, ${look.backgroundTop}, ${look.backgroundBottom})`;
  const environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  return { renderer, environment };
}

// En scene med miljøkartet og hovedlyset. reach er hvor langt ut fra origo det
// som skal ha lys og skygge rekker.
export function createLitScene(environment, reach, shadowMapSize = 2048) {
  const scene = new THREE.Scene();
  scene.environment = environment;
  scene.environmentIntensity = look.environmentIntensity;
  addLight(scene, reach, shadowMapSize);
  return scene;
}

// Hovedlyset: lavt fra siden, så det streifer toppflatene og fanger tennene.
// Et spotlys med helt myk kant gir en glidende overgang fra lyst til mørkere
// over flatene. Fyll-lyset kommer fra miljøkartet.
function addLight(scene, reach, shadowMapSize) {
  const lightDistance = reach * 3;
  const light = new THREE.SpotLight('#ffffff', look.lightIntensity);
  light.decay = 0;     // lyset svekkes ikke med avstanden, bare mot kanten av lyskjeglen
  light.penumbra = 1;  // helt myk kant
  light.angle = Math.atan((reach * look.lightSpread) / lightDistance);
  const height = THREE.MathUtils.degToRad(look.lightHeight);
  const around = THREE.MathUtils.degToRad(look.lightDirection);
  light.position.set(
    Math.cos(height) * Math.cos(around) * lightDistance,
    Math.sin(height) * lightDistance,
    -Math.cos(height) * Math.sin(around) * lightDistance
  );
  light.castShadow = true;
  light.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  light.shadow.radius = look.shadowSoftness;
  light.shadow.bias = -0.0005;
  light.shadow.normalBias = 0.05; // hindrer stripete skygge når lyset kommer lavt inn
  light.shadow.camera.near = lightDistance * 0.3;
  light.shadow.camera.far = lightDistance * 2;
  scene.add(light);
  scene.add(light.target); // lyset peker mot midten av scenen
}

// Usynlig gulv som bare viser skyggen, så det ikke finnes noen gulvkant.
export function addShadowFloor(scene, reach) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(reach * 20, reach * 20), new THREE.ShadowMaterial({ opacity: look.shadowStrength }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
}

// Gradienten fra siden som bakgrunn i scenen, så glass har noe å se gjennom.
// Mot en gjennomsiktig bakgrunn blir glasset grått.
export function setGradientBackground(scene) {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, look.backgroundTop);
  gradient.addColorStop(1, look.backgroundBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  scene.background = texture;
}
