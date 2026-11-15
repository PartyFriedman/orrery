import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  drive, outerDrive, center, gear, bigGear, smallGear, arm, armStyle, planets, moonTrain, bodies, panels, accent, look, jupiterMoons,
} from './config.js';
import { createGearGeometry, createSprocketGeometry } from './gear.js';
import { createArmGeometry } from './arm.js';
import { createPanelGeometry } from './panels.js';
import { createPlexus, plexusPatterns } from './plexus.js';
import {
  layout, anglesAt, pairModule, tube, tubes, heights, reach as armReach, armParts, armLengths,
  moonChain, parallelChain, driveChain, driveFrame, layChain, layFrame, idlerHub, earthAxis, moonRing, moonLift,
  phases, inputPerYear, dateAt, jupiterChain, jupiterLayout, jupiterTrain, moonSystems,
} from './mechanism.js';
import { daysPerYear } from './ephemeris.js';
import { createTimeControl } from './timeControl.js';

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
function addSprocket(parent, settings, pitchRadius, y, chain = moonChain) {
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
// Mørkt metall som synes i fugene mellom panelene.
const seamMaterial = new THREE.MeshPhysicalMaterial({
  color: look.seamColor,
  metalness: look.seamMetalness,
  roughness: look.seamRoughness,
});
// Rødt: blank rød lakk, brukt på ringene ved stolpene og på lakksola.
const redLacquer = new THREE.MeshPhysicalMaterial({
  color: accent.red,
  roughness: 0.2,
  metalness: 0,
  clearcoat: 1,
  clearcoatRoughness: 0.05,
});
// En planet som kule av paneler (mønsteret står i panels i config): hvite
// topper, mørke sider og en mørk kjerne under, som synes i fugene. Sola
// bruker den samme kula med andre materialer.
// Med mønsteret 'plexusA', 'plexusB' eller 'plexusC' blir kula en plexus-kule
// (plexus.js) i stedet. Andre tall i panels[name] erstatter dem i plexus i config.
const plexusUpdates = []; // flytter nodene i plexus-kulene, se animasjonen nederst
function addPlanetSphere(parent, radius, name, topMaterial = material, coreMaterial = seamMaterial) {
  const group = new THREE.Group();
  parent.add(group);
  const { pattern, ...overrides } = panels[name] ?? {};
  if (plexusPatterns[pattern]) {
    plexusUpdates.push(createPlexus(group, pattern, radius, { white: topMaterial, metal: seamMaterial }, overrides));
    return group;
  }
  const { geometry, coreRadius } = createPanelGeometry({
    radius, shape: panels.shape, seamWidth: panels.seamWidth, seamDepth: panels.seamDepth, ...panels[name],
  });
  const panelMesh = new THREE.Mesh(geometry, [topMaterial, seamMaterial]); // topper, mørke sider
  panelMesh.castShadow = true;
  panelMesh.receiveShadow = true;
  group.add(panelMesh);
  const core = new THREE.Mesh(new THREE.SphereGeometry(coreRadius, 48, 24), coreMaterial);
  core.receiveShadow = true;
  group.add(core);
  return group;
}
// Flat stang langs +x fra x = 0 til `length`, med runde ender.
function addBar(parent, length, width, y0, y1) {
  const bar = addMesh(parent, new THREE.BoxGeometry(length, y1 - y0, width));
  bar.position.set(length / 2, (y0 + y1) / 2, 0);
  addShaft(parent, width / 2, y0, y1).position.x = length;
  addShaft(parent, width / 2, y0, y1);
}
// En arm langs +x som smalner av mot enden, med myk overgang inn i navet og
// en krage rundt stolpen ytterst. Navet stikker litt opp over og ned under
// armen, så flatene ikke ligger i samme høyde. hub: false når navet er et rør
// som tegnes for seg. collar: false gir en arm uten krage (månearmene ved
// Jupiter), og thickness og chamfer kan settes for tynnere armer.
function addArm(parent, {
  length, hubRadius, part, y, hub = true, ring = false, collar = true,
  thickness = arm.thickness, chamfer = armStyle.chamfer,
}) {
  const geometry = createArmGeometry({
    length, hubRadius, rootHalf: part.rootHalf, endRadius: part.endRadius,
    fillet: armStyle.fillet, thickness, chamfer,
  });
  addMesh(parent, geometry).position.y = y;
  if (hub) addShaft(parent, hubRadius, y - armStyle.hubRise, y + thickness + armStyle.hubRise);
  if (!collar) return;
  // Kragen smalner av oppover, så stolpen ikke går rett ned i armen.
  const collarMesh = addMesh(parent, new THREE.CylinderGeometry(
    part.postRadius + armStyle.collarWidth * 0.25, part.collarRadius, armStyle.collarHeight, 32
  ));
  collarMesh.position.set(length, y + arm.thickness + armStyle.collarHeight / 2, 0);
  if (ring) {
    // En tynn rød ring rundt stolpen, oppå kragen.
    const red = new THREE.Mesh(
      new THREE.TorusGeometry(part.postRadius + accent.ringWidth / 2, accent.ringWidth / 2, 12, 48),
      redLacquer
    );
    red.rotation.x = Math.PI / 2;
    red.position.set(length, y + arm.thickness + armStyle.collarHeight + accent.ringWidth / 2, 0);
    red.castShadow = true;
    parent.add(red);
  }
}
// Sola: en kule av buede paneler i rødt, som planetene. To varianter i config:
// 'lacquer' er blank rød lakk med mørke fuger. 'glass' er rødt glass med en
// glødende kjerne og et rødt lys i midten, så den lyser innenfra og fugene gløder.
function addSun() {
  if (accent.sunStyle !== 'lacquer' && accent.sunStyle !== 'glass') {
    throw new Error(`Ukjent solstil '${accent.sunStyle}'. Velg 'lacquer' eller 'glass'.`);
  }
  if (accent.sunStyle === 'lacquer') {
    addPlanetSphere(scene, bodies.sunRadius, 'sun', redLacquer).position.y = bodies.height;
    return;
  }
  const glass = new THREE.MeshPhysicalMaterial({
    color: accent.red,
    roughness: 0.15,
    metalness: 0,
    transmission: 0.6,      // slipper lyset fra kjernen gjennom
    thickness: 1.5,
    ior: 1.5,
    attenuationColor: accent.red,
    attenuationDistance: 3,
    emissive: accent.red,
    emissiveIntensity: 0.35 * accent.glow,
  });
  const glowCore = new THREE.MeshStandardMaterial({
    color: accent.red,
    emissive: accent.red,
    emissiveIntensity: 2 * accent.glow,
  });
  const sunSphere = addPlanetSphere(scene, bodies.sunRadius, 'sun', glass, glowCore);
  sunSphere.position.y = bodies.height;
  sunSphere.children[0].castShadow = false; // glasset skal ikke stenge lyset inne i skyggekartet
  const light = new THREE.PointLight(accent.red, 8 * accent.glow, 0, 1); // svakt rødt lys innenfra
  light.position.y = bodies.height;
  scene.add(light);
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

const pillarRadius = armParts.earth.postRadius; // jordstolpen og tappen parallellhjulet går på
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
// Kjedene har sitt eget materiale, styrt av chain* i look i config.
const chainMaterial = new THREE.MeshPhysicalMaterial({
  color: look.chainColor,
  metalness: look.chainMetalness,
  roughness: look.chainRoughness,
  clearcoat: look.chainGloss,
  clearcoatRoughness: look.glossRoughness,
});
const plateThickness = 0.12;
const plateGap = 0.05;
const placer = new THREE.Object3D();
function addChain(parent, chain, y) {
  const rollerHeight = moonTrain.thickness + plateGap * 2;
  const rollers = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(chain.rollerRadius, chain.rollerRadius, rollerHeight, 16),
    chainMaterial,
    chain.links
  );
  const plateShape = new THREE.Shape();
  const plateEnd = chain.rollerRadius * 1.25;
  plateShape.absarc(chain.pitch / 2, 0, plateEnd, -Math.PI / 2, Math.PI / 2, false);
  plateShape.absarc(-chain.pitch / 2, 0, plateEnd, Math.PI / 2, (Math.PI * 3) / 2, false);
  const plateGeometry = new THREE.ExtrudeGeometry(plateShape, { depth: plateThickness, bevelEnabled: false, curveSegments: 12 });
  plateGeometry.rotateX(-Math.PI / 2);
  const plates = new THREE.InstancedMesh(plateGeometry, chainMaterial, chain.links * 2);
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
addSun();

// De faste rørene. Jordas faste rør har det faste hjulet og det faste
// kjedehjulet øverst. Rørene for Mars og Saturn står klare til månehjulverk
// senere, uten hjul ennå. (Jupiter har et månerør som dreier, se under.) Hvert rør holdes av en brakett nede i
// tårnet, og alle brakettene går bakover (bort fra mellomakselen) til den
// samme stolpen ned til gulvet.
addShaft(scene, tube.fixed.outer, heights.bottom.fixed, heights.fixedTop);
addGear(scene, trainGear({ ...moonTrain.fixed, holeRadius: tube.fixed.outer }), level1); // dreier aldri
addSprocket(scene, { ...moonTrain.parallelSprocket, holeRadius: tube.fixed.outer }, parallelChain.radius1, parallelLevel);
const bracket = addGroupAt(scene, layout.center);
bracket.rotation.y = Math.PI / 2;
let bracketTop = 0;
for (const t of tubes.filter((t) => t.fixed)) {
  if (t.name !== 'fixed') addShaft(scene, t.outer, heights.bottom[t.name], heights.stack[t.owner].fixedTop);
  const y = heights.bottom[t.name];
  addBar(bracket, drive.distance, arm.width * 0.75, y, y + arm.thickness);
  bracketTop = Math.max(bracketTop, y + arm.thickness);
}
addShaft(bracket, arm.width * 0.3, 0, bracketTop).position.x = drive.distance;

// --- Mellomakselen, der inngangen kommer inn. Den har et hjul for hver planet
// den driver direkte, og nederst et kjedehjul for det første kjedet. Hvert
// hjul er satt på akselen i sin egen vinkel (phases), så planeten står riktig
// på startdatoen. ---
const driveGroup = addGroupAt(scene, layout.drive);
addShaft(driveGroup, drive.shaftRadius, 0, heights.driveTop);
addGear(driveGroup, pairGear(smallGear.teeth, bigGear.teeth, drive.shaftRadius, smallGear), heights.bottom.earth)
  .rotation.y = phases.earth;
for (const [name, p] of Object.entries(planets)) {
  if (p.driveTeeth) {
    addGear(driveGroup, pairGear(p.driveTeeth, p.tubeTeeth, drive.shaftRadius), heights.bottom[name]).rotation.y = phases[name];
  }
}
// Hjulet som driver månerøret til Jupiters måner.
addGear(driveGroup, pairGear(jupiterMoons.driveTeeth, jupiterMoons.tubeTeeth, drive.shaftRadius), heights.bottom['drive-jupiter']);
const sprocketStyle = { spokes: 0, spokeWidth: 1, hubWidth: 1, rimWidth: 1 };
addSprocket(driveGroup, { teeth: outerDrive.driveSprocket, holeRadius: drive.shaftRadius, ...sprocketStyle },
  driveChain.radius1, heights.driveChain, driveChain);

// --- Det løse hjulet på sentralakselen: det store kjedehjulet nederst tar
// imot det første kjedet, og det lille over driver det andre. ---
const idlerGroup = addGroupAt(scene, layout.center);
addSprocket(idlerGroup, {
  teeth: outerDrive.idlerLarge, holeRadius: center.axleRadius, spokes: 5, spokeWidth: 1.5, hubWidth: 1.2, rimWidth: 1.5,
}, driveChain.radius2, heights.driveChain, driveChain);
addSprocket(idlerGroup, { teeth: outerDrive.idlerSmall, holeRadius: center.axleRadius, ...sprocketStyle },
  layChain.radius1, heights.layChain, layChain);
addShaft(idlerGroup, idlerHub, heights.driveChain + moonTrain.thickness, heights.layChain);

// --- Forlegsakselen: drives av det andre kjedet, og driver Jupiter og Saturn. ---
const layGroup = addGroupAt(scene, layout.lay);
addShaft(layGroup, drive.shaftRadius, 0, heights.driveTop);
addSprocket(layGroup, {
  teeth: outerDrive.laySprocket, holeRadius: drive.shaftRadius, spokes: 4, spokeWidth: 1.5, hubWidth: 1.2, rimWidth: 1.5,
}, layChain.radius2, heights.layChain, layChain);
for (const [name, p] of Object.entries(planets)) {
  if (p.layTeeth) {
    addGear(layGroup, pairGear(p.layTeeth, p.tubeTeeth, drive.shaftRadius), heights.bottom[name]).rotation.y = phases[name];
  }
}
// Kjedene, regnet ut langs +x fra sitt første kjedehjul og dreid på plass.
const chainGroupAt = (frame) => {
  const group = addGroupAt(scene, frame.origin);
  group.rotation.y = frame.angle;
  return group;
};
const driveChainGroup = chainGroupAt(driveFrame);
const layChainGroup = chainGroupAt(layFrame);

// --- Planetene utenom jorda: rør med hjul nederst, arm øverst, stolpe og kule. ---
const planetGroups = {};
for (const [name, p] of Object.entries(planets)) {
  const group = new THREE.Group();
  scene.add(group);
  const y = heights.arm[name];
  const length = armLengths[name];
  addShaft(group, tube[name].outer, heights.bottom[name], y);
  addGear(group, pairGear(p.tubeTeeth, p.driveTeeth ?? p.layTeeth, tube[name].outer), heights.bottom[name]);
  addArm(group, { length, hubRadius: tube[name].outer + 1, part: armParts.planet, y, ring: true });
  addShaft(group, armParts.planet.postRadius, y + arm.thickness, bodies.height).position.x = length;
  addPlanetSphere(group, p.radius, name).position.set(length, bodies.height, 0);
  planetGroups[name] = group;
}

// --- Jupiters måner ---
// Månerøret går inni Jupiter-røret, fra hjulet i tårnet opp til kjedehjulet
// rett over Jupiter-armen.
const JM = jupiterMoons;
const JS = heights.stack.jupiter;
const driveTube = tube['drive-jupiter'];
const jupiterTubeGroup = new THREE.Group();
scene.add(jupiterTubeGroup);
addShaft(jupiterTubeGroup, driveTube.outer, heights.bottom['drive-jupiter'], JS.tubeTop);
addGear(jupiterTubeGroup, pairGear(JM.tubeTeeth, JM.driveTeeth, driveTube.outer), heights.bottom['drive-jupiter']);
addSprocket(jupiterTubeGroup, { teeth: JM.tubeSprocket, holeRadius: driveTube.outer, ...sprocketStyle },
  jupiterChain.radius1, JS.chain, jupiterChain);

// Ved Jupiter: et hjul i et par mellom forlegsakselen og stolpen. Modulen
// følger av paret, og store hjul får eiker.
const jupiterGear = (teeth, otherTeeth, holeRadius) => {
  const module = (2 * JM.layDistance) / (teeth + otherTeeth);
  const hubWidth = 0.35, rimWidth = 0.35;
  const rimRadius = (module * teeth) / 2 - 1.25 * module - rimWidth;
  return {
    ...gear, thickness: JM.thickness, chamfer: JM.chamfer, backlash: JM.backlash,
    teeth, module, holeRadius, hubWidth, rimWidth, spokeWidth: 0.35,
    spokes: rimRadius - holeRadius - hubWidth > 1.2 ? (teeth >= 40 ? 5 : 4) : 0,
  };
};
const jupiterGroup = planetGroups.jupiter;
const jupiterArmTop = heights.arm.jupiter + arm.thickness;
const updateJupiterChain = addChain(jupiterGroup, jupiterChain, JS.chain);

// Kragen går løst på stolpen: kjedehjulet nederst, tannhjulet over.
const collarGroup = addGroupAt(jupiterGroup, jupiterLayout.post);
addShaft(collarGroup, jupiterTrain.collar.outer, JS.chain, JS.collarGear + JM.thickness);
addSprocket(collarGroup, { teeth: JM.collarSprocket, holeRadius: jupiterTrain.collar.outer, ...sprocketStyle },
  jupiterChain.radius2, JS.chain, jupiterChain);
addGear(collarGroup, jupiterGear(JM.collarTeeth, JM.collarPinion, jupiterTrain.collar.outer), JS.collarGear);

// Forlegsakselen på armen. Hjulene som driver månene er satt på i sin egen
// vinkel, så hver måne står riktig på startdatoen.
const jupiterLayGroup = addGroupAt(jupiterGroup, jupiterLayout.lay);
addShaft(jupiterLayGroup, JM.shaftRadius, jupiterArmTop, JS.layTop);
addGear(jupiterLayGroup, jupiterGear(JM.collarPinion, JM.collarTeeth, JM.shaftRadius), JS.collarGear);

// Ett rør per måne rundt stolpen, med hjulet nederst og armen øverst.
const moonOrbits = Object.fromEntries(moonSystems.jupiter.orbits.map((o) => [o.name, o]));
const jupiterMoonGroups = {};
for (const [name, m] of Object.entries(jupiterTrain.moons)) {
  addGear(jupiterLayGroup, jupiterGear(m.layTeeth, m.moonTeeth, JM.shaftRadius), JS.moonGear[name]).rotation.y = phases[name];
  const group = addGroupAt(jupiterGroup, jupiterLayout.post);
  const y = JS.moonArm[name];
  const { orbit, radius } = moonOrbits[name];
  addShaft(group, m.outer, JS.moonGear[name], y);
  addGear(group, jupiterGear(m.moonTeeth, m.layTeeth, m.outer), JS.moonGear[name]);
  addArm(group, {
    length: orbit, hubRadius: m.outer + 0.25, part: armParts.jupiterMoon, y,
    thickness: JM.armThickness, chamfer: JM.chamfer, collar: false,
  });
  addShaft(group, JM.postRadius, y + JM.armThickness, bodies.height).position.x = orbit;
  addPlanetSphere(group, radius, name).position.set(orbit, bodies.height, 0);
  jupiterMoonGroups[name] = group;
}

// --- Jordarmen: røret, det store hjulet nederst og stanga ut til jorda. ---
const armGroup = new THREE.Group();
scene.add(armGroup);
addShaft(armGroup, tube.earth.outer, heights.bottom.earth, armY);
addGear(armGroup, pairGear(bigGear.teeth, smallGear.teeth, tube.earth.outer, bigGear), heights.bottom.earth);
addArm(armGroup, { length: armLengths.earth, hubRadius: tube.earth.outer + 1, part: armParts.earth, y: armY, ring: true });

// Pinion og det store månekjedehjulet på samme aksel, som går rundt det faste hjulet.
const pinionGroup = addGroupAt(armGroup, layout.pinion);
addShaft(pinionGroup, moonTrain.pinion.holeRadius, armTop, heights.pinionTop);
addGear(pinionGroup, trainGear(moonTrain.pinion), level1);
// Kjedehjulet er satt på akselen i sin egen vinkel, så månefasen stemmer.
addSprocket(pinionGroup, moonTrain.driveSprocket, moonChain.radius1, moonChainLevel).rotation.y = phases.moon;

const updateMoonChain = addChain(armGroup, moonChain, moonChainLevel);
const updateParallelChain = addChain(armGroup, parallelChain, parallelLevel);
const updateDriveChain = addChain(driveChainGroup, driveChain, heights.driveChain);
const updateLayChain = addChain(layChainGroup, layChain, heights.layChain);

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
addPlanetSphere(earthTilted, bodies.earthRadius, 'earth');
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
// Røret er navet til månearmen, og stikker litt opp over den.
addShaft(moonGroup, moonTrain.moonSprocket.holeRadius, parallelLevel + moonTrain.thickness + 0.1, moonArmTop + armStyle.hubRise);
addArm(moonGroup, { length: bodies.moonOrbit, hubRadius: moonTrain.moonSprocket.holeRadius, part: armParts.moon, y: moonArmY, hub: false });
addShaft(moonGroup, armParts.moon.postRadius, moonArmTop, sleeveTop).position.x = bodies.moonOrbit; // hylsa

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
addPlanetSphere(moonPin, bodies.moonRadius, 'moon').position.y = bodies.height;

// Tilpass ved endring av vindusstørrelse.
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animasjon: tiden går med farten fra glidebryteren, og inngangsvinkelen
// følger av den. Hver del får vinkelen mekanismen regner ut fra tanntallene.
const timeControl = createTimeControl();
let lastTime = null;
let years = 0; // år siden startdatoen
renderer.setAnimationLoop((time) => {
  // Høyst 0,1 s per bilde, så modellen ikke hopper etter at fanen har vært skjult.
  const seconds = lastTime === null ? 0 : Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;
  years += (timeControl.daysPerSecond() * seconds) / daysPerYear;
  timeControl.show(dateAt(years));

  const a = anglesAt(years * inputPerYear);
  driveGroup.rotation.y = a.driveAngle;
  updateDriveChain(a.driveChainOffset);
  idlerGroup.rotation.y = a.idlerAngle;
  updateLayChain(a.layChainOffset);
  layGroup.rotation.y = a.layAngle;
  armGroup.rotation.y = a.armAngle;
  for (const name in planetGroups) planetGroups[name].rotation.y = a.planetAngles[name];
  jupiterTubeGroup.rotation.y = a.jupiterTubeAngle;
  updateJupiterChain(a.jupiterChainOffset);
  collarGroup.rotation.y = a.collarAngle;
  jupiterLayGroup.rotation.y = a.jupiterLayAngle;
  for (const name in jupiterMoonGroups) jupiterMoonGroups[name].rotation.y = a.jupiterMoonAngles[name];
  pinionGroup.rotation.y = a.pinionAngle;
  updateMoonChain(a.moonChainOffset);
  updateParallelChain(a.parallelChainOffset);
  parallelGroup.rotation.y = a.parallelAngle;
  moonGroup.rotation.y = a.moonAngle;
  moonPin.position.y = moonLift(a);
  // Plexus-kulene driver i vanlig tid, uansett hvor fort modellen går.
  for (const update of plexusUpdates) update(time / 1000);

  controls.update();
  renderer.render(scene, camera);
});
