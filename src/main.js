import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { drive, gear, bigGear, smallGear, arm, moonTrain, bodies, look } from './config.js';
import { createGearGeometry, createSprocketGeometry } from './gear.js';
import { layout, anglesAt, chain, chainPoint } from './mechanism.js';

// Hvor langt ut og opp modellen rekker, så kamera og lys kan tilpasses.
const reach = arm.length + bodies.moonOrbit + bodies.moonRadius;
const modelHeight = bodies.sunHeight + bodies.sunRadius;

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

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(cameraTarget);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.05; // ikke under gulvet

// Hovedlys: lavt fra siden, så det streifer toppflatene og fanger tennene.
// Et spotlys med helt myk kant gir en glidende overgang fra lyst til mørkere
// over flatene. Fyll-lyset kommer fra miljøkartet.
const lightDistance = reach * 3;
const sun = new THREE.SpotLight('#ffffff', look.lightIntensity);
sun.decay = 0;     // lyset svekkes ikke med avstanden, bare mot kanten av lyskjeglen
sun.penumbra = 1;  // helt myk kant
sun.angle = Math.atan((reach * look.lightSpread) / lightDistance);
const height = THREE.MathUtils.degToRad(look.lightHeight);
const around = THREE.MathUtils.degToRad(look.lightDirection);
sun.position.set(
  Math.cos(height) * Math.cos(around) * lightDistance,
  Math.sin(height) * lightDistance,
  -Math.cos(height) * Math.sin(around) * lightDistance
);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.radius = look.shadowSoftness;
sun.shadow.blurSamples = 16;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.05; // hindrer stripete skygge når lyset kommer lavt inn
sun.shadow.camera.near = lightDistance * 0.3;
sun.shadow.camera.far = lightDistance * 2;
scene.add(sun);
scene.add(sun.target); // lyset peker mot midten av scenen

// Usynlig gulv som bare viser skyggen, så det ikke finnes noen gulvkant.
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(reach * 20, reach * 20),
  new THREE.ShadowMaterial({ opacity: look.shadowStrength })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Satengmatt hvit lakk: halvmatt grunnfarge med et tynt, mykt klarlakklag oppå.
// Brukes på alt: hjul, aksler, arm og kuler.
const material = new THREE.MeshPhysicalMaterial({
  color: look.gearColor,
  roughness: look.roughness,
  metalness: 0,
  clearcoat: look.gloss,
  clearcoatRoughness: look.glossRoughness,
});

// Små hjelpere som lager deler og legger dem i en gruppe.
function addMesh(parent, geometry) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function addGear(parent, settings, y) {
  const mesh = addMesh(parent, createGearGeometry(settings));
  mesh.position.y = y;
  return mesh;
}
function addSprocket(parent, settings, pitchRadius, y) {
  const geometry = createSprocketGeometry({
    ...settings,
    pitchRadius,
    rollerRadius: chain.rollerRadius,
    thickness: moonTrain.thickness,
    chamfer: Math.min(moonTrain.chamfer, chain.rollerRadius * 0.4), // smale tenner tåler lite avfasing
  });
  const mesh = addMesh(parent, geometry);
  mesh.position.y = y;
  return mesh;
}
// Loddrett sylinder (aksel, rør) fra y0 til y1.
function addShaft(parent, radius, y0, y1) {
  const mesh = addMesh(parent, new THREE.CylinderGeometry(radius, radius, y1 - y0, 32));
  mesh.position.y = (y0 + y1) / 2;
  return mesh;
}
function addSphere(parent, radius) {
  return addMesh(parent, new THREE.SphereGeometry(radius, 64, 32));
}
// Flat stang langs +x fra x = 0 til `length`, med runde ender.
function addBar(parent, length, width, y0, y1) {
  const bar = addMesh(parent, new THREE.BoxGeometry(length, y1 - y0, width));
  bar.position.set(length / 2, (y0 + y1) / 2, 0);
  addShaft(parent, width / 2, y0, y1).position.x = length;
  addShaft(parent, width / 2, y0, y1);
}
// Gruppe som står på et punkt i planet (planets y er -z i three.js).
function addGroupAt(parent, point) {
  const group = new THREE.Group();
  group.position.set(point.x, 0, -point.y);
  parent.add(group);
  return group;
}

// Høyder, nedenfra og opp.
const gap = 0.5;
const mainY = 2;                                  // hjulparet nederst
const mainTop = mainY + gear.thickness;
const armY = mainTop + 1.5;                        // jordarmen
const armTop = armY + arm.thickness;
const level1 = armTop + gap;                       // fast hjul og pinion
const level2 = level1 + moonTrain.thickness + gap; // kjedehjulene og kjedet
const level3 = level2 + moonTrain.thickness + gap; // månearmen
const moonArmTop = level3 + arm.thickness;

const mainGear = (settings) => ({ ...gear, ...settings });
const trainGear = (settings) => ({ ...gear, ...moonTrain, ...settings });

// --- Det som står fast: sentralakselen med sola og det faste hjulet. ---
addShaft(scene, moonTrain.fixed.holeRadius, 0, bodies.sunHeight);
addSphere(scene, bodies.sunRadius).position.y = bodies.sunHeight;
addGear(scene, trainGear(moonTrain.fixed), level1); // dreier aldri

// --- Mellomakselen med det lille hjulet, der inngangen kommer inn. ---
const driveGroup = addGroupAt(scene, layout.drive);
addShaft(driveGroup, smallGear.holeRadius, 0, mainTop + gap);
addGear(driveGroup, mainGear(smallGear), mainY);

