import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { drive, center, gear, bigGear, smallGear, arm, planets, moonTrain, bodies, look } from './config.js';
import { createGearGeometry, createSprocketGeometry } from './gear.js';
import {
  layout, anglesAt, pairModule, tube, heights, reach as armReach,
  moonChain, parallelChain, earthAxis, moonRing, moonLift,
} from './mechanism.js';

// Hvor langt ut og opp modellen rekker, så kamera og lys kan tilpasses.
const reach = Math.max(...Object.values(armReach).map((r) => r.outer));
const modelHeight = bodies.height + bodies.sunRadius;

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
    rollerRadius: moonChain.rollerRadius,
    thickness: moonTrain.thickness,
    chamfer: Math.min(moonTrain.chamfer, moonChain.rollerRadius * 0.4), // smale tenner tåler lite avfasing
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

// Høyder (regnet ut i mechanism.js, nedenfra og opp).
const { gap } = heights;
const armY = heights.arm.earth;                // jordarmen
const armTop = armY + arm.thickness;
const level1 = heights.level1;                 // fast hjul og pinion
const parallelLevel = heights.parallel;        // parallellkjedet
const moonChainLevel = heights.moonChain;      // månekjedet
const moonArmY = heights.moonArm;              // månearmen
const moonArmTop = moonArmY + arm.thickness;
const travel = moonRing.maxLift;               // hvor langt månestaven går opp og ned
const ringY = heights.ring;
const sleeveTop = heights.sleeveTop;

const pillarRadius = 0.9; // jordstolpen og tappen parallellhjulet går på
const trainGear = (settings) => ({ ...gear, ...moonTrain, ...settings });

// Et hjul i et av parene nederst. Modulen følger av paret, og hjulet får eiker
// når det er stort nok til det.
function pairGear(teeth, otherTeeth, holeRadius, style = null) {
  const module = pairModule(teeth, otherTeeth);
  if (style) return { ...gear, ...style, teeth, module, holeRadius };
  const rimRadius = (module * teeth) / 2 - 1.25 * module - 1.5 * module;
  const hubRadius = holeRadius + 2 * module;
  const spokes = rimRadius - hubRadius > 4 ? (teeth >= 40 ? 5 : 4) : 0;
  return {
    ...gear, teeth, module, holeRadius, spokes,
    spokeWidth: 1.5 * module, hubWidth: 2 * module, rimWidth: 1.5 * module,
  };
}

// Et kjede: ruller som ligger i setene på kjedehjulene, holdt sammen av
// lenkeplater over og under. Annenhver lenke har platene ytterst, som på et
// ekte kjede, så platene ikke kolliderer. Gir tilbake en funksjon som flytter
// leddene til en ny posisjon langs banen.
const plateThickness = 0.12;
const plateGap = 0.05;
const placer = new THREE.Object3D();
function addChain(parent, chain, y) {
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
    parent.add(part);
  }

  return (offset) => {
    const points = [];
    for (let i = 0; i < chain.links; i++) points.push(chain.point(offset + i * chain.pitch));

    for (let i = 0; i < chain.links; i++) {
      const a = points[i];
      placer.position.set(a.x, y - plateGap + rollerHeight / 2, -a.y);
      placer.rotation.set(0, 0, 0);
      placer.updateMatrix();
      rollers.setMatrixAt(i, placer.matrix);

      // Lenken fra denne rullen til den neste, med en plate over og en under.
      const b = points[(i + 1) % chain.links];
      const outer = i % 2 === 0 ? plateThickness : 0;
      placer.rotation.set(0, Math.atan2(b.y - a.y, b.x - a.x), 0);
      placer.position.set((a.x + b.x) / 2, y + moonTrain.thickness + plateGap + outer, -(a.y + b.y) / 2);
      placer.updateMatrix();
      plates.setMatrixAt(i * 2, placer.matrix);
      placer.position.y = y - plateGap - plateThickness - outer;
      placer.updateMatrix();
      plates.setMatrixAt(i * 2 + 1, placer.matrix);
    }
    rollers.instanceMatrix.needsUpdate = true;
    plates.instanceMatrix.needsUpdate = true;
  };
}

// --- Det som står fast: sentralakselen med sola. ---
addShaft(scene, center.axleRadius, 0, bodies.height);
addSphere(scene, bodies.sunRadius).position.y = bodies.height;

