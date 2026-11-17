// Prøveside: månene til Uranus og Neptun. Åpnes på /orrery/moons.html med
// `npm run dev`. To ruter, A og B, som bare skiller seg på Uranus:
//   A: ringene bærer månene (Saturn-ideen): δ og ε dreier og bærer Oberon og Titania.
//   B: månene på rør (Jupiter-ideen): Titania og Oberon på skrå stag fra rør på
//      polakselen, med et kort bein ned til månen utenfor ringene. B er bygget
//      inn i modellen, og tegnes her fra den samme geometrien (mechanism.js).
// Neptun er lik i begge: et mellomhjul (ring i colors.accent) får Triton til å gå baklengs,
// og Triton går opp og ned på en skrå føringsring (banen heller 130°).
// Hver planet vises stor og i modellstørrelse (fra modellkameraets avstand).
// Tallene står i iceMoons i config.js, geometrien i iceMoons.js. Klaringen
// regnes med det samme verktøyet som npm run check (scripts/clearance3d.mjs).
// Klikk stopper og starter; dra for å snu.
// ?cell=0 eller 1 viser bare A eller B. ?speed= er dager per sekund (standard 1;
// 40 eller mer gir lysspor). ?t= starter så mange sekunder ut, &stop står stille.
import * as THREE from 'three';
import { look, panels, colors, uranusRing, uranusPost, iceMoons as IM, bodies, moonTrain, armStyle, accent, arm, gear as gearStyle } from './config.js';
import { createRenderer, createLitScene, createMaterials } from './testStage.js';
import { createPanelGeometry } from './panels.js';
import { createAnnulus, createGlassMaterials } from './ring.js';
import { createGearGeometry, createBevelGeometry, createSprocketGeometry } from './gear.js';
import { createArmGeometry } from './arm.js';
import { trackRotation, createTrail, createSmoothGear, updateBlur } from './blur.js';
import { iceMoonDesigns, uranusParts, neptuneParts } from './iceMoons.js';
import * as model from './mechanism.js';
import { uranusTrain, uranusAxis, armParts, inPlane } from './mechanism.js';
import { makeAxis, v, run3D, lastMinimum } from '../scripts/clearance3d.mjs';

// B og Neptun er modellens (mechanism.js); A regnes ved siden av.
const designs = iceMoonDesigns(model);
const H = bodies.height;
const query = new URLSearchParams(location.search);
const onlyCell = query.has('cell') ? Number(query.get('cell')) : null;
const daysPerSecond = Number(query.get('speed')) || 1;
const yearDays = designs.yearDays;
const deg = THREE.MathUtils.degToRad;

const { renderer, environment } = createRenderer();
const base = createMaterials();
const white = base.white, metal = base.metal;
const red = new THREE.MeshPhysicalMaterial({ color: colors.accent, roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 });
const chainMaterial = new THREE.MeshPhysicalMaterial({
  color: look.chainColor, metalness: look.chainMetalness, roughness: look.chainRoughness,
  clearcoat: look.chainGloss, clearcoatRoughness: look.glossRoughness,
});
const strutMaterial = new THREE.MeshPhysicalMaterial({
  color: uranusRing.struts.color, metalness: uranusRing.struts.metalness, roughness: uranusRing.struts.roughness,
});
const darkGlass = createGlassMaterials(uranusRing)[0];

