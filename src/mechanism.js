// Mekanismen som ren matematikk (uten three.js): hvor lange armene er, hvor
// akslene og rørene står, hvor høyt hver del ligger, hvor kjedene går, og
// hvilken vinkel hvert hjul har for en gitt inngangsvinkel.
//
// Vinkler er i radianer, målt mot klokka sett ovenfra, fra +x.
// Posisjoner er i planet: { x, y } der planets y tilsvarer -z i three.js.

import {
  drive, outerDrive, spacing, center, gear, bigGear, smallGear, arm, armStyle,
  planets, moonTrain, bodies, tilt, moonSize, time, jupiterMoons, accent, saturnMoons, saturnRing, marsMoons,
  counterDrive, uranusRing, uranusPost, iceMoons as IM, earthDay as ED,
} from './config.js';
import { longitudeAt, addYears, marsPoleLongitude, uranusPoleLongitude } from './ephemeris.js';
import { ringLayout, thinRingLayout } from './ringLayout.js';
import { uranusDesign, neptuneDesign, attachUranusArm, attachNeptuneArm, firstChainAbove } from './iceMoons.js';
import { earthDesign, ratesFor, gmst } from './earthDesign.js';

const { gap, chainGap, reachGap, moonGap } = spacing;
const pitchRadius = (module, teeth) => (module * teeth) / 2;
const degrees = (d) => (d * Math.PI) / 180;
const at = (direction, distance) => ({ x: Math.cos(direction) * distance, y: Math.sin(direction) * distance });

// Alle hjulparene nederst går til sentrum fra en aksel like langt ute
// (mellomakselen eller forlegsakselen), altså over samme avstand. Avstanden er
// modul × (tenner1 + tenner2) / 2, så hvert par får den modulen som gjør at
// akkurat det paret når over.
export const pairModule = (teeth1, teeth2) => (2 * drive.distance) / (teeth1 + teeth2);

// Det samme for et hjul (2) som griper inn i et ringhjul med innvendige tenner
// (1), når hjul 2 står i retning `direction` fra midten av ringhjulet. De
// dreier samme vei.
export function internalMeshAngle(angle1, teeth1, teeth2, direction) {
  return direction - Math.PI / teeth2 + (teeth1 / teeth2) * (angle1 - direction);
}

// Vinkelen hjul 2 må ha for å gripe inn i hjul 1, når hjul 1 har vinkelen
// angle1 og hjul 2 står i retning `direction` fra hjul 1.
// Formelen gir motsatt dreieretning, forholdet teeth1/teeth2, og plasserer en
// tann på det ene hjulet midt i et mellomrom på det andre der de møtes.
export function meshAngle(angle1, teeth1, teeth2, direction) {
  return direction + Math.PI - Math.PI / teeth2 + (teeth1 / teeth2) * (direction - angle1);
}

const { fixed, pinion, driveSprocket, moonSprocket, parallelSprocket } = moonTrain;

// --- Kjeder ---
// Et kjede går rundt to kjedehjul langs en linje (det første nærmest
// sentrum). Begge hjulene dreier samme vei. Kjedehjulenes radius er valgt så
// buen mellom to tenner er nøyaktig én ledd-lengde, så rullene ligger i
// setene hele veien.
const sprocketRadius = (teeth, pitch) => (teeth * pitch) / (2 * Math.PI);

function makeChain(name, from, to, teeth1, teeth2, chainPitch = moonTrain.chainPitch) {
  const span = to.x - from.x;
  const rollerRadius = chainPitch * 0.3;

  // Lengden av kjedebanen for en gitt ledd-lengde.
  const loopLength = (p) => {
    const a = sprocketRadius(teeth1, p);
    const b = sprocketRadius(teeth2, p);
    const alpha = Math.acos((a - b) / span);
    return 2 * Math.sqrt(span ** 2 - (a - b) ** 2) + 2 * alpha * b + (2 * Math.PI - 2 * alpha) * a;
  };

  // Kjedehjulene må få plass ved siden av hverandre, med litt luft.
  const needed = sprocketRadius(teeth1, chainPitch) + sprocketRadius(teeth2, chainPitch) + chainPitch * 2;
  if (span < needed) {
    throw new Error(`${name}: kjedehjulene står for nær hverandre (${span.toFixed(1)}, trenger ${needed.toFixed(1)}).`);
  }

  // Et ekte kjede har et helt antall ledd. Vi runder av til nærmeste hele antall
  // og justerer ledd-lengden bittelitt så kjedet går nøyaktig opp.
  const links = Math.round(loopLength(chainPitch) / chainPitch);
  let low = chainPitch * 0.8;
  let high = chainPitch * 1.2;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (loopLength(mid) / mid > links) low = mid; // for mange ledd: større ledd
    else high = mid;
  }
  const pitch = (low + high) / 2;
  const r1 = sprocketRadius(teeth1, pitch);
  const r2 = sprocketRadius(teeth2, pitch);
  const alpha = Math.acos((r1 - r2) / span); // hvor kjedet slipper hjulene
  const straight = Math.sqrt(span ** 2 - (r1 - r2) ** 2);
  const length = links * pitch;

  // Banen går mot klokka: langs undersiden ut fra hjul 1, rundt hjul 2,
  // langs oversiden tilbake og rundt hjul 1.
  const arc2Start = straight;
  const backStart = arc2Start + 2 * alpha * r2;
  const arc1Start = backStart + straight;

  const onCircle = (c, r, angle) => ({ x: c.x + r * Math.cos(angle), y: c.y + r * Math.sin(angle) });
  const lerp = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

  return {
    links,
    pitch,
    rollerRadius,
    radius1: r1,
    radius2: r2,

    // Punktet en avstand `u` langs kjedet, i kjedets koordinatsystem.
    point(u) {
      u = ((u % length) + length) % length;
      if (u < arc2Start) return lerp(onCircle(from, r1, -alpha), onCircle(to, r2, -alpha), u / straight);
      if (u < backStart) return onCircle(to, r2, -alpha + (u - arc2Start) / r2);
      if (u < arc1Start) return lerp(onCircle(to, r2, alpha), onCircle(from, r1, alpha), (u - backStart) / straight);
      return onCircle(from, r1, alpha + (u - arc1Start) / r1);
    },

    // Hjul 1 drar kjedet med seg: en bue på hjulet er like lang som strekket
    // kjedet flytter seg. Startpunktet er valgt så rull nr. 0 ligger i et sete.
    offsetFor(angle1) {
      return arc1Start - alpha * r1 + angle1 * r1;
    },

    // Kjedet drar hjul 2 like langt langs sin bue. Vinkelen er valgt så rullene
    // som ligger på hjul 2, også ligger i setene.
    angle2For(offset) {
      return -alpha + (offset - arc2Start) / r2;
    },
  };
}

// --- Mål på armene ---
// Mål på armene og det som står ytterst på dem (stolpe, tapp eller hylse),
// brukt både av scenen og av avstandssjekkene. Enden er minst så bred at
// kragen rundt stolpen får plass på den flate toppen, innenfor avfasingen.
const armPart = (rootWidth, postRadius) => {
  const collarRadius = postRadius + armStyle.collarWidth;
  return {
    rootHalf: rootWidth / 2,
    endRadius: Math.max((rootWidth / 2) * armStyle.tipWidth, collarRadius + armStyle.chamfer + 0.05),
    postRadius,
    collarRadius,
  };
};
export const armParts = {
  planet: armPart(arm.width * 0.75, 0.5), // planetarmene og stolpene
  earth: armPart(arm.width, 0.9),         // jordarmen og tappen parallellhjulet går på
  moon: armPart(arm.width * 0.75, 0.8),   // månearmen og hylsa
  // Månearmene ved Jupiter: smale, uten krage, så de går klar av nabostolpene.
  jupiterMoon: {
    rootHalf: jupiterMoons.armWidth / 2,
    endRadius: jupiterMoons.postRadius + 0.2,
    postRadius: jupiterMoons.postRadius,
    collarRadius: jupiterMoons.postRadius,
  },
};

// --- Plass rundt hver planet ---
// Månebanene pakkes utover fra planeten (eller fra ringen): hver måne går
// moonGap klar av det som er innenfor. Rundt den ytterste månen holdes litt
// ekstra av til en framtidig månearm. Ingenting av dette bygges ennå.
const moonHardware = 0.8;
// Saturns ring er en skive (inner og outer), Uranus' ringer en liste tynne ringer.
const ringExtent = (p) => {
  if (!p.ring) return null;
  if (p.ring.rings) {
    const r = thinRingLayout(p.radius, p.ring);
    return { inner: r.inner, outer: r.outer, tilt: degrees(p.ring.tilt) };
  }
  return { inner: p.ring.inner * p.radius, outer: p.ring.outer * p.radius, tilt: degrees(p.ring.tilt) };
};
export const moonSystems = Object.fromEntries(Object.entries(planets).map(([name, p]) => {
  const ring = ringExtent(p);
  const orbits = [];
  let edge = ring ? ring.outer : p.radius;
  for (const moon of p.moons ?? []) {
    // Mars' måner har egne, små størrelser (marsMoons.size).
    const radius = (name === 'mars' && marsMoons.size?.[moon]) || moonSize(moon);
    const orbit = edge + moonGap + radius;
    orbits.push({ name: moon, radius, orbit });
    edge = orbit + radius;
  }
  const last = orbits.at(-1);
  const envelope = Math.max(ring ? ring.outer : 0, last ? last.orbit + Math.max(last.radius, moonHardware) : 0);
  return [name, { ring, orbits, envelope }];
}));

// Hvilken mekanikk som ligger over armen: jorda har månehjulverk med
// parallellføring, Jupiter har månerøret ('moonDrive'), andre har det de
// reserverer plass til.
export const mechanismOf = (name) => (name === 'earth' ? 'moons+parallel' : planets[name].mechanism ?? null);
for (const [name, p] of Object.entries(planets)) {
  if (p.mechanism === 'moonDrive' && name !== 'jupiter') {
    throw new Error(`planets.${name}.mechanism: 'moonDrive' er bare bygget for Jupiter.`);
  }
  if (p.mechanism === 'ringMoons' && name !== 'saturn') {
    throw new Error(`planets.${name}.mechanism: 'ringMoons' er bare bygget for Saturn.`);
  }
  if (p.mechanism === 'epicyclic' && name !== 'mars') {
    throw new Error(`planets.${name}.mechanism: 'epicyclic' er bare bygget for Mars.`);
  }
  if (p.mechanism === 'parallelMoons' && name !== 'uranus') {
    throw new Error(`planets.${name}.mechanism: 'parallelMoons' er bare bygget for Uranus.`);
  }
  if (p.mechanism === 'idlerMoon' && name !== 'neptune') {
    throw new Error(`planets.${name}.mechanism: 'idlerMoon' er bare bygget for Neptun.`);
  }
  if (p.counterTeeth && !planets.saturn?.layTeeth) {
    throw new Error(`planets.${name}.counterTeeth: motakselen drives fra Saturn-røret, så Saturn må drives fra forlegsakselen (layTeeth).`);
  }
}

// --- Hjulverket ved Jupiter ---
// Rundt Jupiter-stolpen står kragen (nederst) og ett rør per måne, Io innerst.
// Forlegsakselen står layDistance innenfor stolpen, og hvert hjulpar har den
// modulen som gjør at paret når over. Alle mål her er fra Jupiter-stolpen.
const J = jupiterMoons;
const jupiterMoonNames = planets.jupiter.moons;
const layModule = (teeth1, teeth2) => (2 * J.layDistance) / (teeth1 + teeth2);
const tipOf = (module, teeth) => pitchRadius(module, teeth) + module;
const rootOf = (module, teeth) => pitchRadius(module, teeth) - 1.25 * module;
export const jupiterTrain = (() => {
  const post = armParts.planet.postRadius;
  const collarModule = layModule(J.collarTeeth, J.collarPinion);
  const train = {
    collar: { inner: post, outer: post + J.tubeWall, module: collarModule },
    moons: {},
  };
  jupiterMoonNames.forEach((name, i) => {
    const [layTeeth, moonTeeth] = J.steps[name];
    train.moons[name] = {
      inner: post + i * J.tubeWall,
      outer: post + (i + 1) * J.tubeWall,
      module: layModule(layTeeth, moonTeeth),
      layTeeth,
      moonTeeth,
    };
  });
  const gears = [
    { name: 'kragen', module: collarModule, moonTeeth: J.collarTeeth, layTeeth: J.collarPinion, outer: train.collar.outer },
    ...jupiterMoonNames.map((name) => ({ name, ...train.moons[name] })),
  ];
  // Det hjulverket rekker ut fra stolpen: hjulene på forlegsakselen ligger lengst inne.
  train.reach = Math.max(...gears.map((g) => Math.max(J.layDistance + tipOf(g.module, g.layTeeth), tipOf(g.module, g.moonTeeth))));
  for (const g of gears) {
    if (rootOf(g.module, g.moonTeeth) < g.outer + 0.2) {
      throw new Error(`Hjulet på ${g.name === 'kragen' ? 'kragen' : `røret til ${g.name}`} ved Jupiter er for lite til røret: endre tanntallene i jupiterMoons.`);
    }
    if (rootOf(g.module, g.layTeeth) < J.shaftRadius + 0.2) {
      throw new Error(`Hjulet på forlegsakselen ved Jupiter som driver ${g.name} er for lite til akselen: endre tanntallene eller gjør jupiterMoons.shaftRadius mindre.`);
    }
    if (tipOf(g.module, g.moonTeeth) > J.layDistance - J.shaftRadius - 0.3) {
      throw new Error(`Hjulet til ${g.name} ved Jupiter går for nær forlegsakselen: øk jupiterMoons.layDistance.`);
    }
    if (tipOf(g.module, g.layTeeth) > J.layDistance - g.outer - 0.3) {
      throw new Error(`Hjulet på forlegsakselen som driver ${g.name} går for nær rørene på Jupiter-stolpen: øk jupiterMoons.layDistance.`);
    }
  }
  return train;
})();