// Det faste røret for månehjulverket, med det faste hjulet og det faste
// kjedehjulet øverst. Det holdes av en brakett som går bakover (bort fra
// mellomakselen) til en stolpe ned til gulvet.
addShaft(scene, tube.fixed.outer, heights.bottom.fixed, heights.fixedTop);
addGear(scene, trainGear({ ...moonTrain.fixed, holeRadius: tube.fixed.outer }), level1); // dreier aldri
addSprocket(scene, { ...moonTrain.parallelSprocket, holeRadius: tube.fixed.outer }, parallelChain.radius1, parallelLevel);
const bracket = addGroupAt(scene, layout.center);
bracket.rotation.y = Math.PI / 2;
const bracketTop = heights.bottom.fixed + arm.thickness;
addBar(bracket, drive.distance, arm.width * 0.75, heights.bottom.fixed, bracketTop);
addShaft(bracket, arm.width * 0.3, 0, bracketTop).position.x = drive.distance;

// --- Mellomakselen, der inngangen kommer inn. Den har ett hjul for hver planet. ---
const driveGroup = addGroupAt(scene, layout.drive);
addShaft(driveGroup, drive.shaftRadius, 0, heights.driveTop);
addGear(driveGroup, pairGear(smallGear.teeth, bigGear.teeth, drive.shaftRadius, smallGear), heights.bottom.earth);
for (const [name, p] of Object.entries(planets)) {
  addGear(driveGroup, pairGear(p.driveTeeth, p.tubeTeeth, drive.shaftRadius), heights.bottom[name]);
}

// --- Merkur, Venus og Mars: rør med hjul nederst, arm øverst, stolpe og kule. ---
const planetGroups = {};
for (const [name, p] of Object.entries(planets)) {
  const group = new THREE.Group();
  scene.add(group);
  const y = heights.arm[name];
  addShaft(group, tube[name].outer, heights.bottom[name], y);
  addGear(group, pairGear(p.tubeTeeth, p.driveTeeth, tube[name].outer), heights.bottom[name]);
  addShaft(group, tube[name].outer + 1, y, y + arm.thickness); // navet
  addBar(group, p.armLength, arm.width * 0.75, y, y + arm.thickness);
  addShaft(group, 0.5, y + arm.thickness, bodies.height).position.x = p.armLength;
  addSphere(group, p.radius).position.set(p.armLength, bodies.height, 0);
  planetGroups[name] = group;
}

// --- Jordarmen: røret, det store hjulet nederst og stanga ut til jorda. ---
const armGroup = new THREE.Group();
scene.add(armGroup);
addShaft(armGroup, tube.earth.outer, heights.bottom.earth, armY);
addGear(armGroup, pairGear(bigGear.teeth, smallGear.teeth, tube.earth.outer, bigGear), heights.bottom.earth);
addBar(armGroup, arm.length, arm.width, armY, armTop);
addShaft(armGroup, tube.earth.outer + 1, armY, armTop); // navet midt på armen

// Pinion og det store månekjedehjulet på samme aksel, som går rundt det faste hjulet.
const pinionGroup = addGroupAt(armGroup, layout.pinion);
addShaft(pinionGroup, moonTrain.pinion.holeRadius, armTop, heights.pinionTop);
addGear(pinionGroup, trainGear(moonTrain.pinion), level1);
addSprocket(pinionGroup, moonTrain.driveSprocket, moonChain.radius1, moonChainLevel);

const updateMoonChain = addChain(armGroup, moonChain, moonChainLevel);
const updateParallelChain = addChain(armGroup, parallelChain, parallelLevel);

// --- Ytterst på armen: en tapp som parallellhjulet går på. ---
const earthGroup = addGroupAt(armGroup, layout.earth);
addShaft(earthGroup, pillarRadius, armTop, parallelLevel);

// --- Parallellhjulet står stille i rommet. Det bærer jordstolpen, jorda med
// den skrå aksen og den skrå ringen som styrer månebanen. ---
const parallelGroup = new THREE.Group();
earthGroup.add(parallelGroup);
addSprocket(parallelGroup, { ...moonTrain.parallelSprocket, holeRadius: pillarRadius }, parallelChain.radius2, parallelLevel);
addShaft(parallelGroup, pillarRadius, parallelLevel, bodies.height);