// ------------------------------------------------------------ Hjelpere ---
function mesh(parent, geometry, material = white) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = !material.transmission;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
// Loddrett sylinder (langs y i gruppen) fra y0 til y1.
function cyl(parent, r, y0, y1, material = white, x = 0, z = 0) {
  const m = mesh(parent, new THREE.CylinderGeometry(r, r, y1 - y0, 32), material);
  m.position.set(x, (y0 + y1) / 2, z);
  return m;
}
const upAxis = new THREE.Vector3(0, 1, 0);
function rod(parent, a, b, r, material = white) {
  const A = new THREE.Vector3(a.x, a.y, a.z ?? 0), B = new THREE.Vector3(b.x, b.y, b.z ?? 0);
  const m = mesh(parent, new THREE.CylinderGeometry(r, r, A.distanceTo(B), 16), material);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(upAxis, B.clone().sub(A).normalize());
  return m;
}
function ball(parent, p, r, material = white) {
  const m = mesh(parent, new THREE.SphereGeometry(r, 24, 12), material);
  m.position.set(p.x, p.y, p.z ?? 0);
  return m;
}
// Myk overgang: en kjegle fra radius 2r ved a til r, fillet langs retningen mot b.
function flare(parent, a, b, r, fillet, material = white) {
  const A = new THREE.Vector3(a.x, a.y, a.z ?? 0), B = new THREE.Vector3(b.x, b.y, b.z ?? 0);
  const dir = B.clone().sub(A).normalize();
  const m = mesh(parent, new THREE.CylinderGeometry(r, 2 * r, fillet, 24), material);
  m.position.copy(A).addScaledVector(dir, fillet / 2);
  m.quaternion.setFromUnitVectors(upAxis, dir);
  return m;
}
const gearSettings = (teeth, module, thickness, hole) => {
  const pitch = (module * teeth) / 2;
  const spokes = pitch > 1.4 ? 4 : 0;
  return {
    teeth, module, pressureAngle: gearStyle.pressureAngle, backlash: module * 0.15, holeRadius: hole,
    spokes, spokeWidth: Math.max(0.2, pitch * 0.18), hubWidth: Math.max(0.15, pitch * 0.12), rimWidth: Math.max(0.15, pitch * 0.14),
    thickness, chamfer: Math.min(0.06, thickness * 0.2),
  };
};
// Tannhjul som ligger flatt med midten i høyden y.
function addGear(parent, teeth, module, thickness, hole, y, material = white) {
  const m = mesh(parent, createGearGeometry(gearSettings(teeth, module, thickness, hole)), material);
  m.position.y = y - thickness / 2;
  return m;
}
// Konisk hjul med midten i y; toppunktet ligger apex over (negativ: under) midten.
function addBevel(parent, teeth, module, thickness, hole, y, apex) {
  const geometry = createBevelGeometry(gearSettings(teeth, module, thickness, hole), Math.abs(apex));
  if (apex < 0) geometry.rotateX(Math.PI);
  const m = mesh(parent, geometry);
  m.position.y = y;
  return m;
}
function addSprocket(parent, teeth, pitch, hole, y) {
  const pitchRadius = (teeth * pitch) / (2 * Math.PI);
  const m = mesh(parent, createSprocketGeometry({
    teeth, pitchRadius, rollerRadius: pitch * 0.3, holeRadius: hole,
    spokes: pitchRadius > 2.5 ? 5 : 0, spokeWidth: 0.6, hubWidth: 0.5, rimWidth: 0.6,
    thickness: moonTrain.thickness, chamfer: 0.08,
  }));
  m.position.y = y;
  return pitchRadius;
}
// Et stykke av kjedet: rundt kjedehjulet (mot +x) og to parter inn mot sentrum (−x).
function addChainStub(parent, pitchRadius, y, length = 9, pitch = 1) {
  const rr = pitch * 0.3, h = moonTrain.thickness + 0.1;
  const roller = new THREE.CylinderGeometry(rr, rr, h, 12);
  const pts = [];
  const around = Math.max(3, Math.round((Math.PI * pitchRadius) / pitch));
  for (let k = 0; k <= around; k++) {
    const a = -Math.PI / 2 + (Math.PI * k) / around;
    pts.push([pitchRadius * Math.cos(a), pitchRadius * Math.sin(a)]);
  }
  for (let k = 1; k <= length / pitch; k++) pts.push([-k * pitch, pitchRadius], [-k * pitch, -pitchRadius]);
  for (const [x, z] of pts) mesh(parent, roller, chainMaterial).position.set(x, y + moonTrain.thickness / 2, z);
  for (const side of [1, -1]) for (const dy of [-0.1, moonTrain.thickness + 0.1]) {
    const bar = mesh(parent, new THREE.BoxGeometry(length, 0.08, rr * 2.4), chainMaterial);
    bar.position.set(-length / 2, y + dy, side * pitchRadius);
  }
}
// Stykke av en planetarm som ender ved stolpen (x = 0) og går inn mot sentrum (−x).
function addArmStub(parent, y, part = armParts.planet, length = 14) {
  const m = mesh(parent, createArmGeometry({
    length, hubRadius: 0.3, rootHalf: part.endRadius + 0.15, endRadius: part.endRadius,
    fillet: 0.01, thickness: arm.thickness, chamfer: armStyle.chamfer,
  }));
  m.position.set(-length, y, 0);
  // Kragen og den røde ringen rundt stolpen.
  const collar = mesh(parent, new THREE.CylinderGeometry(part.postRadius + armStyle.collarWidth * 0.25, part.collarRadius, armStyle.collarHeight, 32));
  collar.position.y = y + arm.thickness + armStyle.collarHeight / 2;
  const ring = mesh(parent, new THREE.TorusGeometry(part.postRadius + accent.ringWidth / 2, accent.ringWidth / 2, 12, 48), red);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = y + arm.thickness + armStyle.collarHeight + accent.ringWidth / 2;
}
// Fargen på kula fra colors.bodies, i den samme lakken som hjulene.
const bodyMaterials = {};
const bodyMaterial = (name) => (bodyMaterials[name] ??= colors.bodies[name]
  ? new THREE.MeshPhysicalMaterial({ color: colors.bodies[name], roughness: look.roughness, metalness: 0, clearcoat: look.gloss, clearcoatRoughness: look.glossRoughness })
  : white);
function addPlanet(parent, radius, name) {
  const { geometry, coreRadius } = createPanelGeometry({
    radius, shape: panels.shape, seamWidth: panels.seamWidth, seamDepth: panels.seamDepth, ...(panels[name] ?? { pattern: 'quads', subdivisions: 1 }),
  });
  const group = new THREE.Group();
  parent.add(group);
  mesh(group, geometry, [bodyMaterial(name), metal, metal]);
  mesh(group, new THREE.SphereGeometry(coreRadius, 32, 16), metal);
  return group;
}
// Flat stang i planet y = 0 fra a til b (x og z), med runde ender.
function addFlatBar(parent, a, b, width, y0, y1, material = white) {
  const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
  const box = mesh(parent, new THREE.BoxGeometry(L, y1 - y0, width), material);
  box.position.set((a.x + b.x) / 2, (y0 + y1) / 2, (a.z + b.z) / 2);
  box.rotation.y = -Math.atan2(dz, dx);
  for (const p of [a, b]) cyl(parent, width / 2, y0, y1, material, p.x, p.z);
}

