// Alle delene i modellen: materialene, tårnet, armene, mekanikken ved hver
// planet og kulene. Målene og vinklene regnes ut i mechanism.js; her tegnes de.
// Alt legges i gruppen root, uten renderer og DOM, så npm run check kan bygge
// modellen i Node. main.js legger root i scenen og kaller update(years) når
// tiden har gått.
import * as THREE from 'three';
import {
  drive, outerDrive, center, gear, bigGear, smallGear, arm, armStyle, planets, moonTrain, bodies, bodyLooks, accent, jupiterMoons,
  saturnMoons, saturnRing, marsMoons, counterDrive, uranusRing, uranusPost, iceMoons, earthDay,
} from './config.js';
import { createMaterials, createBodyMaterials, lookOf, lacquer } from './materials.js';
import { makeBuilder, bandGeometry } from './build.js';
import { createGearGeometry, createSprocketGeometry, createBevelGeometry, createRingGearGeometry } from './gear.js';
import { createArmGeometry } from './arm.js';
import { createPanelGeometry } from './panels.js';
import { createPlexus, plexusPatterns } from './plexus.js';
import { trackRotation, trackValue, createTrail, createFan, createSmoothGear, createSmoothChain } from './blur.js';
import { createGlassBands, createAnnulus, createGlassMaterials } from './ring.js';
import { createEarthSurface, createSurfaceMaterials, createSpinBlur } from './earthSurface.js';
import { buildEarthEnd } from './earthBuild.js';
import {
  layout, anglesAt, pairModule, tube, tubes, heights, armParts, armLengths,
  moonChain, parallelChain, driveChain, driveFrame, layChain, layFrame, idlerHub, earthAxis, earthTrain, earthDayChain,
  phases, inputPerYear, jupiterChain, jupiterLayout, jupiterTrain, moonSystems, mechanismOf, meshAngle,
  saturnTrain, saturnChain, saturnParallelChain, saturnLayout, saturnAxis, saturnBracket,
  marsTrain, marsChain, marsParallelChain, marsLayout, marsAxis, marsBracket,
  usesCounter, uranusTrain, uranusParallelChain, uranusLayout, uranusAxis, uranusBracket,
  uranusMoonTrain, uranusMoonChain, uranusMoonNames, neptuneMoonTrain, neptuneChain, neptuneLayout,
} from './mechanism.js';
import { ALL, moonsOf, system, drives } from './drives.js';

// Kroppene langs kjedene nederst i tårnet: alt fra Jupiter og utover.
const outerBodies = ['jupiter', 'saturn', 'uranus', 'neptune'].flatMap(system);
// Saturn-røret driver også motakselen, og dermed Uranus og Neptun.
const counterBodies = usesCounter ? [...system('uranus'), ...system('neptune')] : [];

// Gruppen alt legges i.
export const root = new THREE.Group();

// Materialene (materials.js): hvit lakk på alt i mekanikken, mørkt metall i
// fugene, kjedene, og accent på ringene ved stolpene og mellomhjulet ved Neptun.
const mat = createMaterials();
const bodyMaterial = createBodyMaterials(mat.white);

// Byggeklossene (build.js) i hvit lakk.
const { mesh: addMesh, shaft: addShaft, rod: addRod, ball, flare: addFlare, flatBar: addFlatBar, bracket: addBracket } = makeBuilder(mat.white);
const addSphere = (parent, radius) => ball(parent, { x: 0, y: 0, z: 0 }, radius, mat.white, [64, 32]);
const bigBall = [64, 32];   // kulene i knekkene på brakettene
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
// Gruppe som står på et punkt i planet (planets y er -z i three.js).
function addGroupAt(parent, point) {
  const group = new THREE.Group();
  group.position.set(point.x, 0, -point.y);
  parent.add(group);
  return group;
}

// Det som dreier: hver gruppe får vinkelen fra anglesAt hvert bilde. key er
// navnet på vinkelen, eller en funksjon som henter den.
const turning = [];
const turnsWith = (group, key) => {
  turning.push([group, typeof key === 'string' ? (a) => a[key] : key]);
  return group;
};

// En planet som kule av paneler (mønsteret står i bodyLooks i config): toppene
// i fargen til kula, mørke sider og en mørk kjerne under, som synes i fugene.
// Sola bruker den samme kula med andre materialer.
// Med mønsteret 'plexusA', 'plexusB' eller 'plexusC' blir kula en plexus-kule
// (plexus.js) i stedet. Andre tall i blokka erstatter dem i plexus i config.
// Alle kulene, sola inkludert, havner også i spheres (navn: gruppe og radius),
// så de kan velges med klikk (picking.js) og kameraet kan følge dem (focus.js).
const plexusUpdates = []; // flytter nodene i plexus-kulene, se animasjonen nederst
const spheres = {};
let earthSurfaceMaterials = null;
function addPlanetSphere(parent, radius, name, topMaterial = bodyMaterial(name), coreMaterial = mat.metal) {
  const group = new THREE.Group();
  parent.add(group);
  group.userData.body = name; // en kule, ikke mekanikk (drives.js)
  spheres[name] = { object: group, radius };
  const { pattern, ...overrides } = bodyLooks[name] ?? {};
  if (pattern === 'continents') {
    // Jorda med landmasser (earthSurface.js), i fargene til havet, landet og isen.
    group.add(createEarthSurface(radius, earthSurfaceMaterials ??= createSurfaceMaterials()));
    return group;
  }
  if (plexusPatterns[pattern]) {
    plexusUpdates.push(createPlexus(group, pattern, radius, { white: topMaterial, metal: mat.metal, core: coreMaterial }, overrides));
    return group;
  }
  const { geometry, coreRadius } = createPanelGeometry({ radius, ...lookOf(name) });
  const panelMesh = new THREE.Mesh(geometry, [topMaterial, mat.metal, mat.metal]); // topper, mørke sider, mørke topper (split)
  panelMesh.castShadow = true;
  panelMesh.receiveShadow = true;
  group.add(panelMesh);
  const core = new THREE.Mesh(new THREE.SphereGeometry(coreRadius, 48, 24), coreMaterial);
  core.receiveShadow = true;
  group.add(core);
  return group;
}
// En arm langs +x som smalner av mot enden, med myk overgang inn i navet og
// en krage rundt stolpen ytterst. Navet stikker litt opp over og ned under
// armen, så flatene ikke ligger i samme høyde. hub: false når navet er et rør
// som tegnes for seg. collar: false gir en arm uten krage (månearmene ved
// Jupiter), og thickness og chamfer kan settes for tynnere armer. ring: en
// tynn ring i accent rundt stolpen, oppå kragen.
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
    const accentRing = new THREE.Mesh(
      new THREE.TorusGeometry(part.postRadius + accent.ringWidth / 2, accent.ringWidth / 2, 12, 48),
      mat.accent
    );
    accentRing.rotation.x = Math.PI / 2;
    accentRing.position.set(length, y + arm.thickness + armStyle.collarHeight + accent.ringWidth / 2, 0);
    accentRing.castShadow = true;
    parent.add(accentRing);
  }
}
// Sola: en kule som planetene, i fargen og stilen fra bodyLooks.sun. 'lacquer'
// er blank lakk med mørke fuger. 'glass' er glass med en glødende kjerne og et
// lys i midten, så den lyser innenfra og fugene gløder.
function addSun() {
  const sun = lookOf('sun');
  if (sun.style !== 'lacquer' && sun.style !== 'glass') {
    throw new Error(`Ukjent solstil '${sun.style}' i bodyLooks.sun. Velg 'lacquer' eller 'glass'.`);
  }
  if (sun.style === 'lacquer') {
    addPlanetSphere(root, bodies.sunRadius, 'sun', lacquer(sun.color, sun.lacquer)).position.y = bodies.height;
    return;
  }
  const glass = new THREE.MeshPhysicalMaterial({
    color: sun.color,
    roughness: sun.glass.roughness,
    metalness: 0,
    transmission: sun.glass.transmission,   // slipper lyset fra kjernen gjennom
    thickness: sun.glass.thickness,
    ior: sun.glass.ior,
    attenuationColor: sun.color,
    attenuationDistance: sun.glass.attenuationDistance,
    emissive: sun.color,
    emissiveIntensity: sun.glowParts.surface * sun.glow,
  });
  const glowCore = new THREE.MeshStandardMaterial({
    color: sun.color,
    emissive: sun.color,
    emissiveIntensity: sun.glowParts.core * sun.glow,
  });
  const sunSphere = addPlanetSphere(root, bodies.sunRadius, 'sun', glass, glowCore);
  sunSphere.position.y = bodies.height;
  // Glasset kaster ingen skygge, så lyset fra kjernen slipper ut (som glasset i ringene).
  sunSphere.traverse((o) => {
    if (o.isMesh && [o.material].flat()[0].transmission > 0) o.castShadow = false;
  });
  const light = new THREE.PointLight(sun.color, sun.glowParts.light * sun.glow, 0, 1); // svakt lys innenfra i solas farge
  light.position.y = bodies.height;
  root.add(light);
}

