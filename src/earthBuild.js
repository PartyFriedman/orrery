// Jordstolpen i three.js, fra en utforming i earthDesign.js: forlegsakselen og
// driveakselen ved foten, parallellhjulet og stolperøret, føringsringen,
// braketten, overgangen til jordaksen, jorda som roterer, og månen med staven og
// foten som følger ringen. Brukes av modellen (main.js).
//
// Gruppen `end` står ytterst på jordarmen (armens koordinater, origo på
// loddlinjen gjennom stolpen). Monteringsrammen (x dit jordaksen heller) står
// inni parallellgruppa, dreid earthAxisDirection.
import * as THREE from 'three';
import { gear as gearStyle, moonTrain, earthDay as ED, moonGuide as MG } from './config.js';
import { createGearGeometry, createBevelGeometry, createSprocketGeometry } from './gear.js';
import { createArmGeometry } from './arm.js';
import { makeBuilder, bandGeometry } from './build.js';

const TC = moonTrain.thickness;

// Tannhjulene ved jorda: eiker når de er store nok, og avfasing og klaring
// etter størrelsen.
const gearSettings = (teeth, module, thickness, hole) => {
  const pitch = (module * teeth) / 2;
  const spokes = pitch > 1.4 ? (teeth >= 40 ? 5 : 4) : 0;
  return {
    teeth, module, pressureAngle: gearStyle.pressureAngle, backlash: module * 0.15, holeRadius: hole,
    spokes, spokeWidth: Math.max(0.2, pitch * 0.16), hubWidth: Math.max(0.15, pitch * 0.12), rimWidth: Math.max(0.15, pitch * 0.13),
    thickness, chamfer: Math.min(0.08, thickness * 0.2),
  };
};