// Hjul som dreier, til blur.js: gruppen dreier om sin egen y-akse.
const fast = [];
const track = (group, gears = [], trail = null) => fast.push({ group, gears, trail });

// ------------------------------------------------------------- Uranus ---
function buildUranus(variant) {
  const d = designs[variant].uranus;
  const UM = IM.uranus, T = d.T;
  const root = new THREE.Group();
  const parR = (uranusPost.parallel.postSprocket * uranusPost.chainPitch) / (2 * Math.PI);

  // Armen, kjedene og driveakselen nederst.
  addArmStub(root, d.armY);
  const driveGroup = new THREE.Group();
  root.add(driveGroup);
  cyl(driveGroup, UM.driveShaftRadius, d.armTop, d.shaftTop);
  const shaftSprocketR = addSprocket(driveGroup, UM.shaftSprocket, UM.chainPitch, UM.driveShaftRadius, d.chainY);
  addBevel(driveGroup, d.bevel.driveTeeth, d.bevel.module, T, UM.driveShaftRadius, d.bevel.driveY, d.bevel.driveApex);
  addChainStub(root, shaftSprocketR, d.chainY);
  // Stolperøret med kjedehjulet til parallellføringen.
  cyl(root, d.frameOuter, d.parallelY, d.frameTop);
  addSprocket(root, uranusPost.parallel.postSprocket, uranusPost.chainPitch, d.frameOuter, d.parallelY);
  addChainStub(root, parR, d.parallelY);
  // Braketten.
  const bp = d.bracket.points, r = d.r;
  const start = { x: d.frameOuter, y: bp[0].y, z: 0 };
  rod(root, start, bp[1], r);
  for (let i = 1; i < bp.length - 1; i++) rod(root, bp[i], bp[i + 1], r);
  for (const p of bp.slice(1, -1)) ball(root, p, r);
  flare(root, start, bp[1], r, d.bracket.fillet);
  flare(root, bp.at(-1), bp.at(-2), r, d.bracket.fillet);

  // Alt rundt Uranus' akse: y i gruppen er aksen (s), x er x' (nedover).
  const tilted = new THREE.Group();
  tilted.position.y = H;
  tilted.rotation.z = -uranusAxis.tilt;
  root.add(tilted);
  addPlanet(tilted, d.R, 'uranus');
  cyl(tilted, r, d.poleS, d.elbowS);                                  // polakselen
  const fil = mesh(tilted, new THREE.CylinderGeometry(r, 2 * r, d.bracket.fillet, 24));
  fil.position.y = d.poleS + d.bracket.fillet / 2;
  const ringAt = (rho, s, ang) => ({ x: rho * Math.cos(ang), y: s, z: -rho * Math.sin(ang) });
  const glassRing = (parent, x) => {
    const m = new THREE.Mesh(createAnnulus(x.inner, x.outer, uranusRing.thickness, uranusRing.chamfer), darkGlass);
    m.receiveShadow = true;
    parent.add(m);
  };
  const moving = variant === 'A' ? ['δ', 'ε'] : [];
  const fixedRings = d.ring.rings.filter((x) => !moving.includes(x.name));
  for (const x of fixedRings) glassRing(tilted, x);
  for (const ang of uranusTrain.azimuths) rod(tilted, ringAt(d.ring.inner, 0, ang), ringAt(fixedRings.at(-1).outer, 0, ang), uranusRing.spokeWidth / 2, strutMaterial);
  {
    // Det faste navet med stagene til ring 6, som i modellen i dag.
    const hub = uranusTrain.hub;
    cyl(tilted, hub.radius, hub.s0, hub.s1);
    for (const ang of uranusTrain.azimuths) {
      rod(tilted, ringAt(hub.radius - 0.05, hub.s, ang), ringAt(uranusTrain.attach.rho, uranusTrain.attach.s, ang), uranusTrain.strutRadius, strutMaterial);
    }
  }

  // Lagrene til forlegsakselen (står fast): ett i den loddrette delen av
  // braketten, og ett på en bukk fra den vannrette delen.
  const bb = d.bearings;
  cyl(tilted, bb.riser.radius, bb.riser.s0, bb.riser.s1, white, d.LD, 0);
  cyl(tilted, bb.foot.radius, bb.foot.s0, bb.foot.s1, white, d.LD, 0);
  rod(root, ...bb.foot.post, UM.bearing.postRadius);
  ball(root, bb.foot.post[0], UM.bearing.postRadius);

  // Forlegsakselen med det koniske hjulet og hjulparene.
  const lay = new THREE.Group();
  lay.position.x = d.LD;
  tilted.add(lay);
  cyl(lay, UM.shaftRadius, ...d.laySpan);
  addBevel(lay, d.bevel.layTeeth, d.bevel.module, T, UM.shaftRadius, d.bevel.layS, d.bevel.layApex);
  const layGears = [];
  for (const [moon, p] of Object.entries(d.pairs)) layGears.push(addGear(lay, p.lay, p.module, T, UM.shaftRadius, d.levels[`${moon}Gear`]));
  track(lay, layGears);

  // Månene, med rørene og det de bærer.
  const moonGroups = {};
  const aT = UM.armThickness, aW = UM.armWidth;
  for (const [moon, mo] of Object.entries(d.moons)) {
    const g = new THREE.Group();
    tilted.add(g);
    moonGroups[moon] = g;
    const t = mo.tube, p = d.pairs[moon];
    cyl(g, t.outer, t.s0, t.s1);
    const gearMesh = addGear(g, p.tube, p.module, T, t.outer, d.levels[`${moon}Gear`]);
    addPlanet(g, mo.radius, moon).position.set(mo.orbit, mo.s, 0);
    if (variant === 'B') {
      // Kragen på røret, det skrå staget og beinet ned til månen.
      const rr = d.rods.rodRadius;
      cyl(g, mo.rod.from.x + rr, mo.armS - aT / 2, mo.armS + aT / 2);
      rod(g, { x: mo.rod.from.x, y: mo.rod.from.y, z: 0 }, { x: mo.rod.to.x, y: mo.rod.to.y, z: 0 }, rr);
      ball(g, { x: mo.rod.to.x, y: mo.rod.to.y, z: 0 }, rr);
      cyl(g, UM.legRadius, 0, mo.legTop, white, mo.orbit, 0);
    } else {
      const hub = d.ringHubs[moon];
      cyl(g, hub.outer, hub.s - UM.hub.length / 2, hub.s + UM.hub.length / 2);
      for (let k = 0; k < 3; k++) {
        const ang = Math.PI / 3 + (2 * Math.PI * k) / 3;
        rod(g, ringAt(hub.outer - 0.05, hub.s, ang), ringAt(hub.ring.middle, d.half, ang), uranusRing.struts.width / 2, strutMaterial);
      }
      glassRing(g, hub.ring);
      if (mo.s === 0) {
        addFlatBar(g, { x: mo.from, z: 0 }, { x: mo.orbit, z: 0 }, aW, -aT / 2, aT / 2);
      } else {
        cyl(g, UM.legRadius, mo.s, -d.half, white, mo.from, 0);
        addFlatBar(g, { x: mo.from, z: 0 }, { x: mo.orbit, z: 0 }, aW, mo.s - aT / 2, mo.s + aT / 2);
      }
    }
    track(g, [gearMesh], { radius: mo.orbit, y: mo.s, tube: mo.radius * 0.35 });
  }

  // Startvinklene: med samme funksjon som modellen (se iceMoons.js).
  // Startvinklene: et par vilkårlige lengder, regnet om med den samme funksjonen som modellen.
  const startAngle = { titania: inPlane(uranusAxis, uranusAxis.poleWorld + 1.0), oberon: inPlane(uranusAxis, uranusAxis.poleWorld + 2.6) };
  const rates = designs.rates.uranus;
  const update = (days) => {
    const years = days / yearDays;
    for (const [moon, g] of Object.entries(moonGroups)) g.rotation.y = startAngle[moon] + 2 * Math.PI * rates.moons[moon] * years;
    // Hjulene på forlegsakselen griper i hjulene på rørene: motsatt vei.
    lay.rotation.y = -2 * Math.PI * rates.lay * years;
    driveGroup.rotation.y = 2 * Math.PI * rates.shaft * years;
  };
  return { root, update, d };
}