// --- Hjulverket ved Saturn ---
// Alt ved Saturn som står i ringplanet eller rundt Saturns akse, regnes i den
// skrå aksens koordinatsystem: s langs aksen (0 = ringplanet, positivt mot
// nordpolen) og rho fra aksen. Den skrå forlegsakselen står layDistance fra
// aksen, i retning x' (den veien aksen heller). Den går gjennom punktet P rett
// under Saturns sentrum, der den loddrette driveakselen og forlegsakselen
// møtes (toppen av kjeglene til vinkelgiren).
const SM = saturnMoons;
export const saturnMoonNames = planets.saturn.moons;
const saturnTilt = degrees(saturnRing.tilt);
const segDist2 = (p, q, r, s) => {
  const d1 = { x: q.x - p.x, y: q.y - p.y }, d2 = { x: s.x - r.x, y: s.y - r.y }, w0 = { x: p.x - r.x, y: p.y - r.y };
  const a = d1.x * d1.x + d1.y * d1.y, b = d1.x * d2.x + d1.y * d2.y, c = d2.x * d2.x + d2.y * d2.y;
  const dd = d1.x * w0.x + d1.y * w0.y, e = d2.x * w0.x + d2.y * w0.y;
  const clamp = (x) => Math.max(0, Math.min(1, x));
  let sc = a > 0 ? clamp(-dd / a) : 0;
  const tc = c > 0 ? clamp((b * sc + e) / c) : 0;
  sc = a > 0 ? clamp((b * tc - dd) / a) : 0;
  return Math.hypot(w0.x + sc * d1.x - tc * d2.x, w0.y + sc * d1.y - tc * d2.y);
};
// Avstanden fra et linjestykke til et rektangel { x0, x1, y0, y1 } i planet (0 hvis de overlapper).
const segRectDist = (p, q, r) => {
  const inside = (u) => u.x >= r.x0 && u.x <= r.x1 && u.y >= r.y0 && u.y <= r.y1;
  if (inside(p) || inside(q)) return 0;
  const c = [{ x: r.x0, y: r.y0 }, { x: r.x1, y: r.y0 }, { x: r.x1, y: r.y1 }, { x: r.x0, y: r.y1 }];
  let best = Infinity;
  for (let i = 0; i < 4; i++) best = Math.min(best, segDist2(p, q, c[i], c[(i + 1) % 4]));
  return best;
};
export const saturnTrain = (() => {
  const R = planets.saturn.radius;
  const ring = ringLayout(R, saturnRing);
  if (ring.bands.length !== 3) {
    throw new Error('saturnRing.bands må være 3 i modellen: ett bånd per måne (C, B og A).');
  }
  if (SM.bandMoons.A !== 'enceladus' || SM.bandMoons.B !== 'titan' || SM.bandMoons.C !== 'iapetus') {
    throw new Error('saturnMoons.bandMoons: bare A Enceladus, B Titan og C Iapetus går opp. Bare det ytterste båndet kan få armen rett ut i ringplanet, og Iapetus drives fra Titan-røret ved siden av.');
  }
  const LD = SM.layDistance, T = SM.thickness;
  const band = { C: ring.bands[0], B: ring.bands[1], A: ring.bands[2] };
  const ax = SM.axleRadius, w = SM.tubeWall;
  const tubeOf = { C: { inner: ax, outer: ax + w }, B: { inner: ax + w, outer: ax + 2 * w }, A: { inner: ax + 2 * w, outer: ax + 3 * w } };
  const sleeve = { inner: SM.shaftRadius, outer: SM.shaftRadius + w };
  const pairModuleAt = (z1, z2) => (2 * LD) / (z1 + z2);
  const pairs = {
    enceladus: { lay: SM.steps.enceladus[0], tube: SM.steps.enceladus[1], band: 'A' },
    titan: { lay: SM.steps.titan[0], tube: SM.steps.titan[1], band: 'B' },
    // Iapetus: fra et ekstra hjul på Titan-røret til hylsa, og fra hylsa til Iapetus-røret.
    titan2: { lay: SM.iapetusStage[0][1], tube: SM.iapetusStage[0][0], band: 'B', onSleeve: true },
    iapetus: { lay: SM.iapetusStage[1][0], tube: SM.iapetusStage[1][1], band: 'C', onSleeve: true },
  };
  for (const [name, p] of Object.entries(pairs)) {
    p.module = pairModuleAt(p.lay, p.tube);
    // Rørene som står rundt aksen der hjulet ligger: båndets eget rør er ytterst.
    const around = tubeOf[p.band].outer;
    const shaft = p.onSleeve ? sleeve.outer : SM.shaftRadius;
    const label = { enceladus: 'Enceladus', titan: 'Titan', titan2: 'Titan (til hylsa)', iapetus: 'Iapetus' }[name];
    if (rootOf(p.module, p.tube) < around + 0.2) {
      throw new Error(`Hjulet på båndrøret til ${label} ved Saturn er for lite til røret: endre saturnMoons.steps/iapetusStage eller øk layDistance.`);
    }
    if (rootOf(p.module, p.lay) < shaft + 0.2) {
      throw new Error(`Hjulet på forlegsakselen ved Saturn som driver ${label} er for lite til akselen: endre tanntallene.`);
    }
    if (tipOf(p.module, p.tube) > LD - shaft - 0.3) {
      throw new Error(`Hjulet på båndrøret til ${label} går for nær forlegsakselen ved Saturn: øk saturnMoons.layDistance.`);
    }
    if (tipOf(p.module, p.lay) > LD - around - 0.3) {
      throw new Error(`Hjulet på forlegsakselen som driver ${label} går for nær rørene på Saturns akse: øk saturnMoons.layDistance.`);
    }
  }

  // Vinkelgiren: to koniske hjul med toppunkt i P. Aksene står saturnTilt fra
  // hverandre, og begge hjulene ligger under P, så de dreier motsatt vei (som
  // et vanlig hjulpar). Hjul 1 sitter på driveakselen, hjul 2 nederst på forlegsakselen.
  const bz1 = SM.bevel.driveTeeth, bz2 = SM.bevel.layTeeth, bm = SM.bevel.module;
  const delta1 = Math.atan2(Math.sin(saturnTilt), bz2 / bz1 + Math.cos(saturnTilt));
  const delta2 = saturnTilt - delta1;
  const r1 = (bm * bz1) / 2, r2 = (bm * bz2) / 2;
  const coneDistance = r1 / Math.sin(delta1);
  const bevel = {
    driveTeeth: bz1, layTeeth: bz2, module: bm, delta1, delta2, r1, r2, coneDistance,
    drop1: coneDistance * Math.cos(delta1),  // hjul 1 ligger så langt under P (loddrett)
    drop2: coneDistance * Math.cos(delta2),  // hjul 2 ligger så langt under P (langs forlegsakselen)
  };
  if (rootOf(bm, bz2) < SM.shaftRadius + 0.2) throw new Error('Det koniske hjulet på forlegsakselen ved Saturn er for lite til akselen: øk saturnMoons.bevel.layTeeth eller module.');
  if (rootOf(bm, bz1) < SM.driveShaftRadius + 0.2) throw new Error('Det koniske hjulet på driveakselen ved Saturn er for lite til akselen: øk saturnMoons.bevel.driveTeeth eller module.');
  const P = { s: -LD / Math.tan(saturnTilt), drop: LD / Math.sin(saturnTilt) }; // P langs aksen, og loddrett under Saturns sentrum
  bevel.layGear = P.s - bevel.drop2;                                              // midten av hjul 2, langs aksen

  // Stagene og navene: hvert bånd har et nav på sitt rør og stag opp til
  // midten av undersiden av båndet. Navet til C ligger høyest, så lavt at
  // stagene går klar av kula. Navene under ligger så stagene deres går klar av
  // stagene, navene og båndene over.
  const gap = spacing.gap;
  const strutR = saturnRing.struts.width / 2;
  const hubLength = 0.5, hubRise = 0.25;
  const bandBottom = -saturnRing.thickness / 2;
  const hubs = {};
  const struts = {};
  const obstacles = [];  // rektangler (rho, s) og stag som er lagt ut så langt
  for (const b of ['C', 'B', 'A']) {
    const hubRadius = tubeOf[b].outer + hubRise;
    const attach = (band[b].inner + band[b].outer) / 2;
    // Staget går fra litt inne i navet (så det sitter fast) til undersiden av båndet.
    const clear = (s) => {
      const p = { x: hubRadius - 0.05, y: s }, q = { x: attach, y: bandBottom };
      const need = gap + strutR + 0.01;
      if (segDist2(p, q, { x: 0, y: 0 }, { x: 0, y: 0 }) < R + need) return false;      // kula
      for (const o of obstacles) {
        const d = o.rect ? segRectDist(p, q, o.rect) : segDist2(p, q, o.a, o.b) - strutR;
        if (d < need) return false;
      }
      return true;
    };
    let s = b === 'C' ? -R : hubs[b === 'B' ? 'C' : 'B'].s - hubLength - gap;
    while (!clear(s)) {
      s -= 0.05;
      if (s < -40) throw new Error(`Stagene til bånd ${b} i Saturns ring finner ikke plass: gjør saturnRing.struts.width mindre.`);
    }
    hubs[b] = { s, radius: hubRadius, length: hubLength, attach };
    struts[b] = { from: { rho: hubRadius - 0.05, s }, to: { rho: attach, s: bandBottom } };
    obstacles.push({ a: { x: hubRadius - 0.05, y: s }, b: { x: attach, y: bandBottom } });
    obstacles.push({ rect: { x0: band[b].inner, x1: band[b].outer, y0: bandBottom, y1: -bandBottom } });
    obstacles.push({ rect: { x0: tubeOf[b].outer, x1: hubRadius, y0: s - hubLength / 2, y1: s + hubLength / 2 } });
  }

  // Hjulene under navene, ovenfra: Enceladus (A-røret), Titan, Titans ekstra
  // hjul, Iapetus (C-røret). Under dem en plate som holder akselen og
  // forlegsakselen, og under platen vinkelgiren.
  const level = {};
  level.enceladus = hubs.A.s - hubLength / 2 - gap - T / 2;
  level.titan = level.enceladus - T - gap;
  level.titan2 = level.titan - T - gap;
  level.iapetus = level.titan2 - T - gap;
  const plateThickness = 0.4;
  level.plate = level.iapetus - T / 2 - gap - plateThickness / 2;
  if (level.plate - plateThickness / 2 - gap < bevel.layGear + T / 2) {
    throw new Error('Vinkelgiren ved Saturn går inn i hjulene på forlegsakselen: øk saturnMoons.layDistance eller gjør saturnMoons.bevel.module mindre.');
  }

  // Månearmene over ringen. Enceladus: rett ut fra ytterkanten av A-båndet,
  // i ringplanet. Titan og Iapetus: et ledd opp fra midten av B- og C-båndet,
  // og en arm over det som ligger under (månene og armene).
  const orbits = Object.fromEntries(moonSystems.saturn.orbits.map((o) => [o.name, o]));
  const half = SM.armThickness / 2;
  const top = saturnRing.thickness / 2;
  const titanLift = Math.max(orbits.enceladus.radius, top) + gap + half + (SM.armLift.titan ?? 0);
  const iapetusLift = titanLift + Math.max(orbits.titan.radius, half) + gap + half + (SM.armLift.iapetus ?? 0);
  const arms = {
    enceladus: { band: 'A', s: 0, from: band.A.outer - 0.3, orbit: orbits.enceladus.orbit, radius: orbits.enceladus.radius },
    titan: { band: 'B', s: titanLift, from: (band.B.inner + band.B.outer) / 2, orbit: orbits.titan.orbit, radius: orbits.titan.radius },
    iapetus: { band: 'C', s: iapetusLift, from: (band.C.inner + band.C.outer) / 2, orbit: orbits.iapetus.orbit, radius: orbits.iapetus.radius },
  };

  return {
    radius: R, ring, band, tubeOf, sleeve, pairs, bevel, P, hubs, struts, strutRadius: strutR, level, plateThickness, arms,
    footRadius: SM.legRadius * 1.6,  // foten leddene står på, på glasset
    plateBearing: SM.shaftRadius + 0.35,  // lagerøyet i platen rundt forlegsakselen
    layDistance: LD,
    // Rørene langs aksen (nedre og øvre ende).
    tubeSpan: {
      A: [level.enceladus - T / 2, hubs.A.s + hubLength / 2],
      B: [level.titan2 - T / 2, hubs.B.s + hubLength / 2],
      C: [level.iapetus - T / 2, hubs.C.s + hubLength / 2],
    },
    sleeveSpan: [level.iapetus - T / 2, level.titan2 + T / 2],
    laySpan: [bevel.layGear - T / 2 - 0.1, level.enceladus + T / 2 + 0.1],
    axleSpan: [level.plate, R + 1.0],  // fra platen, gjennom kula og litt ut over nordpolen
  };
})();

