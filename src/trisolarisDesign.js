// Trisolaris (testsiden trisolaris.html): tre soler i åttetallsbanen på hver
// sin sleidemaskin, og en planet på en ring rundt alle tre. Ren matematikk
// uten three.js, som earthDesign.js: målene, nivåene, tennene, modulene og
// fasene, og én liste over alle delene (parts) som både tegningen
// (trisolarisBuild.js) og sjekken (scripts/checkTrisolaris.mjs) bruker.
//
// Koordinater som i three.js: y er opp, banen ligger i planet xz med lengden
// langs x. Vinklene er rotation.y: vinkelen ψ peker mot (cos ψ, 0, −sin ψ).
// θ går én runde (2π) per runde i åttetallet.
//
// Sleidemaskinen (lik for alle tre, i maskinens eget plan med utgangen i O):
//   X-tårnet står i (0, dX) og sveiver X-sleiden, en slisset stang langs z som
//   glir i x på to skinner. Sveivtappen og utgangstappen går i samme sliss.
//   Y-tårnet står i (dY, 0) og sveiver Y-sleiden, en slisset stang langs x som
//   glir i z, ett nivå over. Utgangstappen går gjennom begge slissene.
//   Hjultoget nederst (X-hjul, mellomhjul, Y-hjul) gir Y-tårnet dobbel fart.
//   Med korreksjonshjul sitter sveivtappen eksentrisk på en skive over et
//   planethjul, som ruller rundt et fast hjul på tårnet (en episykel).
// Hvor maskinene står (bevist i figureEight.js og med sjekken):
//   B: utgangen i (0, +Oz), stav i −z inn til sol B. Sett fra sol B er sol A
//      (en tredjedel foran) aldri rett i +z, så staven går klar av stolpe A.
//   A: speilet, utgangen i (0, −Oz), ett nivå under B (stolpe B går ikke ned
//      dit). C: opp ned over banen, utgangen rett over midten.
import { trisolaris as T, accent } from './config.js';
import { coefficients, maxError, minSeparation } from './figureEight.js';

const TAU = 2 * Math.PI;
const deg = Math.PI / 180;

// --- Små hjelpere ---
const dirOf = (a) => ({ x: Math.cos(a), z: -Math.sin(a) });
export const angleOf = (v) => Math.atan2(-v.z, v.x);
const rotate = (p, a) => ({ x: p.x * Math.cos(a) + p.z * Math.sin(a), z: -p.x * Math.sin(a) + p.z * Math.cos(a) });
const pitchR = (m, teeth) => (m * teeth) / 2;
const tipR = (m, teeth) => m * (teeth / 2 + 1);
const mid = ([a, b]) => (a + b) / 2;
// Vinkelen hjul 2 må ha for å gripe inn i hjul 1 (samme som meshAngle i mechanism.js).
const meshAngle = (angle1, teeth1, teeth2, direction) =>
  direction + Math.PI - Math.PI / teeth2 + (teeth1 / teeth2) * (direction - angle1);

// 3D-vektorer til vinkelgirene.
const v3 = (x, y, z) => ({ x, y, z });
const sub3 = (a, b) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const add3 = (a, b, k = 1) => v3(a.x + k * b.x, a.y + k * b.y, a.z + k * b.z);
const dot3 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross3 = (a, b) => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const len3 = (a) => Math.sqrt(dot3(a, a));
export const AXES = { x: v3(1, 0, 0), y: v3(0, 1, 0), z: v3(0, 0, 1) };

// To hjul på hver sin aksel (axis, gjennom midten c, delesirkel r): punktet der
// de møtes, og farten hjul 2 får når hjul 1 dreier med rate1 (radianer per
// radian θ, høyrehånd om aksen). Farten på tennene er den samme i punktet.
export function meshContact(g1, g2) {
  const d = sub3(g2.c, g1.c);
  const a = AXES[g1.axis];
  const perp = add3(d, a, -dot3(d, a));
  return add3(g1.c, perp, g1.r / len3(perp));
}
export function drivenRate(g1, rate1, g2) {
  const P = meshContact(g1, g2);
  const v = cross3(AXES[g1.axis], sub3(P, g1.c));
  const w = cross3(AXES[g2.axis], sub3(P, g2.c));
  return (rate1 * dot3(v, w)) / dot3(w, w);
}

// --- Banen og variantene ---
const W = T.halfWidth;
const amp = {
  x1: coefficients.x[1] * W, x5: coefficients.x[5] * W,
  y2: coefficients.y[2] * W, y4: coefficients.y[4] * W,
};
// Største utslag for alle variantene (summen av leddene).
const xMax = amp.x1 + Math.abs(amp.x5);
const zMax = amp.y2 + Math.abs(amp.y4);

export const variants = Object.fromEntries(Object.entries(T.variants).map(([key, v]) => {
  const ok = v.x.includes(1) && v.y.includes(2) && v.x.every((n) => n === 1 || n === 5) && v.y.every((n) => n === 2 || n === 4);
  if (!ok) {
    throw new Error(`trisolaris.variants.${key}: x kan ha leddene 1 og 5, y leddene 2 og 4 (1 og 2 må være med). Fikk x: [${v.x}], y: [${v.y}].`);
  }
  const terms = { x: v.x, y: v.y };
  return [key, { ...v, key, terms, x5: v.x.includes(5), y4: v.y.includes(4), error: maxError(terms) * W }];
}));
if (!variants[T.variant]) throw new Error(`trisolaris.variant '${T.variant}' finnes ikke. Velg mellom: ${Object.keys(variants).join(', ')}.`);

// Sola i banen ved vinkelen θi (fasen er tatt med), med leddene i varianten.
export function orbitPoint(thetaI, variant) {
  const v = variants[variant];
  return {
    x: amp.x1 * Math.sin(thetaI) + (v.x5 ? amp.x5 * Math.sin(5 * thetaI) : 0),
    z: amp.y2 * Math.sin(2 * thetaI) + (v.y4 ? amp.y4 * Math.sin(4 * thetaI) : 0),
  };
}
// Den eksakte banen (alle leddene i figureEight.js).
export function exactPoint(thetaI) {
  let x = 0, z = 0;
  for (const [n, c] of Object.entries(coefficients.x)) x += c * W * Math.sin(n * thetaI);
  for (const [n, c] of Object.entries(coefficients.y)) z += c * W * Math.sin(n * thetaI);
  return { x, z };
}

const C = T.clearance;
if (minSeparation * W - 2 * T.sunRadius < C) {
  throw new Error(`trisolaris.sunRadius ${T.sunRadius} er for stor: solene kommer ${(minSeparation * W).toFixed(2)} fra hverandre (sentrum til sentrum). Største radius er ${((minSeparation * W - C) / 2).toFixed(2)}.`);
}

// --- Målene i hver maskin ---
const g = T.levelGap, gt = T.gearThickness;
const pinR = T.pin.radius, slotHalf = pinR + T.pin.play;
const shaftR = T.crank.shaftRadius, tubeR = shaftR + T.crank.tubeWall;
const sleeveR = T.rail.radius + T.rail.sleeveWall;
const spindleR = Math.min(0.2, pinR);