// ------------------------------------------------------------- Neptun ---
function buildNeptune() {
  const d = designs.neptune;
  const NM = IM.neptune, T = d.T, m = d.m;
  const root = new THREE.Group();
  const postR = d.postR;
  addArmStub(root, d.armY);
  cyl(root, postR, d.armTop, H - d.R * 0.5);                          // stolpen
  addPlanet(root, d.R, 'neptune').position.y = H;

  // Kjedet og kragen.
  const collar = new THREE.Group();
  root.add(collar);
  cyl(collar, d.tubeOuter, d.chainY, d.lowY + T);
  const collarSprocketR = addSprocket(collar, NM.collarSprocket, NM.chainPitch, d.tubeOuter, d.chainY);
  const collarGear = addGear(collar, NM.collarTeeth, m, T, d.tubeOuter, d.lowY + T / 2);
  addChainStub(root, collarSprocketR, d.chainY);
  // Tappen A med dobbelthjulet, bøylen og tappen B med mellomhjulet (rød ring).
  cyl(root, NM.pinRadius, d.armTop, d.pinTopA, white, d.A.x, d.A.z);
  cyl(root, NM.pinRadius, d.pinBottomB, d.pinTopA, white, d.B.x, d.B.z);
  addFlatBar(root, d.A, d.B, NM.bridge.width, d.bridgeY, d.bridgeY + NM.bridge.thickness);
  const layGroup = new THREE.Group();
  layGroup.position.set(d.A.x, 0, d.A.z);
  root.add(layGroup);
  cyl(layGroup, NM.pinRadius + 0.12, d.lowY, d.highY + T);
  const low = addGear(layGroup, NM.layLow, m, T, NM.pinRadius, d.lowY + T / 2);
  const high = addGear(layGroup, NM.layHigh, m, T, NM.pinRadius, d.highY + T / 2);
  const idler = new THREE.Group();
  idler.position.set(d.B.x, 0, d.B.z);
  root.add(idler);
  const idlerGear = addGear(idler, NM.idlerTeeth, m, T, NM.pinRadius, d.highY + T / 2);
  const mark = mesh(idler, new THREE.TorusGeometry((m * NM.idlerTeeth) / 2 * 0.62, 0.07, 10, 48), red);
  mark.rotation.x = Math.PI / 2;
  mark.position.y = d.highY + T + 0.05;
  track(collar, [collarGear]);
  track(layGroup, [low, high]);
  track(idler, [idlerGear]);

  // Føringsringen: nav på stolpen, eiker og en smal ring med loddrette sider.
  const G = NM.guide;
  cyl(root, postR + G.hub, d.guideHubY - 0.3, d.guideHubY + 0.3);
  for (const t of d.spokeAngles) {
    const end = d.guidePoint(t, -G.width / 2, -G.height / 2);
    rod(root, { x: (postR + G.hub - 0.05) * Math.cos(t), y: d.guideHubY, z: (postR + G.hub - 0.05) * Math.sin(t) }, end, G.spokeRadius, strutMaterial);
  }
  mesh(root, camRingGeometry(d, G), white);

  // Triton: røret med hjulet og armen (dreier baklengs), hylsa, og staven med
  // foten og Triton, som flyttes opp og ned etter ringen.
  const triton = new THREE.Group();
  root.add(triton);
  cyl(triton, d.tubeOuter, d.highY, d.tritonTubeTop);
  const tritonGear = addGear(triton, NM.tritonTeeth, m, T, d.tubeOuter, d.highY + T / 2);
  const armGeo = createArmGeometry({
    length: d.orbit, hubRadius: d.tubeOuter + 0.1, rootHalf: 0.45, endRadius: NM.sleeveRadius,
    fillet: 0.3, thickness: NM.armThickness, chamfer: 0.08,
  });
  mesh(triton, armGeo).position.y = d.tritonArmY;
  cyl(triton, NM.sleeveRadius, d.tritonArmTop, d.sleeveTop, white, d.orbit, 0);
  const slider = new THREE.Group();
  triton.add(slider);
  const bar0 = d.guideY + d.barAbove;                                  // stanga når løftet er 0
  cyl(slider, NM.stalkRadius, bar0 - d.stalkBelow, H, white, d.orbit, 0);
  rod(slider, { x: NM.guide.radius, y: bar0, z: 0 }, { x: d.orbit, y: bar0, z: 0 }, NM.footRadius);
  ball(slider, { x: NM.guide.radius, y: bar0, z: 0 }, NM.footRadius);
  cyl(slider, NM.footRadius * 0.6, bar0 - NM.footRadius - NM.pinLength, bar0, white, NM.guide.radius, 0);
  addPlanet(slider, IM.size.triton, 'triton').position.set(d.orbit, H, 0);
  track(triton, [tritonGear], { radius: d.orbit, y: H, tube: IM.size.triton * 0.35 });

  const rates = designs.rates.neptune;
  const update = (days) => {
    const years = days / yearDays;
    const theta = 2 * Math.PI * rates.triton * years;                  // negativ: baklengs
    triton.rotation.y = -theta;
    slider.position.y = d.lift(theta);
    collar.rotation.y = -2 * Math.PI * rates.collar * years;
    layGroup.rotation.y = -2 * Math.PI * rates.lay * years;
    idler.rotation.y = -2 * Math.PI * rates.idler * years;
  };
  return { root, update, d };
}

