// Felles scene for testsidene (panels.html og plexus.html): renderer, miljø,
// lys, skyggegulv, kamera og materialer som i modellen (look i config.js), og
// navn under hver kule. Kulene stilles opp i rader rett mot kameraet.
// rings.html bruker bare renderer, lys og materialer (createRenderer,
// createLitScene og createMaterials), og har egne kameraer.
import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { look } from './config.js';

// Renderer med gjennomsiktig bakgrunn (gradienten ligger på siden), myke
// skygger og tonemapping som i main.js, og miljøkartet til scenene.
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

// En scene med miljøkartet og hovedlyset som i main.js. reach er hvor langt
// ut fra origo det som skal ha lys og skygge rekker.
export function createLitScene(environment, reach) {
  const scene = new THREE.Scene();
  scene.environment = environment;
  scene.environmentIntensity = look.environmentIntensity;
  addLight(scene, reach);
  return scene;
}

// Materialene som i main.js.
export function createMaterials() {
  return {
    white: new THREE.MeshPhysicalMaterial({
      color: look.gearColor, roughness: look.roughness, metalness: 0,
      clearcoat: look.gloss, clearcoatRoughness: look.glossRoughness,
    }),
    metal: new THREE.MeshPhysicalMaterial({
      color: look.seamColor, metalness: look.seamMetalness, roughness: look.seamRoughness,
    }),
  };
}

function addLight(scene, reach) {
  const lightDistance = reach * 3;
  const light = new THREE.SpotLight('#ffffff', look.lightIntensity);
  light.decay = 0;
  light.penumbra = 1;
  light.angle = Math.atan((reach * look.lightSpread) / lightDistance);
  const height = THREE.MathUtils.degToRad(look.lightHeight);
  const around = THREE.MathUtils.degToRad(look.lightDirection);
  light.position.set(
    Math.cos(height) * Math.cos(around) * lightDistance,
    Math.sin(height) * lightDistance,
    -Math.cos(height) * Math.sin(around) * lightDistance
  );
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.radius = look.shadowSoftness;
  light.shadow.blurSamples = 16;
  light.shadow.bias = -0.0005;
  light.shadow.normalBias = 0.05;
  light.shadow.camera.near = lightDistance * 0.3;
  light.shadow.camera.far = lightDistance * 2;
  scene.add(light);
  scene.add(light.target);
}

export function createStage({ count, radius, columns = count, spacing = radius * 2.7, rowSpacing = radius * 3.4 }) {
  const rows = Math.ceil(count / columns);
  const bottomRow = radius + 1.5;
  const { renderer, environment } = createRenderer();

  const halfWidth = ((columns - 1) / 2) * spacing + radius + 1;
  const halfHeight = ((rows - 1) * rowSpacing) / 2 + radius + 2;
  const reach = Math.hypot(halfWidth, halfHeight);
  const scene = createLitScene(environment, reach);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(reach * 20, reach * 20), new THREE.ShadowMaterial({ opacity: look.shadowStrength }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const materials = createMaterials();

  // Kamera rett forfra, litt ovenfra, så hele oppstillingen fyller bildet.
  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 4000);
  const target = new THREE.Vector3(0, bottomRow + ((rows - 1) * rowSpacing) / 2 - 0.8, 0);
  const direction = new THREE.Vector3(0, 0.2, 1).normalize();
  const fitCamera = () => {
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const distance = Math.max(halfWidth / Math.tan(hFov / 2), halfHeight / Math.tan(vFov / 2)) * 1.1;
    camera.position.copy(direction).multiplyScalar(distance).add(target);
  };
  fitCamera();
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    fitCamera();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Plassene, med navnet under hver.
  const slots = [];
  const labelBox = document.createElement('div');
  document.body.appendChild(labelBox);
  const addSlot = (title, subtitle = '') => {
    const i = slots.length;
    const col = i % columns, row = Math.floor(i / columns);
    const group = new THREE.Group();
    group.position.set((col - (columns - 1) / 2) * spacing, bottomRow + (rows - 1 - row) * rowSpacing, 0);
    scene.add(group);
    const label = document.createElement('div');
    label.innerHTML = `${title}${subtitle ? `<br><small>${subtitle}</small>` : ''}`;
    Object.assign(label.style, {
      position: 'fixed', transform: 'translate(-50%, 0)', textAlign: 'center', pointerEvents: 'none',
      font: '500 14px/1.3 system-ui, sans-serif', color: look.gearColor, textShadow: '0 1px 3px #000',
    });
    labelBox.appendChild(label);
    slots.push({ group, label });
    return group;
  };

  // Klikk stopper og starter bevegelsen.
  let running = true;
  renderer.domElement.addEventListener('click', () => { running = !running; });

  const below = new THREE.Vector3();
  const run = (update) => {
    let last = null, time = 0;
    renderer.setAnimationLoop((now) => {
      const seconds = last === null ? 0 : Math.min((now - last) / 1000, 0.1);
      last = now;
      if (running) time += seconds;
      update(time, running ? seconds : 0);
      for (const { group, label } of slots) {
        below.copy(group.position).add({ x: 0, y: -radius * 1.1, z: 0 }).project(camera);
        label.style.left = `${((below.x + 1) / 2) * window.innerWidth}px`;
        label.style.top = `${((1 - below.y) / 2) * window.innerHeight + 6}px`;
      }
      controls.update();
      renderer.render(scene, camera);
    });
  };

  return { scene, camera, renderer, materials, addSlot, run };
}