// Høyder (regnet ut i mechanism.js, nedenfra og opp).
const armY = heights.arm.earth;                // jordarmen
const armTop = armY + arm.thickness;
const level1 = heights.level1;                 // fast hjul og pinion
const parallelLevel = heights.parallel;        // parallellkjedet
const moonChainLevel = heights.moonChain;      // månekjedet
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
// ekte kjede, så platene ikke kolliderer. key er navnet på kjedets offset i
// anglesAt; animasjonen flytter leddene dit. smooth: kjedet får et glatt bånd
// mot flimring når det går fort (blur.js). driven: kroppene kjedet driver, når
// de ikke er de samme som for gruppen det ligger i (drives.js).
const chains = [];
const plateThickness = 0.12;
const plateGap = 0.05;
const placer = new THREE.Object3D();
function addChain(parent, chain, y, key, smooth = false, driven = null) {
  const rollerHeight = moonTrain.thickness + plateGap * 2;
  const rollers = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(chain.rollerRadius, chain.rollerRadius, rollerHeight, 16),
    mat.chain,
    chain.links
  );
  const plateShape = new THREE.Shape();
  const plateEnd = chain.rollerRadius * 1.25;
  plateShape.absarc(chain.pitch / 2, 0, plateEnd, -Math.PI / 2, Math.PI / 2, false);
  plateShape.absarc(-chain.pitch / 2, 0, plateEnd, Math.PI / 2, (Math.PI * 3) / 2, false);
  const plateGeometry = new THREE.ExtrudeGeometry(plateShape, { depth: plateThickness, bevelEnabled: false, curveSegments: 6 });
  plateGeometry.rotateX(-Math.PI / 2);
  const plates = new THREE.InstancedMesh(plateGeometry, mat.chain, chain.links * 2);
  for (const part of [rollers, plates]) {
    part.castShadow = true;
    part.receiveShadow = true;
    part.frustumCulled = false; // leddene flytter seg, så la three.js alltid tegne dem
    if (driven) drives(part, driven);
    parent.add(part);
  }

  const update = (offset) => {
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
  chains.push({ update, key, parent, chain, y, smooth, rollers });
}

// --- Det som står fast: sentralakselen med sola. ---
drives(addShaft(root, center.axleRadius, 0, bodies.height), ALL);
addSun();

// De faste rørene. Jordas faste rør har det faste hjulet og det faste
// kjedehjulet øverst. Hvert rør holdes av en brakett nede i tårnet, og alle
// brakettene går bakover (bort fra mellomakselen) til den samme stolpen ned
// til gulvet. Det faste hjulet driver månen (og pinionen jordas døgn), og
// parallellkjedet holder jordaksen og føringsringen.
const fixedBodies = (t) => (t.name === 'fixed' ? system('earth') : system(t.owner));
drives(addShaft(root, tube.fixed.outer, heights.bottom.fixed, heights.fixedTop), system('earth'));
drives(addGear(root, trainGear({ ...moonTrain.fixed, holeRadius: tube.fixed.outer }), level1), system('earth')); // dreier aldri
drives(addSprocket(root, { ...moonTrain.parallelSprocket, holeRadius: tube.fixed.outer }, parallelChain.radius1, parallelLevel), system('earth'));
const bracketGroup = addGroupAt(root, layout.center);
bracketGroup.rotation.y = Math.PI / 2;
let bracketTop = 0;
const bracketBodies = [];
for (const t of tubes.filter((t) => t.fixed)) {
  if (t.name !== 'fixed') drives(addShaft(root, t.outer, heights.bottom[t.name], heights.stack[t.owner].fixedTop), fixedBodies(t));
  const y = heights.bottom[t.name];
  // Flat stang fra røret til stolpen, med runde ender.
  drives(addFlatBar(bracketGroup, 0, drive.distance, y, y + arm.thickness, arm.width * 0.75, mat.white, 32), fixedBodies(t));
  bracketTop = Math.max(bracketTop, y + arm.thickness);
  bracketBodies.push(...fixedBodies(t));
}
drives(addShaft(bracketGroup, arm.width * 0.3, 0, bracketTop), bracketBodies).position.x = drive.distance;

// --- Mellomakselen, der inngangen kommer inn. Den har et hjul for hver planet
// den driver direkte, for månerørene og par-mars, og nederst et kjedehjul for
// det første kjedet. Hvert planethjul er satt på akselen i sin egen vinkel
// (phases), så planeten står riktig på startdatoen. ---
const driveGroup = turnsWith(drives(addGroupAt(root, layout.drive), ALL), 'driveAngle');
addShaft(driveGroup, drive.shaftRadius, 0, heights.driveTop);
drives(addGear(driveGroup, pairGear(smallGear.teeth, bigGear.teeth, drive.shaftRadius, smallGear), heights.bottom.earth), system('earth'))
  .rotation.y = phases.earth;
for (const [name, p] of Object.entries(planets)) {
  if (p.driveTeeth) {
    drives(addGear(driveGroup, pairGear(p.driveTeeth, p.tubeTeeth, drive.shaftRadius), heights.bottom[name]), system(name)).rotation.y = phases[name];
  }
}
for (const [name, teeth, tubeTeeth, driven] of [
  ['drive-jupiter', jupiterMoons.driveTeeth, jupiterMoons.tubeTeeth, moonsOf.jupiter],
  ['drive-saturn', saturnMoons.driveTeeth, saturnMoons.tubeTeeth, moonsOf.saturn],
  ['drive-mars', marsMoons.driveTeeth, marsMoons.tubeTeeth, moonsOf.mars],
  ['par-mars', marsMoons.parallel.driveTeeth, marsMoons.parallel.tubeTeeth, system('mars')],
  ['drive-uranus', iceMoons.uranus.driveTeeth, iceMoons.uranus.tubeTeeth, moonsOf.uranus],
  ['drive-neptune', iceMoons.neptune.driveTeeth, iceMoons.neptune.tubeTeeth, moonsOf.neptune],
]) {
  drives(addGear(driveGroup, pairGear(teeth, tubeTeeth, drive.shaftRadius), heights.bottom[name]), driven);
}
const sprocketStyle = { spokes: 0, spokeWidth: 1, hubWidth: 1, rimWidth: 1 };
const bigSprocketStyle = { spokes: 5, spokeWidth: 1.5, hubWidth: 1.2, rimWidth: 1.5 };
drives(addSprocket(driveGroup, { teeth: outerDrive.driveSprocket, holeRadius: drive.shaftRadius, ...sprocketStyle },
  driveChain.radius1, heights.driveChain, driveChain), outerBodies);

// --- Det løse hjulet på sentralakselen: det store kjedehjulet nederst tar
// imot det første kjedet, og det lille over driver det andre. ---
const idlerGroup = turnsWith(drives(addGroupAt(root, layout.center), outerBodies), 'idlerAngle');
addSprocket(idlerGroup, {
  teeth: outerDrive.idlerLarge, holeRadius: center.axleRadius, spokes: 5, spokeWidth: 1.5, hubWidth: 1.2, rimWidth: 1.5,
}, driveChain.radius2, heights.driveChain, driveChain);
addSprocket(idlerGroup, { teeth: outerDrive.idlerSmall, holeRadius: center.axleRadius, ...sprocketStyle },
  layChain.radius1, heights.layChain, layChain);