// Føringsringen: et bånd med loddrette sider rundt stolpen (bredde width
// radielt, høyde height), med midtlinjen løftet K × cos θ.
function camRingGeometry(d, G) {
  const N = 192, pos = [], idx = [];
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];               // (radielt, høyde)
  for (let k = 0; k <= N; k++) {
    const t = (2 * Math.PI * k) / N;
    for (const [cr, cy] of corners) {
      const p = d.guidePoint(t, (cr * G.width) / 2, (cy * G.height) / 2);
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let k = 0; k < N; k++) for (let c = 0; c < 4; c++) {
    const a = k * 4 + c, b = k * 4 + ((c + 1) % 4), a2 = a + 4, b2 = b + 4;
    idx.push(a, a2, b, b, a2, b2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}

// ------------------------------------------------------------- Scenene ---
// Hver planet får sin egen scene, flyttet så midten av det som vises ligger
// i origo (der lyset sikter). Neptun er den samme i begge rutene.
function sceneFor(assembly, center, reach) {
  const scene = createLitScene(environment, reach);
  assembly.root.position.set(-center.x, -center.y, -center.z);
  scene.add(assembly.root);
  return scene;
}
const uranusA = buildUranus('A'), uranusB = buildUranus('B'), neptune = buildNeptune();
const nd = neptune.d;
// Hva hver stor visning rammer inn (i stolpens koordinater): midten og en radius.
const uranusFrame = (u) => {
  const top = H + u.d.ring.outer + 0.6, bottom = u.d.bracket.points[0].y - 0.8;
  return { center: { x: u.d.elbow.x * 0.35, y: (top + bottom) / 2, z: 0 }, radius: Math.max((top - bottom) / 2, u.d.reach + 0.5) };
};
const neptuneWhole = { center: { x: -0.6, y: (nd.armY + H + nd.R) / 2, z: 0 }, radius: (H + nd.R - nd.armY) / 2 + 0.8 };
const neptuneTop = { center: { x: 0, y: H - 7.5, z: 0 }, radius: 11 };
const neptuneFoot = { center: { x: -1.0, y: (nd.armY + nd.pinTopA) / 2 + 0.3, z: 0.4 }, radius: 3.6 };
const scenes = {
  A: sceneFor(uranusA, uranusFrame(uranusA).center, 14),
  B: sceneFor(uranusB, uranusFrame(uranusB).center, 14),
  N: sceneFor(neptune, neptuneWhole.center, 22),
};
// Fra stolpens koordinater til scenens.
const inScene = (frame, sceneCenter) => ({ x: frame.center.x - sceneCenter.x, y: frame.center.y - sceneCenter.y, z: frame.center.z - sceneCenter.z });

// Lysspor og glatte hjul.
for (const p of fast) {
  const pieces = p.gears.map((g) => createSmoothGear(g));
  if (p.trail) pieces.push(createTrail(p.group, p.trail));
  trackRotation(p.group, pieces);
}

// ------------------------------------------------------------- Rutene ---
const cells = ['A', 'B'].map((variant) => {
  const x = designs[variant], u = variant === 'A' ? uranusA : uranusB;
  return {
    variant, x, u,
    title: variant === 'A' ? 'A: ringene bærer månene' : 'B: månene på rør (i modellen)',
    note: variant === 'A'
      ? 'δ og ε dreier og bærer Oberon og Titania (Saturn-ideen)'
      : 'Titania og Oberon på skrå stag fra rør på polakselen (Jupiter-ideen)',
    views: [
      { key: 'uranus', label: 'Uranus', scene: scenes[variant], frame: uranusFrame(u), sceneCenter: uranusFrame(u).center },
      { key: 'neptune', label: 'Neptun: hele stolpen', scene: scenes.N, frame: neptuneWhole, sceneCenter: neptuneWhole.center },
      { key: 'triton', label: 'Neptun: Triton og føringsringen', scene: scenes.N, frame: neptuneTop, sceneCenter: neptuneWhole.center },
      { key: 'idler', label: 'Neptun: mellomhjulet (rød ring)', scene: scenes.N, frame: neptuneFoot, sceneCenter: neptuneWhole.center },
      { key: 'uranusModel', label: 'Uranus som i modellen', scene: scenes[variant], frame: uranusFrame(u), sceneCenter: uranusFrame(u).center, model: 'uranus' },
      { key: 'neptuneModel', label: 'Neptun som i modellen', scene: scenes.N, frame: neptuneTop, sceneCenter: neptuneWhole.center, model: 'neptune' },
    ],
  };
}).filter((c, i) => onlyCell === null || onlyCell === i);
for (const c of cells) for (const view of c.views) view.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 2000);

// Modellens kamera: hvor langt unna Uranus og Neptun er (snitt over en runde), som rings.html.
function modelDistance(armLength) {
  const outer = armLength + 4;
  const modelHeight = bodies.height + bodies.sunRadius;
  const vFov = deg(40);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (window.innerWidth / window.innerHeight));
  const distance = (Math.hypot(outer, modelHeight / 2) * 0.9) / Math.sin(Math.min(vFov, hFov) / 2);
  const camera = new THREE.Vector3(55, 65, 75).normalize().multiplyScalar(distance).add({ x: 0, y: modelHeight * 0.1, z: 0 });
  let sum = 0;
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    sum += camera.distanceTo({ x: armLength * Math.cos(a), y: H, z: armLength * Math.sin(a) });
  }
  return sum / 72;
}