// Kjedehjulene ute ved planeten (og kjedet rundt dem) rekker så langt ut fra
// planetens sentrum.
const chainEnd = (teeth) => sprocketRadius(teeth, moonTrain.chainPitch) + moonTrain.chainPitch * 0.3 * 1.3;
// --- Hjulverket ved Mars ---
// Som ved Saturn regnes alt rundt Mars' skrå akse med s langs aksen (0 =
// ekvatorplanet, positivt mot nordpolen) og rho fra aksen, og x' er retningen
// aksen heller mot. Ovenfra og ned under Mars: armen til Fobos (på solrøret),
// armen til Deimos (på bærerrøret), hjulparet med mellomhjulet (det lille
// hjulet på bærerrøret), bærerens øvre plate, planetgiret (laget med solhjulet
// og planet1 øverst, laget med ringhjulet og planet2 under), bærerens nedre
// plate, og skåla som holder ringhjulet og den faste akselen.
// Den skrå drivakselen står drive.distance fra Mars' akse, mot +x'. Forlenget
// nedover treffer den loddlinjen gjennom stolpen i K, og der sitter kryssleddet
// på toppen av stolpen.
const MM = marsMoons;
export const marsMoonNames = planets.mars.moons;
const marsTilt = degrees(MM.tilt);
export const marsTrain = (() => {
  const R = planets.mars.radius;
  const gap = spacing.gap, T = MM.thickness, plate = 0.15, half = MM.armThickness / 2, rise = 0.08;
  const PG = MM.planetary;
  if (PG.ring !== PG.sun + PG.planet1 + PG.planet2) {
    throw new Error('marsMoons.planetary: ring må være sun + planet1 + planet2, ellers når ikke planethjulene både solhjulet og ringhjulet.');
  }
  const m = PG.module;
  const carrierRadius = (m * (PG.sun + PG.planet1)) / 2;   // fra aksen til planetaksene
  const sunTube = { inner: MM.axleRadius, outer: MM.axleRadius + MM.tubeWall };
  const carrierTube = { inner: sunTube.outer, outer: sunTube.outer + MM.tubeWall };
  if (rootOf(m, PG.sun) < sunTube.outer + 0.15) throw new Error('Solhjulet i planetgiret ved Mars er for lite til røret: øk marsMoons.planetary.sun eller module.');
  if (carrierRadius - tipOf(m, PG.planet2) < MM.axleRadius + gap) throw new Error('Planethjulene (planet2) ved Mars når inn til akselen i midten: gjør planet2 mindre (og sun større).');
  const ringPitch = (m * PG.ring) / 2;
  // Kanten utenfor tennene er bred nok til at braketten kan festes på utsiden
  // og fortsatt gå klar av planethjulene inni.
  const ring = { pitch: ringPitch, tip: ringPitch - m, root: ringPitch + 1.25 * m, outer: ringPitch + 1.25 * m + 0.5 };

  // Månene og armene, og nivåene nedover.
  const orbits = Object.fromEntries(moonSystems.mars.orbits.map((o) => [o.name, o]));
  const level = {};
  level.phobosArm = -R - gap - rise - half;
  level.deimosArm = level.phobosArm - 2 * (half + rise) - gap;
  level.drive = level.deimosArm - half - rise - gap - T / 2;           // hjulparet med mellomhjulet
  level.carrierTop = level.drive - T / 2 - gap - plate / 2;
  level.sunLayer = level.carrierTop - plate / 2 - gap - T / 2;       // solhjulet og planet1
  level.ringLayer = level.sunLayer - T - gap;                        // ringhjulet og planet2
  level.carrierBottom = level.ringLayer - T / 2 - gap - plate / 2;
  level.bowl = level.carrierBottom - plate / 2 - gap - MM.bowlThickness / 2;  // bunnen i skåla

  // Hjulparet: det store hjulet på drivakselen (i x' = distance), mellomhjulet
  // ute ved ringhjulet (tappen står på en knast utenfor kanten, klar av
  // planethjulene), og det lille hjulet på bærerrøret.
  const DR = MM.drive, dm = DR.module, D = DR.distance;
  const rBig = (dm * DR.bigTeeth) / 2, rIdler = (dm * DR.idlerTeeth) / 2, rSmall = (dm * DR.smallTeeth) / 2;
  if (rootOf(dm, DR.smallTeeth) < carrierTube.outer + 0.15) throw new Error('Det lille hjulet på bærerrøret ved Mars er for lite til røret: øk marsMoons.drive.smallTeeth eller module.');
  if (rootOf(dm, DR.bigTeeth) < MM.tiltShaftRadius + 0.15) throw new Error('Det store hjulet på drivakselen ved Mars er for lite til akselen.');
  if (D - tipOf(dm, DR.bigTeeth) < tipOf(dm, DR.smallTeeth) + gap) {
    throw new Error('Det store hjulet ved Mars når inn til det lille på bærerrøret: øk marsMoons.drive.distance eller gjør hjulene mindre.');
  }
  if (D - MM.tiltShaftRadius < ring.outer + gap) throw new Error('Den skrå drivakselen ved Mars går for nær ringhjulet: øk marsMoons.drive.distance.');
  const idlerRho = rSmall + rIdler;                                   // fra Mars' akse til mellomhjulet
  if (idlerRho - MM.pinRadius < ring.root + gap) {
    throw new Error('Tappen til mellomhjulet ved Mars står for nær planethjulene: gjør marsMoons.drive.idlerTeeth større.');
  }
  const dBI = rBig + rIdler;                                          // fra det store hjulet til mellomhjulet
  const cosPhi = (D * D + idlerRho * idlerRho - dBI * dBI) / (2 * D * idlerRho);
  if (Math.abs(cosPhi) > 1) throw new Error('Mellomhjulet ved Mars får ikke plass mellom det store og det lille hjulet: endre marsMoons.drive.');
  const idlerPhi = Math.acos(cosPhi);                                 // vinkelen til mellomhjulet om Mars' akse, fra x'
  const drive = {
    distance: D, module: dm, rBig, rIdler, rSmall, idlerRho, idlerPhi,
    idler: { x: idlerRho * Math.cos(idlerPhi), z: idlerRho * Math.sin(idlerPhi) },   // z i vinkelretningen (three.js: −z)
    // K, toppen av stolpen: der drivakselen forlenget treffer loddlinjen.
    jointS: -D / Math.tan(marsTilt), jointDrop: D / Math.sin(marsTilt),
  };

  const hubRadius = (tube) => tube.outer + 0.15;
  const arms = {
    phobos: { s: level.phobosArm, tube: sunTube, orbit: orbits.phobos.orbit, radius: orbits.phobos.radius },
    deimos: { s: level.deimosArm, tube: carrierTube, orbit: orbits.deimos.orbit, radius: orbits.deimos.radius },
  };
  // Fobos-stolpen går opp forbi Mars: den må stå klar av kula.
  if (arms.phobos.orbit - MM.postRadius < R + gap) {
    throw new Error('Fobos går for nær Mars: øk spacing.moonGap eller gjør marsMoons.size mindre.');
  }

  return {
    radius: R, module: m, planetary: PG, carrierRadius, sunTube, carrierTube, ring, drive, level, arms,
    plateThickness: plate, hubRadius, hubLength: MM.armThickness + 2 * rise,
    axleSpan: [level.bowl - MM.bowlThickness / 2, R + 0.4],            // den faste akselen, fra skåla opp gjennom Mars
    sunTubeSpan: [level.sunLayer - T / 2, level.phobosArm + half + rise],
    carrierTubeSpan: [level.carrierTop - plate / 2, level.deimosArm + half + rise],
    driveShaftSpan: [drive.jointS, level.drive + T / 2],               // den skrå drivakselen, fra K til det store hjulet
    pinSpan: [level.ringLayer - T / 2, level.drive - T / 2],            // tappen til mellomhjulet, fra knasten opp
  };
})();

// --- Holderen ved Uranus ---
// Uranus ligger på siden, så ringplanet står nesten loddrett. Stolpen slutter
// under ringene, og en knekt brakett går vannrett ut langs polretningen, rett
// opp, og inn som en aksel i polen (den som peker nedover). Som ved Saturn og
// Mars regnes alt rundt aksen med s langs aksen (0 = ringplanet, positivt mot
// polen med akselen) og rho fra aksen, og x' er retningen aksen heller mot.
// Høyder her er fra Uranus' sentrum; heights legger til bodies.height.
// På stolpen: x den veien aksen heller, y opp, z til siden (som tiltedToPost).
const UR = uranusRing, UP = uranusPost;
const uranusTilt = degrees(UR.tilt);
export const uranusTrain = (() => {
  const R = planets.uranus.radius;
  const ring = thinRingLayout(R, UR);
  const gap = spacing.gap, r = UP.bracket.radius, half = UR.thickness / 2;
  const c = Math.cos(uranusTilt), sn = Math.sin(uranusTilt);
  const toPost = (x, s) => ({ x: x * c + s * sn, y: -x * sn + s * c });
  const toTilted = (x, y, z = 0) => ({ x: x * c - y * sn, s: x * sn + y * c, z });
  if (!(UR.tilt > 90 && UR.tilt < 180)) throw new Error('uranusRing.tilt må være mellom 90 og 180 grader (polakselen sitter i polen som peker nedover).');

  // Navet og stagene: navet sitter rett utenfor den myke overgangen der
  // akselen går inn i polen, og så langt ut at stagene går klar av kula.
  // Stagene går til siden av den innerste ringen som vender mot navet.
  const poleS = Math.sqrt(Math.max(R * R - 4 * r * r, 0));       // der overgangen (radius 2r) møter kula
  const strutR = UR.struts.width / 2;
  const hub = { radius: UP.hub.radius, length: UP.hub.length };
  const attach = { rho: ring.rings[0].middle, s: half };
  const strutClear = (s) => segDist2({ x: s, y: hub.radius - 0.05 }, { x: attach.s, y: attach.rho }, { x: 0, y: 0 }, { x: 0, y: 0 })
    >= R + gap + strutR;
  hub.s = poleS + UP.bracket.fillet + hub.length / 2;
  while (!strutClear(hub.s)) {
    hub.s += 0.05;
    if (hub.s > 4 * R) throw new Error('Stagene ved Uranus finner ikke plass: gjør uranusRing.struts.width eller uranusPost.hub.radius mindre.');
  }
  if (hub.radius > attach.rho - 0.5) throw new Error('Navet ved Uranus er for stort for ringene: gjør uranusPost.hub.radius mindre.');
  // Navet er en hylse fra den myke overgangen ved polen ut forbi stagene, så
  // akselen ikke står bar mellom kula og stagene.
  hub.s0 = poleS + UP.bracket.fillet;
  hub.s1 = hub.s + hub.length / 2;

  // Albuen: der braketten møter polakselen, rett utenfor navet.
  const elbowS = hub.s1 + gap + r;
  const elbow = toPost(0, elbowS);

  // Avstanden fra et punkt (på stolpen) til ringene (som én skive, med eikene).
  const toRing = (x, y, z = 0) => {
    const p = toTilted(x, y, z), rho = Math.hypot(p.x, p.z);
    return Math.hypot(Math.max(0, Math.abs(p.s) - half), Math.max(0, ring.inner - rho, rho - ring.outer));
  };
  // Den vannrette delen av braketten (med den myke overgangen ved stolpen, 2r)
  // og toppen av stolpen må gå klar av ringene.
  const postR = armParts.planet.postRadius;
  const clearAt = (y) => {
    for (let k = 0; k <= 40; k++) if (toRing((elbow.x * k) / 40, y) < gap + 2 * r) return false;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      if (toRing(postR * Math.cos(a), y + r, postR * Math.sin(a)) < gap) return false;
    }
    return true;
  };
  // Braketten går under hele ringen (ikke gjennom hullet i midten, der stolpen
  // ville gått tett inntil ringene og kula): søket starter ved den laveste ringen.
  let bracketY = -ring.outer * sn;
  while (!clearAt(bracketY)) bracketY -= 0.05;
  if (elbow.y < bracketY + 2 * r) throw new Error('Braketten ved Uranus får ikke plass under polakselen: endre uranusRing.tilt eller uranusPost.');

  // Stagene og eikene: tre retninger rundt aksen, ingen rett mot braketten (x').
  const count = UR.struts.count;
  const azimuths = Array.from({ length: count }, (_, k) => Math.PI / count + (2 * Math.PI * k) / count);
  return {
    radius: R, ring, tilt: uranusTilt, hub, attach, azimuths, strutRadius: strutR,
    elbowS, elbow, poleS,
    bracketY,                 // høyden på den vannrette delen, fra Uranus' sentrum
    postTop: bracketY + r,    // toppen av stolpen
    // Hvor langt det som står på stolpen rekker ut fra den (sett ovenfra).
    reach: Math.max(elbow.x + r, ring.outer),
  };
})();