// Episyklene: planethjulet går `rate` ganger så fort som armen.
function epicycle({ fixedTeeth, planetTeeth }, armLength, offset, rate, label) {
  if (fixedTeeth !== (rate - 1) * planetTeeth) {
    throw new Error(`trisolaris.epicycles.${label}: 1 + ${fixedTeeth}/${planetTeeth} skal være ${rate} (det faste hjulet ${rate - 1} ganger planethjulet).`);
  }
  const module = (2 * armLength) / (fixedTeeth + planetTeeth);
  const e = {
    fixedTeeth, planetTeeth, module, offset, armLength,
    fixedRadius: pitchR(module, fixedTeeth), planetRadius: pitchR(module, planetTeeth),
    planetTip: tipR(module, planetTeeth), discRadius: offset + pinR + T.pinDisc.margin,
  };
  if (e.fixedRadius - 1.25 * module < tubeR + 0.1) throw new Error(`trisolaris.epicycles.${label}: det faste hjulet er for lite til røret.`);
  if (e.planetRadius - 1.25 * module < spindleR + 0.05) throw new Error(`trisolaris.epicycles.${label}: planethjulet er for lite til akselen sin.`);
  return e;
}
export const epiX = epicycle(T.epicycles.x5, amp.x1, Math.abs(amp.x5), 5, 'x5');
export const epiY = epicycle(T.epicycles.y4, amp.y2, Math.abs(amp.y4), 2, 'y4');

// Hvor langt det som dreier med hver sveiv rekker fra tårnet.
const crankReach = (e) => e.armLength + Math.max(e.planetTip, e.discRadius, T.crank.endRadius);
const reachX = crankReach(epiX), reachY = crankReach(epiY);

// Plasseringen i maskinens plan (z' = z i B og C, speilet i A).
// X-tårnet: sveivtappen og utgangstappen går i samme sliss uten å møtes.
const dX = zMax + amp.x1 + Math.abs(amp.x5) + 2 * pinR + C;
// Y-tårnet: utgangstappen går klar av Y-sveiven (armen, planethjulet og skiva).
const dY = xMax + reachY + pinR + C;
const xSlot = [-(zMax + slotHalf), dX + amp.x1 + Math.abs(amp.x5) + slotHalf];
// Endene på sleidene (der hylsene går på skinnene) ligger utenfor slissene, og
// bak tårnene så langt ut at hylsene går klar av det som dreier med sveiven.
const xEnds = [xSlot[0] - T.slide.endMargin, Math.max(xSlot[1] + T.slide.endMargin, dX + reachX + sleeveR + C)];
const xRail = xMax + T.rail.sleeveLength / 2 + T.rail.overrun;               // halve lengden på X-skinnene
const ySlot = [-(xMax + slotHalf), dY + amp.y2 + Math.abs(amp.y4) + slotHalf];
const yLeft = -(xRail + 2 * T.rail.postRadius + C);                            // forbi enden av X-skinnene
const yEnds = [Math.min(yLeft, ySlot[0] - T.slide.endMargin), Math.max(ySlot[1] + T.slide.endMargin, dY + reachY + sleeveR + C)];
const zRail = zMax + T.rail.sleeveLength / 2 + T.rail.overrun;               // halve lengden på Y-skinnene

// Hjultoget nederst: X-hjulet, mellomhjulet og Y-hjulet på en rett linje.
const TR = T.train;
if (TR.xTeeth !== 2 * TR.yTeeth) throw new Error(`trisolaris.train: xTeeth (${TR.xTeeth}) skal være 2 · yTeeth (${TR.yTeeth}), så Y-sveiven går dobbelt så fort.`);
const towerX = { x: 0, z: dX }, towerY = { x: dY, z: 0 };
const span = Math.hypot(dX, dY);
const trainModule = (2 * span) / (TR.xTeeth + 2 * TR.idlerTeeth + TR.yTeeth);
const idlerAt = (() => {
  const k = (pitchR(trainModule, TR.xTeeth) + pitchR(trainModule, TR.idlerTeeth)) / span;
  return { x: towerX.x + k * (towerY.x - towerX.x), z: towerX.z + k * (towerY.z - towerX.z) };
})();