addShaft(idlerGroup, idlerHub, heights.driveChain + moonTrain.thickness, heights.layChain);

// --- Forlegsakselen: drives av det andre kjedet, og driver Jupiter og Saturn. ---
const layGroup = turnsWith(drives(addGroupAt(root, layout.lay), outerBodies), 'layAngle');
addShaft(layGroup, drive.shaftRadius, 0, heights.driveTop);
addSprocket(layGroup, {
  teeth: outerDrive.laySprocket, holeRadius: drive.shaftRadius, spokes: 4, spokeWidth: 1.5, hubWidth: 1.2, rimWidth: 1.5,
}, layChain.radius2, heights.layChain, layChain);
for (const [name, p] of Object.entries(planets)) {
  if (p.layTeeth) {
    const driven = name === 'saturn' ? [...system(name), ...counterBodies] : system(name);
    drives(addGear(layGroup, pairGear(p.layTeeth, p.tubeTeeth, drive.shaftRadius), heights.bottom[name]), driven).rotation.y = phases[name];
  }
}
// Hjulet som driver par-saturn (parallellføringen av Saturn-stolpen).
drives(addGear(layGroup, pairGear(saturnMoons.parallel.layTeeth, saturnMoons.parallel.tubeTeeth, drive.shaftRadius), heights.bottom['par-saturn']), system('saturn'));

// --- Motakselen: drives av hjul nr. 2 på Saturn-røret, og driver Uranus,
// Neptun og par-uranus (parallellføringen av Uranus-stolpen). ---
const counterGroup = turnsWith(drives(addGroupAt(root, layout.counter), counterBodies), 'counterAngle');
if (usesCounter) {
  addShaft(counterGroup, drive.shaftRadius, 0, heights.driveTop);
  addGear(counterGroup, pairGear(counterDrive.shaftTeeth, counterDrive.saturnTeeth, drive.shaftRadius), heights.counterGear);
  for (const [name, p] of Object.entries(planets)) {
    if (p.counterTeeth) {
      drives(addGear(counterGroup, pairGear(p.counterTeeth, p.tubeTeeth, drive.shaftRadius), heights.bottom[name]), system(name)).rotation.y = phases[name];
    }
  }
  drives(addGear(counterGroup, pairGear(uranusPost.parallel.counterTeeth, uranusPost.parallel.tubeTeeth, drive.shaftRadius), heights.bottom['par-uranus']), system('uranus'));
}
// Kjedene, regnet ut langs +x fra sitt første kjedehjul og dreid på plass.
const chainGroupAt = (frame) => {
  const group = addGroupAt(root, frame.origin);
  group.rotation.y = frame.angle;
  return group;
};
const driveChainGroup = drives(chainGroupAt(driveFrame), outerBodies);
const layChainGroup = drives(chainGroupAt(layFrame), outerBodies);

// --- Planetene utenom jorda: rør med hjul nederst, arm øverst, stolpe og kule. ---
const planetGroups = {};
for (const [name, p] of Object.entries(planets)) {
  const group = turnsWith(drives(new THREE.Group(), system(name)), (a) => a.planetAngles[name]);
  root.add(group);
  const y = heights.arm[name];
  const length = armLengths[name];
  const tubeBodies = name === 'saturn' ? [...system(name), ...counterBodies] : system(name);
  drives(addShaft(group, tube[name].outer, heights.bottom[name], y), tubeBodies);
  drives(addGear(group, pairGear(p.tubeTeeth, p.driveTeeth ?? p.layTeeth ?? p.counterTeeth, tube[name].outer), heights.bottom[name]), tubeBodies);
  addArm(group, { length, hubRadius: tube[name].outer + 1, part: armParts.planet, y, ring: true });
  planetGroups[name] = group;
  // Saturn, Mars og Uranus står på sine egne stolper, se under.
  if (['ringMoons', 'epicyclic', 'parallelMoons'].includes(mechanismOf(name))) continue;
  addShaft(group, armParts.planet.postRadius, y + arm.thickness, bodies.height).position.x = length;
  addPlanetSphere(group, p.radius, name).position.set(length, bodies.height, 0);
}
// Hjul nr. 2 på Saturn-røret, som driver motakselen.
if (usesCounter) {
  drives(addGear(planetGroups.saturn, pairGear(counterDrive.saturnTeeth, counterDrive.shaftTeeth, tube.saturn.outer), heights.counterGear), counterBodies);
}

// Et rør i tårnet som drives fra en aksel der: hjulet nederst, røret opp, og
// kjedehjulet til kjedet langs armen rett over armen. Brukes av månerørene og
// par-rørene (parallellføringen av stolpene ved Saturn, Mars og Uranus).
// Månerørene driver månene, par-rørene holder aksen til planeten (og månene).
const towerBodies = (name) => {
  const [kind, planet] = name.split('-');
  return kind === 'drive' ? moonsOf[planet] : system(planet);
};
function addTowerTube(name, teeth, otherTeeth, top, sprocketTeeth, chain, chainY, style, key) {
  const group = turnsWith(drives(new THREE.Group(), towerBodies(name)), key);
  root.add(group);
  const t = tube[name];
  addShaft(group, t.outer, heights.bottom[name], top);
  addGear(group, pairGear(teeth, otherTeeth, t.outer), heights.bottom[name]);
  addSprocket(group, { teeth: sprocketTeeth, holeRadius: t.outer, ...style }, chain.radius1, chainY, chain);
  return group;
}

// Ved månene: et hjul i et par mellom to aksler ved planeten. Modulen følger
// av paret (train.layDistance), eller settes, og store hjul får eiker.
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

// Raske deler som får lysspor, vifter og glatte former (blur.js): gruppen som
// dreier, tannhjulene i den, delene som får vifte, og eventuelt månens bane.
const fastParts = [];

// --- Jupiters måner ---
// Månerøret går inni Jupiter-røret, fra hjulet i tårnet opp til kjedehjulet
// rett over Jupiter-armen. Kjedet tar bevegelsen ut til en krage på stolpen,
// som driver forlegsakselen på armen, og den driver ett rør per måne.
const JM = jupiterMoons;
const JS = heights.stack.jupiter;
addTowerTube('drive-jupiter', JM.tubeTeeth, JM.driveTeeth, JS.tubeTop, JM.tubeSprocket, jupiterChain, JS.chain, sprocketStyle, 'jupiterTubeAngle');
const jupiterGear = (teeth, otherTeeth, holeRadius) => smallTrainGear(JM, teeth, otherTeeth, holeRadius);
const jupiterGroup = planetGroups.jupiter;
const jupiterArmTop = heights.arm.jupiter + arm.thickness;
addChain(jupiterGroup, jupiterChain, JS.chain, 'jupiterChainOffset', true, moonsOf.jupiter);

// Kragen går løst på stolpen: kjedehjulet nederst, tannhjulet over.
const collarGroup = turnsWith(drives(addGroupAt(jupiterGroup, jupiterLayout.post), moonsOf.jupiter), 'collarAngle');
addShaft(collarGroup, jupiterTrain.collar.outer, JS.chain, JS.collarGear + JM.thickness);
addSprocket(collarGroup, { teeth: JM.collarSprocket, holeRadius: jupiterTrain.collar.outer, ...sprocketStyle },
  jupiterChain.radius2, JS.chain, jupiterChain);
addGear(collarGroup, jupiterGear(JM.collarTeeth, JM.collarPinion, jupiterTrain.collar.outer), JS.collarGear);

// Forlegsakselen på armen. Hjulene som driver månene er satt på i sin egen
// vinkel, så hver måne står riktig på startdatoen.
const jupiterLayGroup = turnsWith(drives(addGroupAt(jupiterGroup, jupiterLayout.lay), moonsOf.jupiter), 'jupiterLayAngle');
addShaft(jupiterLayGroup, JM.shaftRadius, jupiterArmTop, JS.layTop);
addGear(jupiterLayGroup, jupiterGear(JM.collarPinion, JM.collarTeeth, JM.shaftRadius), JS.collarGear);