// Jorda, med aksen og ekvator så hellingen synes.
const earthMount = new THREE.Group();
earthMount.position.y = bodies.height;
earthMount.rotation.y = earthAxis.direction;
parallelGroup.add(earthMount);
const earthTilted = new THREE.Group();
earthTilted.rotation.z = -earthAxis.tilt; // heller toppen mot +x i earthMount
earthMount.add(earthTilted);
addSphere(earthTilted, bodies.earthRadius);
addShaft(earthTilted, 0.25, -(bodies.earthRadius + 0.6), bodies.earthRadius + 1.5); // jordaksen
const equator = addMesh(earthTilted, new THREE.TorusGeometry(bodies.earthRadius + 0.04, 0.12, 12, 96));
equator.rotation.x = Math.PI / 2;

// Ringen månefoten hviler på: et nav på stolpen, tre eiker og en flat ring,
// alt i et plan som heller med knutelinjen som akse.
const ringMount = new THREE.Group();
ringMount.position.y = ringY;
ringMount.rotation.y = moonRing.node;
parallelGroup.add(ringMount);
addShaft(ringMount, pillarRadius + 0.5, -0.4, 0.4);
const ringPlane = new THREE.Group();
ringPlane.rotation.x = moonRing.tilt;
ringMount.add(ringPlane);
const bandThickness = 0.3;
const bandShape = new THREE.Shape();
bandShape.absarc(0, 0, moonRing.radius + moonRing.halfWidth, 0, Math.PI * 2, false);
const bandHole = new THREE.Path();
bandHole.absarc(0, 0, moonRing.radius - moonRing.halfWidth, 0, Math.PI * 2, true);
bandShape.holes.push(bandHole);
const bandGeometry = new THREE.ExtrudeGeometry(bandShape, { depth: bandThickness, bevelEnabled: false, curveSegments: 128 });
bandGeometry.rotateX(-Math.PI / 2);
bandGeometry.translate(0, -bandThickness / 2, 0);
addMesh(ringPlane, bandGeometry);
for (let k = 0; k < 3; k++) {
  const spoke = new THREE.Group();
  spoke.rotation.y = (k * Math.PI * 2) / 3 + Math.PI / 6;
  ringPlane.add(spoke);
  addBar(spoke, moonRing.radius, 0.6, -bandThickness / 2, bandThickness / 2);
}

// --- Månen: det lille kjedehjulet går på et rør rundt jordstolpen og bærer månearmen. ---
const moonGroup = new THREE.Group();
earthGroup.add(moonGroup);
addSprocket(moonGroup, moonTrain.moonSprocket, moonChain.radius2, moonChainLevel);
addShaft(moonGroup, moonTrain.moonSprocket.holeRadius, parallelLevel + moonTrain.thickness + 0.1, moonArmTop);
addBar(moonGroup, bodies.moonOrbit, arm.width * 0.5, moonArmY, moonArmTop);
addShaft(moonGroup, 0.8, moonArmTop, sleeveTop).position.x = bodies.moonOrbit; // hylsa

// Månestaven med foten og månen. Den flyttes opp og ned etter ringen.
const footSize = 0.2;
const moonPin = new THREE.Group();
moonPin.position.x = bodies.moonOrbit;
moonGroup.add(moonPin);
addShaft(moonPin, 0.35, moonArmY + travel + 0.1, bodies.height);
const footLength = bodies.moonOrbit - moonRing.radius;
const foot = addMesh(moonPin, new THREE.CylinderGeometry(footSize, footSize, footLength, 12));
foot.rotation.z = Math.PI / 2;
foot.position.set(-footLength / 2, ringY + bandThickness / 2 + footSize, 0);
addSphere(moonPin, bodies.moonRadius).position.y = bodies.height;

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
  for (const name in planetGroups) planetGroups[name].rotation.y = a.planetAngles[name];
  pinionGroup.rotation.y = a.pinionAngle;
  updateMoonChain(a.moonChainOffset);
  updateParallelChain(a.parallelChainOffset);
  parallelGroup.rotation.y = a.parallelAngle;
  moonGroup.rotation.y = a.moonAngle;
  moonPin.position.y = moonLift(a);

  controls.update();
  renderer.render(scene, camera);
});
