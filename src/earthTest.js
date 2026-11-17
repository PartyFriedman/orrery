// Prøveside: jorda som roterer, landmassene og en ryddig månemekanikk. Åpnes på
// /orrery/earth.html med `npm run dev`. Modellen er ikke endret.
// Øverst tre ruter (earthDay.cells i config.js), hver med hele jordarmen i
// modellstørrelse: drivet (P fra pinionakselen eller T fra et dagrør i tårnet),
// overgangen til den skrå jordaksen (V vinkelgir eller K kryssledd), føringsringen
// (G1, G2, G3) og foten som følger den (F1, F2). Valgene kan blandes i config.
// Nederst de tre overflatene med landmasser (S1, S2, S3).
// Geometrien står i earthDesign.js og earthSurface.js; klaringen regnes med det
// samme verktøyet som npm run check (scripts/clearance3d.mjs).
// Klikk stopper og starter; dra for å snu.
// ?cell=0|1|2 viser bare én rute. ?speed= er dager per sekund (standard 0,1;
// 2 eller mer gir glatt kule og glatte hjul). ?surface=S1|S2|S3 velger overflaten
// på jordarmene. ?t= starter så mange sekunder ut, &stop står stille.
import * as THREE from 'three';
import {
  look, colors, bodies, arm, armStyle, accent, gear as gearStyle, moonTrain, earthDay as ED, moonGuide as MG, earthSurface as ES,
} from './config.js';
import { createRenderer, createLitScene, createMaterials } from './testStage.js';
import { createArmGeometry } from './arm.js';
import { makeHelpers, buildEarthEnd } from './earthBuild.js';
import { trackRotation, trackValue, createTrail, createSmoothGear, createSmoothChain, updateBlur } from './blur.js';
import { earthDesign, earthParts, gmst, removed, contextFrom } from './earthDesign.js';
import { createEarthSurface, createSurfaceMaterials, createSpinBlur } from './earthSurface.js';
import * as M from './mechanism.js';
import { run3D, lastMinimum, toCheckParts } from '../scripts/clearance3d.mjs';

const query = new URLSearchParams(location.search);
const onlyCell = query.has('cell') ? Number(query.get('cell')) : null;
const daysPerSecond = query.has('speed') ? Number(query.get('speed')) : 0.1;
const surfaceStyle = ['S1', 'S2', 'S3'].includes(query.get('surface')) ? query.get('surface') : 'S1';
const globesOnly = query.get('view') === 'globes' || query.has('globe');             // bare kulene, store
const oneGlobe = query.has('globe') ? Number(query.get('globe')) : null;              // ?globe=0|1|2: én kule, helt nær
const oneView = ['top', 'gear', 'follower', 'foot', 'model'].includes(query.get('view')) ? query.get('view') : null;  // én visning per rute, stor
const deg = THREE.MathUtils.degToRad;
const yearDays = M.dateAt(1).getTime() / 86400000 - M.startDate.getTime() / 86400000;
const TC = moonTrain.thickness;

const { renderer, environment } = createRenderer();
const base = createMaterials();
const white = base.white, metal = base.metal;
const red = new THREE.MeshPhysicalMaterial({ color: colors.accent, roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 });
const chainMaterial = new THREE.MeshPhysicalMaterial({
  color: look.chainColor, metalness: look.chainMetalness, roughness: look.chainRoughness,
  clearcoat: look.chainGloss, clearcoatRoughness: look.glossRoughness,
});
const strutMaterial = new THREE.MeshPhysicalMaterial({ color: look.seamColor, metalness: look.seamMetalness, roughness: look.seamRoughness });
const moonMaterial = new THREE.MeshPhysicalMaterial({ color: colors.bodies.moon, roughness: look.roughness, clearcoat: look.gloss, clearcoatRoughness: look.glossRoughness });
const surfaceMaterials = createSurfaceMaterials();