// Ett rør per måne rundt stolpen, med hjulet nederst og armen øverst.
const moonOrbits = Object.fromEntries(moonSystems.jupiter.orbits.map((o) => [o.name, o]));
for (const [name, m] of Object.entries(jupiterTrain.moons)) {
  drives(addGear(jupiterLayGroup, jupiterGear(m.layTeeth, m.moonTeeth, JM.shaftRadius), JS.moonGear[name]), name).rotation.y = phases[name];
  const group = turnsWith(drives(addGroupAt(jupiterGroup, jupiterLayout.post), name), (a) => a.jupiterMoonAngles[name]);
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

// I tårnet: månerøret og par-saturn, med kjedehjulene rett over Saturn-armen.
addTowerTube('drive-saturn', SM.tubeTeeth, SM.driveTeeth, SS.driveTubeTop, SM.tubeSprocket, saturnChain, SS.chain, bigSprocketStyle, 'saturnTubeAngle');
addTowerTube('par-saturn', SMP.tubeTeeth, SMP.layTeeth, SS.parTubeTop, SMP.centerSprocket, saturnParallelChain, SS.parallel, bigSprocketStyle, 'saturnParTubeAngle');

// Langs Saturn-armen: de to kjedene.
const saturnGroup = planetGroups.saturn;
const saturnArmTop = heights.arm.saturn + arm.thickness;
addChain(saturnGroup, saturnChain, SS.chain, 'saturnChainOffset', true, moonsOf.saturn);
addChain(saturnGroup, saturnParallelChain, SS.parallel, 'saturnParChainOffset');

// Driveakselen midt i stolpen: kjedehjulet nederst og det koniske hjulet øverst.
const bevelGear = (teeth, holeRadius) => smallTrainGear(SM, teeth, 0, holeRadius, ST.bevel.module);
const saturnShaftGroup = turnsWith(drives(addGroupAt(saturnGroup, saturnLayout.post), moonsOf.saturn), 'saturnShaftAngle');
addShaft(saturnShaftGroup, SM.driveShaftRadius, saturnArmTop, SS.shaftTop);
addSprocket(saturnShaftGroup, { teeth: SM.shaftSprocket, holeRadius: SM.driveShaftRadius, ...sprocketStyle },
  saturnChain.radius2, SS.chain, saturnChain);
addMesh(saturnShaftGroup, createBevelGeometry(bevelGear(ST.bevel.driveTeeth, SM.driveShaftRadius), ST.bevel.drop1))
  .position.y = SS.bevelGear;

// Stolpen (står stille i rommet): kjedehjulet nederst og røret rundt
// driveakselen, og på den retningen aksen heller mot (saturnMount).
const saturnFrameGroup = turnsWith(addGroupAt(saturnGroup, saturnLayout.post), 'saturnFrameAngle');
const frameOuter = SM.driveShaftRadius + SM.frameWall;
addSprocket(saturnFrameGroup, { teeth: SMP.postSprocket, holeRadius: frameOuter, ...sprocketStyle },
  saturnParallelChain.radius2, SS.parallel, saturnParallelChain);
addShaft(saturnFrameGroup, frameOuter, SS.parallel + moonTrain.thickness, SS.frameTop);
const saturnMount = new THREE.Group();
saturnMount.rotation.y = saturnAxis.direction;
saturnFrameGroup.add(saturnMount);
// Braketten fra toppen av stolperøret ut til siden og opp til platen under hjulene.
addBracket(saturnMount, saturnBracket.points, saturnBracket.radius, { detail: bigBall });

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
const saturnLayGroup = turnsWith(drives(new THREE.Group(), moonsOf.saturn), 'saturnLayAngle');
saturnLayGroup.position.x = ST.layDistance;
saturnTilted.add(saturnLayGroup);
addShaft(saturnLayGroup, SM.shaftRadius, ST.laySpan[0], ST.laySpan[1]);
addMesh(saturnLayGroup, createBevelGeometry(bevelGear(ST.bevel.layTeeth, SM.shaftRadius), ST.bevel.drop2))
  .position.y = ST.bevel.layGear;
// Titan-røret driver også Iapetus (gjennom hylsa på forlegsakselen).
const bandBodies = { enceladus: ['enceladus'], titan: ['titan', 'iapetus'], titan2: ['iapetus'], iapetus: ['iapetus'] };
for (const name of ['enceladus', 'titan']) {
  const p = ST.pairs[name];
  drives(addGear(saturnLayGroup, smallTrainGear(SM, p.lay, p.tube, SM.shaftRadius), ST.level[name] - SM.thickness / 2), bandBodies[name])
    .rotation.y = phases[name];
}
const saturnSleeveGroup = turnsWith(drives(new THREE.Group(), 'iapetus'), 'saturnSleeveAngle');
saturnSleeveGroup.position.x = ST.layDistance;
saturnTilted.add(saturnSleeveGroup);
addShaft(saturnSleeveGroup, ST.sleeve.outer, ST.sleeveSpan[0], ST.sleeveSpan[1]);
addGear(saturnSleeveGroup, smallTrainGear(SM, ST.pairs.titan2.lay, ST.pairs.titan2.tube, ST.sleeve.outer), ST.level.titan2 - SM.thickness / 2);
addGear(saturnSleeveGroup, smallTrainGear(SM, ST.pairs.iapetus.lay, ST.pairs.iapetus.tube, ST.sleeve.outer), ST.level.iapetus - SM.thickness / 2)
  .rotation.y = phases.iapetus;

// Båndene C, B og A: rør med hjul nederst, nav med stag opp til glassbåndet,
// og månearmen over ringen.
const glassBands = createGlassBands(ST.radius, saturnRing);
const gearsOnBand = { A: ['enceladus'], B: ['titan', 'titan2'], C: ['iapetus'] };
const moonOnBand = { A: 'enceladus', B: 'titan', C: 'iapetus' };
const bandTop = saturnRing.thickness / 2;
['C', 'B', 'A'].forEach((b, i) => {
  const group = turnsWith(drives(new THREE.Group(), moonOnBand[b]), (a) => a.saturnBands[b]);
  saturnTilted.add(group);
  const t = ST.tubeOf[b], hub = ST.hubs[b];
  drives(addShaft(group, t.outer, ...ST.tubeSpan[b]), gearsOnBand[b].flatMap((n) => bandBodies[n]));
  const bandGears = [];
  for (const name of gearsOnBand[b]) {
    const p = ST.pairs[name];
    bandGears.push(drives(addGear(group, smallTrainGear(SM, p.tube, p.lay, t.outer), ST.level[name] - SM.thickness / 2), bandBodies[name]));
  }
  addShaft(group, hub.radius, hub.s - hub.length / 2, hub.s + hub.length / 2);
  const count = saturnRing.struts.count;
  const fan = [];
  for (let k = 0; k < count; k++) {
    const ang = ((k + 0.5) / count) * Math.PI * 2;
    const at = (r, y) => ({ x: r * Math.cos(ang), y, z: -r * Math.sin(ang) });
    fan.push(addRod(group, at(hub.radius - 0.05, hub.s), at(hub.attach, -bandTop), ST.strutRadius));
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
    const leg = addMesh(group, new THREE.CylinderGeometry(SM.legRadius, SM.legRadius, m.s + half - bandTop, 16));
    leg.position.set(m.from, (bandTop + m.s + half) / 2, 0);
  }
  addFlatBar(group, m.from, m.orbit, m.s - half, m.s + half, SM.armWidth);
  fan.push(...group.children.slice(armStart));
  addPlanetSphere(group, m.radius, name).position.set(m.orbit, m.s, 0);
  fastParts.push({ group, gears: bandGears, fan, trail: { radius: m.orbit, y: m.s, tube: m.radius * 0.35 } });
});

// --- Mars ---
// Fobos og Deimos med planetgir. Drivet går fra månerøret i tårnet, med et
// kjede langs armen, til driveakselen midt i Mars-stolpen. På toppen av den
// sitter et dobbelt kryssledd (kardang), som knekker drivet over i en skrå
// drivaksel parallell med Mars' akse. Den driver bæreren i planetgiret gjennom
// et stort hjul, et mellomhjul og et lite hjul. Ringhjulet står fast; bæreren
// med planethjulene går med Deimos, solhjulet med Fobos. Mars står stille på en
// aksel ned til en skål under bæreren, og en knekt brakett fra toppen av
// stolperøret holder skåla og ringhjulet. Stolpen holdes i samme retning i
// rommet av par-mars og parallellkjedet.
const MMc = marsMoons, MS = heights.stack.mars, MTr = marsTrain, PGm = MTr.planetary;
const marsGear = (teeth, holeRadius, module) => smallTrainGear(MMc, teeth, 0, holeRadius, module);

// I tårnet: månerøret og par-mars, med kjedehjulene rett over Mars-armen.
addTowerTube('drive-mars', MMc.tubeTeeth, MMc.driveTeeth, MS.driveTubeTop, MMc.tubeSprocket, marsChain, MS.chain, bigSprocketStyle, 'marsTubeAngle');
addTowerTube('par-mars', MMc.parallel.tubeTeeth, MMc.parallel.driveTeeth, MS.parTubeTop, MMc.parallel.centerSprocket, marsParallelChain, MS.parallel, bigSprocketStyle, 'marsParTubeAngle');

// Langs Mars-armen: de to kjedene.
const marsGroup = planetGroups.mars;
const marsArmTop = heights.arm.mars + arm.thickness;
addChain(marsGroup, marsChain, MS.chain, 'marsChainOffset', true, moonsOf.mars);
addChain(marsGroup, marsParallelChain, MS.parallel, 'marsParChainOffset');

// Driveakselen midt i stolpen: kjedehjulet nederst, opp til kryssleddet K på toppen.
const plateT = MTr.plateThickness;
const marsShaftGroup = turnsWith(drives(addGroupAt(marsGroup, marsLayout.post), moonsOf.mars), 'marsShaftAngle');
addShaft(marsShaftGroup, MMc.driveShaftRadius, marsArmTop, MS.shaftTop);
addSprocket(marsShaftGroup, { teeth: MMc.shaftSprocket, holeRadius: MMc.driveShaftRadius, ...sprocketStyle },
  marsChain.radius2, MS.chain, marsChain);

// Stolpen (står stille i rommet): kjedehjulet nederst og røret rundt
// driveakselen, og på den retningen aksen heller mot (marsMount): den knekte
// braketten, kryssleddet og alt rundt Mars' skrå akse.
const marsFrameGroup = turnsWith(addGroupAt(marsGroup, marsLayout.post), 'marsFrameAngle');
const marsFrameOuter = MMc.driveShaftRadius + MMc.frameWall;
addSprocket(marsFrameGroup, { teeth: MMc.parallel.postSprocket, holeRadius: marsFrameOuter, ...sprocketStyle },
  marsParallelChain.radius2, MS.parallel, marsParallelChain);
addShaft(marsFrameGroup, marsFrameOuter, MS.parallel + moonTrain.thickness, MS.frameTop);
const marsMount = new THREE.Group();
marsMount.rotation.y = marsAxis.direction;
marsFrameGroup.add(marsMount);
// Den knekte braketten: runde knekker, og myke overganger der den møter
// stolperøret og ringhjulet.
addBracket(marsMount, marsBracket.points, marsBracket.radius, { fillet: marsBracket.fillet, flareStart: true, flareEnd: true, detail: bigBall });

// Kryssleddet K på toppen av stolpen: driveakselen (loddrett) og den skrå
// drivakselen møtes, og korset dreier med dem.
const upAxis = new THREE.Vector3(0, 1, 0);
const marsJoint = drives(new THREE.Group(), moonsOf.mars);
marsJoint.position.set(0, MS.joint, 0);
const bisector = new THREE.Vector3(0, 1, 0).add(new THREE.Vector3(Math.sin(marsAxis.tilt), Math.cos(marsAxis.tilt), 0)).normalize();
marsJoint.quaternion.setFromUnitVectors(upAxis, bisector);
marsMount.add(marsJoint);
addMesh(marsJoint, new THREE.SphereGeometry(MMc.jointRadius * 0.55, 24, 12), mat.metal);
const marsCross = turnsWith(new THREE.Group(), 'marsDriveAngle');
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
const marsDriveGroup = turnsWith(drives(new THREE.Group(), moonsOf.mars), 'marsDriveAngle');
marsDriveGroup.position.x = MDr.distance;
marsTilted.add(marsDriveGroup);
addShaft(marsDriveGroup, MMc.tiltShaftRadius, ...MTr.driveShaftSpan);
addGear(marsDriveGroup, smallTrainGear(MMc, MMc.drive.bigTeeth, 0, MMc.tiltShaftRadius, MDr.module), MTr.level.drive - MMc.thickness / 2);
// Mellomhjulet.
const marsIdlerGroup = turnsWith(drives(new THREE.Group(), moonsOf.mars), 'marsIdlerAngle');
marsIdlerGroup.position.set(MDr.idler.x, 0, -MDr.idler.z);
marsTilted.add(marsIdlerGroup);
addGear(marsIdlerGroup, smallTrainGear(MMc, MMc.drive.idlerTeeth, 0, MMc.pinRadius, MDr.module), MTr.level.drive - MMc.thickness / 2);

// Bæreren (Deimos): to plater, pinnene med planethjulene, det lille hjulet i
// hjulparet, røret opp og armen til Deimos.
const marsCarrierGroup = turnsWith(drives(new THREE.Group(), moonsOf.mars), 'marsCarrier');
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
const startMars = anglesAt(0);
for (let k = 0; k < PGm.count; k++) {
  const az = (2 * Math.PI * k) / PGm.count;
  const pin = new THREE.Group();
  pin.position.set(MTr.carrierRadius * Math.cos(az), 0, -MTr.carrierRadius * Math.sin(az));
  marsCarrierGroup.add(pin);
  addShaft(pin, pinRadius, MTr.level.carrierBottom, MTr.level.carrierTop);
  const spin = turnsWith(new THREE.Group(), (a) => a.marsPlanetSpins[k]);
  pin.add(spin);
  const planet2 = addGear(spin, marsGear(PGm.planet2, pinRadius, MTr.module), MTr.level.ringLayer - MMc.thickness / 2);
  // planet1 sitter fast på planet2, satt på så det griper i solhjulet.
  const sunRel = startMars.marsSun - startMars.marsCarrier;
  const p1 = meshAngle(sunRel, PGm.sun, PGm.planet1, az) - startMars.marsPlanetSpins[k];
  const planet1 = addGear(spin, marsGear(PGm.planet1, pinRadius, MTr.module), MTr.level.sunLayer - MMc.thickness / 2);
  planet1.rotation.y = p1;
  fastParts.push({ group: spin, gears: [planet2, planet1] });
}

// Månearmene: et nav på røret, armen ut og en stolpe opp til ekvatorplanet.
const addMarsMoon = (parent, name, tubeOuter, gears = []) => {
  const m = MTr.arms[name], half = MMc.armThickness / 2;
  const holder = drives(new THREE.Group(), name);
  holder.rotation.y = phases[name];
  parent.add(holder);
  addShaft(holder, tubeOuter + 0.15, m.s - MTr.hubLength / 2, m.s + MTr.hubLength / 2);
  addFlatBar(holder, tubeOuter + 0.15, m.orbit, m.s - half, m.s + half, MMc.armWidth);
  const post = addMesh(holder, new THREE.CylinderGeometry(MMc.postRadius, MMc.postRadius, -m.s, 12));
  post.position.set(m.orbit, m.s / 2, 0);
  const fan = holder.children.slice(1);
  addPlanetSphere(holder, m.radius, name).position.set(m.orbit, 0, 0);
  // Sporet ligger i holderen (der månen står på +x), men måles på gruppen som dreier.
  fastParts.push({ group: parent, gears, fan, trail: { parent: holder, radius: m.orbit, y: 0, tube: Math.max(m.radius * 0.35, 0.03) } });
};
addMarsMoon(marsCarrierGroup, 'deimos', MTr.carrierTube.outer);

// Solhjulet (Fobos): hjulet, røret opp og armen til Fobos.
const marsSunGroup = turnsWith(drives(new THREE.Group(), 'phobos'), 'marsSun');
marsTilted.add(marsSunGroup);
const marsSunGear = addGear(marsSunGroup, marsGear(PGm.sun, MTr.sunTube.outer, MTr.module), MTr.level.sunLayer - MMc.thickness / 2);
addShaft(marsSunGroup, MTr.sunTube.outer, ...MTr.sunTubeSpan);
addMarsMoon(marsSunGroup, 'phobos', MTr.sunTube.outer, [marsSunGear]);

// --- Uranus ---
// Uranus ligger på siden, med tynne ringer av mørkt glass i ekvatorplanet.
// Stolpen holdes i samme retning i rommet av par-uranus og parallellkjedet.
// Den slutter under ringene, og en knekt brakett går ut langs polretningen,
// opp og inn som en aksel i polen. Et nav på akselen bærer stagene ut til den
// innerste ringen, og eiker i ringplanet binder ringene sammen. Titania og
// Oberon drives fra et månerør og et kjede langs armen, en driveaksel inni
// stolperøret, en vinkelgir og en forlegsaksel parallell med Uranus' akse.
// Se uranusRing, uranusPost og iceMoons i config.
const UPc = uranusPost, US = heights.stack.uranus, UT = uranusTrain;
const UM = iceMoons.uranus, UMT = uranusMoonTrain;
addTowerTube('par-uranus', UPc.parallel.tubeTeeth, UPc.parallel.counterTeeth, US.parTubeTop, UPc.parallel.centerSprocket, uranusParallelChain, US.parallel, bigSprocketStyle, 'uranusParTubeAngle');
const uranusGroup = planetGroups.uranus;
addChain(uranusGroup, uranusParallelChain, US.parallel, 'uranusParChainOffset');

// Månerøret drive-uranus i tårnet, med kjedehjulet rett under parallellkjedet.
addTowerTube('drive-uranus', UM.tubeTeeth, UM.driveTeeth, US.driveTubeTop, UM.tubeSprocket, uranusMoonChain, US.chain, bigSprocketStyle, 'uranusTubeAngle');
addChain(uranusGroup, uranusMoonChain, US.chain, 'uranusChainOffset', true, moonsOf.uranus);

// Hjulene ved Uranus: som ved Saturn, med en modul per par.
const uranusGearStyle = { layDistance: UMT.LD, thickness: UM.thickness, chamfer: 0.06, backlash: 0.05 };
const uranusGear = (teeth, otherTeeth, holeRadius, module) => smallTrainGear(uranusGearStyle, teeth, otherTeeth, holeRadius, module);

// Driveakselen midt i stolperøret: kjedehjulet nederst og det koniske hjulet
// øverst, over toppunktet P (akselen går opp gjennom det).
const uranusShaftGroup = turnsWith(drives(addGroupAt(uranusGroup, uranusLayout.post), moonsOf.uranus), 'uranusShaftAngle');
addShaft(uranusShaftGroup, UM.driveShaftRadius, UMT.armTop, UMT.shaftTop);
addSprocket(uranusShaftGroup, { teeth: UM.shaftSprocket, holeRadius: UM.driveShaftRadius, ...sprocketStyle },
  uranusMoonChain.radius2, US.chain, uranusMoonChain);
const uranusDriveBevel = createBevelGeometry(uranusGear(UMT.bevel.driveTeeth, 0, UM.driveShaftRadius, UMT.bevel.module), Math.abs(UMT.bevel.driveApex));
if (UMT.bevel.driveApex < 0) uranusDriveBevel.rotateX(Math.PI);  // toppunktet under hjulet
addMesh(uranusShaftGroup, uranusDriveBevel).position.y = UMT.bevel.driveY;

// Stolperøret (står stille i rommet): kjedehjulet til parallellføringen og
// røret rundt driveakselen opp til rett under vinkelgiren.
const uranusFrameGroup = turnsWith(addGroupAt(uranusGroup, uranusLayout.post), 'uranusFrameAngle');
addSprocket(uranusFrameGroup, { teeth: UPc.parallel.postSprocket, holeRadius: UMT.frameOuter, ...sprocketStyle },
  uranusParallelChain.radius2, US.parallel, uranusParallelChain);
addShaft(uranusFrameGroup, UMT.frameOuter, US.parallel + moonTrain.thickness, UMT.frameTop);
const uranusMount = new THREE.Group();
uranusMount.rotation.y = uranusAxis.direction;
uranusFrameGroup.add(uranusMount);
// Braketten: fra siden av stolperøret vannrett ut under hjulene på
// forlegsakselen, opp til polakselen, og langs den inn i polen. Runde knekker,
// og myke overganger ved stolperøret og ved polen.
const ubp = uranusBracket.points;
addBracket(uranusMount, [{ x: UMT.frameOuter, y: ubp[0].y, z: 0 }, ...ubp.slice(1)], uranusBracket.radius,
  { fillet: uranusBracket.fillet, flareStart: true, flareEnd: true, detail: bigBall });
// Bukken fra den vannrette delen opp til lageret ved vinkelgiren.
const footPost = UMT.bearings.foot.post;
drives(addRod(uranusMount, footPost[0], footPost[1], UM.bearing.postRadius), moonsOf.uranus);

// Alt rundt Uranus' akse, med sentrum i origo og aksen langs y (x er x', nedover).
const uranusTilted = new THREE.Group();
uranusTilted.position.y = bodies.height;
uranusTilted.rotation.z = -uranusAxis.tilt; // heller polen med akselen mot +x i uranusMount (under vannrett)
uranusMount.add(uranusTilted);
addPlanetSphere(uranusTilted, UT.radius, 'uranus');
drives(addShaft(uranusTilted, UT.hub.radius, UT.hub.s0, UT.hub.s1), 'uranus');   // navet, en hylse på polakselen
const ringAt = (r, y, ang) => ({ x: r * Math.cos(ang), y, z: -r * Math.sin(ang) });
for (const ang of UT.azimuths) {
  drives(addRod(uranusTilted, ringAt(UT.hub.radius - 0.05, UT.hub.s, ang), ringAt(UT.attach.rho, UT.attach.s, ang), UT.strutRadius), 'uranus');
  drives(addRod(uranusTilted, ringAt(UT.ring.inner, 0, ang), ringAt(UT.ring.outer, 0, ang), uranusRing.spokeWidth / 2), 'uranus');
}
const uranusGlass = createGlassMaterials(uranusRing);
for (const r of UT.ring.rings) {
  const glass = new THREE.Mesh(
    createAnnulus(r.inner, r.outer, uranusRing.thickness, uranusRing.chamfer),
    uranusGlass[Math.min(r.index, uranusGlass.length - 1)],
  );
  glass.receiveShadow = true; // glasset stenger ikke lyset helt, så det kaster ingen skygge
  uranusTilted.add(drives(glass, 'uranus'));
}
// Lagrene til forlegsakselen (står fast): i den loddrette delen av braketten og på bukken.
for (const b of [UMT.bearings.riser, UMT.bearings.foot]) drives(addShaft(uranusTilted, b.radius, b.s0, b.s1), moonsOf.uranus).position.x = UMT.LD;

// Forlegsakselen med det koniske hjulet og ett hjul per måne.
const uranusLayGroup = turnsWith(drives(new THREE.Group(), moonsOf.uranus), 'uranusLayAngle');
uranusLayGroup.position.x = UMT.LD;
uranusTilted.add(uranusLayGroup);
addShaft(uranusLayGroup, UM.shaftRadius, ...UMT.laySpan);
const uranusLayBevel = createBevelGeometry(uranusGear(UMT.bevel.layTeeth, 0, UM.shaftRadius, UMT.bevel.module), Math.abs(UMT.bevel.layApex));
if (UMT.bevel.layApex < 0) uranusLayBevel.rotateX(Math.PI);
addMesh(uranusLayGroup, uranusLayBevel).position.y = UMT.bevel.layS;
const uranusLayGears = [];
for (const n of uranusMoonNames) {
  const pr = UMT.pairs[n];
  uranusLayGears.push(drives(addGear(uranusLayGroup, uranusGear(pr.lay, pr.tube, UM.shaftRadius, pr.module), UMT.levels[`${n}Gear`] - UM.thickness / 2), n));
}

// Titania og Oberon: hvert rør på polakselen har hjulet ytterst, og en krage
// med et skrått stag ned til et kort bein og månen i ekvatorplanet.
uranusMoonNames.forEach((n, i) => {
  const mo = UMT.moons[n], t = mo.tube, pr = UMT.pairs[n], rr = UMT.rods.rodRadius;
  const group = turnsWith(drives(new THREE.Group(), n), (a) => a.uranusMoonAngles[n]);
  uranusTilted.add(group);
  drives(addShaft(group, t.outer, t.s0, t.s1), uranusMoonNames.slice(i));
  const gearMesh = addGear(group, uranusGear(pr.tube, pr.lay, t.outer, pr.module), UMT.levels[`${n}Gear`] - UM.thickness / 2);
  addShaft(group, mo.rod.from.x + rr, mo.armS - UM.armThickness / 2, mo.armS + UM.armThickness / 2);   // kragen
  addRod(group, { x: mo.rod.from.x, y: mo.rod.from.y, z: 0 }, { x: mo.rod.to.x, y: mo.rod.to.y, z: 0 }, rr);
  addSphere(group, rr).position.set(mo.rod.to.x, mo.rod.to.y, 0);
  addShaft(group, UM.legRadius, 0, mo.legTop).position.x = mo.orbit;                                  // beinet
  addPlanetSphere(group, mo.radius, n).position.set(mo.orbit, 0, 0);
  fastParts.push({ group, gears: [gearMesh], trail: { radius: mo.orbit, y: 0, tube: mo.radius * 0.35 } });
});
fastParts.push({ group: uranusLayGroup, gears: uranusLayGears });

// --- Neptun og Triton ---
// Månerøret drive-neptune i tårnet, kjedet langs armen og kragen på
// Neptun-stolpen. Kragen driver dobbelthjulet på tapp A, det øverste hjulet
// driver mellomhjulet på tapp B (ring i accent), og mellomhjulet driver
// Tritons rør: tre inngrep, så Triton går baklengs. Triton sitter på en stav
// som glir i en hylse ytterst på Triton-armen, og en fot på staven hviler på en
// skrå føringsring under Neptun. Se iceMoons i config.
const NM = iceMoons.neptune, NMT = neptuneMoonTrain, NS = heights.stack.neptune;
const neptuneGroup = planetGroups.neptune;
addTowerTube('drive-neptune', NM.tubeTeeth, NM.driveTeeth, NS.tubeTop, NM.tubeSprocket, neptuneChain, NS.chain, bigSprocketStyle, 'neptuneTubeAngle');
addChain(neptuneGroup, neptuneChain, NS.chain, 'neptuneChainOffset', true, moonsOf.neptune);

const neptuneMount = drives(addGroupAt(neptuneGroup, neptuneLayout.post), moonsOf.neptune);
const neptuneGear = (teeth) => smallTrainGear({ layDistance: 1, thickness: NMT.T, chamfer: 0.04, backlash: 0.02 }, teeth, 0, NM.pinRadius, NMT.m);
// Kragen: røret rundt stolpen med kjedehjulet og hjulet.
const neptuneCollarGroup = turnsWith(new THREE.Group(), 'neptuneCollarAngle');
neptuneMount.add(neptuneCollarGroup);
addShaft(neptuneCollarGroup, NMT.tubeOuter, NMT.chainY, NMT.lowY + NMT.T);
addSprocket(neptuneCollarGroup, { teeth: NM.collarSprocket, holeRadius: NMT.tubeOuter, ...sprocketStyle },
  neptuneChain.radius2, NMT.chainY, neptuneChain);
const neptuneCollarGear = addGear(neptuneCollarGroup, { ...neptuneGear(NM.collarTeeth), holeRadius: NMT.tubeOuter }, NMT.lowY);
// Tappene og bøylen (står fast på armen).
addShaft(neptuneMount, NM.pinRadius, NMT.armTop, NMT.pinTopA).position.set(NMT.A.x, 0, NMT.A.z);
addShaft(neptuneMount, NM.pinRadius, NMT.pinBottomB, NMT.pinTopA).position.set(NMT.B.x, 0, NMT.B.z);
{
  const dx = NMT.B.x - NMT.A.x, dz = NMT.B.z - NMT.A.z, L = Math.hypot(dx, dz), y0 = NMT.bridgeY, y1 = NMT.bridgeY + NM.bridge.thickness;
  const bar = addMesh(neptuneMount, new THREE.BoxGeometry(L, y1 - y0, NM.bridge.width));
  bar.position.set((NMT.A.x + NMT.B.x) / 2, (y0 + y1) / 2, (NMT.A.z + NMT.B.z) / 2);
  bar.rotation.y = -Math.atan2(dz, dx);
  for (const q of [NMT.A, NMT.B]) addShaft(neptuneMount, NM.bridge.width / 2, y0, y1).position.set(q.x, 0, q.z);
}
// Dobbelthjulet på tapp A og mellomhjulet på tapp B.
const neptuneLayGroup = turnsWith(new THREE.Group(), 'neptuneLayAngle');
neptuneLayGroup.position.set(NMT.A.x, 0, NMT.A.z);
neptuneMount.add(neptuneLayGroup);
addShaft(neptuneLayGroup, NM.pinRadius + 0.12, NMT.lowY, NMT.highY + NMT.T);
const neptuneLayGears = [addGear(neptuneLayGroup, neptuneGear(NM.layLow), NMT.lowY), addGear(neptuneLayGroup, neptuneGear(NM.layHigh), NMT.highY)];
const neptuneIdlerGroup = turnsWith(new THREE.Group(), 'neptuneIdlerAngle');
neptuneIdlerGroup.position.set(NMT.B.x, 0, NMT.B.z);
neptuneMount.add(neptuneIdlerGroup);
const neptuneIdlerGear = addGear(neptuneIdlerGroup, neptuneGear(NM.idlerTeeth), NMT.highY);
const idlerMark = new THREE.Mesh(new THREE.TorusGeometry((NMT.m * NM.idlerTeeth) / 2 * 0.62, 0.07, 10, 48), mat.accent);
idlerMark.rotation.x = Math.PI / 2;
idlerMark.position.y = NMT.highY + NMT.T + 0.05;
idlerMark.castShadow = true;
neptuneIdlerGroup.add(idlerMark);
// Føringsringen: nav på stolpen under ringen, eiker opp til undersiden av
// ringen, og en smal ring med loddrette sider, løftet K × cos θ.
const G = NM.guide;
addShaft(neptuneMount, NMT.postR + G.hub, NMT.guideHubY - 0.3, NMT.guideHubY + 0.3);
for (const t of NMT.spokeAngles) {
  const start = { x: (NMT.postR + G.hub - 0.05) * Math.cos(t), y: NMT.guideHubY, z: (NMT.postR + G.hub - 0.05) * Math.sin(t) };
  addRod(neptuneMount, start, NMT.guidePoint(t, -G.width / 2, -G.height / 2), G.spokeRadius);
}
addMesh(neptuneMount, bandGeometry(NMT.guidePoint, G.width, G.height));
// Triton: røret med hjulet og armen (dreier baklengs), hylsa ytterst på armen,
// og staven med foten, tappen under foten og Triton, som løftes av ringen.
const tritonGroup = turnsWith(new THREE.Group(), 'tritonAngle');
neptuneMount.add(tritonGroup);
addShaft(tritonGroup, NMT.tubeOuter, NMT.highY, NMT.tritonTubeTop);
const tritonGear = addGear(tritonGroup, { ...neptuneGear(NM.tritonTeeth), holeRadius: NMT.tubeOuter }, NMT.highY);
addMesh(tritonGroup, createArmGeometry({
  length: NMT.orbit, hubRadius: NMT.tubeOuter + 0.1, rootHalf: 0.45, endRadius: NM.sleeveRadius,
  fillet: 0.3, thickness: NM.armThickness, chamfer: 0.08,
})).position.y = NMT.tritonArmY;
addShaft(tritonGroup, NM.sleeveRadius, NMT.tritonArmTop, NMT.sleeveTop).position.x = NMT.orbit;
const tritonSlider = new THREE.Group();
tritonGroup.add(tritonSlider);
const bar0 = NMT.guideY + NMT.barAbove;                       // stanga når løftet er 0
addShaft(tritonSlider, NM.stalkRadius, bar0 - NMT.stalkBelow, bodies.height).position.x = NMT.orbit;
addRod(tritonSlider, { x: G.radius, y: bar0, z: 0 }, { x: NMT.orbit, y: bar0, z: 0 }, NM.footRadius);
addSphere(tritonSlider, NM.footRadius).position.set(G.radius, bar0, 0);
addShaft(tritonSlider, NM.footRadius * 0.6, bar0 - NM.footRadius - NM.pinLength, bar0).position.x = G.radius;
addPlanetSphere(tritonSlider, iceMoons.size.triton, 'triton').position.set(NMT.orbit, bodies.height, 0);
fastParts.push({ group: tritonGroup, gears: [tritonGear], trail: { radius: NMT.orbit, y: bodies.height, tube: iceMoons.size.triton * 0.35 } });
fastParts.push({ group: neptuneCollarGroup, gears: [neptuneCollarGear] });
fastParts.push({ group: neptuneLayGroup, gears: neptuneLayGears });
fastParts.push({ group: neptuneIdlerGroup, gears: [neptuneIdlerGear] });

// --- Jordarmen: røret, det store hjulet nederst og stanga ut til jorda. ---
// Ytterst har armen ingen krage: der står tannhjulet på driveakselen til jordrotasjonen.
const armGroup = turnsWith(drives(new THREE.Group(), system('earth')), 'armAngle');
root.add(armGroup);
addShaft(armGroup, tube.earth.outer, heights.bottom.earth, armY);
addGear(armGroup, pairGear(bigGear.teeth, smallGear.teeth, tube.earth.outer, bigGear), heights.bottom.earth);
addArm(armGroup, { length: armLengths.earth, hubRadius: tube.earth.outer + 1, part: armParts.earth, y: armY, collar: false });

// Pinion, kjedehjulet til dagkjedet og det store månekjedehjulet på samme aksel,
// som går rundt det faste hjulet.
const pinionGroup = turnsWith(addGroupAt(armGroup, layout.pinion), 'pinionAngle');
addShaft(pinionGroup, moonTrain.pinion.holeRadius, armTop, heights.pinionTop);
addGear(pinionGroup, trainGear(moonTrain.pinion), level1);
drives(addSprocket(pinionGroup, { teeth: earthDay.P.pinionSprocket, holeRadius: moonTrain.pinion.holeRadius, ...bigSprocketStyle },
  earthDayChain.radius1, heights.day, earthDayChain), 'earth');
// Kjedehjulet er satt på akselen i sin egen vinkel, så månefasen stemmer.
drives(addSprocket(pinionGroup, moonTrain.driveSprocket, moonChain.radius1, moonChainLevel), 'moon').rotation.y = phases.moon;

addChain(armGroup, moonChain, moonChainLevel, 'moonChainOffset', true, 'moon');
addChain(armGroup, parallelChain, parallelLevel, 'parallelChainOffset');
addChain(armGroup, earthDayChain, heights.day, 'earthDayChainOffset', true, 'earth');
addChain(driveChainGroup, driveChain, heights.driveChain, 'driveChainOffset');
addChain(layChainGroup, layChain, heights.layChain, 'layChainOffset');

// --- Ytterst på armen: jordstolpen (earthBuild.js, utformingen i earthTrain):
// forlegsakselen og driveakselen ved foten, parallellhjulet med stolperøret,
// føringsringen, vinkelgiret og jorda som roterer, og månen med staven og foten
// som følger ringen. ---
const earthEnd = buildEarthEnd(earthTrain, {
  materials: { white: mat.white, metal: mat.metal },
  moonChain, parallelChain, earthAxisDirection: earthAxis.direction, moonRadius: bodies.moonRadius,
  addEarth: (group) => addPlanetSphere(group, bodies.earthRadius, 'earth'),
  addMoon: (group, p) => addPlanetSphere(group, bodies.moonRadius, 'moon').position.set(p.x, p.y, p.z),
});
earthEnd.end.position.set(layout.earth.x, 0, -layout.earth.y);
armGroup.add(earthEnd.end);
// Mot flimring: en glatt kule med fargene smurt ut langs breddegradene når jorda spinner fort.
const earthRaised = bodyLooks.earth?.pattern === 'continents' ? bodyLooks.earth.height : 0;
const earthSpinBlur = createSpinBlur(earthEnd.tilted, bodies.earthRadius + earthRaised + 0.015);
earthSpinBlur.source = spheres.earth.object; // dempes som jorda
earthEnd.spinEntry.extra.push(earthSpinBlur);
fastParts.push(...earthEnd.fast);

// --- Mot flimring (blur.js) ---
// Hjulene på akslene som går fort (alle unntatt den første delen, som er akselen).
const gearsOf = (group) => group.children.filter((c) => c.isMesh).slice(1);
fastParts.push({ group: collarGroup, gears: gearsOf(collarGroup) });
fastParts.push({ group: jupiterLayGroup, gears: gearsOf(jupiterLayGroup) });
fastParts.push({ group: saturnLayGroup, gears: gearsOf(saturnLayGroup) });
fastParts.push({ group: saturnSleeveGroup, gears: gearsOf(saturnSleeveGroup) });
fastParts.push({ group: marsDriveGroup, gears: gearsOf(marsDriveGroup) });
fastParts.push({ group: marsIdlerGroup, gears: marsIdlerGroup.children.filter((c) => c.isMesh) });
root.updateMatrixWorld(true);
for (const p of fastParts) {
  const pieces = [];
  for (const g of p.gears ?? []) pieces.push(createSmoothGear(g));
  if (p.fan?.length) pieces.push(createFan(p.group, p.fan));
  if (p.trail) {
    // Lyssporet viser månen, så det dempes som kula (driveView.js).
    const holder = p.trail.parent ?? p.group;
    const trail = createTrail(holder, p.trail);
    let moon = null;
    holder.traverse((o) => { if (!moon && o.userData.body) moon = o; });
    trail.source = moon ?? holder;
    pieces.push(trail);
  }
  pieces.push(...(p.extra ?? []));
  trackRotation(p.group, pieces);
}
// Kjedene til månene og jorda: et glatt bånd over leddene. Farten måles som
// vinkelen det minste kjedehjulet dreier.
let angles = null; // vinklene delene sist ble stilt etter
for (const c of chains.filter((x) => x.smooth)) {
  const over = plateGap + 2 * plateThickness;
  const band = createSmoothChain(c.parent, c.chain, c.y - over, moonTrain.thickness + 2 * over, c.chain.rollerRadius * 1.25, mat.chain, c.rollers);
  trackValue(() => angles?.[c.key] ?? 0, Math.min(c.chain.radius1, c.chain.radius2), [band]);
}

// Stiller alle delene etter tiden (år siden startdatoen): hver del får vinkelen
// mekanismen regner ut fra tanntallene.
export function update(years) {
  const a = (angles = anglesAt(years * inputPerYear));
  for (const [group, angleOf] of turning) group.rotation.y = angleOf(a);
  for (const c of chains) c.update(a[c.key]);
  tritonSlider.position.y = NMT.lift(a.tritonAngle);
  earthEnd.update({
    layAngle: a.earthLayAngle, shaftArm: a.earthShaftAngle, parallelAngle: a.parallelAngle, moonAngle: a.moonAngle, spin: a.earthSpin,
  });
}

// spheres: alle kulene (navn: gruppe og radius). plexusUpdates: flytter nodene
// i plexus-kulene i vanlig tid. turning: det som dreier (til sjekken).
export { spheres, plexusUpdates, turning };