// --- Armen: røret rundt sentralakselen, det store hjulet nederst og stanga ut til jorda. ---
const armGroup = new THREE.Group();
scene.add(armGroup);
addShaft(armGroup, bigGear.holeRadius, mainY, armY);
addGear(armGroup, mainGear(bigGear), mainY);
addBar(armGroup, arm.length, arm.width, armY, armTop);
addShaft(armGroup, bigGear.holeRadius + 1, armY, armTop); // navet midt på armen

// Pinion og det store kjedehjulet på samme aksel, som går rundt det faste hjulet.
const pinionGroup = addGroupAt(armGroup, layout.pinion);
addShaft(pinionGroup, moonTrain.pinion.holeRadius, armTop, level2 + moonTrain.thickness + gap);
addGear(pinionGroup, trainGear(moonTrain.pinion), level1);
addSprocket(pinionGroup, moonTrain.driveSprocket, chain.driveRadius, level2);

// Kjedet: ruller som ligger i setene på kjedehjulene, holdt sammen av
// lenkeplater over og under. Annenhver lenke har platene ytterst, som på et
// ekte kjede, så platene ikke kolliderer.
const plateThickness = 0.12;
const plateGap = 0.05;
const rollerHeight = moonTrain.thickness + plateGap * 2;
const rollers = new THREE.InstancedMesh(
  new THREE.CylinderGeometry(chain.rollerRadius, chain.rollerRadius, rollerHeight, 16),
  material,
  chain.links
);
const plateShape = new THREE.Shape();
const plateEnd = chain.rollerRadius * 1.25;
plateShape.absarc(chain.pitch / 2, 0, plateEnd, -Math.PI / 2, Math.PI / 2, false);
plateShape.absarc(-chain.pitch / 2, 0, plateEnd, Math.PI / 2, (Math.PI * 3) / 2, false);
const plateGeometry = new THREE.ExtrudeGeometry(plateShape, { depth: plateThickness, bevelEnabled: false, curveSegments: 12 });
plateGeometry.rotateX(-Math.PI / 2);
const plates = new THREE.InstancedMesh(plateGeometry, material, chain.links * 2);
for (const part of [rollers, plates]) {
  part.castShadow = true;
  part.receiveShadow = true;
  part.frustumCulled = false; // leddene flytter seg, så la three.js alltid tegne dem
  armGroup.add(part);
}
const placer = new THREE.Object3D();
function updateChain(offset) {
  const points = [];
  for (let i = 0; i < chain.links; i++) points.push(chainPoint(offset + i * chain.pitch));

  for (let i = 0; i < chain.links; i++) {
    const a = points[i];
    placer.position.set(a.x, level2 - plateGap + rollerHeight / 2, -a.y);
    placer.rotation.set(0, 0, 0);
    placer.updateMatrix();
    rollers.setMatrixAt(i, placer.matrix);

    // Lenken fra denne rullen til den neste, med en plate over og en under.
    const b = points[(i + 1) % chain.links];
    const outer = i % 2 === 0 ? plateThickness : 0;
    placer.rotation.set(0, Math.atan2(b.y - a.y, b.x - a.x), 0);
    placer.position.set((a.x + b.x) / 2, level2 + moonTrain.thickness + plateGap + outer, -(a.y + b.y) / 2);
    placer.updateMatrix();
    plates.setMatrixAt(i * 2, placer.matrix);
    placer.position.y = level2 - plateGap - plateThickness - outer;
    placer.updateMatrix();
    plates.setMatrixAt(i * 2 + 1, placer.matrix);
  }
  rollers.instanceMatrix.needsUpdate = true;
  plates.instanceMatrix.needsUpdate = true;
}

// --- Jorda: følger armen. Står på en fast stang ytterst på armen. ---
const earthGroup = addGroupAt(armGroup, layout.earth);
addShaft(earthGroup, moonTrain.moonSprocket.holeRadius * 0.6, armTop, bodies.earthHeight);
addSphere(earthGroup, bodies.earthRadius).position.y = bodies.earthHeight;

// --- Månen: følger jorda. Det lille kjedehjulet sitter på et rør rundt jordstanga og bærer månearmen. ---
const moonGroup = new THREE.Group();
earthGroup.add(moonGroup);
addSprocket(moonGroup, moonTrain.moonSprocket, chain.moonRadius, level2);
addShaft(moonGroup, moonTrain.moonSprocket.holeRadius, armTop, moonArmTop);
addBar(moonGroup, bodies.moonOrbit, arm.width * 0.5, level3, moonArmTop);
const moonPin = addShaft(moonGroup, arm.width * 0.15, moonArmTop, bodies.earthHeight);
moonPin.position.x = bodies.moonOrbit;
addSphere(moonGroup, bodies.moonRadius).position.set(bodies.moonOrbit, bodies.earthHeight, 0);

// Tilpass ved endring av vindusstørrelse.
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animasjon: inngangsvinkelen øker med valgt fart. Hver del får vinkelen
// mekanismen regner ut fra tanntallene.
let lastTime = null;
let input = 0;
renderer.setAnimationLoop((time) => {
  const seconds = lastTime === null ? 0 : (time - lastTime) / 1000;
  lastTime = time;
  input += (drive.speed / 60) * Math.PI * 2 * seconds;

  const a = anglesAt(input);
  driveGroup.rotation.y = a.driveAngle;
  armGroup.rotation.y = a.armAngle;
  pinionGroup.rotation.y = a.pinionAngle;
  updateChain(a.chainOffset);
  moonGroup.rotation.y = a.moonAngle;

  controls.update();
  renderer.render(scene, camera);
});