// --- Månene til Uranus og Neptun (geometrien står i iceMoons.js) ---
// Uranus: Titania og Oberon på skrå stag fra rør på polakselen, drevet gjennom
// en vinkelgir på toppen av stolpen og en forlegsaksel i to lagre i braketten.
// Neptun: Triton på en arm fra et rør rundt stolpen, drevet fra en krage
// gjennom et dobbelthjul og et mellomhjul, og løftet av en skrå føringsring.
// Høydene ved armene settes når heights er regnet ut.
const UM = IM.uranus, NM = IM.neptune, UB = UM.bevel;
export const uranusMoonNames = ['titania', 'oberon'];
export const uranusMoonTrain = uranusDesign('B', uranusTrain, armParts);
export const neptuneMoonTrain = neptuneDesign(armParts);

// Hvor langt hjulverket ved Saturn (rundt den skrå aksen) rekker ut, sett ovenfra.
// En skive med radius r rundt et punkt (x', s) i den skrå aksens koordinater:
// hvor langt den rekker ut fra loddlinjen, sett ovenfra.
const tiltedDiscReach = (tiltAngle, x, s, r, z = 0) => {
  const c = Math.cos(tiltAngle), s0 = Math.sin(tiltAngle);
  let m = 0;
  for (let k = 0; k < 72; k++) {
    const a = (k / 72) * Math.PI * 2;
    m = Math.max(m, Math.hypot((x + r * Math.cos(a)) * c + s * s0, z + r * Math.sin(a)));
  }
  return m;
};
const marsGearboxReach = (() => {
  const MT = marsTrain, DR = MT.drive, s = MT.level.drive;
  let m = tiltedDiscReach(marsTilt, 0, MT.level.ringLayer, MT.ring.outer);
  m = Math.max(m, tiltedDiscReach(marsTilt, DR.distance, s, tipOf(DR.module, MM.drive.bigTeeth)));
  m = Math.max(m, tiltedDiscReach(marsTilt, DR.idler.x, s, tipOf(DR.module, MM.drive.idlerTeeth), DR.idler.z));
  return m;
})();
const saturnGearboxReach = (() => {
  const ST = saturnTrain;
  const disc = (x, s, r) => tiltedDiscReach(saturnTilt, x, s, r);
  let m = disc(ST.layDistance, ST.bevel.layGear, tipOf(ST.bevel.module, ST.bevel.layTeeth));
  for (const [name, p] of Object.entries(ST.pairs)) {
    const lvl = ST.level[name];
    m = Math.max(m, disc(0, lvl, tipOf(p.module, p.tube)), disc(ST.layDistance, lvl, tipOf(p.module, p.lay)));
  }
  return m;
})();
const mechanismEnd = (name) => {
  const kind = mechanismOf(name);
  if (!kind) return 0;
  if (kind === 'moonDrive') return jupiterTrain.reach;
  if (kind === 'ringMoons') {
    const sprocketEnd = Math.max(SM.shaftSprocket, SM.parallel.postSprocket) * SM.chainPitch / (2 * Math.PI) + SM.chainPitch * 0.3 * 1.3;
    return Math.max(sprocketEnd, saturnGearboxReach);
  }
  if (kind === 'epicyclic') {
    const sprocketEnd = Math.max(MM.shaftSprocket, MM.parallel.postSprocket) * MM.chainPitch / (2 * Math.PI) + MM.chainPitch * 0.3 * 1.3;
    return Math.max(sprocketEnd, marsGearboxReach);
  }
  if (kind === 'parallelMoons') {
    const sprocketEnd = Math.max(UP.parallel.postSprocket * UP.chainPitch, UM.shaftSprocket * UM.chainPitch) / (2 * Math.PI) + UP.chainPitch * 0.3 * 1.3;
    return Math.max(sprocketEnd, uranusMoonTrain.reach);
  }
  if (kind === 'idlerMoon') {
    return Math.max(neptuneMoonTrain.collarSprocket.edge, neptuneMoonTrain.reach);
  }
  return Math.max(chainEnd(moonSprocket.teeth), kind === 'moons+parallel' ? chainEnd(parallelSprocket.teeth) : 0);
};

// Hvor langt innover og utover hver arm rekker fra planetens sentrum.
const earthMoonReach = bodies.moonOrbit + Math.max(bodies.moonRadius, armParts.moon.endRadius, armParts.moon.collarRadius);
function envelopeOf(name) {
  if (name === 'earth') {
    const r = Math.max(earthMoonReach, mechanismEnd('earth'));
    return { inner: r, outer: r };
  }
  const p = planets[name];
  const around = Math.max(moonSystems[name].envelope, mechanismEnd(name));
  return {
    inner: Math.max(p.radius, armParts.planet.collarRadius, around),
    outer: Math.max(p.radius, armParts.planet.endRadius, around),
  };
}

// En arm med månehjulverk må være lang nok til at pinionen, kjedehjulene og
// kjedene får plass langs den.
const pinionX = pitchRadius(moonTrain.module, fixed.teeth) + pitchRadius(moonTrain.module, pinion.teeth);
const mechanismMinimum = (name) => {
  if (!mechanismOf(name)) return 0;
  if (mechanismOf(name) === 'ringMoons' || mechanismOf(name) === 'epicyclic') {
    // De to kjedene langs armen: det største kjedehjulet ved sentrum og det ved planeten.
    const C = mechanismOf(name) === 'ringMoons' ? SM : MM;
    const p = C.chainPitch;
    const big = sprocketRadius(Math.max(C.tubeSprocket, C.parallel.centerSprocket), p);
    return big + sprocketRadius(Math.max(C.shaftSprocket, C.parallel.postSprocket), p) + 2 * p;
  }
  if (mechanismOf(name) === 'parallelMoons') {
    // Månekjedet og parallellkjedet langs armen.
    const p = Math.max(UP.chainPitch, UM.chainPitch);
    const big = sprocketRadius(Math.max(UP.parallel.centerSprocket, UM.tubeSprocket), p);
    return big + sprocketRadius(Math.max(UP.parallel.postSprocket, UM.shaftSprocket), p) + 2 * p;
  }
  if (mechanismOf(name) === 'idlerMoon') {
    // Kjedet fra månerøret ut til kragen, og tappen med dobbelthjulet inne i kjedesløyfa.
    const p = NM.chainPitch;
    const big = sprocketRadius(NM.tubeSprocket, p), small = sprocketRadius(NM.collarSprocket, p);
    return Math.max(big + small + 2 * p, big + p + neptuneMoonTrain.dA + NM.pinRadius + 0.3);
  }
  if (mechanismOf(name) === 'moonDrive') {
    // Kjedet fra månerøret ut til kragen, og forlegsakselen inne i kjedesløyfa.
    const p = J.chainPitch;
    const big = sprocketRadius(J.tubeSprocket, p), small = sprocketRadius(J.collarSprocket, p);
    return Math.max(big + small + 2 * p, big + p + J.layDistance + J.shaftRadius + 0.3);
  }
  const p = moonTrain.chainPitch;
  const moonChainNeeds = pinionX + sprocketRadius(driveSprocket.teeth, p) + sprocketRadius(moonSprocket.teeth, p) + 2 * p;
  const parallelNeeds = 2 * sprocketRadius(parallelSprocket.teeth, p) + 2 * p;
  return Math.max(moonChainNeeds, parallelNeeds);
};

// --- Armlengdene ---
// Armene pakkes innenfra og ut, i rekkefølgen omløpstidene gir. Hver arm får
// den korteste lengden der det den rekker over går reachGap klar av det
// naboarmen innenfor rekker over (eller sola, for den innerste), og der dens
// egen mekanikk får plass. Det som stikker opp fra en lavere (lengre) arm,
// ligger dermed alltid utenfor alt en høyere (kortere) arm rekker.
const periodOf = (name) => (name === 'earth' ? 1 : planets[name].period);
export const order = [...Object.keys(planets), 'earth'].sort((a, b) => periodOf(a) - periodOf(b));
export const armLengths = {};
export const reach = {};
{
  let outside = bodies.sunRadius;
  for (const name of order) {
    const env = envelopeOf(name);
    const gapHere = name === 'earth' ? reachGap : (planets[name].reachGap ?? reachGap);
    const shortest = Math.ceil(Math.max(mechanismMinimum(name), outside + gapHere + env.inner) * 10) / 10;
    const setting = name === 'earth' ? arm.length : planets[name].armLength;
    const length = setting === 'auto' ? shortest : setting;
    if (length < shortest - 1e-9) {
      const where = name === 'earth' ? 'arm.length' : `planets.${name}.armLength`;
      throw new Error(`${where} er for kort: minst ${shortest.toFixed(1)} så ${name} går klar av naboen og mekanikken får plass (er ${length}).`);
    }
    armLengths[name] = length;
    reach[name] = { inner: length - env.inner, outer: length + env.outer };
    outside = reach[name].outer;
  }
}

// --- Rørene rundt sentralakselen ---
// En arm som ligger høyere, må være kortere enn alle armene under den. Røret
// med den øverste armen må stikke lengst opp, og dermed ligge innerst. Det må
// også stikke lengst ned, så hjulet nederst får plass. Altså: kortest arm innerst.
//
// En planet med månehjulverk trenger et fast hjul ved sentrum, rett over armen.
// Der er sentralakselen dekket av de innerste rørene, så hjulet får et eget fast
// rør rett innenfor planetens rør, holdt av en brakett nede i tårnet.
// Jordas faste rør heter 'fixed'; de andre 'fixed-mars' osv.
// Jupiters måner drives i stedet av et månerør på samme plass ('drive-jupiter'),
// som dreier og har et hjul nederst i tårnet, som planetrørene.
// Saturns ringbånd og måner drives på samme måte av et månerør ('drive-saturn'),
// og parallellføringen av et eget rør som dreier sakte ('par-saturn', se
// saturnMoons i config). Kjedet til parallell-røret ligger øverst ved sentrum,
// så det røret ligger innerst.
const tubeNames = order.flatMap((name) => {
  const kind = mechanismOf(name);
  if (!kind) return [name];
  if (kind === 'moonDrive') return [`drive-${name}`, name];
  if (kind === 'ringMoons' || kind === 'epicyclic') return [`par-${name}`, `drive-${name}`, name];
  if (kind === 'parallelMoons') return [`par-${name}`, `drive-${name}`, name];
  if (kind === 'idlerMoon') return [`drive-${name}`, name];
  return [name === 'earth' ? 'fixed' : `fixed-${name}`, name];
});
export const tubes = tubeNames.map((name, i) => ({
  name,
  fixed: name.startsWith('fixed'),
  drive: name.startsWith('drive-'),
  par: name.startsWith('par-'),
  owner: name === 'fixed' ? 'earth' : name.replace(/^(fixed|drive|par)-/, ''),
  inner: center.axleRadius + i * center.tubeWall,
  outer: center.axleRadius + (i + 1) * center.tubeWall,
}));
export const tube = Object.fromEntries(tubes.map((t) => [t.name, t]));

// --- Akslene i tårnet ---
// Mellomakselen står foran sentralakselen (mot kameraet). Forlegsakselen og
// motakselen står like langt fra sentrum, en vinkel videre rundt.
const driveDirection = -Math.PI / 2;
const layDirection = driveDirection + degrees(outerDrive.angle);
const counterDirection = driveDirection + degrees(counterDrive.angle);
export const usesCounter = Object.values(planets).some((p) => p.counterTeeth);

export const layout = {
  drive: at(driveDirection, drive.distance),
  lay: at(layDirection, drive.distance),
  counter: at(counterDirection, drive.distance),
  center: { x: 0, y: 0 },
  pinion: { x: pinionX, y: 0 },
  earth: { x: armLengths.earth, y: 0 },
};

// Kjedene nederst i tårnet går mellom to punkter i planet. Hvert regnes ut
// langs +x fra det første punktet og dreies på plass med sin ramme.
const frameBetween = (from, to) => ({
  origin: from,
  angle: Math.atan2(to.y - from.y, to.x - from.x),
  span: Math.hypot(to.x - from.x, to.y - from.y),
});
const chainAlong = (name, frame, teeth1, teeth2) => makeChain(
  name, { x: 0, y: 0 }, { x: frame.span, y: 0 }, teeth1, teeth2, outerDrive.chainPitch
);

// Første kjede: fra mellomakselen til det løse hjulet på sentralakselen.
export const driveFrame = frameBetween(layout.drive, layout.center);
export const driveChain = chainAlong('Kjedet til sentralakselen', driveFrame, outerDrive.driveSprocket, outerDrive.idlerLarge);
// Andre kjede: fra det løse hjulet til forlegsakselen.
export const layFrame = frameBetween(layout.center, layout.lay);
export const layChain = chainAlong('Kjedet til forlegsakselen', layFrame, outerDrive.idlerSmall, outerDrive.laySprocket);
// De to kjedehjulene på det løse hjulet holdes sammen av et nav rundt sentralakselen.
export const idlerHub = center.axleRadius + 0.3;

// Månekjedet: fra kjedehjulet på pinion-akselen til kjedehjulet under jorda.
export const moonChain = makeChain('Månekjedet', layout.pinion, layout.earth, driveSprocket.teeth, moonSprocket.teeth);

// Parallellkjedet: fra et fast kjedehjul på det faste røret til et like stort
// kjedehjul på armen under jorda. Sett fra armen dreier det faste hjulet
// baklengs like fort som armen går rundt, og kjedet overfører det 1:1. Dermed
// står hjulet under jorda stille i rommet, uansett hvor armen er.
export const parallelChain = makeChain('Parallellkjedet', layout.center, layout.earth, parallelSprocket.teeth, parallelSprocket.teeth);

