import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { gear, look } from './config.js';
import { createGearGeometry } from './gear.js';

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

// Kamera skrått ovenfra.
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.set(55, 65, 75);

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
s.left = s.bottom = -50;
s.right = s.top = 50;
s.near = 1;
s.far = 150;
scene.add(sun);

// Gulv i samme farge som bakgrunnen, så bare skyggen synes.
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshStandardMaterial({ color: look.background, roughness: 1 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Tannhjulet, løftet litt over gulvet.
const gearMesh = new THREE.Mesh(
  createGearGeometry(gear),
  new THREE.MeshStandardMaterial({ color: look.gearColor, roughness: 0.85, metalness: 0 })
);
gearMesh.position.y = 2;
gearMesh.castShadow = true;
gearMesh.receiveShadow = true;
scene.add(gearMesh);

// Tilpass ved endring av vindusstørrelse.
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animasjon: roter hjulet med valgt hastighet (omdreininger per minutt).
let lastTime = null;
renderer.setAnimationLoop((time) => {
  const seconds = lastTime === null ? 0 : (time - lastTime) / 1000;
  lastTime = time;

  gearMesh.rotation.y += (gear.speed / 60) * Math.PI * 2 * seconds;

  controls.update();
  renderer.render(scene, camera);
});