// --- Tekstene ---
const textColor = look.gearColor;
const overlay = document.createElement('div');
document.body.appendChild(overlay);
const makeText = (html, style) => {
  const el = document.createElement('div');
  el.innerHTML = html;
  Object.assign(el.style, {
    position: 'fixed', pointerEvents: 'none', color: textColor, textShadow: '0 1px 3px #000',
    font: '500 14px/1.35 system-ui, sans-serif', ...style,
  });
  overlay.appendChild(el);
  return el;
};
const small = { font: '12px/1.35 system-ui, sans-serif', opacity: 0.6 };
const n2 = (x) => x.toFixed(2).replace('.', ',');
for (const c of cells) {
  c.titleEl = makeText(`${c.title}<br><small style="opacity:.7">${c.note}</small>`, { textAlign: 'center', transform: 'translate(-50%, 0)' });
  for (const view of c.views) view.el = makeText(view.label, small);
  c.infoEl = makeText('', { font: '12.5px/1.45 system-ui, sans-serif', fontVariantNumeric: 'tabular-nums' });
}
const footer = makeText('', {
  left: '50%', bottom: '10px', transform: 'translate(-50%, 0)', font: '12px system-ui, sans-serif', opacity: 0.7, whiteSpace: 'nowrap',
});

// Klaringen, med samme verktøy som npm run check (regnes etter første bilde).
const clearance = {};
function checkClearance() {
  const toCheck = (list) => {
    const axes = {};
    return list.map((p) => ({ ...p, ax: p.axis ? (axes[p.axis.key] ??= makeAxis(v(p.axis.o.x, p.axis.o.y, p.axis.o.z), v(p.axis.d.x, p.axis.d.y, p.axis.d.z))) : null }));
  };
  const named = (x) => `${x.body} ${x.name}`;
  for (const variant of ['A', 'B']) {
    const skip = (a, b) => {
      const pair = [named(a), named(b)].sort().join('|');
      if (/^Uranus Uranus\|stolpe myk overgang ved polen/.test(pair) || /^ringer stag \d\|stolpe nav$/.test(pair)) return true;
      if (pair === 'forlegg forlegsaksel|stolpe brakett 2') return true;   // akselen går inn i lageret i braketten
      return Boolean(a.glass && b.glass);
    };
    const fails = run3D(`U${variant}`, `Uranus ${variant}`, toCheck(uranusParts(designs[variant].uranus)), skip);
    clearance[variant] = { fails, min: Object.values(lastMinimum).reduce((m, r) => (r.gap < m.gap ? r : m), { gap: Infinity }) };
  }
  const skipN = (a, b) => {
    const pair = [named(a), named(b)].sort().join('|');
    if (pair === 'Neptun Neptun|stolpe stolpe' || (a.rests && b.guide) || (b.rests && a.guide)) return true;
    return pair === 'forlegg hylse|krage hjul' || pair === 'krage hjul|stolpe tapp A';
  };
  const fails = run3D('N', 'Neptun', toCheck(neptuneParts(nd, 36)), skipN);
  clearance.N = { fails, min: Object.values(lastMinimum).reduce((m, r) => (r.gap < m.gap ? r : m), { gap: Infinity }) };
  writeInfo();
}