// Jordrotasjonen (earthDay i config, ruta earthDay.model): et kjede fra et
// kjedehjul på pinionakselen til en forlegsaksel ved jordstolpen, og et
// tannhjulspar derfra til driveakselen inni stolperøret. Forlegsakselen står
// like langt innenfor stolpen som tannhjulsparet når.
const earthCell = ED.cells[ED.model];
if (!earthCell) throw new Error(`earthDay.model: finner ikke ruta '${ED.model}' i earthDay.cells.`);
if (earthCell.source !== 'P') throw new Error('earthDay.model: modellen har bare drivet fra pinionakselen (P). Drivet fra et dagrør i tårnet (T) finnes bare på prøvesiden.');
const EP = ED.P;
export const earthLayDistance = (EP.module * (EP.layGear + EP.shaftGear)) / 2;
export const earthDayChain = makeChain('Dagkjedet (jordrotasjonen)', layout.pinion, { x: armLengths.earth - earthLayDistance, y: 0 },
  EP.pinionSprocket, EP.laySprocket, EP.chainPitch);
export const earthRate = ratesFor(earthCell);

// Kjedet over Jupiter-armen: fra kjedehjulet på månerøret ved sentrum til
// kjedehjulet på kragen ved Jupiter-stolpen (i armens koordinatsystem).
export const jupiterLayout = {
  post: { x: armLengths.jupiter, y: 0 },
  lay: { x: armLengths.jupiter - J.layDistance, y: 0 },
};
export const jupiterChain = makeChain('Kjedet til Jupiters måner', layout.center, jupiterLayout.post,
  J.tubeSprocket, J.collarSprocket, J.chainPitch);
{
  // Forlegsakselen står inne i kjedesløyfa og må gå klar av kjedet.
  let nearest = Infinity;
  const L = jupiterChain.links * jupiterChain.pitch;
  for (let u = 0; u < L; u += 0.02) {
    const p = jupiterChain.point(u);
    nearest = Math.min(nearest, Math.hypot(p.x - jupiterLayout.lay.x, p.y - jupiterLayout.lay.y));
  }
  jupiterTrain.layToChain = nearest - jupiterChain.rollerRadius * 1.25 - J.shaftRadius;
  if (jupiterTrain.layToChain < 0.3) {
    throw new Error('Forlegsakselen ved Jupiter går for nær kjedet: endre jupiterMoons.layDistance eller kjedehjulene.');
  }
  const root = (chain, r) => r - chain.rollerRadius * 1.1;
  if (root(jupiterChain, jupiterChain.radius1) < tube['drive-jupiter'].outer + 0.2) {
    throw new Error('Kjedehjulet på månerøret er for lite til røret: øk jupiterMoons.tubeSprocket.');
  }
  if (root(jupiterChain, jupiterChain.radius2) < jupiterTrain.collar.outer + 0.2) {
    throw new Error('Kjedehjulet på kragen ved Jupiter er for lite til kragen: øk jupiterMoons.collarSprocket.');
  }
}

// Kjedene langs Saturn-armen (i armens koordinatsystem): månekjedet fra
// månerøret til driveakselen midt i stolpen, og parallellkjedet fra par-saturn
// til stolpen. Stolpen står da stille i rommet, så lenge tanntallene går opp
// (se saturnMoons i config); det sjekkes eksakt med heltall her.
export const saturnLayout = { post: { x: armLengths.saturn, y: 0 } };
const SP = SM.parallel;
export const saturnChain = makeChain('Kjedet til Saturns måner', layout.center, saturnLayout.post,
  SM.tubeSprocket, SM.shaftSprocket, SM.chainPitch);
export const saturnParallelChain = makeChain('Parallellkjedet til Saturn', layout.center, saturnLayout.post,
  SP.centerSprocket, SP.postSprocket, SM.chainPitch);
{
  const sat = planets.saturn;
  // (a/b − c/d) · e/f = −c/d  ⇔  (a·d − c·b) · e = −c · b · f
  const lhs = (SP.layTeeth * sat.tubeTeeth - sat.layTeeth * SP.tubeTeeth) * SP.centerSprocket;
  const rhs = -sat.layTeeth * SP.tubeTeeth * SP.postSprocket;
  if (!sat.layTeeth || lhs !== rhs) {
    throw new Error('saturnMoons.parallel: tanntallene gjør ikke at Saturn-stolpen står stille i rommet. Det må gjelde: (parallel.layTeeth/parallel.tubeTeeth − saturn.layTeeth/saturn.tubeTeeth) × centerSprocket/postSprocket = −saturn.layTeeth/saturn.tubeTeeth.');
  }
  const root = (chain, r) => r - chain.rollerRadius * 1.1;
  if (root(saturnChain, saturnChain.radius1) < tube['drive-saturn'].outer + 0.2) {
    throw new Error('Kjedehjulet på månerøret til Saturn er for lite til røret: øk saturnMoons.tubeSprocket.');
  }
  if (root(saturnParallelChain, saturnParallelChain.radius1) < tube['par-saturn'].outer + 0.2) {
    throw new Error('Kjedehjulet på par-saturn er for lite til røret: øk saturnMoons.parallel.centerSprocket (og tanntallene i tårnet så det går opp).');
  }
  if (root(saturnChain, saturnChain.radius2) < SM.driveShaftRadius + 0.2) {
    throw new Error('Kjedehjulet på driveakselen ved Saturn er for lite til akselen: øk saturnMoons.shaftSprocket.');
  }
  if (root(saturnParallelChain, saturnParallelChain.radius2) < SM.driveShaftRadius + SM.frameWall + 0.2) {
    throw new Error('Kjedehjulet nederst på Saturn-stolpen er for lite til stolpen: øk saturnMoons.parallel.postSprocket.');
  }
}

// Kjedene langs Mars-armen, som ved Saturn: månekjedet til driveakselen og
// parallellkjedet til stolpen. Begge rørene i tårnet drives fra mellomakselen.
export const marsLayout = { post: { x: armLengths.mars, y: 0 } };
const MP = MM.parallel;
export const marsChain = makeChain('Kjedet til Mars\' måner', layout.center, marsLayout.post,
  MM.tubeSprocket, MM.shaftSprocket, MM.chainPitch);
export const marsParallelChain = makeChain('Parallellkjedet til Mars', layout.center, marsLayout.post,
  MP.centerSprocket, MP.postSprocket, MM.chainPitch);
{
  const mars = planets.mars;
  // (x/y − c/b) · e/f = −c/b  ⇔  (x·b − c·y) · e = −c · y · f
  const lhs = (MP.driveTeeth * mars.tubeTeeth - mars.driveTeeth * MP.tubeTeeth) * MP.centerSprocket;
  const rhs = -mars.driveTeeth * MP.tubeTeeth * MP.postSprocket;
  if (!mars.driveTeeth || lhs !== rhs) {
    throw new Error('marsMoons.parallel: tanntallene gjør ikke at Mars-stolpen står stille i rommet. Det må gjelde: (parallel.driveTeeth/parallel.tubeTeeth − mars.driveTeeth/mars.tubeTeeth) × centerSprocket/postSprocket = −mars.driveTeeth/mars.tubeTeeth.');
  }
  const root = (chain, r) => r - chain.rollerRadius * 1.1;
  if (root(marsChain, marsChain.radius1) < tube['drive-mars'].outer + 0.2) {
    throw new Error('Kjedehjulet på månerøret til Mars er for lite til røret: øk marsMoons.tubeSprocket.');
  }
  if (root(marsParallelChain, marsParallelChain.radius1) < tube['par-mars'].outer + 0.2) {
    throw new Error('Kjedehjulet på par-mars er for lite til røret: øk marsMoons.parallel.centerSprocket (og tanntallene i tårnet så det går opp).');
  }
  if (root(marsChain, marsChain.radius2) < MM.driveShaftRadius + 0.2) {
    throw new Error('Kjedehjulet på driveakselen ved Mars er for lite til akselen: øk marsMoons.shaftSprocket.');
  }
  if (root(marsParallelChain, marsParallelChain.radius2) < MM.driveShaftRadius + MM.frameWall + 0.2) {
    throw new Error('Kjedehjulet nederst på Mars-stolpen er for lite til stolpen: øk marsMoons.parallel.postSprocket.');
  }
}

// Parallellkjedet langs Uranus-armen, som ved Saturn: fra par-uranus til
// stolpen. par-uranus drives fra motakselen, som Uranus-røret, så stolpen står
// stille i rommet når tanntallene går opp (sjekkes eksakt med heltall).
export const uranusLayout = { post: { x: armLengths.uranus, y: 0 } };
const UPP = UP.parallel;
export const uranusParallelChain = makeChain('Parallellkjedet til Uranus', layout.center, uranusLayout.post,
  UPP.centerSprocket, UPP.postSprocket, UP.chainPitch);
// Månekjedet langs Uranus-armen: fra drive-uranus til driveakselen inni stolpen.
export const uranusMoonChain = makeChain('Kjedet til Uranus\' måner', layout.center, uranusLayout.post,
  UM.tubeSprocket, UM.shaftSprocket, UM.chainPitch);
// Kjedet langs Neptun-armen: fra drive-neptune til kragen på Neptun-stolpen.
export const neptuneLayout = { post: { x: armLengths.neptune, y: 0 } };
export const neptuneChain = makeChain('Kjedet til Triton', layout.center, neptuneLayout.post,
  NM.tubeSprocket, NM.collarSprocket, NM.chainPitch);
{
  const ur = planets.uranus;
  // (x/y − c/b) · e/f = −c/b  ⇔  (x·b − c·y) · e = −c · y · f
  const lhs = (UPP.counterTeeth * ur.tubeTeeth - ur.counterTeeth * UPP.tubeTeeth) * UPP.centerSprocket;
  const rhs = -ur.counterTeeth * UPP.tubeTeeth * UPP.postSprocket;
  if (!ur.counterTeeth || lhs !== rhs) {
    throw new Error('uranusPost.parallel: tanntallene gjør ikke at Uranus-stolpen står stille i rommet. Det må gjelde: (parallel.counterTeeth/parallel.tubeTeeth − uranus.counterTeeth/uranus.tubeTeeth) × centerSprocket/postSprocket = −uranus.counterTeeth/uranus.tubeTeeth.');
  }
  const root = (chain, r) => r - chain.rollerRadius * 1.1;
  if (root(uranusParallelChain, uranusParallelChain.radius1) < tube['par-uranus'].outer + 0.2) {
    throw new Error('Kjedehjulet på par-uranus er for lite til røret: øk uranusPost.parallel.centerSprocket (og tanntallene i tårnet så det går opp).');
  }
  if (root(uranusMoonChain, uranusMoonChain.radius1) < tube['drive-uranus'].outer + 0.2) {
    throw new Error('Kjedehjulet på drive-uranus er for lite til røret: øk iceMoons.uranus.tubeSprocket (og tanntallene, så månene går riktig).');
  }
  if (root(neptuneChain, neptuneChain.radius1) < tube['drive-neptune'].outer + 0.2) {
    throw new Error('Kjedehjulet på drive-neptune er for lite til røret: øk iceMoons.neptune.tubeSprocket (og tanntallene, så Triton går riktig).');
  }
  if (root(uranusParallelChain, uranusParallelChain.radius2) < uranusMoonTrain.frameOuter + 0.2) {
    throw new Error('Kjedehjulet nederst på Uranus-stolpen er for lite til stolpen: øk uranusPost.parallel.postSprocket.');
  }
}

// Runder månen går rundt jorda per runde armen tar (månefaser per år).
export const moonPerYear = (fixed.teeth / pinion.teeth) * (driveSprocket.teeth / moonSprocket.teeth);

// Hvor mange ganger røret går rundt per omdreining av mellomakselen.
// Motakselen drives fra Saturn-røret (to inngrep, så rørene går samme vei).
const tubeRate = (p) => {
  if (p.counterTeeth) return tubeRate(planets.saturn) * (counterDrive.saturnTeeth / counterDrive.shaftTeeth) * (p.counterTeeth / p.tubeTeeth);
  return p.layTeeth
    ? (outerDrive.driveSprocket / outerDrive.idlerLarge) * (outerDrive.idlerSmall / outerDrive.laySprocket) * (p.layTeeth / p.tubeTeeth)
    : p.driveTeeth / p.tubeTeeth;
};

// Omløpstiden i år for en planet, slik tanntallene gir den. Mellomakselen går
// bigGear/smallGear ganger per år.
export function planetPeriod(name) {
  return (smallGear.teeth / bigGear.teeth) / tubeRate(planets[name]);
}

const directionFrom = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const driveToCenter = directionFrom(layout.drive, layout.center);
const layToCenter = directionFrom(layout.lay, layout.center);
const counterToCenter = directionFrom(layout.counter, layout.center);
const centerToCounter = directionFrom(layout.center, layout.counter);

