// Jordstolpen i three.js, fra en utforming i earthDesign.js: forlegsakselen og
// driveakselen ved foten, parallellhjulet og stolperøret, føringsringen,
// braketten, overgangen til jordaksen, jorda som roterer, og månen med staven og
// foten som følger ringen. Brukes av modellen (main.js) og prøvesiden (earthTest.js),
// så begge tegner det samme.
//
// Gruppen `end` står ytterst på jordarmen (armens koordinater, origo på
// loddlinjen gjennom stolpen). Monteringsrammen (x dit jordaksen heller) står
// inni parallellgruppa, dreid earthAxisDirection.
import * as THREE from 'three';
import { armStyle, accent, gear as gearStyle, moonTrain, earthDay as ED, moonGuide as MG } from './config.js';
import { createGearGeometry, createBevelGeometry, createSprocketGeometry } from './gear.js';
import { createArmGeometry } from './arm.js';

const TC = moonTrain.thickness;
const upAxis = new THREE.Vector3(0, 1, 0);

// Små byggeklosser med et standardmateriale (hvit lakk).
export function makeHelpers(white) {
  const mesh = (parent, geometry, material = white) => {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const cyl = (parent, r, y0, y1, material = white, x = 0, z = 0) => {
    const m = mesh(parent, new THREE.CylinderGeometry(r, r, Math.max(1e-3, y1 - y0), 32), material);
    m.position.set(x, (y0 + y1) / 2, z);
    return m;
  };
  const rod = (parent, a, b, r, material = white) => {
    const A = new THREE.Vector3(a.x, a.y, a.z ?? 0), B = new THREE.Vector3(b.x, b.y, b.z ?? 0);
    const m = mesh(parent, new THREE.CylinderGeometry(r, r, A.distanceTo(B), 16), material);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(upAxis, B.clone().sub(A).normalize());
    return m;
  };
  const ball = (parent, p, r, material = white) => {
    const m = mesh(parent, new THREE.SphereGeometry(r, 24, 12), material);
    m.position.set(p.x, p.y, p.z ?? 0);
    return m;
  };
  // Myk overgang: en kjegle fra radius 2r ved a til r, fillet langs retningen mot b.
  const flare = (parent, a, b, r, fillet, material = white) => {
    const A = new THREE.Vector3(a.x, a.y, a.z ?? 0), B = new THREE.Vector3(b.x, b.y, b.z ?? 0);
    const dir = B.clone().sub(A).normalize();
    const m = mesh(parent, new THREE.CylinderGeometry(r, 2 * r, fillet, 24), material);
    m.position.copy(A).addScaledVector(dir, fillet / 2);
    m.quaternion.setFromUnitVectors(upAxis, dir);
  };
  const gearSettings = (teeth, module, thickness, hole) => {
    const pitch = (module * teeth) / 2;
    const spokes = pitch > 1.4 ? (teeth >= 40 ? 5 : 4) : 0;
    return {
      teeth, module, pressureAngle: gearStyle.pressureAngle, backlash: module * 0.15, holeRadius: hole,
      spokes, spokeWidth: Math.max(0.2, pitch * 0.16), hubWidth: Math.max(0.15, pitch * 0.12), rimWidth: Math.max(0.15, pitch * 0.13),
      thickness, chamfer: Math.min(0.08, thickness * 0.2),
    };
  };
  // Tannhjul med midten i høyden y (langs gruppens y).
  const addGear = (parent, teeth, module, thickness, hole, y, material = white) => {
    const m = mesh(parent, createGearGeometry(gearSettings(teeth, module, thickness, hole)), material);
    m.position.y = y - thickness / 2;
    return m;
  };
  // Konisk hjul med midten i y; toppunktet ligger apex over midten.
  const addBevel = (parent, teeth, module, thickness, hole, y, apex) => {
    const m = mesh(parent, createBevelGeometry(gearSettings(teeth, module, thickness, hole), apex));
    m.position.y = y;
    return m;
  };
  // Kjedehjul med undersiden i y.
  const addSprocket = (parent, teeth, pitchRadius, rollerRadius, hole, y, spokes = null) => {
    const m = mesh(parent, createSprocketGeometry({
      teeth, pitchRadius, rollerRadius, holeRadius: hole,
      spokes: spokes ?? (pitchRadius > 2.5 ? 5 : 0), spokeWidth: Math.max(0.5, pitchRadius * 0.12), hubWidth: 0.5, rimWidth: 0.5,
      thickness: TC, chamfer: Math.min(moonTrain.chamfer, rollerRadius * 0.4),
    }));
    m.position.y = y;
    return m;
  };
  const groupAt = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  return { mesh, cyl, rod, ball, flare, addGear, addBevel, addSprocket, groupAt };
}

// Føringsringen G1: et bånd med loddrette sider rundt stolpen.
function bandGeometry(d) {
  const g = d.g, N = 192, pos = [], idx = [];
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let k = 0; k <= N; k++) {
    const phi = (2 * Math.PI * k) / N;
    for (const [cr, cy] of corners) { const p = d.ringAt(phi, (cr * g.w) / 2, (cy * g.h) / 2); pos.push(p.x, p.y, p.z); }
  }
  for (let k = 0; k < N; k++) for (let c = 0; c < 4; c++) {
    const a = k * 4 + c, b = k * 4 + ((c + 1) % 4);
    idx.push(a, a + 4, b, b, a + 4, b + 4);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setIndex(idx);
  const flat = geometry.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}
// G2: et rør langs midtlinjen.
class RingCurve extends THREE.Curve {
  constructor(d) { super(); this.d = d; }
  getPoint(t, target = new THREE.Vector3()) { const p = this.d.ringAt(2 * Math.PI * t); return target.set(p.x, p.y, p.z); }
}
// G3: en flat skive med vinduer, skjevet inn i det skrå planet.
function discGeometry(d) {
  const g = d.g, G3 = MG.G3, rIn = d.hubR, rOut = g.outer;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, rOut, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, rIn, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const w0 = rIn + 0.35, w1 = g.rc - 0.35, n = G3.windows, half = Math.PI / n - 0.28;
  for (let k = 0; k < n; k++) {
    const c = Math.PI / 2 + (2 * Math.PI * k) / n;
    const win = new THREE.Path();
    win.absarc(0, 0, w0, c + half * (w1 / w0) * 0.55, c - half * (w1 / w0) * 0.55, true);
    win.absarc(0, 0, w1, c - half, c + half, false);
    win.closePath();
    shape.holes.push(win);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: G3.thickness - 2 * G3.chamfer, bevelEnabled: true, bevelThickness: G3.chamfer, bevelSize: G3.chamfer, bevelOffset: -G3.chamfer, bevelSegments: 1, curveSegments: 64,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -G3.thickness / 2 + G3.chamfer, 0);
  // Skjev: y += lift(φ) · r / rc, der lift(φ) = K sin(φ − node), x = r cos φ, z = −r sin φ.
  const p = geometry.attributes.position, k = d.K / g.rc;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + d.ringY + k * (-p.getZ(i) * Math.cos(d.node) - p.getX(i) * Math.sin(d.node)));
  p.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}
