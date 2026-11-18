// Felles scene for testsidene panels.html og plexus.html: renderer, miljø,
// lys, skyggegulv og materialer som i modellen (scene.js og materials.js), og
// navn under hver kule. Kulene stilles opp i rader rett mot kameraet.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { look } from './config.js';
import { createRenderer, createLitScene, addShadowFloor } from './scene.js';
import { createMaterials } from './materials.js';

export function createStage({ count, radius, columns = count, spacing = radius * 2.7, rowSpacing = radius * 3.4 }) {
  const rows = Math.ceil(count / columns);
  const bottomRow = radius + 1.5;
  const { renderer, environment } = createRenderer();

  const halfWidth = ((columns - 1) / 2) * spacing + radius + 1;
  const halfHeight = ((rows - 1) * rowSpacing) / 2 + radius + 2;
  const reach = Math.hypot(halfWidth, halfHeight);
  const scene = createLitScene(environment, reach);

  addShadowFloor(scene, reach);

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

  // Plassene, med navnet under hver. slotRadius: kula på plassen, når den er
  // mindre enn radius (navnet står rett under den).
  const slots = [];
  const labelBox = document.createElement('div');
  document.body.appendChild(labelBox);
  const addSlot = (title, subtitle = '', slotRadius = radius) => {
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
    slots.push({ group, label, slotRadius });
    return group;
  };

  // Klikk stopper og starter bevegelsen. update(time, seconds, frame): time og
  // seconds står stille når bevegelsen er stoppet, frame er den ekte tiden siden
  // forrige bilde (for det som skal gå uansett, som bodyLift).
  let running = true;
  renderer.domElement.addEventListener('click', () => { running = !running; });

  const below = new THREE.Vector3();
  const run = (update) => {
    let last = null, time = 0;
    renderer.setAnimationLoop((now) => {
      const seconds = last === null ? 0 : Math.min((now - last) / 1000, 0.1);
      last = now;
      if (running) time += seconds;
      update(time, running ? seconds : 0, seconds);
      for (const { group, label, slotRadius } of slots) {
        below.copy(group.position).add({ x: 0, y: -slotRadius * 1.1, z: 0 }).project(camera);
        label.style.left = `${((below.x + 1) / 2) * window.innerWidth}px`;
        label.style.top = `${((1 - below.y) / 2) * window.innerHeight + 6}px`;
      }
      controls.update();
      renderer.render(scene, camera);
    });
  };

  return { scene, camera, renderer, materials, addSlot, run };
}