function writeInfo() {
  const t = designs.today;
  for (const c of cells) {
    const x = c.x, change = x.arms.maxRadius - t.maxRadius;
    const radius = `<b>${n2(x.arms.maxRadius)}</b>, ${change >= 0 ? '+' : ''}${n2(change)} mot modellen`;
    const removed = x.parts.removed.length ? ` (${x.parts.removed.join(' og ')} fjernes)` : '';
    const cl = (k) => {
      const r = clearance[k];
      if (!r) return 'regnes …';
      const text = `${n2(r.min.gap)}`;
      return r.fails ? `<b>${text}, ${r.fails} par under 0,3</b>` : `${text} (alt minst 0,3)`;
    };
    c.infoEl.innerHTML = [
      `Nye deler: Uranus <b>${x.count.uranus}</b>${removed}, Neptun <b>${x.count.neptune}</b>`,
      `Armene: Uranus ${n2(x.arms.uranus)} (modellen ${n2(t.uranus)}), Neptun ${n2(x.arms.neptune)} (modellen ${n2(t.neptune)})`,
      `Uranus rekker ${n2(x.uranus.reach)} fra stolpen (modellen ${n2(t.uranusReach)}), Neptun ${n2(designs.neptune.reach)}`,
      `Største radius: ${radius} (modellen ${n2(t.maxRadius)})`,
      `Minste klaring: Uranus ${cl(c.variant)} · Neptun ${cl('N')}`,
    ].join('<br>');
  }
}
writeInfo();

// --- Plasseringen av rutene ---
const header = 50;
let modelDistances = {};
function placeCells() {
  const W = window.innerWidth, Hh = window.innerHeight - 30;
  const columns = cells.length === 1 ? 1 : W >= Hh ? 2 : 1;
  const rows = Math.ceil(cells.length / columns);
  const cellW = W / columns, cellH = Hh / rows;
  modelDistances = {
    uranus: modelDistance(Math.max(...cells.map((c) => c.x.arms.uranus))),
    neptune: modelDistance(Math.max(...cells.map((c) => c.x.arms.neptune))),
  };
  cells.forEach((c, i) => {
    const x0 = (i % columns) * cellW, y0 = Math.floor(i / columns) * cellH;
    const inner = cellH - header - 92;                                   // plass til tallene nederst
    const bigH = inner * 0.72, modelH = inner - bigH;
    const [u, nWhole, nTop, nFoot, um, nm] = c.views;
    u.rect = { x: x0, y: y0 + header, w: cellW * 0.4, h: bigH };
    nWhole.rect = { x: x0 + cellW * 0.4, y: y0 + header, w: cellW * 0.18, h: bigH };
    nTop.rect = { x: x0 + cellW * 0.58, y: y0 + header, w: cellW * 0.42, h: bigH * 0.55 };
    nFoot.rect = { x: x0 + cellW * 0.58, y: y0 + header + bigH * 0.55, w: cellW * 0.42, h: bigH * 0.45 };
    um.rect = { x: x0, y: y0 + header + bigH, w: cellW * 0.5, h: modelH };
    nm.rect = { x: x0 + cellW * 0.5, y: y0 + header + bigH, w: cellW * 0.5, h: modelH };
    Object.assign(c.titleEl.style, { left: `${x0 + cellW / 2}px`, top: `${y0 + 8}px` });
    for (const view of c.views) {
      Object.assign(view.el.style, { left: `${view.rect.x + 10}px`, top: `${view.rect.y + 4}px` });
      if (view.model) view.el.textContent = `${view.label} (fra ${Math.round(modelDistances[view.model])} mm)`;
    }
    Object.assign(c.infoEl.style, { left: `${x0 + 14}px`, top: `${y0 + header + inner + 6}px`, width: `${cellW - 28}px` });
  });
}
placeCells();
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  placeCells();
});