// Bygger alt ytterst på jordarmen. opts:
//   materials: { white, metal }
//   moonChain, parallelChain: kjedene langs armen (radiene til kjedehjulene ved jorda)
//   earthAxisDirection: vinkelen monteringsrammen står i på parallellhjulet
//   addEarth(group): legger jorda (overflaten) i gruppa som roterer
//   addMoon(group, position): legger månen i glidebiten
// Gir tilbake gruppene, delene som går fort (til blur.js) og update(vinkler).
export function buildEarthEnd(d, opts) {
  const { white, metal } = opts.materials;
  const { mesh, shaft: cyl, rod, ball, bracket, groupAt } = makeBuilder(white);
  // Tannhjul med midten i høyden y (langs gruppens y).
  const addGear = (parent, teeth, module, thickness, hole, y) => {
    const m = mesh(parent, createGearGeometry(gearSettings(teeth, module, thickness, hole)));
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
  const s = d.stack, g = d.g, top = d.top, H = d.H, L = d.L;
  const P = ED.P, F = MG.follower;
  const end = new THREE.Group();
  const fast = [];
  const track = (group, gears = [], trail = null, extra = []) => fast.push({ group, gears, trail, extra });

  // Forlegsakselen på armen, med tannhjulet og kjedehjulet til dagkjedet.
  const layGroup = groupAt(end, d.lay.x - L);
  cyl(layGroup, d.lay.shaftR, s.armTop, d.lay.top);
  const layGear = addGear(layGroup, P.layGear, P.module, ED.shaftGearThickness, d.lay.shaftR, s.level1 + ED.shaftGearThickness / 2);
  const laySprocket = addSprocket(layGroup, P.laySprocket, d.dayChain.radius2, d.dayChain.rollerRadius, d.lay.shaftR, s.day);
  track(layGroup, [layGear, laySprocket]);

  // Driveakselen (dreier sett fra armen), med tannhjulet nederst og lageret i armen.
  const shaft = groupAt(end);
  cyl(shaft, d.dsR, d.shaftBottom, d.shaftTop);
  cyl(end, d.dsR + 0.25, s.armTop, s.armTop + 0.15);
  const shaftGear = addGear(shaft, P.shaftGear, P.module, ED.shaftGearThickness, d.dsR, s.level1 + ED.shaftGearThickness / 2);
  track(shaft, [shaftGear]);

  // Parallellhjulet og stolperøret (står stille i rommet), og monteringsrammen.
  const parallel = groupAt(end);
  addSprocket(parallel, moonTrain.parallelSprocket.teeth, opts.parallelChain.radius2, opts.parallelChain.rollerRadius, d.frameOuter, s.parallel, 4);
  cyl(parallel, d.frameOuter, d.frameBottom, d.frameTop);
  const mount = groupAt(parallel);
  mount.rotation.y = opts.earthAxisDirection;

  // Navet, stagene og ringen.
  cyl(mount, d.hubR, d.hubY0, d.hubY1);
  for (const [a, b] of d.struts) { rod(mount, a, b, MG.strutRadius); ball(mount, b, MG.strutRadius * 1.3); }
  mesh(mount, bandGeometry(d.ringAt, g.w, g.h));

  // Braketten fra stolperøret til lageret.
  bracket(mount, d.bracket, ED.bracket.radius, { fillet: ED.bracket.fillet, flareStart: true });

  // Rundt jordaksen: y i gruppen er aksen (s fra jordas sentrum), x er e1 (mot drivet).
  const tilted = groupAt(mount, 0, H);
  tilted.rotation.z = -d.tilt;
  const spin = groupAt(tilted);
  opts.addEarth(spin);
  cyl(spin, d.spR, ...top.spindle);
  ball(spin, { x: 0, y: top.spindle[1], z: 0 }, d.spR * 1.6);                         // tuppen over nordpolen
  // Vinkelgiret: hjulet på spindelen og hjulet på driveakselen, og lageret over.
  const V = ED.V;
  const earthGear = addBevel(spin, V.earthTeeth, V.module, V.faceWidth, d.spR, top.sE, -top.sE);
  cyl(tilted, d.spR + ED.bearing.wall, ...top.bearing);
  const vertical = groupAt(mount);
  const vGear = addBevel(vertical, V.shaftTeeth, V.module, V.faceWidth, d.dsR, top.yV, top.dropV);
  track(vertical, [vGear]);
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
  // Gaffelen med to ruller, én oppå og én under ringen.
  const rollers = [];
  const bar = mesh(slider, new THREE.BoxGeometry(F.barWidth, 2 * g.barHalf, F.barWidth * 1.6));
  bar.position.set(g.barR, d.ringY, 0);
  for (const k of [1, -1]) {
    const y = d.ringY + k * g.rollerCenter;
    rod(slider, { x: g.barInner, y, z: 0 }, { x: g.rc - F.rollerWidth / 2 - 0.02, y, z: 0 }, F.axleRadius, metal);
    const holder = groupAt(slider, g.rc, y);
    const roller = mesh(holder, new THREE.CylinderGeometry(F.rollerRadius, F.rollerRadius, F.rollerWidth, 24), metal);
    roller.rotation.z = Math.PI / 2;                                               // aksen radielt
    // Et merke på rullen, så man ser at den ruller.
    const mark = mesh(holder, new THREE.BoxGeometry(F.rollerWidth * 1.02, 0.03, 0.03), white);
    mark.position.y = F.rollerRadius * 0.98;
    rollers.push({ holder, sign: k });
  }
  track(moon, [], { radius: d.orbit, y: H, tube: opts.moonRadius * 0.35 });

  // Vinklene (alle sett fra armen): parallelAngle, moonAngle, shaftArm (driveakselen),
  // layAngle (forlegsakselen) og spin (jorda om sin akse, i den skrå gruppa).
  const update = (a) => {
    layGroup.rotation.y = a.layAngle;
    shaft.rotation.y = a.shaftArm;
    parallel.rotation.y = a.parallelAngle;
    vertical.rotation.y = a.shaftArm - a.parallelAngle;
    spin.rotation.y = a.spin;
    moon.rotation.y = a.moonAngle;
    const phi = a.moonAngle - a.parallelAngle - opts.earthAxisDirection;            // månearmen i monteringsrammen
    slider.position.y = d.lift(phi);
    for (const r of rollers) r.holder.rotation.x = (r.sign * g.rc * phi) / F.rollerRadius;
  };
  return { end, tilted, spinEntry, fast, update };
}