// F2: en C-formet sko rundt den runde ringen, åpen innover.
function shoeGeometry(d) {
  const g = d.g, F2 = MG.F2;
  const open = (F2.opening * Math.PI) / 360;
  const shape = new THREE.Shape();
  const a0 = -Math.PI + open, a1 = Math.PI - open;
  shape.absarc(0, 0, g.shoeOut, a0, a1, false);
  shape.absarc(0, 0, g.shoeIn, a1, a0, true);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: F2.length, bevelEnabled: false, curveSegments: 24 });
  geometry.translate(0, 0, -F2.length / 2);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const r = g.rc + p.getX(i), y = p.getY(i), phi = -p.getZ(i) / g.rc;
    p.setXYZ(i, r * Math.cos(phi), y, -r * Math.sin(phi));
  }
  geometry.computeVertexNormals();
  return geometry;
}

// Bygger alt ytterst på jordarmen. opts:
//   materials: { white, metal, red, strut }
//   moonChain, parallelChain: kjedene langs armen (radiene til kjedehjulene ved jorda)
//   earthAxisDirection: vinkelen monteringsrammen står i på parallellhjulet
//   addEarth(group): legger jorda (overflaten) i gruppa som roterer
//   addMoon(group, position): legger månen i glidebiten
// Gir tilbake gruppene, delene som går fort (til blur.js), update(vinkler) og footAt().
export function buildEarthEnd(d, opts) {
  const { white, metal, red, strut } = opts.materials;
  const { mesh, cyl, rod, ball, flare, addGear, addBevel, addSprocket, groupAt } = makeHelpers(white);
  const c = d.cell, s = d.stack, g = d.g, top = d.top, H = d.H, L = d.L;
  const P = ED.P, T = ED.T;
  const end = new THREE.Group();
  const fast = [];
  const track = (group, gears = [], trail = null, extra = []) => fast.push({ group, gears, trail, extra });

  // P: forlegsakselen på armen, med tannhjulet og kjedehjulet til dagkjedet.
  let layGroup = null;
  if (c.source === 'P') {
    layGroup = groupAt(end, d.lay.x - L);
    cyl(layGroup, d.lay.shaftR, s.armTop, d.lay.top);
    const C = addGear(layGroup, P.layGear, P.module, ED.shaftGearThickness, d.lay.shaftR, s.level1 + ED.shaftGearThickness / 2);
    const spr = addSprocket(layGroup, P.laySprocket, d.dayChain.radius2, d.dayChain.rollerRadius, d.lay.shaftR, s.day);
    track(layGroup, [C, spr]);
  }

  // Driveakselen (dreier sett fra armen), med tannhjulet (P) eller kjedehjulet (T) nederst.
  const shaft = groupAt(end);
  cyl(shaft, d.dsR, d.shaftBottom, c.top === 'K' ? top.K.y : d.shaftTop);
  let shaftGear;
  if (c.source === 'P') {
    cyl(end, d.dsR + 0.25, s.armTop, s.armTop + 0.15);                               // lageret i armen
    shaftGear = addGear(shaft, P.shaftGear, P.module, ED.shaftGearThickness, d.dsR, s.level1 + ED.shaftGearThickness / 2);
  } else {
    // Kragen og den røde ringen der driveakselen kommer opp av armen.
    const postR = d.dsR + 0.15;
    const collar = mesh(end, new THREE.CylinderGeometry(postR + armStyle.collarWidth * 0.25, postR + armStyle.collarWidth, armStyle.collarHeight, 32));
    collar.position.y = s.armTop + armStyle.collarHeight / 2;
    const ring = mesh(end, new THREE.TorusGeometry(postR + accent.ringWidth / 2, accent.ringWidth / 2, 12, 48), red);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = s.armTop + armStyle.collarHeight + accent.ringWidth / 2;
    shaftGear = addSprocket(shaft, T.shaftSprocket, d.dayChain.radius2, d.dayChain.rollerRadius, d.dsR, s.day);
  }
  track(shaft, [shaftGear]);

  // Parallellhjulet og stolperøret (står stille i rommet), og monteringsrammen.
  const parallel = groupAt(end);
  addSprocket(parallel, moonTrain.parallelSprocket.teeth, opts.parallelChain.radius2, opts.parallelChain.rollerRadius, d.frameOuter, s.parallel, 4);
  cyl(parallel, d.frameOuter, d.frameBottom, d.frameTop);
  const mount = groupAt(parallel);
  mount.rotation.y = opts.earthAxisDirection;

  // Navet, stagene og ringen.
  cyl(mount, d.hubR, d.hubY0, d.hubY1);
  for (const [a, b] of d.struts) { rod(mount, a, b, MG.strutRadius, strut); ball(mount, b, MG.strutRadius * 1.3, strut); }
  if (g.kind === 'G1') mesh(mount, bandGeometry(d));
  else if (g.kind === 'G2') mesh(mount, new THREE.TubeGeometry(new RingCurve(d), 256, g.rt, 16, true));
  else mesh(mount, discGeometry(d));

  // Braketten fra stolperøret til lageret (V) eller platen (K).
  const bp = d.bracket, br = ED.bracket.radius;
  for (let i = 0; i < bp.length - 1; i++) rod(mount, bp[i], bp[i + 1], br);
  for (const p of bp.slice(1, -1)) ball(mount, p, br);
  flare(mount, bp[0], bp[1], br, ED.bracket.fillet);

  // Rundt jordaksen: y i gruppen er aksen (s fra jordas sentrum), x er e1 (mot drivet).
  const tilted = groupAt(mount, 0, H);
  tilted.rotation.z = -d.tilt;
  const spin = groupAt(tilted);
  opts.addEarth(spin);
  cyl(spin, d.spR, ...top.spindle);
  ball(spin, { x: 0, y: top.spindle[1], z: 0 }, d.spR * 1.6);                         // tuppen over nordpolen
  const turning = { vertical: null, tiltedShaft: null, idler: null, cross: null };
  let earthGear;
  if (c.top === 'V') {
    const V = ED.V;
    earthGear = addBevel(spin, V.earthTeeth, V.module, V.faceWidth, d.spR, top.sE, -top.sE);
    cyl(tilted, d.spR + ED.bearing.wall, ...top.bearing);
    turning.vertical = groupAt(mount);
    const vGear = addBevel(turning.vertical, V.shaftTeeth, V.module, V.faceWidth, d.dsR, top.yV, top.dropV);
    track(turning.vertical, [vGear]);
  } else {
    const kk = ED.K[c.source], Tk = top.Tk;
    earthGear = addGear(spin, kk.smallTeeth, top.m, Tk, d.spR, top.sG);
    // Platen med de to lagrene: to øyne og en bro imellom.
    for (const x of [0, top.dK]) {
      const eye = mesh(tilted, new THREE.CylinderGeometry(top.eyeR, top.eyeR, top.pt, 32));
      eye.position.set(x, top.sP, 0);
    }
    const bridge = mesh(tilted, new THREE.BoxGeometry(top.dK, top.pt, top.eyeR * 1.5));
    bridge.position.set(top.dK / 2, top.sP, 0);
    // Den skrå drivakselen med det store hjulet.
    turning.tiltedShaft = groupAt(tilted, top.dK);
    cyl(turning.tiltedShaft, top.tiltedR, top.tilted[0], top.tilted[1] + 0.05);
    const big = addGear(turning.tiltedShaft, kk.bigTeeth, top.m, Tk, top.tiltedR, top.sG);
    track(turning.tiltedShaft, [big]);
    // Kryssleddet: kule og kors som dreier med akslene.
    const joint = groupAt(mount, 0, top.K.y);
    joint.quaternion.setFromUnitVectors(upAxis, new THREE.Vector3(0, 1, 0).add(new THREE.Vector3(Math.sin(d.tilt), Math.cos(d.tilt), 0)).normalize());
    ball(joint, { x: 0, y: 0, z: 0 }, top.jr * 0.55, metal);
    turning.cross = groupAt(joint);
    for (const [rx, rz] of [[0, Math.PI / 2], [Math.PI / 2, 0]]) {
      const pin = mesh(turning.cross, new THREE.CylinderGeometry(0.05, 0.05, top.jr * 2, 12));
      pin.rotation.set(rx, 0, rz);
    }
    // Mellomhjulet (T): på en tapp fra platen, med rød ring.
    if (top.idler) {
      const I = top.idler;
      cyl(tilted, I.pinR, top.sG - Tk / 2 - 0.05, top.sP, white, I.ix, I.iz);
      rod(tilted, { x: top.eyeR * 0.7, y: top.sP, z: Math.sign(I.iz) * top.eyeR * 0.6 }, { x: I.ix, y: top.sP, z: I.iz }, top.pt / 2);
      turning.idler = groupAt(tilted, I.ix, 0, I.iz);
      const ig = addGear(turning.idler, kk.idlerTeeth, top.m, Tk, I.pinR, top.sG);
      const mark = mesh(turning.idler, new THREE.TorusGeometry(I.rI * 0.6, 0.05, 10, 40), red);
      mark.rotation.x = Math.PI / 2;
      mark.position.y = top.sG + Tk / 2 + 0.04;
      track(turning.idler, [ig]);
    }
  }
  const spinEntry = { group: spin, gears: [earthGear], trail: null, extra: [] };
  fast.push(spinEntry);

  // Månen: røret, kjedehjulet, armen og hylsa dreier om stolpen.
  const moon = groupAt(end);
  cyl(moon, d.moonTubeOuter, s.moonChain, d.moonTubeTop);
  addSprocket(moon, moonTrain.moonSprocket.teeth, opts.moonChain.radius2, opts.moonChain.rollerRadius, d.moonTubeOuter, s.moonChain, 0);
  const A = MG.arm;
  mesh(moon, createArmGeometry({ length: d.orbit, hubRadius: d.moonTubeOuter + 0.05, rootHalf: A.rootHalf, endRadius: MG.sleeveRadius + 0.08, fillet: A.fillet, thickness: A.thickness, chamfer: A.chamfer }))
    .position.y = d.moonArmY;
  cyl(moon, MG.sleeveRadius, d.moonArmTop, d.sleeveTop, white, d.orbit);
  // Staven, foten og månen løftes etter ringen (glidebiten).
  const slider = groupAt(moon);
  cyl(slider, MG.pinRadius, d.moonArmY + d.pinBelow + d.K, H, white, d.orbit);
  opts.addMoon(slider, { x: d.orbit, y: H, z: 0 });
  rod(slider, { x: g.footFrom - 0.02, y: d.ringY, z: 0 }, { x: d.orbit, y: d.ringY, z: 0 }, MG.footRadius);
  const rollers = [];
  if (g.follower === 'F1') {
    const F1 = MG.F1;
    const bar = mesh(slider, new THREE.BoxGeometry(F1.barWidth, 2 * g.barHalf, F1.barWidth * 1.6));
    bar.position.set(g.barR, d.ringY, 0);
    for (const k of [1, -1]) {
      const y = d.ringY + k * g.rollerCenter;
      rod(slider, { x: g.barInner, y, z: 0 }, { x: g.rc - F1.rollerWidth / 2 - 0.02, y, z: 0 }, F1.axleRadius, metal);
      const holder = groupAt(slider, g.rc, y);
      if (g.balls) mesh(holder, new THREE.SphereGeometry(F1.rollerRadius, 24, 12), metal);
      else {
        const roller = mesh(holder, new THREE.CylinderGeometry(F1.rollerRadius, F1.rollerRadius, F1.rollerWidth, 24), metal);
        roller.rotation.z = Math.PI / 2;                                             // aksen radielt
        // Et merke på rullen, så man ser at den ruller.
        const mark = mesh(holder, new THREE.BoxGeometry(F1.rollerWidth * 1.02, 0.03, 0.03), white);
        mark.position.y = F1.rollerRadius * 0.98;
      }
      rollers.push({ holder, sign: k });
    }
  } else {
    const shoe = mesh(slider, shoeGeometry(d), metal);
    shoe.position.y = d.ringY;
  }
  track(moon, [], { radius: d.orbit, y: H, tube: opts.moonRadius * 0.35 });

  // Vinklene (alle sett fra armen): parallelAngle, moonAngle, shaftArm (driveakselen),
  // layAngle (forlegsakselen, P) og spin (jorda om sin akse, i den skrå gruppa).
  const state = {};
  const update = (a) => {
    state.last = a;
    if (layGroup) layGroup.rotation.y = a.layAngle;
    shaft.rotation.y = a.shaftArm;
    parallel.rotation.y = a.parallelAngle;
    const shaftPar = a.shaftArm - a.parallelAngle;
    if (turning.vertical) turning.vertical.rotation.y = shaftPar;
    if (turning.tiltedShaft) turning.tiltedShaft.rotation.y = shaftPar;
    if (turning.cross) turning.cross.rotation.y = shaftPar;
    if (turning.idler) turning.idler.rotation.y = -(ED.K[c.source].bigTeeth / ED.K[c.source].idlerTeeth) * shaftPar;
    spin.rotation.y = a.spin;
    moon.rotation.y = a.moonAngle;
    const phi = a.moonAngle - a.parallelAngle - opts.earthAxisDirection;            // månearmen i monteringsrammen
    slider.position.y = d.lift(phi);
    for (const r of rollers) r.holder.rotation.x = (r.sign * g.rc * phi) / MG.F1.rollerRadius;
  };
  // Hvor foten står nå (armens koordinater), til et kamera som følger den.
  const footAt = () => {
    const a = state.last;
    if (!a) return { x: L + g.rc, y: d.ringY, z: 0 };
    const r = (g.rc + g.footFrom) / 2;
    return { x: L + r * Math.cos(a.moonAngle), y: d.ringY + slider.position.y, z: -r * Math.sin(a.moonAngle) };
  };
  return { end, layGroup, shaft, parallel, mount, tilted, spin, spinEntry, moon, slider, fast, update, footAt };
}