// --- Kameraene: sakte rundt, og opp og ned ---
let running = !query.has('stop');
let time = Number(query.get('t')) || 0, turnOffset = 0, heightOffset = 0, press = null;
const canvas = renderer.domElement;
canvas.style.cursor = 'grab';
canvas.addEventListener('pointerdown', (e) => {
  press = { x: e.clientX, y: e.clientY, moved: false };
  canvas.setPointerCapture(e.pointerId);
  canvas.style.cursor = 'grabbing';
});
canvas.addEventListener('pointermove', (e) => {
  if (!press) return;
  const dx = e.clientX - press.x, dy = e.clientY - press.y;
  if (Math.hypot(dx, dy) > 4) press.moved = true;
  if (!press.moved) return;
  turnOffset -= dx * 0.4;
  heightOffset += dy * 0.3;
  press.x = e.clientX;
  press.y = e.clientY;
});
canvas.addEventListener('pointerup', () => {
  if (press && !press.moved) running = !running;
  press = null;
  canvas.style.cursor = 'grab';
});

const direction = new THREE.Vector3();
function aim(view, distance, fov) {
  const { camera, rect, frame, sceneCenter } = view;
  const target = inScene(frame, sceneCenter);
  camera.aspect = rect.w / rect.h;
  camera.fov = fov;
  camera.near = Math.max(0.1, distance - frame.radius * 3);
  camera.far = distance + frame.radius * 3;
  camera.updateProjectionMatrix();
  camera.position.copy(direction).multiplyScalar(distance).add(target);
  camera.lookAt(target.x, target.y, target.z);
}
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const pageColor = (y) => {
  const f = THREE.MathUtils.clamp(y / window.innerHeight, 0, 1);
  const [top, bottom] = [rgb(look.backgroundTop), rgb(look.backgroundBottom)];
  return `rgb(${top.map((c, i) => Math.round(c + (bottom[i] - c) * f)).join(' ')})`;
};
const backgrounds = new Map();
function backgroundFor(rect) {
  const key = `${Math.round(rect.y)}|${Math.round(rect.h)}`;
  if (!backgrounds.has(key)) {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 256;
    const ctx = c.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, pageColor(rect.y));
    gradient.addColorStop(1, pageColor(rect.y + rect.h));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1, 256);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    backgrounds.set(key, texture);
  }
  return backgrounds.get(key);
}
function draw(view) {
  const Hh = window.innerHeight, r = view.rect;
  view.scene.background = backgroundFor(r);
  renderer.setViewport(r.x, Hh - r.y - r.h, r.w, r.h);
  renderer.setScissor(r.x, Hh - r.y - r.h, r.w, r.h);
  renderer.render(view.scene, view.camera);
}

renderer.setScissorTest(true);
let last = null, frames = 0;
renderer.setAnimationLoop((now) => {
  const seconds = last === null ? 0 : Math.min((now - last) / 1000, 0.1);
  last = now;
  if (running) time += seconds;
  const days = time * daysPerSecond;
  uranusA.update(days);
  uranusB.update(days);
  neptune.update(days);
  updateBlur();

  const around = deg((360 * time) / 60 + 35 + turnOffset);
  const swing = (1 - Math.cos((2 * Math.PI * time) / 23)) / 2;
  const height = deg(THREE.MathUtils.clamp(8 + 27 * swing + heightOffset, -80, 89));
  direction.set(Math.cos(height) * Math.sin(around), Math.sin(height), Math.cos(height) * Math.cos(around));
  footer.textContent = `${n2(days)} dager (${daysPerSecond} per sekund) · klikk stopper eller starter · dra for å snu · ?cell=0|1, ?speed=40`;

  const Hh = window.innerHeight;
  for (const c of cells) for (const view of c.views) {
    const r = view.rect;
    if (view.model) {
      // Samme vinkel per piksel som modellkameraet (40° over hele vinduet).
      const fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(deg(20)) * (r.h / Hh)));
      aim(view, modelDistances[view.model], fov);
    } else {
      const vFov = deg(30), hFov = 2 * Math.atan(Math.tan(vFov / 2) * (r.w / r.h));
      aim(view, view.frame.radius / Math.sin(Math.min(vFov, hFov) / 2), 30);
    }
    draw(view);
  }
  frames++;
  if (frames === 2) setTimeout(checkClearance, 0);
});