// Alle vinklene, utledet fra inngangsvinkelen gjennom hvert inngrep. phases er
// vinkelen hvert hjul er satt på akselen med (se Startdatoen under).
function anglesWith(input, phases) {
  // Inngangen dreier mellomakselen med klokka, så armene går mot klokka (som planetene).
  const driveAngle = -input;

  // De to kjedene nederst (hvert i sitt eget koordinatsystem), som beholder
  // dreieretningen: mellomakselen → det løse hjulet → forlegsakselen.
  const driveChainOffset = driveChain.offsetFor(driveAngle - driveFrame.angle);
  const idlerAngle = driveChain.angle2For(driveChainOffset) + driveFrame.angle;
  const layChainOffset = layChain.offsetFor(idlerAngle - layFrame.angle);
  const layAngle = layChain.angle2For(layChainOffset) + layFrame.angle;

  // Hjulparene nederst: hvert rør får sin vinkel fra sitt hjul på mellomakselen
  // eller forlegsakselen.
  const armAngle = meshAngle(driveAngle + phases.earth, smallGear.teeth, bigGear.teeth, driveToCenter);
  const planetAngles = {};
  for (const [name, p] of Object.entries(planets)) {
    if (p.counterTeeth) continue;
    planetAngles[name] = p.layTeeth
      ? meshAngle(layAngle + phases[name], p.layTeeth, p.tubeTeeth, layToCenter)
      : meshAngle(driveAngle + phases[name], p.driveTeeth, p.tubeTeeth, driveToCenter);
  }
  // Motakselen: hjul nr. 2 på Saturn-røret driver den, og den driver Uranus,
  // Neptun og par-uranus.
  const counterAngle = usesCounter
    ? meshAngle(planetAngles.saturn, counterDrive.saturnTeeth, counterDrive.shaftTeeth, centerToCounter)
    : 0;
  for (const [name, p] of Object.entries(planets)) {
    if (p.counterTeeth) planetAngles[name] = meshAngle(counterAngle + phases[name], p.counterTeeth, p.tubeTeeth, counterToCenter);
  }

  // Herfra regner vi i jordarmens koordinatsystem. Alt som sitter fast på det
  // faste røret står stille i verden, så sett fra armen dreier det baklengs.
  const fixedAngle = -armAngle;
  const pinionAngle = meshAngle(fixedAngle, fixed.teeth, pinion.teeth, 0);

  // Det store månekjedehjulet sitter på pinionakselen med sin egen vinkel.
  const moonDriveAngle = pinionAngle + phases.moon;
  const moonChainOffset = moonChain.offsetFor(moonDriveAngle);
  const moonAngle = moonChain.angle2For(moonChainOffset);

  const parallelChainOffset = parallelChain.offsetFor(fixedAngle);
  const parallelAngle = parallelChain.angle2For(parallelChainOffset);

  // Jordrotasjonen: dagkjedet fra pinionakselen til forlegsakselen ved stolpen,
  // tannhjulsparet derfra til driveakselen (sett fra armen), og overgangen til
  // jordaksen, regnet fra stolperøret (som står stille i rommet). earthSpin er
  // jordas vinkel om sin egen akse.
  const earthDayChainOffset = earthDayChain.offsetFor(pinionAngle);
  const earthLayAngle = earthDayChain.angle2For(earthDayChainOffset);
  const earthShaftAngle = meshAngle(earthLayAngle, EP.layGear, EP.shaftGear, 0);
  const earthSpin = earthRate.sign * earthRate.k * (earthShaftAngle - parallelAngle) + (phases.earthSpin ?? 0);

  // Jupiters måner. Månerøret drives fra mellomakselen. Resten regnes i
  // Jupiter-armens koordinatsystem: kjedet tar kjedehjulet på røret (sett fra
  // armen) ut til kragen, kragen driver forlegsakselen, og hvert hjul på
  // forlegsakselen (satt på i sin egen vinkel) driver røret til en måne.
  const jupiterTubeAngle = meshAngle(driveAngle, J.driveTeeth, J.tubeTeeth, driveToCenter);
  const jupiterChainOffset = jupiterChain.offsetFor(jupiterTubeAngle - planetAngles.jupiter);
  const collarAngle = jupiterChain.angle2For(jupiterChainOffset);
  const jupiterLayAngle = meshAngle(collarAngle, J.collarTeeth, J.collarPinion, Math.PI);
  const jupiterMoonAngles = {};
  for (const name of jupiterMoonNames) {
    const [layTeeth, moonTeeth] = J.steps[name];
    jupiterMoonAngles[name] = meshAngle(jupiterLayAngle + phases[name], layTeeth, moonTeeth, 0);
  }

  // Saturn. Månerøret drives fra mellomakselen og par-saturn fra forlegsakselen.
  // Kjedene tar dem ut til driveakselen og stolpen (vinkler sett fra armen).
  // Stolpen og alt på den står stille i rommet; resten regnes sett fra stolpen:
  // vinkelgiren (driveakselen om loddlinjen, forlegsakselen om Saturns akse),
  // og forlegsakselen som driver båndene (om Saturns akse, fra retningen aksen
  // heller mot). Hjulene på forlegsakselen og hylsa er satt på i sin egen vinkel.
  const saturnTubeAngle = meshAngle(driveAngle, SM.driveTeeth, SM.tubeTeeth, driveToCenter);
  const saturnParTubeAngle = meshAngle(layAngle, SP.layTeeth, SP.tubeTeeth, layToCenter);
  const saturnChainOffset = saturnChain.offsetFor(saturnTubeAngle - planetAngles.saturn);
  const saturnShaftAngle = saturnChain.angle2For(saturnChainOffset);                      // driveakselen, sett fra armen
  const saturnParChainOffset = saturnParallelChain.offsetFor(saturnParTubeAngle - planetAngles.saturn);
  const saturnFrameAngle = saturnParallelChain.angle2For(saturnParChainOffset);           // stolpen, sett fra armen
  const ST = saturnTrain;
  // Driveakselen sett fra den skrå aksens retning på stolpen (der vinkelgiren griper inn).
  const saturnShaftOnFrame = saturnShaftAngle - saturnFrameAngle - (saturnAxis.direction ?? 0);
  const saturnLayAngle = meshAngle(saturnShaftOnFrame, ST.bevel.driveTeeth, ST.bevel.layTeeth, Math.PI);
  const saturnBands = {};
  saturnBands.A = meshAngle(saturnLayAngle + phases.enceladus, ST.pairs.enceladus.lay, ST.pairs.enceladus.tube, Math.PI);
  saturnBands.B = meshAngle(saturnLayAngle + phases.titan, ST.pairs.titan.lay, ST.pairs.titan.tube, Math.PI);
  const saturnSleeveAngle = meshAngle(saturnBands.B, ST.pairs.titan2.tube, ST.pairs.titan2.lay, 0);
  saturnBands.C = meshAngle(saturnSleeveAngle + phases.iapetus, ST.pairs.iapetus.lay, ST.pairs.iapetus.tube, Math.PI);

  // Mars. Månerøret og par-mars drives fra mellomakselen, og kjedene tar dem
  // ut til driveakselen og stolpen (vinkler sett fra armen). Sett fra stolpen:
  // kryssleddet tar driveakselen 1 : 1 over i den skrå drivakselen, det store
  // hjulet driver mellomhjulet, og mellomhjulet det lille hjulet på bæreren
  // (to inngrep, så bæreren går samme vei som driveakselen). Planetgiret gir
  // solhjulet. Planethjul nr. k står i vinkelen 2πk/count på bæreren; planet2
  // griper i ringhjulet (som står stille, altså −bæreren sett fra bæreren),
  // planet1 i solhjulet.
  const MT = marsTrain, PG = MT.planetary;
  const marsTubeAngle = meshAngle(driveAngle, MM.driveTeeth, MM.tubeTeeth, driveToCenter);
  const marsParTubeAngle = meshAngle(driveAngle, MP.driveTeeth, MP.tubeTeeth, driveToCenter);
  const marsChainOffset = marsChain.offsetFor(marsTubeAngle - planetAngles.mars);
  const marsShaftAngle = marsChain.angle2For(marsChainOffset);                             // driveakselen, sett fra armen
  const marsParChainOffset = marsParallelChain.offsetFor(marsParTubeAngle - planetAngles.mars);
  const marsFrameAngle = marsParallelChain.angle2For(marsParChainOffset);                  // stolpen, sett fra armen
  const marsShaftOnMount = marsShaftAngle - marsFrameAngle - (marsAxis.direction ?? 0);
  const marsDriveAngle = marsShaftOnMount;                                                  // kryssleddet: 1 : 1
  const MD = MT.drive;
  const marsIdlerAngle = meshAngle(marsDriveAngle, MM.drive.bigTeeth, MM.drive.idlerTeeth,
    Math.atan2(MD.idler.z, MD.idler.x - MD.distance));
  const marsCarrier = meshAngle(marsIdlerAngle, MM.drive.idlerTeeth, MM.drive.smallTeeth, MD.idlerPhi + Math.PI);
  const marsPlanetSpins = [];
  for (let k = 0; k < PG.count; k++) {
    marsPlanetSpins.push(internalMeshAngle(-marsCarrier, PG.ring, PG.planet2, (2 * Math.PI * k) / PG.count));
  }
  const marsSun = marsCarrier + meshAngle(marsPlanetSpins[0], PG.planet1, PG.sun, Math.PI);
  const marsMoonAngles = { phobos: marsSun + phases.phobos, deimos: marsCarrier + phases.deimos };

  // Uranus: par-uranus drives fra motakselen, og kjedet tar det ut til stolpen
  // (vinkelen sett fra armen). Stolpen og alt på den står stille i rommet.
  const uranusParTubeAngle = meshAngle(counterAngle, UPP.counterTeeth, UPP.tubeTeeth, counterToCenter);
  const uranusParChainOffset = uranusParallelChain.offsetFor(uranusParTubeAngle - planetAngles.uranus);
  const uranusFrameAngle = uranusParallelChain.angle2For(uranusParChainOffset);
  // Månene: drive-uranus drives fra mellomakselen, og kjedet tar det ut til
  // driveakselen inni stolpen (sett fra armen). Sett fra stolpen: vinkelgiren
  // (hjulet på driveakselen over toppunktet, så forlegsakselen går motsatt vei)
  // og ett hjulpar per måne. Rørene dreier om Uranus' akse, fra retningen
  // aksen heller mot (som ved Saturn).
  const uranusTubeAngle = meshAngle(driveAngle, UM.driveTeeth, UM.tubeTeeth, driveToCenter);
  const uranusChainOffset = uranusMoonChain.offsetFor(uranusTubeAngle - planetAngles.uranus);
  const uranusShaftAngle = uranusMoonChain.angle2For(uranusChainOffset);                  // driveakselen, sett fra armen
  const uranusShaftOnFrame = uranusShaftAngle - uranusFrameAngle - (uranusAxis.direction ?? 0);
  const uranusLayAngle = meshAngle(uranusShaftOnFrame, UB.driveTeeth, UB.layTeeth, Math.PI);
  const uranusMoonAngles = {};
  for (const n of uranusMoonNames) {
    const [layTeeth, tubeTeeth] = UM.steps[n];
    uranusMoonAngles[n] = meshAngle(uranusLayAngle + phases[n], layTeeth, tubeTeeth, Math.PI);
  }

  // Neptun: drive-neptune drives fra mellomakselen, og kjedet tar det ut til
  // kragen (sett fra armen; stolpen står fast på armen). Kragen driver
  // dobbelthjulet på tapp A, det øverste hjulet driver mellomhjulet på tapp B,
  // og mellomhjulet driver Tritons rør: tre inngrep, så Triton går baklengs.
  // Vinklene her er i planets koordinater (y = −z i three.js).
  const NT = neptuneMoonTrain;
  const neptuneTubeAngle = meshAngle(driveAngle, NM.driveTeeth, NM.tubeTeeth, driveToCenter);
  const neptuneChainOffset = neptuneChain.offsetFor(neptuneTubeAngle - planetAngles.neptune);
  const neptuneCollarAngle = neptuneChain.angle2For(neptuneChainOffset);
  const toA = Math.atan2(-NT.A.z, NT.A.x), aToB = Math.atan2(-(NT.B.z - NT.A.z), NT.B.x - NT.A.x), bToPost = Math.atan2(NT.B.z, -NT.B.x);
  const neptuneLayAngle = meshAngle(neptuneCollarAngle, NM.collarTeeth, NM.layLow, toA);
  const neptuneIdlerAngle = meshAngle(neptuneLayAngle, NM.layHigh, NM.idlerTeeth, aToB);
  const tritonGearAngle = meshAngle(neptuneIdlerAngle, NM.idlerTeeth, NM.tritonTeeth, bToPost);
  const tritonAngle = tritonGearAngle + phases.triton;                                    // Tritons rør og arm, sett fra armen

  return {
    uranusTubeAngle, uranusChainOffset, uranusShaftAngle, uranusShaftOnFrame, uranusLayAngle, uranusMoonAngles,
    neptuneTubeAngle, neptuneChainOffset, neptuneCollarAngle, neptuneLayAngle, neptuneIdlerAngle, tritonGearAngle, tritonAngle,
    counterAngle, uranusParTubeAngle, uranusParChainOffset, uranusFrameAngle,
    driveAngle, driveChainOffset, idlerAngle, layChainOffset, layAngle, armAngle, planetAngles, fixedAngle, pinionAngle,
    moonDriveAngle, moonChainOffset, moonAngle, parallelChainOffset, parallelAngle,
    earthDayChainOffset, earthLayAngle, earthShaftAngle, earthSpin,
    jupiterTubeAngle, jupiterChainOffset, collarAngle, jupiterLayAngle, jupiterMoonAngles,
    saturnTubeAngle, saturnParTubeAngle, saturnChainOffset, saturnShaftAngle, saturnParChainOffset, saturnFrameAngle,
    saturnShaftOnFrame, saturnLayAngle, saturnSleeveAngle, saturnBands,
    marsTubeAngle, marsParTubeAngle, marsChainOffset, marsShaftAngle, marsParChainOffset, marsFrameAngle,
    marsShaftOnMount, marsDriveAngle, marsIdlerAngle, marsCarrier, marsPlanetSpins, marsSun, marsMoonAngles,
  };
}