// Hjørnene i rammen: rundt tårnene, mellomhjulet og stolpene under skinnene.
const railPosts = [
  ...[-xRail, xRail].flatMap((x) => xEnds.map((z) => ({ x, z }))),
  ...yEnds.flatMap((x) => [-zRail, zRail].map((z) => ({ x, z }))),
];
function hull(points) {
  const p = [...points].sort((a, b) => a.x - b.x || a.z - b.z);
  const crossZ = (o, a, b) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && crossZ(lower.at(-2), lower.at(-1), q) <= 0) lower.pop(); lower.push(q); }
  for (const q of p.reverse()) { while (upper.length >= 2 && crossZ(upper.at(-2), upper.at(-1), q) <= 0) upper.pop(); upper.push(q); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
const plateLocal = hull([towerX, towerY, idlerAt, ...railPosts]);
// Rammen under hver maskin: flate stenger rundt (mellom stolpene under
// skinnene), og inn til tårnene og mellomhjulet fra de to nærmeste hjørnene.
const frameBars = (() => {
  const bars = plateLocal.map((p, i) => [p, plateLocal[(i + 1) % plateLocal.length]]);
  for (const q of [towerX, towerY, idlerAt]) {
    if (plateLocal.some((p) => p.x === q.x && p.z === q.z)) continue;
    const byDistance = [...plateLocal].sort((a, b) => Math.hypot(a.x - q.x, a.z - q.z) - Math.hypot(b.x - q.x, b.z - q.z));
    for (const p of byDistance.slice(0, 2)) bars.push([q, p]);
  }
  return bars;
})();

// Hvor nær midten noe i maskinen kommer (i z', mot banen), og avstanden Oz.
const near = Math.max(-xEnds[0] + sleeveR, zRail + T.rail.postRadius, zMax + T.slide.width / 2);
const postFoot = Math.max(2 * T.post.radius, T.link.width / 2);
const Oz = near + zMax + postFoot + C;

// --- Nivåene i hver maskin, målt fra rammen og inn i maskinen ---
const U = {};
{
  let u = 0;
  const level = (name, thickness, gap = g) => { U[name] = [u + gap, u + gap + thickness]; u = U[name][1]; };
  level('train', TR.thickness);
  level('xGear', gt);
  level('xArm', T.crank.thickness);
  level('xDisc', T.pinDisc.thickness, g / 2);
  level('xSlide', T.slide.thickness);
  level('yGear', gt);
  level('yArm', T.crank.thickness);
  level('yDisc', T.pinDisc.thickness, g / 2);
  level('ySlide', T.slide.thickness);
  level('link', T.link.thickness);
}
export const levels = U;

// --- Høydene ---
const L = T.line;
const miter = { teeth: L.bevelTeeth, module: L.bevelModule, r: pitchR(L.bevelModule, L.bevelTeeth), tip: tipR(L.bevelModule, L.bevelTeeth) };
const yLine = L.height;
if (yLine - miter.tip < C) throw new Error(`trisolaris.line.height ${yLine} er for lav til vinkelgirene (minst ${(miter.tip + C).toFixed(2)}).`);
const plateTop = { A: yLine + miter.r + gt / 2 + C + T.plate.thickness };
plateTop.B = plateTop.A + T.link.thickness + C;           // staven til A går under stolpe B
const linkTopB = plateTop.B + U.link[1];
export const H = linkTopB + T.sunRadius + T.post.lift;    // høyden på baneplanet

// Ringen med planeten, i høyde med solene.
const R = T.ring;
const ringTop = H - T.planet.radius - T.planet.lift;
const ringBottom = ringTop - R.thickness;
const rollerArm = T.frame.hangerRadius;                    // stagene til rullene
const forkR = Math.min(rollerArm * 0.6, R.rollerRadius - C - 0.02);  // gaflene ned til rulleakslene, klar av ringen
const rollerTopY = ringTop + R.rollerRadius, rollerBottomY = ringBottom - R.rollerRadius;
const rollerBarTop = ringTop + 2 * R.rollerRadius + C + rollerArm;
const rollerBarBottom = ringBottom - 2 * R.rollerRadius - C - rollerArm;
// Ringen går over maskinene A og B (alt der unntatt staven inn til sola, som
// ligger innenfor banen). Rullene sitter ved stolpene, utenfor maskinene.
const highestAB = plateTop.B + Math.max(U.ySlide[1], mid(U.ySlide) + sleeveR);
if (ringBottom < highestAB + C) {
  throw new Error(`Ringen ligger for lavt: den går ned i maskinene under. Øk trisolaris.post.lift (nå ${T.post.lift}) eller minsk ring.thickness.`);
}

// Maskinen over (C) henger opp ned, så det laveste i den (Y-sleiden og
// skinnene) går klar over solene.
const lowestC = Math.max(U.ySlide[1], mid(U.ySlide) + sleeveR);
const plateBottomC = H + T.sunRadius + T.post.lift + lowestC;
plateTop.C = plateBottomC + T.plate.thickness;

// Vinkelgiret fra bjelkeakselen ned i Y-tårnet i C (1:2).
const TB = T.topBevel;
if (TB.beamTeeth !== 2 * TB.towerTeeth) throw new Error(`trisolaris.topBevel: beamTeeth (${TB.beamTeeth}) skal være 2 · towerTeeth (${TB.towerTeeth}), så Y-tårnet i C går dobbelt så fort.`);
const topBevel = {
  tower: { teeth: TB.towerTeeth, r: pitchR(TB.module, TB.towerTeeth), tip: tipR(TB.module, TB.towerTeeth) },
  beam: { teeth: TB.beamTeeth, r: pitchR(TB.module, TB.beamTeeth), tip: tipR(TB.module, TB.beamTeeth) },
};
// Kjeglene: avstanden fra midten av hvert hjul til toppunktet er radien til det andre.
const yBeam = plateTop.C + gt / 2 + C + topBevel.beam.r;   // bjelkeakselen og bjelkene

// --- Stativet og ringen i planet ---
// Lengst ut i x: rammen, enden av Y-sleiden og hylsene der.
const plateReach = Math.max(...plateLocal.map((p) => p.x)) + Math.max(T.plate.width / 2, T.slide.width / 2, sleeveR);
export const Xg = plateReach + T.frame.radius + C;            // stolpene står i x = ±Xg
const ringModule = (2 * Xg) / (R.teeth - R.pinionTeeth);       // pinjongen sitter på den loddrette akselen i x = Xg
const pinion = { r: pitchR(ringModule, R.pinionTeeth), tip: tipR(ringModule, R.pinionTeeth) };
const ringPitch = Xg + pinion.r;
const ringRoot = ringPitch + 1.25 * ringModule;
const rollerAt = ringRoot + R.rollerWidth / 2 + 0.2;           // der rullene går på ringen
// Planeten går forbi rullene og stagene ved stolpene, så den står så langt ut
// at kula går klar av dem.
const planetPost = rollerAt + Math.max(R.rollerWidth / 2 + R.rollerRadius, T.frame.hangerRadius) + Math.max(T.planet.radius, T.planet.postRadius + accent.ringWidth) + C;
const ringOuter = Math.max(ringRoot + R.width, planetPost + T.planet.postRadius + 0.3);
const zp = pinion.tip + T.frame.radius + C;                    // de nærmeste stolpene står i z = −zp
const zFar = xEnds[1];                                          // de bakerste over skinnene bak i C

// --- Maskinene ---
// phase: fasen i banen. A er en tredjedel foran B (se øverst).
const machineList = [
  { name: 'A', phase: TAU / 3, s: -1, O: { x: 0, z: -Oz }, inverted: false, link: true },
  { name: 'B', phase: 0, s: 1, O: { x: 0, z: Oz }, inverted: false, link: true },
  { name: 'C', phase: (2 * TAU) / 3, s: 1, O: { x: 0, z: 0 }, inverted: true, link: false },
];
for (const m of machineList) {
  m.world = (p) => ({ x: m.O.x + p.x, z: m.O.z + m.s * p.z });
  // Høyden til nivået u (fra rammen inn i maskinen).
  m.y = m.inverted ? (u) => plateBottomC - u : (u) => plateTop[m.name] + u;
  m.range = ([u0, u1]) => [m.y(u0), m.y(u1)].sort((a, b) => a - b);
  m.towerX = m.world(towerX);
  m.towerY = m.world(towerY);
  m.idler = m.world(idlerAt);
  // Startvinklene: armen til X-sveiven peker så x-delen blir a1·sin(θ + fase),
  // tappen på planethjulet så den blir a5·sin(5(θ + fase)); det samme for z.
  const phi = m.phase;
  m.cA = phi - Math.PI / 2;
  m.cB = 2 * phi - Math.PI;
  const xPin = 5 * phi - Math.PI / 2 + (amp.x5 < 0 ? Math.PI : 0);
  const yPin = 4 * phi + Math.PI + (amp.y4 < 0 ? Math.PI : 0);
  m.lambdaX = xPin - meshAngle(0, epiX.fixedTeeth, epiX.planetTeeth, m.cA);
  m.lambdaY = yPin - meshAngle(0, epiY.fixedTeeth, epiY.planetTeeth, m.cB);
}
export const machines = Object.fromEntries(machineList.map((m) => [m.name, m]));

// --- Drivet: akselstrengen langs gulvet, grenen til stativet, den loddrette
// akselen og bjelkeakselen. Alle X-tårnene skal dreie med +1 og Y-tårnene med +2;
// sidene til hjulene på akselstrengen velges så det stemmer.
const gearOn = (axis, c, r) => ({ axis, c, r });
const xBevel = (m) => gearOn('y', v3(m.towerX.x, yLine + miter.r, m.towerX.z), miter.r);
function pickSide(make, wanted, label) {
  for (const side of [-1, 1]) {
    const result = make(side);
    if (Math.abs(result.rate - wanted) < 1e-9) return { side, ...result };
  }
  throw new Error(`Fant ingen side for vinkelgiret ${label} som gir riktig dreieretning.`);
}
// Akselstrengen (langs z i x = 0) får farten fra X-tårnet i B.
const lineRateFrom = (side) => {
  const lg = gearOn('z', v3(0, yLine, machines.B.towerX.z + side * miter.r), miter.r);
  return { gear: lg, rate: drivenRate(xBevel(machines.B), 1, lg) };
};
const lineB = lineRateFrom(-1);  // hjulet innenfor X-tårnet i B
const lineRate = lineB.rate;
const lineA = pickSide((side) => {
  const lg = gearOn('z', v3(0, yLine, machines.A.towerX.z + side * miter.r), miter.r);
  return { gear: lg, rate: drivenRate(lg, lineRate, xBevel(machines.A)) };
}, 1, 'til A');
const lineEnds = [Math.min(lineA.gear.c.z, lineB.gear.c.z) - miter.r * 0.6, Math.max(lineA.gear.c.z, lineB.gear.c.z) + miter.r * 0.6];
// Grenen langs x i z = 0, fra et hjul på akselstrengen ved origo.
const branchMain = gearOn('z', v3(0, yLine, -miter.r), miter.r);
const branchStart = gearOn('x', v3(miter.r, yLine, 0), miter.r);
const branchRate = drivenRate(branchMain, lineRate, branchStart);
const branchEnd = gearOn('x', v3(Xg - miter.r, yLine, 0), miter.r);
const vBottom = gearOn('y', v3(Xg, yLine + miter.r, 0), miter.r);
const vRate = drivenRate(branchEnd, branchRate, vBottom);
const vTop = gearOn('y', v3(Xg, yBeam - miter.r, 0), miter.r);
const beamStart = gearOn('x', v3(Xg - miter.r, yBeam, 0), miter.r);
const beamRate = drivenRate(vTop, vRate, beamStart);
const cTowerBevel = gearOn('y', v3(machines.C.towerY.x, yBeam - topBevel.beam.r, machines.C.towerY.z), topBevel.tower.r);
const beamEnd = pickSide((side) => {
  const bg = gearOn('x', v3(machines.C.towerY.x + side * topBevel.tower.r, yBeam, 0), topBevel.beam.r);
  return { gear: bg, rate: drivenRate(bg, beamRate, cTowerBevel) };
}, 2, 'til C');
// Ringen dreier samme vei som pinjongen (innvendige tenner).
const ringRate = (vRate * R.pinionTeeth) / R.teeth;
const beamShaftEnds = [Math.min(beamEnd.gear.c.x, beamStart.c.x) - 0.4, Xg + 0.6];

export const drive = {
  lineRate, branchRate, vRate, beamRate, ringRate,
  planetPeriod: Math.abs(1 / ringRate),   // runder i åttetallet per runde for planeten
  // Alle tannhjulsparene (til sjekken): [hjul 1, fart 1, hjul 2, fart 2].
  meshes: [
    ['B: X-tårnet → akselstrengen', xBevel(machines.B), 1, lineB.gear, lineRate],
    ['akselstrengen → X-tårnet i A', lineA.gear, lineRate, xBevel(machines.A), 1],
    ['akselstrengen → grenen', branchMain, lineRate, branchStart, branchRate],
    ['grenen → den loddrette akselen', branchEnd, branchRate, vBottom, vRate],
    ['den loddrette akselen → bjelkeakselen', vTop, vRate, beamStart, beamRate],
    ['bjelkeakselen → Y-tårnet i C', beamEnd.gear, beamRate, cTowerBevel, 2],
  ],
};

// --- Hvor alt står ved θ ---
// Per maskin: vinklene på armene og planethjulene, hvor tappene står, og hvor
// langt sleidene har gått.
function machineState(m, theta, v) {
  const psiA = theta + m.cA, psiB = 2 * theta + m.cB;
  const gX = meshAngle(0, epiX.fixedTeeth, epiX.planetTeeth, psiA);
  const gY = meshAngle(0, epiY.fixedTeeth, epiY.planetTeeth, psiB);
  const endX = { x: m.towerX.x + amp.x1 * Math.cos(psiA), z: m.towerX.z - amp.x1 * Math.sin(psiA) };
  const endY = { x: m.towerY.x + amp.y2 * Math.cos(psiB), z: m.towerY.z - amp.y2 * Math.sin(psiB) };
  const off = (r, a) => ({ x: r * Math.cos(a), z: -r * Math.sin(a) });
  const pinX = v.x5 ? { x: endX.x + off(epiX.offset, gX + m.lambdaX).x, z: endX.z + off(epiX.offset, gX + m.lambdaX).z } : endX;
  const pinY = v.y4 ? { x: endY.x + off(epiY.offset, gY + m.lambdaY).x, z: endY.z + off(epiY.offset, gY + m.lambdaY).z } : endY;
  const dx = pinX.x - m.towerX.x, dz = pinY.z - m.towerY.z;
  // Hjultoget: X-hjulet sitter på X-akselen, mellomhjulet og Y-hjulet følger.
  const dirXI = angleOf({ x: m.idler.x - m.towerX.x, z: m.idler.z - m.towerX.z });
  const dirIY = angleOf({ x: m.towerY.x - m.idler.x, z: m.towerY.z - m.idler.z });
  const idler = meshAngle(psiA, TR.xTeeth, TR.idlerTeeth, dirXI);
  const yGear = meshAngle(idler, TR.idlerTeeth, TR.yTeeth, dirIY);
  return { psiA, psiB, gX, gY, endX, endY, pinX, pinY, dx, dz, idler, yGear, out: { x: m.O.x + dx, z: m.O.z + dz } };
}

export function stateAt(theta, variant) {
  const v = variants[variant];
  const state = { theta, variant, machines: {}, suns: {} };
  for (const m of machineList) {
    const ms = machineState(m, theta, v);
    state.machines[m.name] = ms;
    state.suns[m.name] = { x: ms.out.x - m.O.x, z: ms.out.z - m.O.z };
  }
  state.line = lineRate * theta;
  state.branch = branchRate * theta;
  state.vertical = vRate * theta;
  state.beam = beamRate * theta;
  state.ring = ringRate * theta + T.planet.startAngle * deg;
  return state;
}

// --- Delene ---
// Hver del har et navn, en enhet (body: deler som henger stivt sammen; de
// sjekkes ikke mot hverandre), en type til tellingen (kind) og en tegning
// (draw) i lokale mål. move(state) gir { x, z, angle }: hvor delens lokale
// origo står i planet og vinkelen om y. Deler uten move står stille.
// spin(state): vinkelen om delens egen aksel (aksler og vinkelgir på liggende
// aksler; bare til tegningen).
// draw-typene:
//   cyl      loddrett sylinder: r, y0, y1, at {x, z}
//   gear     tannhjul med hull: teeth, module, y0, thickness, hole, at (midten, standard origo)
//   arm      sveivarm langs +x: length, hub, y0, thickness
//   bar      flat stang mellom a og b (i planet): width, y0, thickness, slot {a, b, width}
//   rod      rund stang mellom to punkter i rommet: a, b, r
//   bevel    vinkelgir: teeth, module, c, axis, apex (avstanden til toppunktet, med fortegn langs aksen)
//   ringGear ring med innvendige tenner om origo: teeth, module, outer, y0, thickness
//   sphere   kule: r, c {x, y, z}, look ('sun' eller 'planet')
//   torus    ring i accent rundt en stolpe: r, y, at
//   collar   kjegle der stolpen møter staven: r0 (nede), r1 (oppe), y0, y1, at
//   pillow   lager langs gulvet: en liten stolpe og en ring rundt akselen: at, y, r, axis
//   bearing  lager fra stativet: stag fra a til b og en ring rundt akselen i b: r, shaft, axis
//   roller   rulle på ringen: c, angle (retningen ut fra midten), r, width
// Tellingen: 'hjul', 'aksel' (aksler, rør og tapper), 'sleide' (sleider,
// skinner og hylser), 'arm' (sveivarmer og skiver), 'ramme' (plater, stolper,
// bjelker, stag og lagre), 'kule'.
export function partsFor(variant) {
  const v = variants[variant];
  const parts = [];
  const add = (p) => { parts.push(p); return p; };

  for (const m of machineList) {
    const n = m.name;
    const P = (part) => `${n}:${part}`;
    const frame = P('ramme');
    const at = (u0, u1) => m.range([u0, u1]);
    const flat = (u0, thickness) => (m.inverted ? m.y(u0) - thickness : m.y(u0));  // undersiden av en flat del som starter i u0
    const ms = (s) => s.machines[n];

    // Rammen, og beina ned til gulvet (A og B).
    const platePts = plateLocal.map(m.world);
    frameBars.forEach(([a, b], i) => add({ name: P(`ramme ${i + 1}`), body: frame, kind: 'ramme',
      draw: { type: 'bar', a: m.world(a), b: m.world(b), width: T.plate.width, y0: m.inverted ? plateBottomC : plateTop[n] - T.plate.thickness, thickness: T.plate.thickness } }));
    if (!m.inverted) {
      platePts.forEach((p, i) => add({ name: P(`bein${i + 1}`), body: frame, kind: 'ramme',
        draw: { type: 'cyl', r: T.plate.legRadius, y0: 0, y1: plateTop[n] - T.plate.thickness, at: p } }));
    }

    // X-tårnet: akselen, det faste røret (med det faste hjulet), X-hjulet nederst og armen.
    const xShaftBottom = m.inverted ? m.y(0) : yLine + miter.r;
    add({ name: P('X-aksel'), body: P('X-sveiv'), kind: 'aksel',
      draw: { type: 'cyl', r: shaftR, y0: Math.min(xShaftBottom, m.y(U.xArm[1])), y1: Math.max(xShaftBottom, m.y(U.xArm[1])), at: m.towerX } });
    add({ name: P('X-rør'), body: frame, kind: 'aksel', draw: { type: 'cyl', r: tubeR, ...yr(at(0, U.xGear[1])), at: m.towerX } });
    add({ name: P('X-hjul'), body: P('X-sveiv'), kind: 'hjul', move: (s) => ({ ...m.towerX, angle: ms(s).psiA }),
      draw: { type: 'gear', teeth: TR.xTeeth, module: trainModule, y0: flat(U.train[0], TR.thickness), thickness: TR.thickness, hole: shaftR } });
    add({ name: P('X-arm'), body: P('X-sveiv'), kind: 'arm', move: (s) => ({ ...m.towerX, angle: ms(s).psiA }),
      draw: { type: 'arm', length: amp.x1, hub: shaftR + 0.25, y0: flat(U.xArm[0], T.crank.thickness), thickness: T.crank.thickness } });
    if (!m.inverted) {
      add({ name: P('X-vinkelgir'), body: P('X-sveiv'), kind: 'hjul', spin: (s) => ms(s).psiA,
        draw: { type: 'bevel', teeth: miter.teeth, module: miter.module, c: xBevel(m).c, axis: 'y', apex: -miter.r } });
    }
    // Y-tårnet.
    const yShaftEnd = m.inverted ? cTowerBevel.c.y : m.y(0);
    add({ name: P('Y-aksel'), body: P('Y-sveiv'), kind: 'aksel',
      draw: { type: 'cyl', r: shaftR, y0: Math.min(yShaftEnd, m.y(U.yArm[1])), y1: Math.max(yShaftEnd, m.y(U.yArm[1])), at: m.towerY } });
    add({ name: P('Y-rør'), body: frame, kind: 'aksel', draw: { type: 'cyl', r: tubeR, ...yr(at(0, U.yGear[1])), at: m.towerY } });
    add({ name: P('Y-hjul'), body: P('Y-sveiv'), kind: 'hjul', move: (s) => ({ ...m.towerY, angle: ms(s).yGear }),
      draw: { type: 'gear', teeth: TR.yTeeth, module: trainModule, y0: flat(U.train[0], TR.thickness), thickness: TR.thickness, hole: shaftR } });
    add({ name: P('Y-arm'), body: P('Y-sveiv'), kind: 'arm', move: (s) => ({ ...m.towerY, angle: ms(s).psiB }),
      draw: { type: 'arm', length: amp.y2, hub: shaftR + 0.25, y0: flat(U.yArm[0], T.crank.thickness), thickness: T.crank.thickness } });
    if (m.inverted) {
      add({ name: P('Y-vinkelgir'), body: P('Y-sveiv'), kind: 'hjul', spin: (s) => ms(s).psiB,
        draw: { type: 'bevel', teeth: topBevel.tower.teeth, module: TB.module, c: cTowerBevel.c, axis: 'y', apex: topBevel.beam.r } });
    }
    // Mellomhjulet på en tapp i rammen.
    add({ name: P('mellomaksel'), body: frame, kind: 'aksel', draw: { type: 'cyl', r: shaftR, ...yr(at(0, U.train[1])), at: m.idler } });
    add({ name: P('mellomhjul'), body: P('mellomhjul'), kind: 'hjul', move: (s) => ({ ...m.idler, angle: ms(s).idler }),
      draw: { type: 'gear', teeth: TR.idlerTeeth, module: trainModule, y0: flat(U.train[0], TR.thickness), thickness: TR.thickness, hole: shaftR } });

    // Sveivtappene, med eller uten korreksjonshjul.
    const crank = (axis, e, use, levelsOf, endKey, gKey, lambdaKey, tower, armBody) => {
      const [gearL, discL, slideL] = levelsOf;
      if (!use) {
        add({ name: P(`${axis}-tapp`), body: armBody, kind: 'aksel', move: (s) => ({ ...tower, angle: axis === 'X' ? ms(s).psiA : ms(s).psiB }),
          draw: { type: 'cyl', r: pinR, ...yr(at(U[discL][0] - g / 2 - 0.05, U[slideL][1] + 0.05)), at: { x: e.armLength, z: 0 } } });
        return;
      }
      add({ name: P(`${axis}-fast hjul`), body: frame, kind: 'hjul',
        draw: { type: 'gear', teeth: e.fixedTeeth, module: e.module, y0: flat(U[gearL][0], gt), thickness: gt, hole: tubeR, at: tower } });
      const body = P(`${axis}-planet`);
      const place = (s) => ({ ...ms(s)[endKey], angle: ms(s)[gKey] });
      add({ name: P(`${axis}-planethjul`), body, kind: 'hjul', move: place,
        draw: { type: 'gear', teeth: e.planetTeeth, module: e.module, y0: flat(U[gearL][0], gt), thickness: gt, hole: spindleR } });
      add({ name: P(`${axis}-spindel`), body, kind: 'aksel', move: place,
        draw: { type: 'cyl', r: spindleR, ...yr(at(U[gearL][0], U[discL][1])), at: { x: 0, z: 0 } } });
      add({ name: P(`${axis}-skive`), body, kind: 'arm', move: place,
        draw: { type: 'cyl', r: e.discRadius, ...yr(at(U[discL][0], U[discL][1])), at: { x: 0, z: 0 } } });
      add({ name: P(`${axis}-tapp`), body, kind: 'aksel', move: place,
        draw: { type: 'cyl', r: pinR, ...yr(at(U[discL][1], U[slideL][1] + 0.05)), at: rotate({ x: e.offset, z: 0 }, m[lambdaKey]) } });
    };
    crank('X', epiX, v.x5, ['xGear', 'xDisc', 'xSlide'], 'endX', 'gX', 'lambdaX', m.towerX, P('X-sveiv'));
    crank('Y', epiY, v.y4, ['yGear', 'yDisc', 'ySlide'], 'endY', 'gY', 'lambdaY', m.towerY, P('Y-sveiv'));

    // X-sleiden (langs z, glir i x) med hylsene, og skinnene på stolper.
    const xRailY = m.y(mid(U.xSlide));
    const zEnd = xEnds.map((z) => m.world({ x: 0, z }).z);
    add({ name: P('X-sleide'), body: P('X-sleide'), kind: 'sleide', move: (s) => ({ x: ms(s).dx, z: 0, angle: 0 }),
      draw: { type: 'bar', a: { x: 0, z: zEnd[0] }, b: { x: 0, z: zEnd[1] }, width: T.slide.width, y0: flat(U.xSlide[0], T.slide.thickness), thickness: T.slide.thickness,
        slot: { a: { x: 0, z: m.world({ x: 0, z: xSlot[0] }).z }, b: { x: 0, z: m.world({ x: 0, z: xSlot[1] }).z }, width: 2 * slotHalf } } });
    zEnd.forEach((z, i) => {
      add({ name: P(`X-hylse${i + 1}`), body: P('X-sleide'), kind: 'sleide', move: (s) => ({ x: ms(s).dx, z: 0, angle: 0 }),
        draw: { type: 'rod', a: { x: -T.rail.sleeveLength / 2, y: xRailY, z }, b: { x: T.rail.sleeveLength / 2, y: xRailY, z }, r: sleeveR } });
      add({ name: P(`X-skinne${i + 1}`), body: frame, kind: 'sleide',
        draw: { type: 'rod', a: { x: -xRail, y: xRailY, z }, b: { x: xRail, y: xRailY, z }, r: T.rail.radius } });
      for (const x of [-xRail, xRail]) add({ name: P(`X-skinnestolpe${i + 1}${x < 0 ? 'v' : 'h'}`), body: frame, kind: 'ramme',
        draw: { type: 'cyl', r: T.rail.postRadius, ...yr([m.y(0), xRailY]), at: { x, z } } });
    });
    // Y-sleiden (langs x, glir i z).
    const yRailY = m.y(mid(U.ySlide));
    add({ name: P('Y-sleide'), body: P('Y-sleide'), kind: 'sleide', move: (s) => ({ x: 0, z: ms(s).dz, angle: 0 }),
      draw: { type: 'bar', a: { x: yEnds[0], z: m.O.z }, b: { x: yEnds[1], z: m.O.z }, width: T.slide.width, y0: flat(U.ySlide[0], T.slide.thickness), thickness: T.slide.thickness,
        slot: { a: { x: ySlot[0], z: m.O.z }, b: { x: ySlot[1], z: m.O.z }, width: 2 * slotHalf } } });
    yEnds.forEach((x, i) => {
      add({ name: P(`Y-hylse${i + 1}`), body: P('Y-sleide'), kind: 'sleide', move: (s) => ({ x: 0, z: ms(s).dz, angle: 0 }),
        draw: { type: 'rod', a: { x, y: yRailY, z: m.O.z - T.rail.sleeveLength / 2 }, b: { x, y: yRailY, z: m.O.z + T.rail.sleeveLength / 2 }, r: sleeveR } });
      add({ name: P(`Y-skinne${i + 1}`), body: frame, kind: 'sleide',
        draw: { type: 'rod', a: { x, y: yRailY, z: m.O.z - zRail }, b: { x, y: yRailY, z: m.O.z + zRail }, r: T.rail.radius } });
      for (const z of [-zRail, zRail]) add({ name: P(`Y-skinnestolpe${i + 1}${z < 0 ? 'f' : 'b'}`), body: frame, kind: 'ramme',
        draw: { type: 'cyl', r: T.rail.postRadius, ...yr([m.y(0), yRailY]), at: { x, z: m.O.z + z } } });
    });

    // Utgangstappen, staven og stolpen opp til sola (eller ned, i C), og sola.
    const out = P('utgang');
    const moveOut = (s) => ({ x: ms(s).dx, z: ms(s).dz, angle: 0 });
    if (m.link) {
      add({ name: P('utgangstapp'), body: out, kind: 'aksel', move: moveOut,
        draw: { type: 'cyl', r: pinR, ...yr(at(U.xSlide[0] - 0.1, U.link[0])), at: { x: m.O.x, z: m.O.z } } });
      add({ name: P('stav'), body: out, kind: 'ramme', move: moveOut,
        draw: { type: 'bar', a: { x: m.O.x, z: m.O.z }, b: { x: 0, z: 0 }, width: T.link.width, y0: m.y(U.link[0]), thickness: T.link.thickness } });
      add({ name: P('solstolpe'), body: out, kind: 'ramme', move: moveOut,
        draw: { type: 'cyl', r: T.post.radius, y0: m.y(U.link[1]), y1: H, at: { x: 0, z: 0 } } });
      add({ name: P('krage'), body: out, kind: 'ramme', move: moveOut,
        draw: { type: 'collar', r0: postFoot, r1: T.post.radius, y0: m.y(U.link[1]), y1: m.y(U.link[1]) + 0.5, at: { x: 0, z: 0 } } });
      add({ name: P('ring'), body: out, kind: 'ramme', move: moveOut,
        draw: { type: 'torus', r: T.post.radius, y: m.y(U.link[1]) + 0.5, at: { x: 0, z: 0 } } });
    } else {
      // I C henger utgangstappen rett over sola og går over i solstolpen under Y-sleiden.
      add({ name: P('utgangstapp'), body: out, kind: 'aksel', move: moveOut,
        draw: { type: 'cyl', r: pinR, y0: m.y(lowestC) - 0.3, y1: m.y(U.xSlide[0] - 0.1), at: { x: m.O.x, z: m.O.z } } });
      add({ name: P('solstolpe'), body: out, kind: 'ramme', move: moveOut,
        draw: { type: 'cyl', r: T.post.radius, y0: H, y1: m.y(lowestC) - 0.3, at: { x: 0, z: 0 } } });
      add({ name: P('ring'), body: out, kind: 'ramme', move: moveOut,
        draw: { type: 'torus', r: T.post.radius, y: m.y(lowestC) - 0.3, at: { x: 0, z: 0 } } });
    }
    add({ name: P('sol'), body: out, kind: 'kule', move: moveOut, sun: n,
      draw: { type: 'sphere', r: T.sunRadius, c: { x: 0, y: H, z: 0 }, look: 'sun' } });
  }

  // --- Akselstrengen, grenen, den loddrette akselen og bjelkeakselen ---
  const lineBody = 'akselstreng';
  add({ name: 'akselstreng', body: lineBody, kind: 'aksel', spin: (s) => s.line,
    draw: { type: 'rod', a: { x: 0, y: yLine, z: lineEnds[0] }, b: { x: 0, y: yLine, z: lineEnds[1] }, r: L.radius, axis: 'z' } });
  for (const [name, gear] of [['vinkelgir A', lineA.gear], ['vinkelgir B', lineB.gear], ['vinkelgir gren', branchMain]]) {
    add({ name: `akselstreng: ${name}`, body: lineBody, kind: 'hjul', spin: (s) => s.line,
      draw: { type: 'bevel', teeth: miter.teeth, module: miter.module, c: gear.c, axis: 'z', apex: (gear === lineA.gear ? machines.A.towerX.z : gear === lineB.gear ? machines.B.towerX.z : 0) - gear.c.z } });
  }
  add({ name: 'gren', body: 'gren', kind: 'aksel', spin: (s) => s.branch,
    draw: { type: 'rod', a: { x: branchStart.c.x - gt / 2 - 0.1, y: yLine, z: 0 }, b: { x: branchEnd.c.x + miter.r * 0.6, y: yLine, z: 0 }, r: L.radius, axis: 'x' } });
  add({ name: 'gren: vinkelgir inn', body: 'gren', kind: 'hjul', spin: (s) => s.branch,
    draw: { type: 'bevel', teeth: miter.teeth, module: miter.module, c: branchStart.c, axis: 'x', apex: -miter.r } });
  add({ name: 'gren: vinkelgir ut', body: 'gren', kind: 'hjul', spin: (s) => s.branch,
    draw: { type: 'bevel', teeth: miter.teeth, module: miter.module, c: branchEnd.c, axis: 'x', apex: miter.r } });
  add({ name: 'loddrett aksel', body: 'loddrett', kind: 'aksel', spin: (s) => s.vertical,
    draw: { type: 'cyl', r: L.radius, y0: vBottom.c.y - 0.4, y1: vTop.c.y + 0.4, at: { x: Xg, z: 0 } } });
  add({ name: 'loddrett: vinkelgir nede', body: 'loddrett', kind: 'hjul', spin: (s) => s.vertical,
    draw: { type: 'bevel', teeth: miter.teeth, module: miter.module, c: vBottom.c, axis: 'y', apex: -miter.r } });
  add({ name: 'loddrett: vinkelgir oppe', body: 'loddrett', kind: 'hjul', spin: (s) => s.vertical,
    draw: { type: 'bevel', teeth: miter.teeth, module: miter.module, c: vTop.c, axis: 'y', apex: miter.r } });
  add({ name: 'pinjong', body: 'loddrett', kind: 'hjul', move: (s) => ({ x: Xg, z: 0, angle: s.vertical }),
    draw: { type: 'gear', teeth: R.pinionTeeth, module: ringModule, y0: ringBottom, thickness: R.thickness, hole: L.radius } });
  add({ name: 'bjelkeaksel', body: 'bjelkeaksel', kind: 'aksel', spin: (s) => s.beam,
    draw: { type: 'rod', a: { x: beamShaftEnds[0], y: yBeam, z: 0 }, b: { x: beamShaftEnds[1], y: yBeam, z: 0 }, r: L.radius, axis: 'x' } });
  add({ name: 'bjelkeaksel: vinkelgir inn', body: 'bjelkeaksel', kind: 'hjul', spin: (s) => s.beam,
    draw: { type: 'bevel', teeth: miter.teeth, module: miter.module, c: beamStart.c, axis: 'x', apex: miter.r } });
  add({ name: 'bjelkeaksel: vinkelgir ned', body: 'bjelkeaksel', kind: 'hjul', spin: (s) => s.beam,
    draw: { type: 'bevel', teeth: topBevel.beam.teeth, module: TB.module, c: beamEnd.gear.c, axis: 'x', apex: machines.C.towerY.x - beamEnd.gear.c.x } });

  // Lagrene langs gulvet: små stolper med en ring rundt akselen.
  const pillow = (name, axis, p) => add({ name, body: 'stativ', kind: 'ramme', draw: { type: 'pillow', at: p, y: yLine, r: L.radius, axis } });
  const between = (a, b, avoid) => {
    const out = [];
    const count = Math.max(1, Math.round(Math.abs(b - a) / L.bearingSpacing));
    for (let i = 1; i < count; i++) out.push(a + ((b - a) * i) / count);
    if (count === 1) out.push((a + b) / 2);
    return out.filter((q) => avoid.every((w) => Math.abs(q - w) > miter.tip + 0.8));
  };
  between(lineEnds[0] + 1, lineEnds[1] - 1, [0, lineA.gear.c.z, lineB.gear.c.z, machines.A.towerX.z, machines.B.towerX.z])
    .forEach((z, i) => pillow(`lager langs gulvet ${i + 1}`, 'z', { x: 0, z }));
  between(branchStart.c.x + 1, branchEnd.c.x - 1, []).forEach((x, i) => pillow(`lager på grenen ${i + 1}`, 'x', { x, z: 0 }));

  // --- Stativet: fire stolper, to bjelker, hengerne ned til C og lagrene ---
  const frameBody = 'stativ';
  const uprights = [[-Xg, -zp], [Xg, -zp], [-Xg, zFar], [Xg, zFar]];
  uprights.forEach(([x, z], i) => add({ name: `stolpe ${i + 1}`, body: frameBody, kind: 'ramme',
    draw: { type: 'cyl', r: T.frame.radius, y0: 0, y1: yBeam + T.frame.beamRadius, at: { x, z } } }));
  for (const [z, label] of [[-zp, 'fremre'], [zFar, 'bakre']]) {
    add({ name: `bjelke ${label}`, body: frameBody, kind: 'ramme',
      draw: { type: 'rod', a: { x: -Xg, y: yBeam, z }, b: { x: Xg, y: yBeam, z }, r: T.frame.beamRadius } });
  }
  // Hengerne: der bjelkene går over rammen i C (kanten rundt).
  const plateC = plateLocal.map(machines.C.world);
  const across = (z) => {
    const xs = [];
    for (let i = 0; i < plateC.length; i++) {
      const a = plateC[i], b = plateC[(i + 1) % plateC.length];
      if ((a.z - z) * (b.z - z) <= 0 && a.z !== b.z) xs.push(a.x + ((z - a.z) * (b.x - a.x)) / (b.z - a.z));
    }
    return xs.length ? [Math.min(...xs), Math.max(...xs)] : null;
  };
  let hangerCount = 0;
  for (const z of [-zp, zFar]) {
    const span2 = across(z);
    if (!span2) throw new Error(`Bjelken i z = ${z.toFixed(1)} går ikke over rammen i C.`);
    for (const x of span2) {
      hangerCount++;
      add({ name: `henger ${hangerCount}`, body: frameBody, kind: 'ramme',
        draw: { type: 'cyl', r: T.frame.hangerRadius, y0: plateTop.C, y1: yBeam, at: { x, z } } });
    }
  }
  // Lagre for den loddrette akselen og bjelkeakselen: stag fra stolpen og bjelken.
  const vBearings = [yLine + miter.tip + 2, (yLine + ringBottom) / 2, rollerBarTop + 2.5, yBeam - miter.tip - 2]
    .filter((y) => y > yLine + miter.tip + 1 && y < yBeam - miter.tip - 1 && (Math.abs(y - (ringTop + ringBottom) / 2) > 3));
  vBearings.forEach((y, i) => add({ name: `lager loddrett ${i + 1}`, body: frameBody, kind: 'ramme',
    draw: { type: 'bearing', a: { x: Xg, y, z: -zp }, b: { x: Xg, y, z: 0 }, r: T.frame.hangerRadius * 0.7, shaft: L.radius, axis: 'y' } }));
  const beamBearings = [(beamShaftEnds[0] + beamStart.c.x) / 2 + 1, beamStart.c.x - miter.tip - 1.5];
  beamBearings.forEach((x, i) => add({ name: `lager bjelkeaksel ${i + 1}`, body: frameBody, kind: 'ramme',
    draw: { type: 'bearing', a: { x, y: yBeam, z: -zp }, b: { x, y: yBeam, z: 0 }, r: T.frame.hangerRadius * 0.7, shaft: L.radius, axis: 'x' } }));

  // --- Ringen, rullene og planeten ---
  add({ name: 'ring', body: 'ring', kind: 'hjul', move: (s) => ({ x: 0, z: 0, angle: s.ring }),
    draw: { type: 'ringGear', teeth: R.teeth, module: ringModule, outer: ringOuter, y0: ringBottom, thickness: R.thickness } });
  for (const sx of [-1, 1]) {
    const base = angleOf({ x: sx * Xg, z: -zp });
    for (const da of [-R.rollerSpread / 2, R.rollerSpread / 2]) {
      const a = base + da * deg;
      const d = dirOf(a);
      for (const [label, yRoll, yBar] of [['over', rollerTopY, rollerBarTop], ['under', rollerBottomY, rollerBarBottom]]) {
        const id = `${sx < 0 ? 'v' : 'h'}${da < 0 ? 1 : 2} ${label}`;
        add({ name: `rulle ${id}`, body: 'stativ', kind: 'hjul',
          draw: { type: 'roller', c: { x: d.x * rollerAt, y: yRoll, z: d.z * rollerAt }, angle: a, r: R.rollerRadius, width: R.rollerWidth } });
        // Staget: fra stolpen ut over (eller under) ringen, og ned (opp) til rulleakselen.
        const over = { x: d.x * rollerAt, y: yBar, z: d.z * rollerAt };
        add({ name: `rullestag ${id}`, body: 'stativ', kind: 'ramme',
          draw: { type: 'rod', a: { x: sx * Xg, y: yBar, z: -zp }, b: over, r: rollerArm } });
        add({ name: `rullegaffel ${id}`, body: 'stativ', kind: 'ramme',
          draw: { type: 'rod', a: over, b: { x: d.x * (rollerAt - R.rollerWidth / 2 - 0.12), y: yRoll, z: d.z * (rollerAt - R.rollerWidth / 2 - 0.12) }, r: forkR } });
      }
    }
  }
  const planetMove = (s) => ({ x: 0, z: 0, angle: s.ring });
  add({ name: 'planetstolpe', body: 'ring', kind: 'ramme', move: planetMove,
    draw: { type: 'cyl', r: T.planet.postRadius, y0: ringTop, y1: H, at: { x: planetPost, z: 0 } } });
  add({ name: 'planetring', body: 'ring', kind: 'ramme', move: planetMove,
    draw: { type: 'torus', r: T.planet.postRadius, y: ringTop + 0.15, at: { x: planetPost, z: 0 } } });
  add({ name: 'planet', body: 'ring', kind: 'kule', move: planetMove,
    draw: { type: 'sphere', r: T.planet.radius, c: { x: planetPost, y: H, z: 0 }, look: 'planet' } });

  return parts;
}

// y0 og y1 fra et høydeintervall.
function yr([y0, y1]) { return { y0, y1 }; }

// Delene som skal berøre hverandre (tapper i slisser, hjul i inngrep, aksler i
// rør og lagre, hylser på skinner). Navnene uten maskinbokstav gjelder i alle
// tre maskinene. Brukes av sjekken.
export const touching = [
  ['X-aksel', 'X-rør'], ['X-aksel', 'ramme'], ['Y-aksel', 'Y-rør'], ['Y-aksel', 'ramme'],
  ['X-aksel', 'X-fast hjul'], ['Y-aksel', 'Y-fast hjul'],
  ['X-hjul', 'mellomhjul'], ['mellomhjul', 'Y-hjul'], ['mellomhjul', 'mellomaksel'],
  ['X-hjul', 'X-rør'], ['Y-hjul', 'Y-rør'],
  ['X-planethjul', 'X-fast hjul'], ['Y-planethjul', 'Y-fast hjul'],
  ['X-planethjul', 'X-arm'], ['X-spindel', 'X-arm'], ['X-skive', 'X-arm'],
  ['Y-planethjul', 'Y-arm'], ['Y-spindel', 'Y-arm'], ['Y-skive', 'Y-arm'],
  ['X-tapp', 'X-sleide'], ['Y-tapp', 'Y-sleide'], ['utgangstapp', 'X-sleide'], ['utgangstapp', 'Y-sleide'],
  ['X-hylse1', 'X-skinne1'], ['X-hylse2', 'X-skinne2'], ['Y-hylse1', 'Y-skinne1'], ['Y-hylse2', 'Y-skinne2'],
  ['X-sleide', 'X-skinne'], ['Y-sleide', 'Y-skinne'],
  ['X-vinkelgir', 'akselstreng: vinkelgir A'], ['X-vinkelgir', 'akselstreng: vinkelgir B'], ['X-vinkelgir', 'akselstreng'],
  ['X-aksel', 'bein'], ['X-vinkelgir', 'ramme'],
  ['Y-vinkelgir', 'bjelkeaksel: vinkelgir ned'], ['Y-vinkelgir', 'bjelkeaksel'], ['Y-aksel', 'bjelkeaksel: vinkelgir ned'],
  ['akselstreng: vinkelgir gren', 'gren: vinkelgir inn'], ['akselstreng', 'gren: vinkelgir inn'], ['akselstreng: vinkelgir gren', 'gren'],
  ['gren: vinkelgir ut', 'loddrett: vinkelgir nede'], ['gren', 'loddrett: vinkelgir nede'], ['gren: vinkelgir ut', 'loddrett aksel'],
  ['loddrett: vinkelgir oppe', 'bjelkeaksel: vinkelgir inn'], ['loddrett aksel', 'bjelkeaksel: vinkelgir inn'], ['loddrett: vinkelgir oppe', 'bjelkeaksel'],
  ['loddrett aksel', 'bjelkeaksel'], ['gren', 'loddrett aksel'],
  ['pinjong', 'ring'], ['rulle', 'ring'],
  ['lager langs gulvet', 'akselstreng'], ['lager på grenen', 'gren'], ['lager loddrett', 'loddrett aksel'], ['lager bjelkeaksel', 'bjelkeaksel'],
  ['henger', 'ramme'], ['bjelkeaksel', 'Y-aksel'],
];

// Hva hver enhet som beveger seg er festet i (sjekkes: delen `via` i enheten
// skal berøre delen `by`, som står stille eller selv er festet).
export const mounts = [
  ...['A', 'B', 'C'].flatMap((n) => [
    { body: `${n}:X-sveiv`, via: `${n}:X-aksel`, by: `${n}:X-rør` },
    { body: `${n}:Y-sveiv`, via: `${n}:Y-aksel`, by: `${n}:Y-rør` },
    { body: `${n}:mellomhjul`, via: `${n}:mellomhjul`, by: `${n}:mellomaksel` },
    { body: `${n}:X-planet`, via: `${n}:X-spindel`, by: `${n}:X-arm` },
    { body: `${n}:Y-planet`, via: `${n}:Y-spindel`, by: `${n}:Y-arm` },
    { body: `${n}:X-sleide`, via: `${n}:X-hylse1`, by: `${n}:X-skinne1` },
    { body: `${n}:Y-sleide`, via: `${n}:Y-hylse1`, by: `${n}:Y-skinne1` },
    { body: `${n}:utgang`, via: `${n}:utgangstapp`, by: `${n}:Y-sleide` },
  ]),
  { body: 'akselstreng', via: 'akselstreng', by: 'lager langs gulvet 1' },
  { body: 'gren', via: 'gren', by: 'lager på grenen 1' },
  { body: 'loddrett', via: 'loddrett aksel', by: 'lager loddrett 1' },
  { body: 'bjelkeaksel', via: 'bjelkeaksel', by: 'lager bjelkeaksel 1' },
  { body: 'ring', via: 'ring', by: 'rulle h1 over' },
];

// Tallene som vises på siden og skrives ut av sjekken.
export const summary = {
  amp, xMax, zMax, dX, dY, Oz, H, Xg, zp, zFar, trainModule, ringModule,
  epiX, epiY, plateTop, plateBottomC, yBeam, ringTop, ringPitch, ringOuter, planetPost,
  reach: Math.hypot(Xg, zFar) + T.frame.radius,
  height: yBeam + T.frame.beamRadius,
};