// ------------------------------------------------------------ Hjelpere ---
const { mesh, cyl, rod, ball, addGear, addSprocket, groupAt } = makeHelpers(white);
// Kjedet: ruller og lenkeplater langs banen (som i main.js). Banen ligger i
// gruppens xz-plan med planets y som −z. Gir tilbake en funksjon som flytter leddene.
const plateThickness = 0.12, plateGap = 0.05;
const placer = new THREE.Object3D();
function addChain(parent, chain, y) {
  const rollerHeight = TC + plateGap * 2;
  const rollers = new THREE.InstancedMesh(new THREE.CylinderGeometry(chain.rollerRadius, chain.rollerRadius, rollerHeight, 12), chainMaterial, chain.links);
  const shape = new THREE.Shape();
  const plateEnd = chain.rollerRadius * 1.25;
  shape.absarc(chain.pitch / 2, 0, plateEnd, -Math.PI / 2, Math.PI / 2, false);
  shape.absarc(-chain.pitch / 2, 0, plateEnd, Math.PI / 2, (Math.PI * 3) / 2, false);
  const plateGeometry = new THREE.ExtrudeGeometry(shape, { depth: plateThickness, bevelEnabled: false, curveSegments: 8 });
  plateGeometry.rotateX(-Math.PI / 2);
  const plates = new THREE.InstancedMesh(plateGeometry, chainMaterial, chain.links * 2);
  for (const part of [rollers, plates]) { part.castShadow = true; part.receiveShadow = true; part.frustumCulled = false; parent.add(part); }
  return (offset) => {
    const pts = [];
    for (let i = 0; i < chain.links; i++) pts.push(chain.point(offset + i * chain.pitch));
    for (let i = 0; i < chain.links; i++) {
      const a = pts[i], b = pts[(i + 1) % chain.links];
      placer.position.set(a.x, y - plateGap + rollerHeight / 2, -a.y);
      placer.rotation.set(0, 0, 0);
      placer.updateMatrix();
      rollers.setMatrixAt(i, placer.matrix);
      const outer = i % 2 === 0 ? plateThickness : 0;
      placer.rotation.set(0, Math.atan2(b.y - a.y, b.x - a.x), 0);
      placer.position.set((a.x + b.x) / 2, y + TC + plateGap + outer, -(a.y + b.y) / 2);
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
// En gruppe som står på et punkt på armen (x langs armen).
// Hjul som dreier, til blur.js.
const fast = [];
const track = (group, gears = [], trail = null, extra = []) => fast.push({ group, gears, trail, extra });
const chainBands = [];

// ------------------------------------------------------------ En jordarm ---
const ctx = contextFrom(M);
function buildCell(name) {
  const d = earthDesign(name, ctx);
  const c = d.cell, s = d.stack, g = d.g, top = d.top, H = d.H, L = d.L;
  const root = new THREE.Group();
  const P = ED.P, T = ED.T;

  // --- Ved sentrum: sentralakselen, de innerste rørene, det faste røret med det
  // faste hjulet og parallellhjulet, (T: dagrøret), og jordrøret med armen. ---
  const bottom = s.armY - 3;
  cyl(root, M.tube.fixed.inner, bottom, s.pinionTop + 1.2);                          // Merkur, Venus og sentralakselen (stump)
  const fixedGroup = groupAt(root);
  cyl(fixedGroup, M.tube.fixed.outer, bottom, s.fixedTop);
  addGear(fixedGroup, moonTrain.fixed.teeth, moonTrain.module, TC, M.tube.fixed.outer, s.level1 + TC / 2);
  addSprocket(fixedGroup, moonTrain.parallelSprocket.teeth, M.parallelChain.radius1, M.parallelChain.rollerRadius, M.tube.fixed.outer, s.parallel, 4);
  let earthTubeOuter = M.tube.fixed.outer + 1, dayTube = null;
  if (c.source === 'T') {
    dayTube = groupAt(root);
    cyl(dayTube, d.dayTube.outer, bottom, d.dayTube.top);
    addSprocket(dayTube, T.tubeSprocket, d.dayChain.radius1, d.dayChain.rollerRadius, d.dayTube.outer, s.day, 5);
    earthTubeOuter = d.dayTube.outer + 1;
  }
  cyl(root, earthTubeOuter, bottom, s.armY);
  const armGeo = createArmGeometry({
    length: L, hubRadius: earthTubeOuter + 1, rootHalf: arm.width / 2, endRadius: M.armParts.earth.endRadius,
    fillet: armStyle.fillet, thickness: arm.thickness, chamfer: armStyle.chamfer,
  });
  mesh(root, armGeo).position.y = s.armY;
  cyl(root, earthTubeOuter + 1, s.armY - armStyle.hubRise, s.armTop + armStyle.hubRise);

  // Pinionakselen med pinionen, (P: dagkjedehjulet) og månekjedehjulet.
  const pinion = groupAt(root, M.layout.pinion.x);
  cyl(pinion, moonTrain.pinion.holeRadius, s.armTop, s.pinionTop);
  addGear(pinion, moonTrain.pinion.teeth, moonTrain.module, TC, moonTrain.pinion.holeRadius, s.level1 + TC / 2);
  if (c.source === 'P') addSprocket(pinion, P.pinionSprocket, d.dayChain.radius1, d.dayChain.rollerRadius, moonTrain.pinion.holeRadius, s.day, 5);
  addSprocket(pinion, moonTrain.driveSprocket.teeth, M.moonChain.radius1, M.moonChain.rollerRadius, moonTrain.pinion.holeRadius, s.moonChain, 4)
    .rotation.y = M.phases.moon;

  // Kjedene langs armen.
  const updateMoonChain = addChain(root, M.moonChain, s.moonChain);
  const updateParallelChain = addChain(root, M.parallelChain, s.parallel);
  const updateDayChain = addChain(root, d.dayChain, s.day);
  chainBands.push({ parent: root, chain: d.dayChain, y: s.day, get: () => state.dayOffset });
  chainBands.push({ parent: root, chain: M.moonChain, y: s.moonChain, get: () => state.moonOffset });

  // Ytterst på armen: alt ved jordstolpen (earthBuild.js, som i modellen).
  const built = buildEarthEnd(d, {
    materials: { white, metal, red, strut: strutMaterial },
    moonChain: M.moonChain, parallelChain: M.parallelChain, earthAxisDirection: M.earthAxis.direction,
    moonRadius: bodies.moonRadius,
    addEarth: (group) => group.add(createEarthSurface(surfaceStyle, d.R, surfaceMaterials)),
    addMoon: (group, p) => { const m = mesh(group, new THREE.SphereGeometry(bodies.moonRadius, 32, 16), moonMaterial); m.position.set(p.x, p.y, p.z); },
  });
  built.end.position.x = L;
  root.add(built.end);
  built.spinEntry.extra.push(createSpinBlur(built.tilted, d.R + (surfaceStyle === 'S2' ? ES.S2.height : 0) + 0.015));
  fast.push(...built.fast);

  // --- Oppdatering ---
  const state = { dayOffset: 0, moonOffset: 0 };
  const shaftAt = (a) => {
    if (c.source === 'P') {
      state.dayOffset = d.dayChain.offsetFor(a.pinionAngle);
      const layAngle = d.dayChain.angle2For(state.dayOffset);
      return { layAngle, shaftArm: M.meshAngle(layAngle, P.layGear, P.shaftGear, 0) };
    }
    const tubeArm = -(T.driveTeeth / T.tubeTeeth) * a.driveAngle - a.armAngle;
    state.dayOffset = d.dayChain.offsetFor(tubeArm);
    return { tubeArm, shaftArm: d.dayChain.angle2For(state.dayOffset) };
  };
  const spinFrom = (shaftPar) => {
    if (c.top === 'V') return -(ED.V.shaftTeeth / ED.V.earthTeeth) * shaftPar;
    return d.rate.sign * d.rate.k * shaftPar;
  };
  const a0 = M.anglesAt(0);
  const spin0 = spinFrom(shaftAt(a0).shaftArm - a0.parallelAngle);
  const psi0 = gmst(M.startDate) - Math.PI / 2;                                        // Greenwich-meridianen etter stjernetiden
  const update = (years) => {
    const a = M.anglesAt(years * M.inputPerYear);
    state.last = a;
    pinion.rotation.y = a.pinionAngle;
    fixedGroup.rotation.y = a.fixedAngle;
    state.moonOffset = a.moonChainOffset;
    updateMoonChain(a.moonChainOffset);
    updateParallelChain(a.parallelChainOffset);
    const { layAngle, tubeArm, shaftArm } = shaftAt(a);
    updateDayChain(state.dayOffset);
    if (dayTube) dayTube.rotation.y = tubeArm;
    const shaftPar = shaftArm - a.parallelAngle;
    built.update({ layAngle, shaftArm, parallelAngle: a.parallelAngle, moonAngle: a.moonAngle, spin: psi0 + spinFrom(shaftPar) - spin0 });
  };
  return { root, update, d, state, footAt: built.footAt };
}

// ------------------------------------------------------------- Scenene ---
const names = globesOnly ? [] : Object.keys(ED.cells).filter((n, i) => onlyCell === null || onlyCell === i);
const cells = names.map((name) => {
  const cell = buildCell(name);
  const d = cell.d, L = d.L, H = d.H, R = d.R;
  const center = { x: L, y: H - 5, z: 0 };
  const scene = createLitScene(environment, 30);
  cell.root.position.set(-center.x, -center.y, -center.z);
  scene.add(cell.root);
  const yTop = H + R + 0.8, yLow = d.moonArmY - 0.4;
  const frames = {
    top: { center: { x: L, y: (yTop + yLow) / 2, z: 0 }, radius: (yTop - yLow) / 2 + 0.6 },
    gear: { center: { x: L, y: (d.ringY + H - R) / 2 + 0.3, z: 0 }, radius: (H - R - d.ringY) / 2 + 2.2 },
    follower: { center: { x: L + 3, y: d.ringY, z: 0 }, radius: 1.5, follow: () => cell.footAt() },
    foot: { center: { x: L - 3, y: (d.stack.armY + d.stack.parallel + TC) / 2, z: 0 }, radius: 4.6 },
    model: { center: { x: L * 0.5, y: (d.stack.armY + H) / 2, z: 0 }, radius: L * 0.6 },
  };
  return { name, cell, d, scene, center, frames };
});

// Lysspor, glatte hjul, glatt kule og glatte kjeder.
for (const p of fast) {
  const pieces = p.gears.map((g) => createSmoothGear(g));
  if (p.trail) pieces.push(createTrail(p.group, p.trail));
  pieces.push(...p.extra);
  trackRotation(p.group, pieces);
}
for (const b of chainBands) {
  const over = plateGap + 2 * plateThickness;
  const band = createSmoothChain(b.parent, b.chain, b.y - over, TC + 2 * over, b.chain.rollerRadius * 1.25, chainMaterial);
  trackValue(b.get, Math.min(b.chain.radius1, b.chain.radius2), [band]);
}

// Overflatene: tre jordkuler som spinner sakte.
const globes = (() => {
  const scene = createLitScene(environment, 9);
  const list = ['S1', 'S2', 'S3'].map((style, i) => {
    const tilt = groupAt(scene, (i - 1) * 6.5, 0);
    tilt.rotation.z = -deg(23.44);
    const spinG = groupAt(tilt);
    spinG.add(createEarthSurface(style, 2, surfaceMaterials));
    cyl(spinG, 0.15, -2.6, 2.6);
    return { style, spin: spinG };
  });
  // Ortografisk, så alle tre viser den samme siden av jorda.
  return { scene, list, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200) };
})();

// --- Tekstene ---
const overlay = document.createElement('div');
document.body.appendChild(overlay);
const makeText = (html, style) => {
  const el = document.createElement('div');
  el.innerHTML = html;
  Object.assign(el.style, {
    position: 'fixed', pointerEvents: 'none', color: look.gearColor, textShadow: '0 1px 3px #000',
    font: '500 14px/1.35 system-ui, sans-serif', ...style,
  });
  overlay.appendChild(el);
  return el;
};
const n2 = (x) => x.toFixed(2).replace('.', ',');
const n4 = (x) => x.toFixed(4).replace('.', ',');
const labels = {
  P: 'drivet fra pinionakselen', T: 'drivet fra et dagrør i tårnet',
  V: 'vinkelgir', K: 'kryssledd og tannhjulspar',
  G1: 'smal ring', G2: 'rund ring', G3: 'skrå skive',
  F1: 'gaffel med ruller', F2: 'glidesko',
};
for (const c of cells) {
  const x = c.d.cell;
  const follower = x.follower === 'F1' && x.guide === 'G3' ? 'gaffel med kuler' : labels[x.follower];
  const idler = c.d.top.idler ? ' med mellomhjul (rød ring)' : '';
  c.titleEl = makeText(`${c.name}: ${x.source} + ${x.top} + ${x.guide} + ${x.follower}<br><small style="opacity:.75">${labels[x.source]}, ${labels[x.top]}${idler}, ${labels[x.guide]}, ${follower}</small>`, { textAlign: 'center', transform: 'translate(-50%, 0)' });
  c.views = [
    { key: 'top', label: 'Jordstolpen' },
    { key: 'gear', label: c.d.cell.top === 'V' ? 'Vinkelgiret og ringen' : 'Kryssleddet, hjulene og ringen' },
    { key: 'follower', label: 'Foten på ringen (følger månen)' },
    { key: 'foot', label: c.d.cell.source === 'P' ? 'Foten av stolpen: kjedet og hjulparet' : 'Foten av stolpen: kjedet' },
    { key: 'model', label: 'Hele jordarmen', model: true },
  ].map((v) => ({ ...v, frame: c.frames[v.key], camera: new THREE.PerspectiveCamera(30, 1, 0.1, 2000), el: makeText(v.label, { font: '12px/1.35 system-ui, sans-serif', opacity: 0.6 }) }));
  c.infoEl = makeText('', { font: '12.5px/1.45 system-ui, sans-serif', fontVariantNumeric: 'tabular-nums' });
}
const globeTitle = makeText('', { font: '12.5px/1.4 system-ui, sans-serif' });
const globeLabels = ['S1: innlagte kontinenter', 'S2: opphøyde kontinenter', `S3: fasetter (${ES.S3.subdivisions} hjørner)`].map((t) => makeText(t, { textAlign: 'center', transform: 'translate(-50%, 0)', font: '12.5px system-ui, sans-serif' }));
const footer = makeText('', { left: '50%', bottom: '8px', transform: 'translate(-50%, 0)', font: '12px system-ui, sans-serif', opacity: 0.7, whiteSpace: 'nowrap' });

const clearance = {};
function writeInfo() {
  for (const c of cells) {
    const d = c.d, r = d.rate, x = d.cell;
    const cl = clearance[c.name];
    const clText = !cl ? 'regnes …' : cl.fails ? `<b>${n2(cl.min.gap)}, ${cl.fails} par under 0,3</b>` : `${n2(cl.min.gap)} (alt minst 0,3)${cl.shoe ? ', unntatt glideskoen rundt stagene' : ''}`;
    const tower = x.source === 'T'
      ? '<br>Tårnet: nytt rør og hjulplan (+1,30). Rørene utenfor blir 1 tykkere, så kjedehjulene ved sentrum for Jupiter, Neptun og par-uranus må få flere tenner.'
      : '';
    c.infoEl.innerHTML = [
      `Døgnet: <b>${r.siderealDay.toFixed(6).replace('.', ',')}</b> dager (mål ${String(ED.siderealDay).replace('.', ',')}, ${r.error >= 0 ? '+' : ''}${n4(r.error)} %). Driveakselen ${Math.abs(r.shaft).toFixed(1).replace('.', ',')} runder per år, ×${n2(r.k)} ved jorda.`,
      `Jordas sentrum: <b>${n2(d.H)}</b> (${d.Hrise >= 0 ? '+' : ''}${n2(d.Hrise)} mot i dag). Armene innenfor jorda løftes ${n2(d.stack.rise)}.${tower}`,
      `Nye deler: <b>${d.count}</b>. Fjernes: ${removed.join(', ')}.`,
      `Minste klaring: ${clText}`,
    ].join('<br>');
  }
  globeTitle.innerHTML = `Overflaten på jordarmene: <b>${surfaceStyle}</b> (?surface=S1|S2|S3). Havet ${colors.bodies.earth}, land ${colors.bodies.earthLand}, is ${colors.bodies.earthIce}.`;
}
writeInfo();
function checkClearance() {
  const named = (x) => `${x.body} ${x.name}`;
  let i = 0;
  const next = () => {
    const c = cells[i++];
    if (!c) return;
    let shoe = false;
    const skip = (a, b) => {
      const pair = [named(a), named(b)].sort().join('|');
      if ((a.rests && b.guide) || (b.rests && a.guide)) return true;
      if ([a.body, b.body].sort().join('|') === 'driveaksel|skrå aksel') return true;
      const shoeSide = (x) => x.shoe || (c.d.cell.follower === 'F2' && x.name === 'fot');
      if ((shoeSide(a) && /^stolpe stag/.test(named(b))) || (shoeSide(b) && /^stolpe stag/.test(named(a)))) { shoe = true; return true; }
      if (pair === 'driveaksel driveaksel|stolpe brakett 1') return true;
      return (a.holds ?? []).includes(b.body) || (b.holds ?? []).includes(a.body);
    };
    const fails = run3D(c.name, `Rute ${c.name}`, toCheckParts(earthParts(c.d, 16)), skip);
    clearance[c.name] = { fails, shoe, min: Object.values(lastMinimum).reduce((m, r) => (r.gap < m.gap ? r : m), { gap: Infinity }) };
    writeInfo();
    setTimeout(next, 30);
  };
  next();
}

// --- Plasseringen av rutene ---
const header = 50;
let globeRect = null;
function modelDistance(armLength, H) {
  const outer = M.armLengths.neptune + 4, modelHeight = H + bodies.sunRadius;
  const vFov = deg(40), hFov = 2 * Math.atan(Math.tan(vFov / 2) * (window.innerWidth / window.innerHeight));
  const distance = (Math.hypot(outer, modelHeight / 2) * 0.9) / Math.sin(Math.min(vFov, hFov) / 2);
  const cam = new THREE.Vector3(55, 65, 75).normalize().multiplyScalar(distance).add({ x: 0, y: modelHeight * 0.1, z: 0 });
  let sum = 0;
  for (let i = 0; i < 72; i++) { const a = (i / 72) * Math.PI * 2; sum += cam.distanceTo({ x: armLength * Math.cos(a), y: H, z: armLength * Math.sin(a) }); }
  return sum / 72;
}
function placeCells() {
  const W = window.innerWidth, Hh = window.innerHeight - 26;
  const globeH = globesOnly ? Hh : oneView ? 0 : Math.round(Hh * 0.24);
  const cellH = Hh - globeH;
  const columns = Math.max(1, cells.length), cellW = W / columns;
  cells.forEach((c, i) => {
    const x0 = i * cellW, y0 = 0;
    const inner = cellH - header - 112;
    const bigH = inner * 0.66, lowH = inner - bigH;
    const [topV, gearV, followV, footV, modelV] = c.views;
    topV.rect = { x: x0, y: y0 + header, w: cellW * 0.52, h: bigH };
    gearV.rect = { x: x0 + cellW * 0.52, y: y0 + header, w: cellW * 0.48, h: bigH * 0.36 };
    followV.rect = { x: x0 + cellW * 0.52, y: y0 + header + bigH * 0.36, w: cellW * 0.48, h: bigH * 0.32 };
    footV.rect = { x: x0 + cellW * 0.52, y: y0 + header + bigH * 0.68, w: cellW * 0.48, h: bigH * 0.32 };
    modelV.rect = { x: x0, y: y0 + header + bigH, w: cellW, h: lowH };
    modelV.distance = modelDistance(c.d.L, c.d.H);
    if (oneView) {
      // Bare én visning, over hele ruta (utenom tallene nederst).
      for (const v of c.views) v.rect = v.key === oneView ? { x: x0, y: y0 + header, w: cellW, h: inner } : { x: 0, y: 0, w: 0, h: 0 };
    }
    Object.assign(c.titleEl.style, { left: `${x0 + cellW / 2}px`, top: `${y0 + 6}px` });
    for (const v of c.views) {
      v.el.style.display = v.rect.w ? '' : 'none';
      Object.assign(v.el.style, { left: `${v.rect.x + 8}px`, top: `${v.rect.y + 3}px` });
      if (v.model) v.el.textContent = `${v.label} (fra ${Math.round(v.distance)} mm, som i modellen)`;
    }
    Object.assign(c.infoEl.style, { left: `${x0 + 12}px`, top: `${y0 + header + inner + 4}px`, width: `${cellW - 24}px` });
  });
  globeRect = { x: 0, y: cellH, w: W, h: globeH };
  Object.assign(globeTitle.style, { left: '12px', top: `${cellH + 6}px` });
  for (const el of [globeTitle, ...globeLabels]) el.style.display = globeH ? '' : 'none';
}
placeCells();
window.addEventListener('resize', () => { renderer.setSize(window.innerWidth, window.innerHeight); placeCells(); });

// --- Kameraene: sakte rundt, og opp og ned; dra for å snu ---
let running = !query.has('stop');
let time = Number(query.get('t')) || 0, turnOffset = 0, heightOffset = 0, press = null;
const canvas = renderer.domElement;
canvas.style.cursor = 'grab';
canvas.addEventListener('pointerdown', (e) => { press = { x: e.clientX, y: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
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
canvas.addEventListener('pointerup', () => { if (press && !press.moved) running = !running; press = null; canvas.style.cursor = 'grab'; });

const direction = new THREE.Vector3();
function aim(camera, rect, target, distance, fov, radius) {
  camera.aspect = rect.w / rect.h;
  camera.fov = fov;
  camera.near = Math.max(0.1, distance - radius * 3);
  camera.far = distance + radius * 4;
  camera.updateProjectionMatrix();
  camera.position.copy(direction).multiplyScalar(distance).add(target);
  camera.lookAt(target.x, target.y, target.z);
}
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const pageColor = (y) => {
  const f = THREE.MathUtils.clamp(y / window.innerHeight, 0, 1);
  const [a, b] = [rgb(look.backgroundTop), rgb(look.backgroundBottom)];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * f)).join(' ')})`;
};
const backgrounds = new Map();
function backgroundFor(rect) {
  const key = `${Math.round(rect.y)}|${Math.round(rect.h)}`;
  if (!backgrounds.has(key)) {
    const cnv = document.createElement('canvas');
    cnv.width = 1;
    cnv.height = 256;
    const ctx = cnv.getContext('2d');
    const gr = ctx.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, pageColor(rect.y));
    gr.addColorStop(1, pageColor(rect.y + rect.h));
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 1, 256);
    const tex = new THREE.CanvasTexture(cnv);
    tex.colorSpace = THREE.SRGBColorSpace;
    backgrounds.set(key, tex);
  }
  return backgrounds.get(key);
}
function draw(scene, camera, r) {
  const Hh = window.innerHeight;
  scene.background = backgroundFor(r);
  renderer.setViewport(r.x, Hh - r.y - r.h, r.w, r.h);
  renderer.setScissor(r.x, Hh - r.y - r.h, r.w, r.h);
  renderer.render(scene, camera);
}

renderer.setScissorTest(true);
let last = null, frames = 0;
let sizeSeen = '';
renderer.setAnimationLoop((now) => {
  // Følg med på vindusstørrelsen (noen nettlesere sender ikke resize når vinduet åpnes).
  const size = `${window.innerWidth}x${window.innerHeight}`;
  if (size !== sizeSeen) { sizeSeen = size; renderer.setSize(window.innerWidth, window.innerHeight); placeCells(); }
  const seconds = last === null ? 0 : Math.min((now - last) / 1000, 0.1);
  last = now;
  if (running) time += seconds;
  const days = time * daysPerSecond;
  for (const c of cells) c.cell.update(days / yearDays);
  updateBlur();

  const around = deg((360 * time) / 70 + 35 + turnOffset);
  const swing = (1 - Math.cos((2 * Math.PI * time) / 23)) / 2;
  const height = deg(THREE.MathUtils.clamp(10 + 25 * swing + heightOffset, -80, 89));
  direction.set(Math.cos(height) * Math.sin(around), Math.sin(height), Math.cos(height) * Math.cos(around));
  const date = M.dateAt(days / yearDays);
  footer.textContent = `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC · ${daysPerSecond} dager per sekund · klikk stopper eller starter · dra for å snu · ?cell=0|1|2, ?speed=2, ?surface=S2`;

  const Hh = window.innerHeight;
  for (const c of cells) for (const v of c.views) {
    if (!v.rect.w) continue;
    const r = v.rect, f = v.frame;
    const at = f.follow ? f.follow() : f.center;
    const target = new THREE.Vector3(at.x - c.center.x, at.y - c.center.y, at.z - c.center.z);
    if (v.model) {
      const fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(deg(20)) * (r.h / Hh)));
      aim(v.camera, r, target, v.distance, fov, f.radius);
    } else {
      const vFov = deg(30), hFov = 2 * Math.atan(Math.tan(vFov / 2) * (r.w / r.h));
      aim(v.camera, r, target, f.radius / Math.sin(Math.min(vFov, hFov) / 2), 30, f.radius);
    }
    draw(c.scene, v.camera, r);
  }
  if (!globeRect.h) { frames++; if (frames === 3) setTimeout(checkClearance, 0); return; }
  // Kulene nederst: sakte rundt (en runde på 24 s), uavhengig av farten over.
  for (const gl of globes.list) gl.spin.rotation.y = (2 * Math.PI * time) / 24;
  const gr = globeRect, cam = globes.camera;
  const halfH = oneGlobe === null ? Math.max(3.3, 10.2 / (gr.w / gr.h)) : 2.9;          // tre kuler i bredden, eller én helt nær
  const gx = oneGlobe === null ? 0 : (oneGlobe - 1) * 6.5;
  Object.assign(cam, { left: -halfH * (gr.w / gr.h), right: halfH * (gr.w / gr.h), top: halfH, bottom: -halfH });
  cam.position.set(gx, 40 * Math.sin(deg(10)) + 0.3, 40 * Math.cos(deg(10)));
  cam.lookAt(gx, 0.3, 0);
  cam.updateProjectionMatrix();
  draw(globes.scene, globes.camera, gr);
  globes.list.forEach((gl, i) => {
    const p = new THREE.Vector3((i - 1) * 6.5, -2.4, 0).project(globes.camera);
    Object.assign(globeLabels[i].style, { left: `${gr.x + ((p.x + 1) / 2) * gr.w}px`, top: `${gr.y + ((1 - p.y) / 2) * gr.h}px` });
  });
  frames++;
  if (frames === 3) setTimeout(checkClearance, 0);
});