// --- Startdatoen ---
// Modellen stilles inn som en ekte orrery: hvert hjul på mellomakselen og
// forlegsakselen settes på akselen i den vinkelen som gjør at planeten det
// driver står riktig på startdatoen (inngangen er da 0). Tennene griper inn
// som før, bare med en annen tann. Månen stilles med det store
// månekjedehjulet på pinionakselen.
const parseStart = (value) => {
  if (value === 'today') return new Date();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Ugyldig startdato '${value}' i time.startDate. Bruk 'today' eller en dato som '2026-11-15'.`);
  }
  return date;
};
export const startDate = parseStart(time.startDate);
const equinox = degrees(tilt.equinoxDirection);

// Vinkelen i verden hver del skal ha på startdatoen. Månene: fra planeten.
// Jupiters måner stilles med hjulene på forlegsakselen ved Jupiter, Saturns
// med hjulene på forlegsakselen ved Saturn (Iapetus med hylsa).
const settable = [...Object.keys(planets), 'earth', 'moon', ...jupiterMoonNames, ...saturnMoonNames, ...marsMoonNames, ...uranusMoonNames, 'triton'];
export const targets = {};
for (const name of settable) targets[name] = longitudeAt(name, startDate) + equinox;

// Saturns akse og ring: stolpen står stille i rommet, og kula og ringen
// monteres på den så Saturns nordpol heller mot lengde knute − 90°, der
// knuten er ringplanets oppstigende knute på ekliptikken (Meeus kap. 45) på
// startdatoen. Settes når planetene er stilt inn (stolpens retning følger
// Saturn-røret).
export const saturnAxis = { tilt: saturnTilt };
export const saturnBandOf = { enceladus: 'A', titan: 'B', iapetus: 'C' };
// En måne i ringplanet i vinkelen psi fra retningen aksen heller mot (om aksen),
// sett ovenfra fra Saturn: lengden i verden, og omvendt.
// (inPlane deler på cos(tilt), så den stemmer også når helningen er over 90°,
// som for Uranus. Under 90° gir den det samme som før.)
export const projected = (axis, psi) => axis.poleWorld + Math.atan2(Math.sin(psi), Math.cos(psi) * Math.cos(axis.tilt));
export const inPlane = (axis, world) => {
  const phi = world - axis.poleWorld;
  return Math.atan2(Math.sin(phi), Math.cos(phi) / Math.cos(axis.tilt));
};
const saturnProjected = (psi) => projected(saturnAxis, psi);
const saturnInPlane = (world) => inPlane(saturnAxis, world);
// Mars' akse: stolpen står stille i rommet, og nordpolen heller mot lengden
// til Mars' pol på ekliptikken (IAU) på startdatoen. Settes når planetene er stilt inn.
export const marsAxis = { tilt: marsTilt };
// Uranus' akse: settes når planetene er stilt inn (se under).
export const uranusAxis = { tilt: uranusTilt };

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const angleOf = (name, a) => {
  if (name === 'earth') return a.armAngle;
  if (name === 'moon') return a.armAngle + a.moonAngle;
  if (jupiterMoonNames.includes(name)) return a.planetAngles.jupiter + a.jupiterMoonAngles[name];
  if (saturnMoonNames.includes(name)) return saturnProjected(a.saturnBands[saturnBandOf[name]]);
  if (marsMoonNames.includes(name)) return projected(marsAxis, a.marsMoonAngles[name]);
  if (uranusMoonNames.includes(name)) return projected(uranusAxis, a.uranusMoonAngles[name]);
  if (name === 'triton') return a.planetAngles.neptune + a.tritonAngle;
  return a.planetAngles[name];
};
export const worldAngleOf = angleOf;

// Vinklene er lineære i fasene, så hver fase løses direkte: hvor mye delen
// dreier per radian fasen settes på, og hvor mye som mangler. Planetene før
// månene, fordi månene sitter på armene. Saturns måner løses i ringplanet
// (vinkelen om aksen er lineær i fasen, lengden sett ovenfra er det ikke).
export const phases = Object.fromEntries(settable.map((n) => [n, 0]));
const solvePhase = (name, measure, target) => {
  const now = measure(anglesWith(0, phases));
  const perRadian = measure(anglesWith(0, { ...phases, [name]: phases[name] + 1 })) - now;
  phases[name] += wrap(target - now) / perRadian;
};
for (const name of settable.filter((n) => !saturnMoonNames.includes(n) && !marsMoonNames.includes(n) && !uranusMoonNames.includes(n))) {
  solvePhase(name, (a) => angleOf(name, a), targets[name]);
}
{
  const a = anglesWith(0, phases);
  const poleWorld = marsPoleLongitude(startDate) + equinox;
  const frameWorld = a.planetAngles.mars + a.marsFrameAngle;
  Object.assign(marsAxis, { poleWorld, frameWorld, direction: poleWorld - frameWorld });
}
for (const name of marsMoonNames) {
  solvePhase(name, (a) => a.marsMoonAngles[name], inPlane(marsAxis, targets[name]));
}
{
  const a = anglesWith(0, phases);
  const nodeWorld = longitudeAt('saturnRingNode', startDate) + equinox;
  const frameWorld = a.planetAngles.saturn + a.saturnFrameAngle;
  Object.assign(saturnAxis, {
    nodeWorld,
    poleWorld: nodeWorld - Math.PI / 2,
    frameWorld,
    direction: nodeWorld - Math.PI / 2 - frameWorld,   // på stolpen
  });
}
for (const name of saturnMoonNames) {
  solvePhase(name, (a) => a.saturnBands[saturnBandOf[name]], saturnInPlane(targets[name]));
}
// Uranus' akse: stolpen står stille i rommet, og aksen monteres så polen med
// akselen (den som peker nedover, 180° fra nordpolen etter IAU) heller mot sin
// lengde på ekliptikken. Med tilt over 90° heller den under vannrett.
{
  const a = anglesWith(0, phases);
  const poleWorld = uranusPoleLongitude(startDate) + Math.PI + equinox;
  const frameWorld = a.planetAngles.uranus + a.uranusFrameAngle;
  Object.assign(uranusAxis, { poleWorld, frameWorld, direction: poleWorld - frameWorld });
}

for (const name of uranusMoonNames) {
  solvePhase(name, (a) => a.uranusMoonAngles[name], inPlane(uranusAxis, targets[name]));
}
// Jorda om sin akse: Greenwich-meridianen står stjernetiden (GMST) østover fra
// vårjevndøgnsretningen på startdatoen. Vårjevndøgnsretningen ligger i jordas
// ekvatorplan, 90° før retningen aksen heller mot; i den skrå gruppa er det −90°.
phases.earthSpin = 0;
export const earthSpinTarget = gmst(startDate) - Math.PI / 2;
phases.earthSpin = wrap(earthSpinTarget - anglesWith(0, phases).earthSpin);

export const anglesAt = (input) => anglesWith(input, phases);

// Mellomakselen går bigGear/smallGear runder per år (én runde for jorda).
export const inputPerYear = (2 * Math.PI * bigGear.teeth) / smallGear.teeth;
export const dateAt = (years) => addYears(startDate, years);

// --- Det som sitter på parallellhjulet ---
// Parallellhjulet har en fast retning i verden. Den følger av hvordan kjedet
// ligger, og er den samme for alle inngangsvinkler.
const start = anglesAt(0);
const parallelWorldAngle = start.armAngle + start.parallelAngle;

// Jordaksen monteres på parallellhjulet så den heller mot lengde 90° (der
// sola står ved sommersolverv), altså mot sola i nordlig sommer.
export const earthAxis = {
  tilt: degrees(tilt.earthAxis),
  world: equinox + Math.PI / 2,
  direction: equinox + Math.PI / 2 - parallelWorldAngle, // på parallellhjulet
};

// Månebanen: knutelinjen der den står på startdatoen (i verden og på
// parallellhjulet). På himmelen dreier den baklengs en runde på 18,6 år; her
// står den fast. Føringsringen som styrer månebanen står i earthTrain (under).
export const moonRing = {
  nodeWorld: longitudeAt('moonNode', startDate) + equinox,
  node: longitudeAt('moonNode', startDate) + equinox - parallelWorldAngle,
};

// --- Høyder ---
// Nederst i tårnet ligger de to kjedene til forlegsakselen, over hverandre (der
// står bare sentralakselen, så det løse hjulet får plass), og over dem ett hjulpar
// per rør innenfra og ut (de faste rørene har en brakett i stedet). Over
// tårnet ligger armene, utenfra og inn, så den lengste armen er nederst. Over
// en arm med månehjulverk ligger en stabel (fast hjul og pinion, eventuelt
// parallellkjede, og månekjede), og armene innenfor må ligge over den.
const plateDepth = 0.3; // så langt stikker lenkeplatene under og over kjedehjulet
export const heights = (() => {
  const h = { gap, chainGap, bottom: {}, arm: {}, stack: {} };

  h.driveChain = plateDepth + gap;                                // første kjede
  h.layChain = h.driveChain + moonTrain.thickness + chainGap;     // andre kjede
  let y = h.layChain + moonTrain.thickness + plateDepth + gap;
  for (const t of tubes) {
    h.bottom[t.name] = y;
    y += (t.fixed ? arm.thickness : gear.thickness) + gap;
    // Saturn-røret har hjul nr. 2 (til motakselen) i planet over sitt første hjul.
    if (t.name === 'saturn' && usesCounter) {
      h.counterGear = y;
      y += gear.thickness + gap;
    }
  }
  h.driveTop = y; // toppen av tårnet

  let a = h.driveTop + gap;
  for (const t of [...tubes].reverse()) {
    if (t.fixed || t.drive || t.par) continue;
    h.arm[t.name] = a;
    const armTop = a + arm.thickness;
    h.topArm = armTop + armStyle.hubRise; // toppen av navet på den øverste armen så langt
    const kind = mechanismOf(t.name);
    if (!kind) {
      a = armTop + 2 * armStyle.hubRise + gap; // plass til navet over og navet til neste arm
      continue;
    }
    if (kind === 'moonDrive') {
      // Kjedet over armen: platene går klar av navet ved sentrum, og kragen
      // ved Jupiter står klar av den røde ringen rundt stolpen.
      const s = {};
      s.chain = armTop + Math.max(armStyle.hubRise + plateDepth, armStyle.collarHeight + accent.ringWidth) + gap;
      s.tubeTop = s.chain + moonTrain.thickness;                           // toppen av månerøret
      s.chainTop = s.chain + moonTrain.thickness + plateDepth;
      // Hjulene ved Jupiter, nedenfra: kragen, så ett hjul per måne (Io først).
      s.collarGear = s.chainTop + gap;
      s.moonGear = {};
      let g = s.collarGear + J.thickness + gap;
      for (const name of jupiterMoonNames) {
        s.moonGear[name] = g;
        g += J.thickness + gap;
      }
      s.layTop = g - gap + 0.1;                                            // toppen av forlegsakselen
      h.stack[t.name] = s;
      a = s.chainTop + armStyle.hubRise + gap;
      continue;
    }
    if (kind === 'ringMoons' || kind === 'epicyclic') {
      // To kjeder over armen: månekjedet nederst (fra månerøret til
      // driveakselen) og parallellkjedet over (fra par-røret til stolpen).
      const s = {};
      s.chain = armTop + Math.max(armStyle.hubRise + plateDepth, armStyle.collarHeight + accent.ringWidth) + gap;
      s.driveTubeTop = s.chain + moonTrain.thickness;                      // toppen av månerøret
      s.parallel = s.chain + moonTrain.thickness + chainGap;
      s.parTubeTop = s.parallel + moonTrain.thickness;                     // toppen av par-saturn
      s.chainTop = s.parallel + moonTrain.thickness + plateDepth;
      h.stack[t.name] = s;
      a = s.chainTop + armStyle.hubRise + gap;
      continue;
    }
    if (kind === 'parallelMoons') {
      // To kjeder over armen: månekjedet nederst (fra drive-uranus til
      // driveakselen) og parallellkjedet over (fra par-uranus til stolperøret).
      const s = {};
      s.chain = firstChainAbove(armTop);
      s.driveTubeTop = s.chain + moonTrain.thickness;                      // toppen av drive-uranus
      s.parallel = s.chain + moonTrain.thickness + chainGap;
      s.parTubeTop = s.parallel + moonTrain.thickness;                     // toppen av par-uranus
      s.chainTop = s.parallel + moonTrain.thickness + plateDepth;
      h.stack[t.name] = s;
      a = s.chainTop + armStyle.hubRise + gap;
      continue;
    }
    if (kind === 'idlerMoon') {
      // Kjedet over armen, fra drive-neptune til kragen ved Neptun.
      const s = {};
      s.chain = firstChainAbove(armTop);
      s.tubeTop = s.chain + moonTrain.thickness;                           // toppen av drive-neptune
      s.chainTop = s.chain + moonTrain.thickness + plateDepth;
      h.stack[t.name] = s;
      a = s.chainTop + armStyle.hubRise + gap;
      continue;
    }
    const s = { level1: armTop + armStyle.hubRise + gap };                 // fast hjul og pinion, klar av navet
    if (kind === 'moons+parallel') {
      // Jorda: dagkjedet (jordrotasjonen) mellom det faste hjulet og parallellkjedet.
      s.day = s.level1 + moonTrain.thickness + gap + plateDepth;           // dagkjedet, platene går over det faste hjulet
      s.parallel = s.day + moonTrain.thickness + chainGap;                 // parallellkjedet
      s.moonChain = s.parallel + moonTrain.thickness + chainGap;           // månekjedet
      s.fixedTop = s.parallel + moonTrain.thickness;                       // toppen av det faste røret
    } else {
      s.moonChain = s.level1 + moonTrain.thickness + gap + plateDepth;
      s.fixedTop = s.level1 + moonTrain.thickness;
    }
    s.pinionTop = s.moonChain + moonTrain.thickness + plateDepth;          // toppen av pinion-akselen, over lenkeplatene
    s.moonArm = s.moonChain + moonTrain.thickness + plateDepth + gap;      // månearmen (bare ute ved planeten), over lenkeplatene
    h.stack[t.name] = s;
    a = s.pinionTop + armStyle.hubRise + gap; // navet til neste arm går klar av kjedet
  }
  Object.assign(h, h.stack.earth); // jordas stabel: level1, day, parallel, moonChain, pinionTop, moonArm, fixedTop

  // Sola må henge over den øverste armen.
  if (bodies.height - bodies.sunRadius < h.topArm + gap) {
    throw new Error(`bodies.height må være minst ${(h.topArm + gap + bodies.sunRadius).toFixed(1)} så sola går klar av armene (er ${bodies.height}).`);
  }

  // Månearmene ved Jupiter, ovenfra: Io øverst, rett under Jupiter. Hver arm
  // har et nav som stikker hubRise opp og ned, og ligger gap over navet under.
  const js = h.stack.jupiter;
  js.moonArm = {};
  let top = bodies.height - planets.jupiter.radius - J.topGap;
  for (const name of jupiterMoonNames) {
    js.moonArm[name] = top - armStyle.hubRise - J.armThickness;
    top = js.moonArm[name] - armStyle.hubRise - gap;
  }
  const lowest = js.moonArm[jupiterMoonNames.at(-1)] - armStyle.hubRise;
  if (lowest < js.layTop + gap) {
    const more = js.layTop + gap - lowest;
    throw new Error(`Månearmene ved Jupiter når ned i hjulene: øk bodies.height med minst ${more.toFixed(1)} eller gjør jupiterMoons.topGap mindre.`);
  }

  // Ved Saturn: P (toppen av vinkelgiren) ligger rett under Saturns sentrum, og
  // det koniske hjulet på driveakselen under den. Stolperøret går fra
  // parallellkjedet opp til rett under det hjulet, og braketten går ut fra
  // toppen av stolperøret.
  const ss = h.stack.saturn;
  const ST = saturnTrain;
  ss.P = bodies.height - ST.P.drop;
  ss.bevelGear = ss.P - ST.bevel.drop1;                    // midten av det koniske hjulet på driveakselen
  ss.shaftTop = ss.bevelGear + SM.thickness / 2;           // toppen av driveakselen
  ss.frameTop = ss.bevelGear - SM.thickness / 2 - gap;     // toppen av stolperøret
  ss.bracket = ss.frameTop - 0.25;                         // braketten ut fra stolperøret
  if (ss.bracket - 0.25 < ss.chainTop + gap) {
    const more = ss.chainTop + gap - (ss.bracket - 0.25);
    throw new Error(`Vinkelgiren ved Saturn kommer ned i kjedene: øk bodies.height med minst ${more.toFixed(1)}, eller gjør saturnMoons.layDistance eller bevel.module mindre.`);
  }

  // Ved Mars: kryssleddet K sitter på toppen av stolpen, der den skrå
  // drivakselen forlenget treffer loddlinjen. Stolperøret går fra
  // parallellkjedet opp til rett under K, og braketten går ut fra toppen av det.
  const ms = h.stack.mars;
  const MT = marsTrain;
  ms.joint = bodies.height - MT.drive.jointDrop;                 // høyden på K
  ms.shaftTop = ms.joint;                                        // driveakselen går opp til K
  ms.frameTop = ms.joint - MM.jointRadius - gap;
  ms.bracket = ms.frameTop - 2 * MM.bracket.radius - 0.1;        // braketten ut fra stolperøret (under kanten, også den myke overgangen)
  const bracketLowest = ms.chainTop + gap + MM.bracket.radius + 0.4;  // braketten må gå klar av kjedene
  if (ms.bracket < bracketLowest) {
    throw new Error(`Kryssleddet ved Mars kommer ned i kjedene: øk bodies.height med minst ${(bracketLowest - ms.bracket).toFixed(1)}, eller gjør marsMoons.drive.distance mindre.`);
  }

  // Ved Uranus: stolperøret går fra parallellkjedet opp til rett under
  // vinkelgiren, og braketten går ut fra siden av det, under hjulene på
  // forlegsakselen. Den myke overgangen ved stolperøret må gå klar av kjedene.
  const us = h.stack.uranus, UMT = uranusMoonTrain;
  attachUranusArm(UMT, { armY: h.arm.uranus, chainY: us.chain, parallelY: us.parallel, chainTop: us.chainTop });
  us.bracket = UMT.bracket.points[0].y;
  us.frameTop = UMT.frameTop;
  const uranusLowest = us.bracket - UMT.r - UMT.bracket.fillet;
  if (uranusLowest < us.chainTop + gap) {
    throw new Error(`Braketten ved Uranus kommer ned i kjedene: øk bodies.height med minst ${(us.chainTop + gap - uranusLowest).toFixed(1)}.`);
  }
  // Ved Neptun: kragen, tappene og hjulene står ved foten av stolpen, og
  // Triton-armen (med hylsa og føringsringen over) må gå klar av dem.
  const ns = h.stack.neptune, NMT = neptuneMoonTrain;
  attachNeptuneArm(NMT, { armY: h.arm.neptune, chainY: ns.chain, armLength: armLengths.neptune });
  if (NMT.tritonArmY - armStyle.hubRise < NMT.pinTopA + gap) {
    throw new Error(`Triton-armen kommer ned i hjulene ved foten av Neptun-stolpen: øk bodies.height med minst ${(NMT.pinTopA + gap - NMT.tritonArmY + armStyle.hubRise).toFixed(1)}.`);
  }
  return h;
})();

// Jordstolpen: rotasjonen, føringsringen og foten (earthDesign.js, ruta
// earthDay.model). Gir feilmelding hvis bodies.height er for lav til det som står under jorda.
export const earthTrain = earthDesign(ED.model, {
  heights, armLengths, layout, tube, armParts, H: bodies.height,
  node: moonRing.node - earthAxis.direction, dayChain: earthDayChain,
});

// Braketten ved Uranus, på stolpen (x den veien aksen heller, y høyde, z):
// fra siden av stolperøret vannrett ut under hjulene på forlegsakselen, rett
// opp til polakselen (albuen), og langs den inn i polen (uranusMoonTrain).
export const uranusBracket = uranusMoonTrain.bracket;

// Punkter ved Saturn og Mars: fra den skrå aksens koordinater (x' mot
// forlegsakselen, s langs aksen, z') til koordinater på stolpen (x den veien
// aksen heller, y høyde, z), før stolpen dreies til retningen axis.direction.
const tiltedToPost = (tiltAngle) => (x, s, z = 0) => ({
  x: x * Math.cos(tiltAngle) + s * Math.sin(tiltAngle),
  y: bodies.height - x * Math.sin(tiltAngle) + s * Math.cos(tiltAngle),
  z,
});
export const saturnToPost = tiltedToPost(saturnTilt);
export const marsToPost = tiltedToPost(marsTilt);
export const uranusToPost = tiltedToPost(uranusTilt);

// Braketten ved Mars (knekt): fra toppen av stolperøret vannrett ut til siden
// (+z, motsatt av mellomhjulet og på tvers av drivakselen), rett opp, og
// vannrett inn i ytterveggen under Mars (ringhjulet og veggen i skåla, midt
// på). Endene møter stolperøret og veggen med myke overganger (fillet), og
// knekkene er runde.
export const marsBracket = (() => {
  const MT = marsTrain, ms = heights.stack.mars, r = MM.bracket.radius;
  const wallBottom = MT.level.bowl - MM.bowlThickness / 2, wallTop = MT.level.ringLayer + MM.thickness / 2;
  const q = marsToPost(0, (wallBottom + wallTop) / 2, MT.ring.outer);   // midt på ytterveggen
  const out = MT.ring.outer + spacing.gap + r + 0.3;              // den loddrette delen står så langt ute
  const frameOuter = MM.driveShaftRadius + MM.frameWall;
  const toward = Math.atan2(out, q.x);                            // retningen ut fra stolperøret
  return {
    radius: r,
    fillet: MM.bracket.fillet,
    points: [
      { x: frameOuter * Math.cos(toward), y: ms.bracket, z: frameOuter * Math.sin(toward) },
      { x: q.x, y: ms.bracket, z: out },
      { x: q.x, y: q.y, z: out },
      q,
    ],
  };
})();
// Braketten fra toppen av stolperøret til platen under hjulene: ut til siden
// (z), opp under platen og inn til akselen.
export const saturnBracket = (() => {
  const ST = saturnTrain, ss = heights.stack.saturn;
  const out = tipOf(ST.bevel.module, ST.bevel.driveTeeth) + spacing.gap + 0.2 + 0.4;
  const q = saturnToPost(0, ST.level.plate);
  return {
    radius: 0.2,
    // Første punkt: så enden på stanga akkurat møter utsiden av stolperøret.
    points: [{ x: 0, y: ss.bracket, z: -(SM.driveShaftRadius + SM.frameWall + 0.2) }, { x: 0, y: ss.bracket, z: -out }, { x: q.x, y: q.y, z: -out }, q],
  };
})();

// --- Tannhjul og kjedehjul må gå klar av akslene ---
// Rørhjulene må gå klar av mellomakselen og forlegsakselen. Hjulene på akslene
// må gå klar av røret de driver (de innerste rørene står også der).
{
  const clear = 0.5;
  const check = (name, teeth, otherTeeth) => {
    const m = pairModule(teeth, otherTeeth);
    const tubeTip = pitchRadius(m, otherTeeth) + m;
    const shaftTip = pitchRadius(m, teeth) + m;
    if (tubeTip > drive.distance - drive.shaftRadius - clear) {
      throw new Error(`Rørhjulet til ${name} går for nær akslene i tårnet: øk drive.distance eller endre tanntallene.`);
    }
    if (shaftTip > drive.distance - tube[name].outer - clear) {
      throw new Error(`Hjulet som driver ${name} går for nær rørene i midten: øk drive.distance eller endre tanntallene.`);
    }
    if (pitchRadius(m, teeth) - 1.25 * m < drive.shaftRadius + 0.2) {
      throw new Error(`Hjulet som driver ${name} er for lite til akselen: endre tanntallene.`);
    }
  };
  check('earth', smallGear.teeth, bigGear.teeth);
  for (const [name, p] of Object.entries(planets)) check(name, p.driveTeeth ?? p.layTeeth ?? p.counterTeeth, p.tubeTeeth);
  check('drive-jupiter', J.driveTeeth, J.tubeTeeth);
  check('drive-saturn', SM.driveTeeth, SM.tubeTeeth);
  check('par-saturn', SP.layTeeth, SP.tubeTeeth);
  if (usesCounter) check('saturn', counterDrive.shaftTeeth, counterDrive.saturnTeeth);  // hjul nr. 2 til motakselen
  check('par-uranus', UPP.counterTeeth, UPP.tubeTeeth);
  check('drive-uranus', UM.driveTeeth, UM.tubeTeeth);
  check('drive-neptune', NM.driveTeeth, NM.tubeTeeth);

  // Kjedene til forlegsakselen ligger nederst, der bare sentralakselen står.
  const edge = (chain, r) => r + chain.rollerRadius * 1.3;   // kjedehjulet med kjedet rundt
  const root = (chain, r) => r - chain.rollerRadius * 1.1;   // bunnen mellom tennene
  if (drive.distance - edge(driveChain, driveChain.radius2) < drive.shaftRadius + clear) {
    throw new Error('Det store løse kjedehjulet på sentralakselen går inn i mellomakselen eller forlegsakselen: gjør outerDrive.idlerLarge mindre.');
  }
  if (drive.distance - edge(layChain, layChain.radius2) < center.axleRadius + clear) {
    throw new Error('Kjedehjulet på forlegsakselen går inn i sentralakselen: gjør outerDrive.laySprocket mindre.');
  }
  if (root(driveChain, driveChain.radius1) < drive.shaftRadius + 0.2) {
    throw new Error('Det lille kjedehjulet på mellomakselen er for lite til akselen: øk outerDrive.driveSprocket.');
  }
  if (root(layChain, layChain.radius1) < idlerHub + 0.2) {
    throw new Error('Det lille løse kjedehjulet er for lite til navet på sentralakselen: øk outerDrive.idlerSmall.');
  }
}
