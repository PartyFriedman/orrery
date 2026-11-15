import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  drive, outerDrive, center, gear, bigGear, smallGear, arm, armStyle, planets, moonTrain, bodies, panels, accent, look, jupiterMoons,
  saturnMoons, saturnRing, marsMoons,
} from './config.js';
import { createGearGeometry, createSprocketGeometry, createBevelGeometry, createRingGearGeometry } from './gear.js';
import { createArmGeometry } from './arm.js';
import { createPanelGeometry } from './panels.js';
import { createPlexus, plexusPatterns } from './plexus.js';
import { trackRotation, trackValue, updateBlur, createTrail, createFan, createSmoothGear, createSmoothChain } from './blur.js';
import { createGlassBands, createAnnulus } from './ring.js';
import {
  layout, anglesAt, pairModule, tube, tubes, heights, reach as armReach, armParts, armLengths,
  moonChain, parallelChain, driveChain, driveFrame, layChain, layFrame, idlerHub, earthAxis, moonRing, moonLift,
  phases, inputPerYear, dateAt, jupiterChain, jupiterLayout, jupiterTrain, moonSystems, mechanismOf, meshAngle,
  saturnTrain, saturnChain, saturnParallelChain, saturnLayout, saturnAxis, saturnBracket,
  marsTrain, marsChain, marsParallelChain, marsLayout, marsAxis, marsBracket,
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

// Den samme gradienten tegnes også som bakgrunn i scenen, så glasset i Saturns
// ring har noe å se gjennom. Mot en gjennomsiktig bakgrunn blir glasset grått.
{
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
  const panelMesh = new THREE.Mesh(geometry, [topMaterial, seamMaterial, seamMaterial]); // topper, mørke sider, mørke topper (split)
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
// Og hjulet som driver månerøret til Saturns ringbånd og måner.
addGear(driveGroup, pairGear(saturnMoons.driveTeeth, saturnMoons.tubeTeeth, drive.shaftRadius), heights.bottom['drive-saturn']);
// Mars: hjulene som driver månerøret og par-mars.
addGear(driveGroup, pairGear(marsMoons.driveTeeth, marsMoons.tubeTeeth, drive.shaftRadius), heights.bottom['drive-mars']);
addGear(driveGroup, pairGear(marsMoons.parallel.driveTeeth, marsMoons.parallel.tubeTeeth, drive.shaftRadius), heights.bottom['par-mars']);
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
// Hjulet som driver par-saturn (parallellføringen av Saturn-stolpen).
addGear(layGroup, pairGear(saturnMoons.parallel.layTeeth, saturnMoons.parallel.tubeTeeth, drive.shaftRadius), heights.bottom['par-saturn']);
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
  planetGroups[name] = group;
  if (mechanismOf(name) === 'ringMoons' || mechanismOf(name) === 'epicyclic') continue; // Saturn og Mars står på sine egne stolper, se under
  addShaft(group, armParts.planet.postRadius, y + arm.thickness, bodies.height).position.x = length;
  addPlanetSphere(group, p.radius, name).position.set(length, bodies.height, 0);
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
// Det samme brukes ved Saturn, med saturnMoons i stedet for jupiterMoons.
const smallTrainGear = (train, teeth, otherTeeth, holeRadius, module = (2 * train.layDistance) / (teeth + otherTeeth)) => {
  const hubWidth = 0.35, rimWidth = 0.35;
  const rimRadius = (module * teeth) / 2 - 1.25 * module - rimWidth;
  return {
    // Avfasingen holdes liten nok til de minste tennene (ellers blir det spisser).
    ...gear, thickness: train.thickness, chamfer: Math.min(train.chamfer, module * 0.4), backlash: train.backlash,
    teeth, module, holeRadius, hubWidth, rimWidth, spokeWidth: 0.35,
    spokes: rimRadius - holeRadius - hubWidth > 1.2 ? (teeth >= 40 ? 5 : 4) : 0,
  };
};
const jupiterGear = (teeth, otherTeeth, holeRadius) => smallTrainGear(JM, teeth, otherTeeth, holeRadius);
const jupiterGroup = planetGroups.jupiter;
const jupiterArmTop = heights.arm.jupiter + arm.thickness;
const updateJupiterChain = addChain(jupiterGroup, jupiterChain, JS.chain);

// Kragen går løst på stolpen: kjedehjulet nederst, tannhjulet over.
// Raske deler som får lysspor, vifter og glatte former (blur.js): gruppen som
// dreier, tannhjulene i den, delene som får vifte, og eventuelt månens bane.
const fastParts = [];
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
  const gearMesh = addGear(group, jupiterGear(m.moonTeeth, m.layTeeth, m.outer), JS.moonGear[name]);
  const armStart = group.children.length;
  addArm(group, {
    length: orbit, hubRadius: m.outer + 0.25, part: armParts.jupiterMoon, y,
    thickness: JM.armThickness, chamfer: JM.chamfer, collar: false,
  });
  addShaft(group, JM.postRadius, y + JM.armThickness, bodies.height).position.x = orbit;
  const fan = group.children.slice(armStart); // armen og stolpen, til vifta mot flimring
  addPlanetSphere(group, radius, name).position.set(orbit, bodies.height, 0);
  jupiterMoonGroups[name] = group;
  fastParts.push({ group, gears: [gearMesh], fan, trail: { radius: orbit, y: bodies.height, tube: radius * 0.35 } });
}

// --- Saturn ---
// Ringbåndene dreier hver for seg rundt Saturns skrå akse og bærer hver sin
// måne på en arm over ringen. Drivet går fra månerøret i tårnet, med et kjede
// langs armen, til en driveaksel midt i Saturn-stolpen. Øverst fører en
// vinkelgir bevegelsen over i en skrå forlegsaksel, som driver båndrørene.
// Stolpen holdes i samme retning i rommet av par-saturn og parallellkjedet,
// og bærer kula, akselen og hjulkassen. Se saturnMoons og saturnRing i config.
const SM = saturnMoons, SMP = saturnMoons.parallel, SS = heights.stack.saturn, ST = saturnTrain;
function addMeshWith(parent, geometry, meshMaterial) {
  const mesh = new THREE.Mesh(geometry, meshMaterial);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
// Rund stang mellom to punkter.
const upAxis = new THREE.Vector3(0, 1, 0);
function addRod(parent, a, b, radius, meshMaterial = material) {
  const A = new THREE.Vector3(a.x, a.y, a.z ?? 0), B = new THREE.Vector3(b.x, b.y, b.z ?? 0);
  const mesh = addMeshWith(parent, new THREE.CylinderGeometry(radius, radius, A.distanceTo(B), 16), meshMaterial);
  mesh.position.copy(A).add(B).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(upAxis, B.clone().sub(A).normalize());
  return mesh;
}
// Flat stang langs x fra x0 til x1, med runde ender.
function addFlatBar(parent, x0, x1, y0, y1, width, meshMaterial = material) {
  addMeshWith(parent, new THREE.BoxGeometry(x1 - x0, y1 - y0, width), meshMaterial).position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
  for (const x of [x0, x1]) {
    addMeshWith(parent, new THREE.CylinderGeometry(width / 2, width / 2, y1 - y0, 24), meshMaterial).position.set(x, (y0 + y1) / 2, 0);
  }
}
const strutMaterial = new THREE.MeshPhysicalMaterial({
  color: saturnRing.struts.color, metalness: saturnRing.struts.metalness, roughness: saturnRing.struts.roughness,
});
const moonArmMaterial = new THREE.MeshPhysicalMaterial({
  color: SM.armMaterial.color, metalness: SM.armMaterial.metalness, roughness: SM.armMaterial.roughness,
  clearcoat: SM.armMaterial.gloss, clearcoatRoughness: look.glossRoughness,
});
const bigSprocketStyle = { spokes: 5, spokeWidth: 1.5, hubWidth: 1.2, rimWidth: 1.5 };

// I tårnet: månerøret og par-saturn, med kjedehjulene rett over Saturn-armen.
const saturnTubeGroup = new THREE.Group();
scene.add(saturnTubeGroup);
const saturnDriveTube = tube['drive-saturn'], saturnParTube = tube['par-saturn'];
addShaft(saturnTubeGroup, saturnDriveTube.outer, heights.bottom['drive-saturn'], SS.driveTubeTop);
addGear(saturnTubeGroup, pairGear(SM.tubeTeeth, SM.driveTeeth, saturnDriveTube.outer), heights.bottom['drive-saturn']);
addSprocket(saturnTubeGroup, { teeth: SM.tubeSprocket, holeRadius: saturnDriveTube.outer, ...bigSprocketStyle },
  saturnChain.radius1, SS.chain, saturnChain);
const saturnParGroup = new THREE.Group();
scene.add(saturnParGroup);
addShaft(saturnParGroup, saturnParTube.outer, heights.bottom['par-saturn'], SS.parTubeTop);
addGear(saturnParGroup, pairGear(SMP.tubeTeeth, SMP.layTeeth, saturnParTube.outer), heights.bottom['par-saturn']);
addSprocket(saturnParGroup, { teeth: SMP.centerSprocket, holeRadius: saturnParTube.outer, ...bigSprocketStyle },
  saturnParallelChain.radius1, SS.parallel, saturnParallelChain);

// Langs Saturn-armen: de to kjedene.
const saturnGroup = planetGroups.saturn;
const saturnArmTop = heights.arm.saturn + arm.thickness;
const updateSaturnChain = addChain(saturnGroup, saturnChain, SS.chain);
const updateSaturnParChain = addChain(saturnGroup, saturnParallelChain, SS.parallel);

// Driveakselen midt i stolpen: kjedehjulet nederst og det koniske hjulet øverst.
const bevelGear = (teeth, holeRadius) => smallTrainGear(SM, teeth, 0, holeRadius, ST.bevel.module);
const saturnShaftGroup = addGroupAt(saturnGroup, saturnLayout.post);
addShaft(saturnShaftGroup, SM.driveShaftRadius, saturnArmTop, SS.shaftTop);
addSprocket(saturnShaftGroup, { teeth: SM.shaftSprocket, holeRadius: SM.driveShaftRadius, ...sprocketStyle },
  saturnChain.radius2, SS.chain, saturnChain);
addMesh(saturnShaftGroup, createBevelGeometry(bevelGear(ST.bevel.driveTeeth, SM.driveShaftRadius), ST.bevel.drop1))
  .position.y = SS.bevelGear;

// Stolpen (står stille i rommet): kjedehjulet nederst og røret rundt
// driveakselen, og på den retningen aksen heller mot (saturnMount).
const saturnFrameGroup = addGroupAt(saturnGroup, saturnLayout.post);
const frameOuter = SM.driveShaftRadius + SM.frameWall;
addSprocket(saturnFrameGroup, { teeth: SMP.postSprocket, holeRadius: frameOuter, ...sprocketStyle },
  saturnParallelChain.radius2, SS.parallel, saturnParallelChain);
addShaft(saturnFrameGroup, frameOuter, SS.parallel + moonTrain.thickness, SS.frameTop);
const saturnMount = new THREE.Group();
saturnMount.rotation.y = saturnAxis.direction;
saturnFrameGroup.add(saturnMount);
// Braketten fra toppen av stolperøret ut til siden og opp til platen under hjulene.
const bracketPoints = saturnBracket.points;
for (let i = 0; i < bracketPoints.length - 1; i++) addRod(saturnMount, bracketPoints[i], bracketPoints[i + 1], saturnBracket.radius);
for (const p of bracketPoints.slice(1, -1)) addSphere(saturnMount, saturnBracket.radius).position.set(p.x, p.y, p.z);

// Alt rundt den skrå aksen, med Saturns sentrum i origo og aksen langs y.
const saturnTilted = new THREE.Group();
saturnTilted.position.y = bodies.height;
saturnTilted.rotation.z = -saturnAxis.tilt; // heller toppen mot +x i saturnMount
saturnMount.add(saturnTilted);
addPlanetSphere(saturnTilted, ST.radius, 'saturn');
addShaft(saturnTilted, SM.axleRadius, ST.axleSpan[0], ST.axleSpan[1]);           // den faste akselen
const saturnPlate = new THREE.Group();
saturnPlate.position.y = ST.level.plate;
saturnTilted.add(saturnPlate);
// Platen fra akselen til et lagerøye rundt forlegsakselen.
// (Den runde enden går 0,05 inn i lagerøyet.)
addFlatBar(saturnPlate, 0, ST.layDistance - ST.plateBearing - ST.plateThickness + 0.05, -ST.plateThickness / 2, ST.plateThickness / 2, ST.plateThickness * 2);
addShaft(saturnPlate, ST.plateBearing, -ST.plateThickness / 2, ST.plateThickness / 2).position.x = ST.layDistance;

// Den skrå forlegsakselen: det koniske hjulet nederst, og hjulene som driver
// Enceladus- og Titan-båndet. Hylsa på den driver Iapetus-båndet fra Titan-røret.
const saturnLayGroup = new THREE.Group();
saturnLayGroup.position.x = ST.layDistance;
saturnTilted.add(saturnLayGroup);
addShaft(saturnLayGroup, SM.shaftRadius, ST.laySpan[0], ST.laySpan[1]);
addMesh(saturnLayGroup, createBevelGeometry(bevelGear(ST.bevel.layTeeth, SM.shaftRadius), ST.bevel.drop2))
  .position.y = ST.bevel.layGear;
for (const name of ['enceladus', 'titan']) {
  const p = ST.pairs[name];
  addGear(saturnLayGroup, smallTrainGear(SM, p.lay, p.tube, SM.shaftRadius), ST.level[name] - SM.thickness / 2)
    .rotation.y = phases[name];
}
const saturnSleeveGroup = new THREE.Group();
saturnSleeveGroup.position.x = ST.layDistance;
saturnTilted.add(saturnSleeveGroup);
addShaft(saturnSleeveGroup, ST.sleeve.outer, ST.sleeveSpan[0], ST.sleeveSpan[1]);
addGear(saturnSleeveGroup, smallTrainGear(SM, ST.pairs.titan2.lay, ST.pairs.titan2.tube, ST.sleeve.outer), ST.level.titan2 - SM.thickness / 2);
addGear(saturnSleeveGroup, smallTrainGear(SM, ST.pairs.iapetus.lay, ST.pairs.iapetus.tube, ST.sleeve.outer), ST.level.iapetus - SM.thickness / 2)
  .rotation.y = phases.iapetus;

// Båndene C, B og A: rør med hjul nederst, nav med stag opp til glassbåndet,
// og månearmen over ringen.
const glassBands = createGlassBands(ST.radius, saturnRing);
const saturnBandGroups = {};
const gearsOnBand = { A: ['enceladus'], B: ['titan', 'titan2'], C: ['iapetus'] };
const moonOnBand = { A: 'enceladus', B: 'titan', C: 'iapetus' };
const bandTop = saturnRing.thickness / 2;
['C', 'B', 'A'].forEach((b, i) => {
  const group = new THREE.Group();
  saturnTilted.add(group);
  saturnBandGroups[b] = group;
  const t = ST.tubeOf[b], hub = ST.hubs[b];
  addShaft(group, t.outer, ...ST.tubeSpan[b]);
  const bandGears = [];
  for (const name of gearsOnBand[b]) {
    const p = ST.pairs[name];
    bandGears.push(addGear(group, smallTrainGear(SM, p.tube, p.lay, t.outer), ST.level[name] - SM.thickness / 2));
  }
  addShaft(group, hub.radius, hub.s - hub.length / 2, hub.s + hub.length / 2);
  const count = saturnRing.struts.count;
  const fan = [];
  for (let k = 0; k < count; k++) {
    const ang = ((k + 0.5) / count) * Math.PI * 2;
    const at = (r, y) => ({ x: r * Math.cos(ang), y, z: -r * Math.sin(ang) });
    fan.push(addRod(group, at(hub.radius - 0.05, hub.s), at(hub.attach, -bandTop), ST.strutRadius, strutMaterial));
  }
  const glass = new THREE.Mesh(glassBands[i].geometry, glassBands[i].material);
  glass.receiveShadow = true; // glasset stenger ikke lyset helt, så det kaster ingen skygge
  group.add(glass);

  // Månearmen: Enceladus rett ut fra ytterkanten av A-båndet; Titan og Iapetus
  // på et ledd opp fra båndet og en arm over det som ligger under.
  const name = moonOnBand[b], m = ST.arms[name], half = SM.armThickness / 2;
  const armStart = group.children.length;
  if (m.s > 0) {
    addShaft(group, ST.footRadius, bandTop, bandTop + 0.08).position.x = m.from; // foten på glasset
    const leg = addMeshWith(group, new THREE.CylinderGeometry(SM.legRadius, SM.legRadius, m.s + half - bandTop, 16), moonArmMaterial);
    leg.position.set(m.from, (bandTop + m.s + half) / 2, 0);
  }
  addFlatBar(group, m.from, m.orbit, m.s - half, m.s + half, SM.armWidth, moonArmMaterial);
  fan.push(...group.children.slice(armStart));
  addPlanetSphere(group, m.radius, name).position.set(m.orbit, m.s, 0);
  fastParts.push({ group, gears: bandGears, fan, trail: { radius: m.orbit, y: m.s, tube: m.radius * 0.35 } });
});

// --- Mars ---
// Fobos og Deimos med planetgir. Drivet går fra månerøret i tårnet, med et
// kjede langs armen, til driveakselen midt i Mars-stolpen. Øverst på den sitter
// klokka (et ringhjul med innvendige tenner), som driver den loddrette
// sideakselen. Der sideakselen møter Mars' skrå akse, under Mars, sitter et
// dobbelt kryssledd (kardang) som tar bevegelsen inn i bæreren i planetgiret.
// Ringhjulet står fast; bæreren med planethjulene går med Deimos, solhjulet med
// Fobos. Mars står stille på en aksel som holdes av gaffelen over nordpolen.
// Stolpen holdes i samme retning i rommet av par-mars og parallellkjedet.
const MMc = marsMoons, MS = heights.stack.mars, MTr = marsTrain, PGm = MTr.planetary;
const marsArmMaterial = new THREE.MeshPhysicalMaterial({
  color: MMc.armMaterial.color, metalness: MMc.armMaterial.metalness, roughness: MMc.armMaterial.roughness,
  clearcoat: MMc.armMaterial.gloss, clearcoatRoughness: look.glossRoughness,
});
const marsGear = (teeth, holeRadius, module) => smallTrainGear(MMc, teeth, 0, holeRadius, module);

// I tårnet: månerøret og par-mars, med kjedehjulene rett over Mars-armen.
const marsTubeGroup = new THREE.Group();
scene.add(marsTubeGroup);
const marsDriveTube = tube['drive-mars'], marsParTube = tube['par-mars'];
addShaft(marsTubeGroup, marsDriveTube.outer, heights.bottom['drive-mars'], MS.driveTubeTop);
addGear(marsTubeGroup, pairGear(MMc.tubeTeeth, MMc.driveTeeth, marsDriveTube.outer), heights.bottom['drive-mars']);
addSprocket(marsTubeGroup, { teeth: MMc.tubeSprocket, holeRadius: marsDriveTube.outer, ...bigSprocketStyle },
  marsChain.radius1, MS.chain, marsChain);
const marsParGroup = new THREE.Group();
scene.add(marsParGroup);
addShaft(marsParGroup, marsParTube.outer, heights.bottom['par-mars'], MS.parTubeTop);
addGear(marsParGroup, pairGear(MMc.parallel.tubeTeeth, MMc.parallel.driveTeeth, marsParTube.outer), heights.bottom['par-mars']);
addSprocket(marsParGroup, { teeth: MMc.parallel.centerSprocket, holeRadius: marsParTube.outer, ...bigSprocketStyle },
  marsParallelChain.radius1, MS.parallel, marsParallelChain);

// Langs Mars-armen: de to kjedene.
const marsGroup = planetGroups.mars;
const marsArmTop = heights.arm.mars + arm.thickness;
const updateMarsChain = addChain(marsGroup, marsChain, MS.chain);
const updateMarsParChain = addChain(marsGroup, marsParallelChain, MS.parallel);

// Driveakselen midt i stolpen: kjedehjulet nederst, opp til kryssleddet K på toppen.
const plateT = MTr.plateThickness;
const marsShaftGroup = addGroupAt(marsGroup, marsLayout.post);
addShaft(marsShaftGroup, MMc.driveShaftRadius, marsArmTop, MS.shaftTop);
addSprocket(marsShaftGroup, { teeth: MMc.shaftSprocket, holeRadius: MMc.driveShaftRadius, ...sprocketStyle },
  marsChain.radius2, MS.chain, marsChain);

// Stolpen (står stille i rommet): kjedehjulet nederst og røret rundt
// driveakselen, og på den retningen aksen heller mot (marsMount): den knekte
// braketten, kryssleddet og alt rundt Mars' skrå akse.
const marsFrameGroup = addGroupAt(marsGroup, marsLayout.post);
const marsFrameOuter = MMc.driveShaftRadius + MMc.frameWall;
addSprocket(marsFrameGroup, { teeth: MMc.parallel.postSprocket, holeRadius: marsFrameOuter, ...sprocketStyle },
  marsParallelChain.radius2, MS.parallel, marsParallelChain);
addShaft(marsFrameGroup, marsFrameOuter, MS.parallel + moonTrain.thickness, MS.frameTop);
const marsMount = new THREE.Group();
marsMount.rotation.y = marsAxis.direction;
marsFrameGroup.add(marsMount);
// Den knekte braketten: runde knekker, og myke overganger (en kjegle som vider
// seg ut) der den møter stolperøret og ringhjulet.
const mbp = marsBracket.points;
for (let i = 0; i < mbp.length - 1; i++) addRod(marsMount, mbp[i], mbp[i + 1], marsBracket.radius);
for (const p of mbp.slice(1, -1)) addSphere(marsMount, marsBracket.radius).position.set(p.x, p.y, p.z);
const addFlare = (at, toward) => {
  const A = new THREE.Vector3(at.x, at.y, at.z), dir = new THREE.Vector3(toward.x, toward.y, toward.z).sub(A).normalize();
  const r = marsBracket.radius, L = marsBracket.fillet;
  const flare = addMesh(marsMount, new THREE.CylinderGeometry(r, r * 2, L, 24));
  flare.position.copy(A).addScaledVector(dir, L / 2);
  flare.quaternion.setFromUnitVectors(upAxis, dir);
};
addFlare(mbp[0], mbp[1]);
addFlare(mbp[mbp.length - 1], mbp[mbp.length - 2]);

// Kryssleddet K på toppen av stolpen: driveakselen (loddrett) og den skrå
// drivakselen møtes, og korset dreier med dem.
const marsJoint = new THREE.Group();
marsJoint.position.set(0, MS.joint, 0);
const bisector = new THREE.Vector3(0, 1, 0).add(new THREE.Vector3(Math.sin(marsAxis.tilt), Math.cos(marsAxis.tilt), 0)).normalize();
marsJoint.quaternion.setFromUnitVectors(upAxis, bisector);
marsMount.add(marsJoint);
addMeshWith(marsJoint, new THREE.SphereGeometry(MMc.jointRadius * 0.55, 24, 12), seamMaterial);
const marsCross = new THREE.Group();
marsJoint.add(marsCross);
for (const [rx, rz] of [[0, Math.PI / 2], [Math.PI / 2, 0]]) {
  const pin = addMesh(marsCross, new THREE.CylinderGeometry(0.06, 0.06, MMc.jointRadius * 2, 12));
  pin.rotation.set(rx, 0, rz);
}

// Alt rundt Mars' skrå akse, med Mars' sentrum i origo og aksen langs y.
const marsTilted = new THREE.Group();
marsTilted.position.y = bodies.height;
marsTilted.rotation.z = -marsAxis.tilt;
marsMount.add(marsTilted);
addPlanetSphere(marsTilted, MTr.radius, 'mars');
addShaft(marsTilted, MMc.axleRadius, ...MTr.axleSpan);
addMesh(marsTilted, createRingGearGeometry({
  teeth: PGm.ring, module: MTr.module, outerRadius: MTr.ring.outer, thickness: MMc.thickness, chamfer: 0.02,
})).position.y = MTr.level.ringLayer - MMc.thickness / 2;
// Skåla under bæreren: bunnen rundt akselen og en vegg opp til ringhjulet, så
// aksel, skål, ringhjul og Mars er én stiv enhet.
{
  const bt = MMc.bowlThickness, bottom = MTr.level.bowl, wallTop = MTr.level.ringLayer - MMc.thickness / 2;
  addShaft(marsTilted, MTr.ring.outer, bottom - bt / 2, bottom + bt / 2);
  addMesh(marsTilted, createAnnulus(MTr.ring.outer - 0.2, MTr.ring.outer, wallTop - (bottom + bt / 2), 0.02))
    .position.y = (wallTop + bottom + bt / 2) / 2;
}
// Tappen mellomhjulet står på, på en knast ytterst på ringhjulet.
const MDr = MTr.drive;
{
  const lug = new THREE.Group();
  lug.rotation.y = MDr.idlerPhi;
  marsTilted.add(lug);
  addFlatBar(lug, MTr.ring.outer - 0.3, MDr.idlerRho, MTr.level.ringLayer - MMc.thickness / 2,
    MTr.level.ringLayer + MMc.thickness / 2, MMc.pinRadius * 4);
  addShaft(lug, MMc.pinRadius, ...MTr.pinSpan).position.x = MDr.idlerRho;
}
// Den skrå drivakselen fra kryssleddet, med det store hjulet øverst.
const marsDriveGroup = new THREE.Group();
marsDriveGroup.position.x = MDr.distance;
marsTilted.add(marsDriveGroup);
addShaft(marsDriveGroup, MMc.tiltShaftRadius, ...MTr.driveShaftSpan);
addGear(marsDriveGroup, smallTrainGear(MMc, MMc.drive.bigTeeth, 0, MMc.tiltShaftRadius, MDr.module), MTr.level.drive - MMc.thickness / 2);
// Mellomhjulet.
const marsIdlerGroup = new THREE.Group();
marsIdlerGroup.position.set(MDr.idler.x, 0, -MDr.idler.z);
marsTilted.add(marsIdlerGroup);
addGear(marsIdlerGroup, smallTrainGear(MMc, MMc.drive.idlerTeeth, 0, MMc.pinRadius, MDr.module), MTr.level.drive - MMc.thickness / 2);

// Bæreren (Deimos): to plater, pinnene med planethjulene, det lille hjulet i
// hjulparet, røret opp og armen til Deimos.
const marsCarrierGroup = new THREE.Group();
marsTilted.add(marsCarrierGroup);
const marsSmallGear = addGear(marsCarrierGroup, smallTrainGear(MMc, MMc.drive.smallTeeth, 0, MTr.carrierTube.outer, MDr.module),
  MTr.level.drive - MMc.thickness / 2);
// Platene er edderkopper med én arm per planethjul, så solsystemet synes ovenfra.
const pinRadius = 0.1, spiderWidth = 0.35;
const spiderMeshes = [];
for (const [y, inner] of [[MTr.level.carrierBottom, 0], [MTr.level.carrierTop, MTr.carrierTube.inner]]) {
  addShaft(marsCarrierGroup, MTr.carrierTube.outer + 0.15, y - plateT / 2, y + plateT / 2);
  for (let k = 0; k < PGm.count; k++) {
    const spoke = new THREE.Group();
    spoke.rotation.y = (2 * Math.PI * k) / PGm.count;
    marsCarrierGroup.add(spoke);
    addFlatBar(spoke, Math.max(inner, 0.2), MTr.carrierRadius, y - plateT / 2, y + plateT / 2, spiderWidth);
    spiderMeshes.push(...spoke.children);
  }
}
fastParts.push({ group: marsCarrierGroup, fan: spiderMeshes, gears: [marsSmallGear] });
addShaft(marsCarrierGroup, MTr.carrierTube.outer, ...MTr.carrierTubeSpan);
const marsPlanets = [];
const startMars = anglesAt(0);
for (let k = 0; k < PGm.count; k++) {
  const az = (2 * Math.PI * k) / PGm.count;
  const pin = new THREE.Group();
  pin.position.set(MTr.carrierRadius * Math.cos(az), 0, -MTr.carrierRadius * Math.sin(az));
  marsCarrierGroup.add(pin);
  addShaft(pin, pinRadius, MTr.level.carrierBottom, MTr.level.carrierTop);
  const spin = new THREE.Group();
  pin.add(spin);
  const planet2 = addGear(spin, marsGear(PGm.planet2, pinRadius, MTr.module), MTr.level.ringLayer - MMc.thickness / 2);
  // planet1 sitter fast på planet2, satt på så det griper i solhjulet.
  const sunRel = startMars.marsSun - startMars.marsCarrier;
  const p1 = meshAngle(sunRel, PGm.sun, PGm.planet1, az) - startMars.marsPlanetSpins[k];
  const planet1 = addGear(spin, marsGear(PGm.planet1, pinRadius, MTr.module), MTr.level.sunLayer - MMc.thickness / 2);
  planet1.rotation.y = p1;
  marsPlanets.push(spin);
  fastParts.push({ group: spin, gears: [planet2, planet1] });
}

// Månearmene: et nav på røret, armen ut og en stolpe opp til ekvatorplanet.
const addMarsMoon = (parent, name, tubeOuter, gears = []) => {
  const m = MTr.arms[name], half = MMc.armThickness / 2;
  const holder = new THREE.Group();
  holder.rotation.y = phases[name];
  parent.add(holder);
  addShaft(holder, tubeOuter + 0.15, m.s - MTr.hubLength / 2, m.s + MTr.hubLength / 2);
  addFlatBar(holder, tubeOuter + 0.15, m.orbit, m.s - half, m.s + half, MMc.armWidth, marsArmMaterial);
  const post = addMeshWith(holder, new THREE.CylinderGeometry(MMc.postRadius, MMc.postRadius, -m.s, 12), marsArmMaterial);
  post.position.set(m.orbit, m.s / 2, 0);
  const fan = holder.children.slice(1);
  addPlanetSphere(holder, m.radius, name).position.set(m.orbit, 0, 0);
  // Sporet ligger i holderen (der månen står på +x), men måles på gruppen som dreier.
  fastParts.push({ group: parent, gears, fan, trail: { parent: holder, radius: m.orbit, y: 0, tube: Math.max(m.radius * 0.35, 0.03) } });
};
addMarsMoon(marsCarrierGroup, 'deimos', MTr.carrierTube.outer);

// Solhjulet (Fobos): hjulet, røret opp og armen til Fobos.
const marsSunGroup = new THREE.Group();
marsTilted.add(marsSunGroup);
const marsSunGear = addGear(marsSunGroup, marsGear(PGm.sun, MTr.sunTube.outer, MTr.module), MTr.level.sunLayer - MMc.thickness / 2);
addShaft(marsSunGroup, MTr.sunTube.outer, ...MTr.sunTubeSpan);
addMarsMoon(marsSunGroup, 'phobos', MTr.sunTube.outer, [marsSunGear]);

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

// --- Mot flimring (blur.js) ---
// Hjulene på akslene som går fort (alle unntatt den første delen, som er akselen).
const gearsOf = (group) => group.children.filter((c) => c.isMesh).slice(1);
fastParts.push({ group: collarGroup, gears: gearsOf(collarGroup) });
fastParts.push({ group: jupiterLayGroup, gears: gearsOf(jupiterLayGroup) });
fastParts.push({ group: saturnLayGroup, gears: gearsOf(saturnLayGroup) });
fastParts.push({ group: saturnSleeveGroup, gears: gearsOf(saturnSleeveGroup) });
fastParts.push({ group: marsDriveGroup, gears: gearsOf(marsDriveGroup) });
fastParts.push({ group: marsIdlerGroup, gears: marsIdlerGroup.children.filter((c) => c.isMesh) });
// Månen: sporet i høyden der banen ligger i snitt (den går litt opp og ned).
fastParts.push({ group: moonGroup, trail: { radius: bodies.moonOrbit, y: bodies.height, tube: bodies.moonRadius * 0.35 } });
scene.updateMatrixWorld(true);
for (const p of fastParts) {
  const pieces = [];
  for (const g of p.gears ?? []) pieces.push(createSmoothGear(g));
  if (p.fan?.length) pieces.push(createFan(p.group, p.fan));
  if (p.trail) pieces.push(createTrail(p.trail.parent ?? p.group, p.trail));
  trackRotation(p.group, pieces);
}
// Kjedene til månene: et glatt bånd over leddene. Farten måles som vinkelen
// det minste kjedehjulet dreier.
const chainOffsets = {};
for (const [key, parent, chain, y] of [
  ['jupiter', jupiterGroup, jupiterChain, JS.chain],
  ['saturn', saturnGroup, saturnChain, SS.chain],
  ['mars', marsGroup, marsChain, MS.chain],
  ['moon', armGroup, moonChain, moonChainLevel],
]) {
  const over = plateGap + 2 * plateThickness;
  const band = createSmoothChain(parent, chain, y - over, moonTrain.thickness + 2 * over, chain.rollerRadius * 1.25, chainMaterial);
  trackValue(() => chainOffsets[key] ?? 0, Math.min(chain.radius1, chain.radius2), [band]);
}

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
  saturnTubeGroup.rotation.y = a.saturnTubeAngle;
  saturnParGroup.rotation.y = a.saturnParTubeAngle;
  updateSaturnChain(a.saturnChainOffset);
  updateSaturnParChain(a.saturnParChainOffset);
  saturnShaftGroup.rotation.y = a.saturnShaftAngle;
  saturnFrameGroup.rotation.y = a.saturnFrameAngle;
  saturnLayGroup.rotation.y = a.saturnLayAngle;
  saturnSleeveGroup.rotation.y = a.saturnSleeveAngle;
  for (const b in saturnBandGroups) saturnBandGroups[b].rotation.y = a.saturnBands[b];
  marsTubeGroup.rotation.y = a.marsTubeAngle;
  marsParGroup.rotation.y = a.marsParTubeAngle;
  updateMarsChain(a.marsChainOffset);
  updateMarsParChain(a.marsParChainOffset);
  marsShaftGroup.rotation.y = a.marsShaftAngle;
  marsFrameGroup.rotation.y = a.marsFrameAngle;
  marsDriveGroup.rotation.y = a.marsDriveAngle;
  marsIdlerGroup.rotation.y = a.marsIdlerAngle;
  marsCross.rotation.y = a.marsDriveAngle;
  marsCarrierGroup.rotation.y = a.marsCarrier;
  marsPlanets.forEach((spin, k) => { spin.rotation.y = a.marsPlanetSpins[k]; });
  marsSunGroup.rotation.y = a.marsSun;
  pinionGroup.rotation.y = a.pinionAngle;
  updateMoonChain(a.moonChainOffset);
  updateParallelChain(a.parallelChainOffset);
  parallelGroup.rotation.y = a.parallelAngle;
  moonGroup.rotation.y = a.moonAngle;
  moonPin.position.y = moonLift(a);
  // Plexus-kulene driver i vanlig tid, uansett hvor fort modellen går.
  for (const update of plexusUpdates) update(time / 1000);
  // Lysspor, vifter og glatte former for det som går fort (blur i config).
  chainOffsets.jupiter = a.jupiterChainOffset;
  chainOffsets.saturn = a.saturnChainOffset;
  chainOffsets.mars = a.marsChainOffset;
  chainOffsets.moon = a.moonChainOffset;
  updateBlur();

  controls.update();
  renderer.render(scene, camera);
});
