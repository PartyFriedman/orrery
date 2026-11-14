import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { drive, gear, bigGear, smallGear, arm, moonTrain, bodies, look } from './config.js';
import { createGearGeometry, createSprocketGeometry } from './gear.js';
import { layout, anglesAt, moonChain, parallelChain, earthAxis, moonRing, moonLift } from './mechanism.js';

// Hvor langt ut og opp modellen rekker, så kamera og lys kan tilpasses.
const reach = arm.length + bodies.moonOrbit + bodies.moonRadius;
const modelHeight = bodies.earthHeight + bodies.sunRadius;

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

// Høyder, nedenfra og opp.
const gap = 0.5;
const chainGap = 1.2;                                                   // ekstra luft mellom to kjeder over hverandre
const mainY = 2;                                                        // hjulparet nederst
const mainTop = mainY + gear.thickness;
const armY = mainTop + 1.5;                                             // jordarmen
const armTop = armY + arm.thickness;
const level1 = armTop + gap;                                            // fast hjul og pinion
const parallelLevel = level1 + moonTrain.thickness + gap;               // parallellkjedet
const moonChainLevel = parallelLevel + moonTrain.thickness + chainGap;  // månekjedet
const moonArmY = moonChainLevel + moonTrain.thickness + gap;            // månearmen
const moonArmTop = moonArmY + arm.thickness;

// Månestaven glir opp og ned i en hylse på månearmen, og en fot på staven
// hviler på den skrå ringen rett under jorda. Hylsa må romme hele vandringen.
const travel = moonRing.maxLift;
const ringY = bodies.earthHeight - bodies.earthRadius - 1;
const sleeveTop = ringY - travel - 0.5;
const neededSleeve = 2 * travel + 0.5;
if (sleeveTop - moonArmY < neededSleeve) {
  const minHeight = bodies.earthHeight + neededSleeve - (sleeveTop - moonArmY);
  throw new Error(
    `bodies.earthHeight må være minst ${minHeight.toFixed(1)} så månestaven får plass til å gå opp og ned (er ${bodies.earthHeight}).`
  );
}

const pillarRadius = 0.9; // jordstolpen og tappen parallellhjulet går på
const mainGear = (settings) => ({ ...gear, ...settings });
const trainGear = (settings) => ({ ...gear, ...moonTrain, ...settings });

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

// --- Det som står fast: sentralakselen med sola, det faste hjulet og det faste kjedehjulet. ---
addShaft(scene, moonTrain.fixed.holeRadius, 0, bodies.earthHeight);
addSphere(scene, bodies.sunRadius).position.y = bodies.earthHeight;
addGear(scene, trainGear(moonTrain.fixed), level1); // dreier aldri
addSprocket(scene, { ...moonTrain.parallelSprocket, holeRadius: moonTrain.fixed.holeRadius }, parallelChain.radius1, parallelLevel);

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

// Pinion og det store månekjedehjulet på samme aksel, som går rundt det faste hjulet.
const pinionGroup = addGroupAt(armGroup, layout.pinion);
addShaft(pinionGroup, moonTrain.pinion.holeRadius, armTop, moonChainLevel + moonTrain.thickness + gap * 0.6);
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
addShaft(parallelGroup, pillarRadius, parallelLevel, bodies.earthHeight);

// Jorda, med aksen og ekvator så hellingen synes.
const earthMount = new THREE.Group();
earthMount.position.y = bodies.earthHeight;
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
addShaft(moonPin, 0.35, moonArmY + travel + 0.1, bodies.earthHeight);
const footLength = bodies.moonOrbit - moonRing.radius;
const foot = addMesh(moonPin, new THREE.CylinderGeometry(footSize, footSize, footLength, 12));
foot.rotation.z = Math.PI / 2;
foot.position.set(-footLength / 2, ringY + bandThickness / 2 + footSize, 0);
addSphere(moonPin, bodies.moonRadius).position.y = bodies.earthHeight;

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
  updateMoonChain(a.moonChainOffset);
  updateParallelChain(a.parallelChainOffset);
  parallelGroup.rotation.y = a.parallelAngle;
  moonGroup.rotation.y = a.moonAngle;
  moonPin.position.y = moonLift(a);

  controls.update();
  renderer.render(scene, camera);
});
