// Månene til Uranus og Neptun som ren matematikk (uten three.js). Modellen
// bruker B (mechanism.js regner ut uranusMoonTrain og neptuneMoonTrain med
// funksjonene her), og prøvesiden moons.html viser A ved siden av. Tallene står
// i iceMoons i config.js. Filen bruker ikke mechanism.js, så mechanism.js kan
// bruke den; det den trenger derfra (uranusTrain, armParts, høydene ved armen)
// sendes inn.
//
// Uranus (to alternativer, A og B): drivet er som ved Saturn, snudd på siden.
// Kjedet langs armen driver en aksel inni stolpen, en vinkelgir på toppen av
// stolpen fører drivet over i en forlegsaksel parallell med Uranus' akse, og
// ett hjulpar per måne går opp til et rør på polakselen.
//   A: rørene bærer ringene δ og ε (med egne stag), og ringene bærer månene.
//   B: rørene bærer månene på skrå stag med et kort bein ned i ekvatorplanet,
//      utenfor ringene. Ringene holdes av navet og stagene som i dag.
// Neptun (lik i begge): som ved Jupiter, med én måne og ett mellomhjul.
//
// Alle punkter er i stolpens koordinater, som uranusBracket i mechanism.js:
// x den veien Uranus' akse heller (ved Neptun: utover langs armen), y høyde,
// z til siden. Rundt Uranus' akse brukes også s (langs aksen, 0 i
// ringplanet, positivt mot polen med akselen), x' (på tvers, positivt nedover)
// og z.
//
// Delene beskrives også som enkle former for avstandssjekken: et rektangel
// eller en tykk strek i profilplanet rundt en akse (et omdreiningslegeme,
// for deler som dreier om den aksen), eller en stav (cap) for deler som står
// stille. Se scripts/clearance3d.mjs.
import { planets, uranusRing, uranusPost, iceMoons as IM, bodies, spacing, arm, armStyle, accent, moonTrain } from './config.js';
import { thinRingLayout } from './ringLayout.js';

const gap = spacing.gap;
const deg = (d) => (d * Math.PI) / 180;
const pitchRadius = (m, z) => (m * z) / 2;
const tipOf = (m, z) => (m * z) / 2 + m;
const rootOf = (m, z) => (m * z) / 2 - 1.25 * m;
const sprocketRadius = (teeth, pitch) => (teeth * pitch) / (2 * Math.PI);
const sprocketEdge = (teeth, pitch) => sprocketRadius(teeth, pitch) + pitch * 0.3 * 1.3;
const yearDays = 365.25636;
// Den korteste avstanden mellom to linjestykker pq og rt i planet ({ x, y }):
// 0 hvis de krysser, ellers den minste avstanden fra et endepunkt til det andre stykket.
const pointToSeg = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  const k = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - a.x - k * dx, p.y - a.y - k * dy);
};
const segDist2 = (p, q, r, t) => {
  const side = (a, b, c) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  if (side(p, q, r) * side(p, q, t) < 0 && side(r, t, p) * side(r, t, q) < 0) return 0;
  return Math.min(pointToSeg(p, r, t), pointToSeg(q, r, t), pointToSeg(r, p, q), pointToSeg(t, p, q));
};
const H = bodies.height;

// Høydene rundt armen ved en planet som får et kjede til (som Saturn og Jupiter).
export const firstChainAbove = (armTop) => armTop + Math.max(armStyle.hubRise + 0.3, armStyle.collarHeight + accent.ringWidth) + gap;

// ---------------------------------------------------------------- Uranus ---
const UR = uranusRing, UP = uranusPost, UM = IM.uranus;
const tilt = deg(UR.tilt);
const c = Math.cos(tilt), sn = Math.sin(tilt);
export const uranusTilt = tilt;
// Fra aksens koordinater (x', s, z) til stolpen.
export const fromTilted = (xp, s, z = 0) => ({ x: xp * c + s * sn, y: H - xp * sn + s * c, z });
// Et punkt i avstanden rho fra aksen, i vinkelen ang rundt den (0 = x', nedover).
export const aroundAxis = (rho, s, ang) => fromTilted(rho * Math.cos(ang), s, -rho * Math.sin(ang));
export const uranusAxisDir = { x: sn, y: c, z: 0 };

export function uranusDesign(variant, train, armParts) {
  const R = planets.uranus.radius;
  const ring = thinRingLayout(R, UR);
  const r = UP.bracket.radius;                 // polakselen og braketten
  const T = UM.thickness, w = UM.tubeWall, LD = UM.layDistance[variant];
  const poleS = train.poleS;
  const filletEnd = poleS + UP.bracket.fillet;
  const half = UR.thickness / 2;

  // Vinkelgiren. Driveakselen står loddrett, forlegsakselen parallelt med
  // aksen, og toppunktet P er der de møtes. Hjulet på forlegsakselen ligger
  // mellom P og polakselen. Hjulet på driveakselen ligger enten under P
  // ('below': vinkelen mellom aksene er 180° − helningen) eller over P
  // ('above': driveakselen går opp gjennom P, og vinkelen er helningen). Bare
  // 'above' får månene til å gå samme vei som Uranus dreier: med 'below'
  // dreier forlegsakselen samme vei som driveakselen, og månerørene motsatt.
  const B = UM.bevel, above = UM.bevelSide[variant] === 'above';
  const sigma = above ? tilt : Math.PI - tilt;
  const delta1 = Math.atan2(Math.sin(sigma), B.layTeeth / B.driveTeeth + Math.cos(sigma));
  const delta2 = sigma - delta1;
  const r1 = pitchRadius(B.module, B.driveTeeth), r2 = pitchRadius(B.module, B.layTeeth);
  const cone = r1 / Math.sin(delta1);
  const bevel = { ...B, delta1, delta2, r1, r2, cone, drop1: cone * Math.cos(delta1), drop2: cone * Math.cos(delta2) };
  // P: der forlegsakselen (x' = LD) krysser loddlinjen gjennom stolpen (x = 0).
  const sP = (-LD * c) / sn;
  const P = fromTilted(LD, sP);
  bevel.driveY = above ? P.y + bevel.drop1 : P.y - bevel.drop1;   // midten av hjulet på driveakselen
  bevel.driveApex = above ? -bevel.drop1 : bevel.drop1;           // fra midten av hjulet til P, loddrett
  bevel.layS = sP + bevel.drop2;                                  // midten av hjulet på forlegsakselen
  bevel.layApex = -bevel.drop2;                                   // fra midten av hjulet til P, langs aksen
  bevel.above = above;

  // Hjulparene: hvert par når over layDistance med sin egen modul.
  const pairs = {};
  for (const [moon, [lay, tube]] of Object.entries(UM.steps)) {
    pairs[moon] = { lay, tube, module: (2 * LD) / (lay + tube) };
  }

  // Rørene på polakselen og det som sitter på dem, langs aksen fra polen og ut.
  // Det innerste røret er lengst og har hjulet sitt ytterst.
  const tubes = {}, levels = {};
  let s;
  let bRods = null;
  if (variant === 'B') {
    // Det faste navet med stagene til ring 6 står som i modellen i dag. Utenfor
    // navet: Titania på det innerste røret, Oberon på røret utenpå. Hvert rør
    // har en krage med et skrått stag ned til et punkt rett over månen, og et
    // kort bein ned til månen i ekvatorplanet, utenfor ringene. Stagene holder
    // seg innenfor månebanen, så Uranus ikke blir bredere enn banene. Så
    // hjulene, Oberons først.
    const aT = UM.armThickness, hub = train.hub, rodR = UM.armWidth / 2;
    const size = IM.size;
    const orbitT = ring.outer + uranusRing.spokeWidth / 2 + gap + size.titania;   // klar av endene på eikene
    const orbitO = orbitT + size.titania + gap + size.oberon;
    // Rørene starter så langt ut at de går klar av stagene fra det faste navet.
    tubes.titania = { inner: r, outer: r + w, s0: hub.s1 + 0.15 };
    tubes.oberon = { inner: r + w, outer: r + 2 * w };
    levels.titaniaArm = hub.s1 + gap + aT / 2;
    const corner = { x: ring.outer, y: half };                  // ytterkanten av ε, på siden mot stagene
    const pd = (p, q, x) => segDist2(p, q, x, x);
    // Titania: det laveste punktet over månen der staget går 0,3 klar av ringene.
    const startT = { x: tubes.titania.outer + 0.2, y: levels.titaniaArm };
    let hT = size.titania;
    while (pd(startT, { x: orbitT, y: hT }, corner) < gap + rodR) hT += 0.02;
    const rodT = [startT, { x: orbitT, y: hT }];
    // Oberon: kragen så nær Titanias som mulig, og staget så lavt som mulig, men
    // klar av Titanias stag, bein og måne, og av ringene.
    const okO = (sO, hO) => {
      const a0 = { x: tubes.oberon.outer + 0.2, y: sO }, a1 = { x: orbitO, y: hO };
      return segDist2(a0, a1, rodT[0], rodT[1]) >= gap + 2 * rodR
        && pd(a0, a1, { x: orbitT, y: 0 }) >= gap + rodR + size.titania
        && segDist2(a0, a1, { x: orbitT, y: 0 }, { x: orbitT, y: hT }) >= gap + rodR + UM.legRadius
        && pd(a0, a1, corner) >= gap + rodR;
    };
    let sO = levels.titaniaArm + aT + gap, hO = null;
    for (let k = 0; k < 200 && hO === null; k++, sO += 0.05) {
      for (let h = size.oberon; h < 3; h += 0.02) if (okO(sO, h)) { hO = h; break; }
    }
    if (hO === null) throw new Error('iceMoons: Oberons stag finner ikke plass i B.');
    sO -= 0.05;
    levels.oberonArm = sO;
    tubes.oberon.s0 = sO - aT / 2;
    bRods = {
      rodRadius: rodR,
      titania: { from: rodT[0], to: rodT[1], orbit: orbitT },
      oberon: { from: { x: tubes.oberon.outer + 0.2, y: sO }, to: { x: orbitO, y: hO }, orbit: orbitO },
    };
    levels.oberonGear = levels.oberonArm + aT / 2 + gap + T / 2;
    levels.titaniaGear = levels.oberonGear + T + gap;
    tubes.oberon.s1 = levels.oberonGear + T / 2;
    tubes.titania.s1 = levels.titaniaGear + T / 2;
    s = levels.titaniaGear + T / 2;
  } else {
    // A: det faste navet (stagene til ring 6) står som før. Utenfor det:
    // navet til δ (Oberon) på det innerste røret, navet til ε (Titania) på røret
    // utenpå, og hjulene, ε først.
    const hub = train.hub, L = UM.hub.length;
    tubes.oberon = { inner: r, outer: r + w, s0: hub.s1 + 0.15, ring: 'δ' };  // klar av stagene fra det faste navet
    levels.oberonHub = hub.s1 + gap + L / 2;
    tubes.titania = { inner: r + w, outer: r + 2 * w, s0: levels.oberonHub + L / 2 + gap, ring: 'ε' };
    levels.titaniaHub = tubes.titania.s0 + L / 2;
    levels.titaniaGear = levels.titaniaHub + L / 2 + gap + T / 2;
    levels.oberonGear = levels.titaniaGear + T + gap;
    tubes.titania.s1 = levels.titaniaGear + T / 2;
    tubes.oberon.s1 = levels.oberonGear + T / 2;
    s = levels.oberonGear + T / 2;
  }
  const elbowS = s + gap + r;
  const elbow = fromTilted(0, elbowS);
  const lastGear = Math.max(levels.titaniaGear, levels.oberonGear);
  const laySpan = [bevel.layS - T / 2, lastGear + T / 2 + 0.1];

  for (const [moon, p] of Object.entries(pairs)) {
    const t = tubes[moon];
    if (rootOf(p.module, p.tube) < t.outer + 0.2) throw new Error(`iceMoons.uranus.steps.${moon}: hjulet på månerøret er for lite til røret.`);
    if (rootOf(p.module, p.lay) < UM.shaftRadius + 0.2) throw new Error(`iceMoons.uranus.steps.${moon}: hjulet på forlegsakselen er for lite til akselen.`);
    if (tipOf(p.module, p.tube) > LD - UM.shaftRadius - gap) throw new Error(`iceMoons.uranus.steps.${moon}: hjulet på månerøret går for nær forlegsakselen.`);
    if (tipOf(p.module, p.lay) > LD - t.outer - gap) throw new Error(`iceMoons.uranus.steps.${moon}: hjulet på forlegsakselen går for nær rørene.`);
  }

  // Braketten: fra stolperøret vannrett ut under alle hjulene på
  // forlegsakselen, rett opp til polakselen (albuen), og langs den inn i polen.
  // Den laveste delen av en skive rundt forlegsakselen ligger radius × sin(helning) under midten.
  const yOnLay = (s1) => fromTilted(LD, s1).y;
  let lowest = yOnLay(bevel.layS) - (tipOf(B.module, B.layTeeth) * sn) - T / 2;
  for (const [moon, p] of Object.entries(pairs)) {
    lowest = Math.min(lowest, yOnLay(levels[`${moon}Gear`]) - tipOf(p.module, p.lay) * sn - (T / 2) * Math.abs(c));
  }
  const frameOuter = UM.driveShaftRadius + UM.frameWall;
  const frameTop = bevel.driveY - T / 2 - gap;
  const bracketY = Math.min(lowest - gap - r, frameTop - 2 * r - UP.bracket.fillet);
  const pole = fromTilted(0, poleS);
  const bracket = {
    radius: r, fillet: UP.bracket.fillet,
    // Det første punktet er der den runde enden møter stolperøret.
    points: [{ x: frameOuter + r, y: bracketY, z: 0 }, { x: elbow.x, y: bracketY, z: 0 }, elbow, pole],
  };

  // Forlegsakselen er båret av to lagre i braketten, som ved Saturn: den er
  // forlenget inn i et lager i den loddrette delen, og en bukk går fra den
  // vannrette delen opp til et lager like ved vinkelgiren.
  const BR = UM.bearing, bearingR = UM.shaftRadius + BR.wall;
  const sRiser = (elbow.x - LD * c) / sn;      // der forlegsakselen treffer den loddrette delen
  const firstLay = Math.min(levels.titaniaGear, levels.oberonGear) - T / 2;
  const sFoot = bevel.layS + T / 2 + gap + BR.length / 2 + 0.4;   // like ved vinkelgiren
  if (sRiser - BR.length - r < lastGear + T / 2 + gap) throw new Error('iceMoons.uranus: lageret i braketten går inn i hjulene på forlegsakselen.');
  const footTop = fromTilted(LD + bearingR + BR.postRadius - 0.02, sFoot);
  const footPost = (y) => {
    const t = (footTop.y - y) / sn;             // langs x' (på tvers av akselen, nedover)
    return { x: footTop.x + t * c, y, z: 0 };
  };
  const bearings = {
    riser: { s0: sRiser - r - BR.length, s1: sRiser, radius: bearingR },
    foot: {
      s0: sFoot - BR.length / 2, s1: sFoot + BR.length / 2, radius: bearingR,
      // Stolpen står på tvers av forlegsakselen (heller med aksen, bort fra
      // hjulene), fra den vannrette delen av braketten opp til lagerhuset. Den
      // runde enden når akkurat lagerhuset.
      post: [footPost(bracketY), footTop],
    },
  };
  laySpan[1] = sRiser;

  const design = {
    variant, train, armParts, R, ring, r, T, LD, poleS, filletEnd, half, bevel, P, sP, pairs, tubes, levels, elbowS, elbow, laySpan,
    frameOuter, frameTop, bracket, bearings, shaftTop: bevel.driveY + T / 2,
  };

  // Månene og det som bærer dem.
  const size = IM.size;
  if (variant === 'B') {
    // Månene går i ekvatorplanet utenfor ringene, på bein ned fra stagene.
    design.rods = bRods;
    design.moons = {
      titania: { orbit: bRods.titania.orbit, radius: size.titania, s: 0, armS: levels.titaniaArm, legTop: bRods.titania.to.y, rod: bRods.titania, tube: tubes.titania },
      oberon: { orbit: bRods.oberon.orbit, radius: size.oberon, s: 0, armS: levels.oberonArm, legTop: bRods.oberon.to.y, rod: bRods.oberon, tube: tubes.oberon },
    };
  } else {
    // A: ε bærer Titania på en arm rett ut i ringplanet; δ bærer Oberon på et
    // ledd ut på den frie siden (mot −s) og en arm over ε og Titania.
    const eps = ring.rings.find((x) => x.name === 'ε'), del = ring.rings.find((x) => x.name === 'δ');
    const aT = UM.armThickness;
    const titaniaOrbit = ring.outer + uranusRing.spokeWidth / 2 + gap + size.titania;
    const lift = Math.max(size.titania, aT / 2) + gap + aT / 2;
    const oberonOrbit = titaniaOrbit + size.titania + gap + size.oberon;
    design.moons = {
      titania: { orbit: titaniaOrbit, radius: size.titania, s: 0, ring: eps, from: eps.outer - 0.1, tube: tubes.titania },
      oberon: { orbit: oberonOrbit, radius: size.oberon, s: -lift, ring: del, from: del.middle, tube: tubes.oberon },
    };
    const hubR = (t) => t.outer + UM.hub.rise;
    design.ringHubs = {
      oberon: { s: levels.oberonHub, inner: tubes.oberon.outer, outer: hubR(tubes.oberon), ring: del },
      titania: { s: levels.titaniaHub, inner: tubes.titania.outer, outer: hubR(tubes.titania), ring: eps },
    };
  }

  // Hvor langt alt rekker ut fra stolpen, sett ovenfra (høydene ved armen
  // betyr ikke noe for det, så her brukes foreløpige høyder).
  attachUranusArm(design, uranusArmLevels(H - 30));
  design.reach = Math.max(...uranusParts(design).map(partReach));
  return design;
}

// Høydene ved Uranus-armen: månekjedet nederst (til driveakselen) og
// parallellkjedet over (til stolperøret), som ved Saturn. heights i
// mechanism.js regner dem på samme måte.
export function uranusArmLevels(armY) {
  const chainY = firstChainAbove(armY + arm.thickness);
  const parallelY = chainY + moonTrain.thickness + spacing.chainGap;
  return { armY, chainY, parallelY, chainTop: parallelY + moonTrain.thickness + 0.3 };
}
export function attachUranusArm(d, { armY, chainY, parallelY, chainTop }) {
  return Object.assign(d, { armY, armTop: armY + arm.thickness, chainY, parallelY, chainTop });
}

// ---------------------------------------------------------------- Neptun ---
const NM = IM.neptune;
export function neptuneDesign(armParts) {
  const R = planets.neptune.radius;
  const m = NM.module, T = NM.thickness;
  const postR = armParts.planet.postRadius;
  const tubeOuter = postR + NM.tubeWall;
  const collarSprocket = { teeth: NM.collarSprocket, radius: sprocketRadius(NM.collarSprocket, NM.chainPitch), edge: sprocketEdge(NM.collarSprocket, NM.chainPitch) };

  // Tappen A står på armen, innover mot sola, inne i kjedesløyfa. Mellomhjulet
  // B henger i en bøyle fra toppen av tappen, på den ene siden.
  const dA = pitchRadius(m, NM.collarTeeth) + pitchRadius(m, NM.layLow);
  const dB = pitchRadius(m, NM.idlerTeeth) + pitchRadius(m, NM.tritonTeeth);
  const dAB = pitchRadius(m, NM.layHigh) + pitchRadius(m, NM.idlerTeeth);
  const bx = (dB * dB - dAB * dAB - dA * dA) / (2 * dA);
  const bz2 = dB * dB - bx * bx;
  if (bz2 <= 0.01) throw new Error('iceMoons.neptune: mellomhjulet når ikke fram til både tappen og Tritons hjul. Endre tanntallene.');
  const A = { x: -dA, z: 0 }, Bp = { x: bx, z: NM.idlerSide * Math.sqrt(bz2) };
  const checks = [
    [dA - collarSprocket.edge - NM.pinRadius < gap, 'Tappen går for nær kjedehjulet på kragen: øk collarTeeth eller layLow.'],
    [rootOf(m, NM.collarTeeth) < tubeOuter + 0.2, 'Hjulet på kragen er for lite til røret.'],
    [rootOf(m, NM.tritonTeeth) < tubeOuter + 0.2, 'Tritons hjul er for lite til røret.'],
    [rootOf(m, NM.layLow) < NM.pinRadius + 0.2 || rootOf(m, NM.layHigh) < NM.pinRadius + 0.2, 'Hjulene på tappen er for små til tappen.'],
    [rootOf(m, NM.idlerTeeth) < NM.pinRadius + 0.2, 'Mellomhjulet er for lite til tappen sin.'],
    [dA - tipOf(m, NM.layHigh) - tipOf(m, NM.tritonTeeth) < gap, 'Det øverste hjulet på tappen går for nær Tritons hjul: det skal bare gripe i mellomhjulet.'],
  ];
  for (const [bad, text] of checks) if (bad) throw new Error(`iceMoons.neptune: ${text}`);

  // Triton og føringsringen. Banen heller i = 180° − tilt (baklengs), med
  // knutelinjen langs z (på tvers av armen). Triton går i avstanden orbit fra
  // stolpen; staven løftes K × cos θ, der θ er vinkelen fra +x (utover).
  const a = NM.orbit, inc = deg(180 - NM.tilt), K = Math.tan(inc) * a;
  const G = NM.guide, rg = G.radius;
  const ringTilt = Math.atan(K / rg);          // ringen heller brattere enn banen, fordi foten er lenger inne
  const fr = NM.footRadius, pinLen = NM.pinLength;
  const barAbove = G.height / 2 + pinLen + fr; // fra midten av ringen til midten av foten (stanga)
  // Ringen senkes til hele ringen og stanga ligger under Neptun og går 0,3
  // klar av kula (ringen er smalere enn Neptun, så den kan ikke gå rundt den).
  const clearOfNeptune = (yg) => {
    const ok = (x, y, extra = 0) => y < 0 && Math.hypot(x, y) >= R + gap + extra;
    for (let k = 0; k < 72; k++) {
      const t = (2 * Math.PI * k) / 72, y = yg + K * Math.cos(t);
      for (const dr of [-G.width / 2, G.width / 2]) for (const dy of [-G.height / 2, G.height / 2]) {
        if (!ok(rg + dr, y + dy)) return false;
      }
      for (let j = 0; j <= 10; j++) if (!ok(rg + ((a - rg) * j) / 10, y + barAbove, fr)) return false;
    }
    return true;
  };
  let yg = -R;
  while (!clearOfNeptune(yg)) {
    yg -= 0.02;
    if (yg < -30) throw new Error('iceMoons.neptune: føringsringen finner ikke plass under Neptun.');
  }
  const guideY = H + yg;
  const stalkLength = -(yg + barAbove);        // fra stanga opp til Triton (Triton i høyde med Neptun ved θ = 90°)
  const barLow = guideY - K + barAbove;        // stanga når den står lavest
  const sleeveTop = barLow - fr - gap;
  const stalkBelow = 2 * K + fr + gap + 0.4;   // så langt staven går ned under stanga (og alltid minst 0,4 inn i hylsa)
  const tritonArmTop = barLow - stalkBelow - 0.1;
  const tritonArmY = tritonArmTop - NM.armThickness;
  // Der Triton, staven og foten er når armen står i vinkelen θ.
  const lift = (theta) => K * Math.cos(theta);
  const tritonAt = (theta) => {
    const x = a * Math.cos(theta), z = a * Math.sin(theta), y = H + lift(theta);
    const bar = guideY + lift(theta) + barAbove;
    const ux = Math.cos(theta), uz = Math.sin(theta);
    return {
      triton: { x, y, z },
      stalk: [{ x, y: bar - stalkBelow, z }, { x, y, z }],
      bar: [{ x: rg * ux, y: bar, z: rg * uz }, { x, y: bar, z }],
      pin: [{ x: rg * ux, y: bar - fr - pinLen, z: rg * uz }, { x: rg * ux, y: bar, z: rg * uz }],
    };
  };
  // Føringsringen: en smal ring med loddrette sider (som et stykke av en
  // sylinder), midtlinjen i avstanden rg fra stolpen, løftet K × cos θ.
  const guidePoint = (theta, dr = 0, dy = 0) => ({
    x: (rg + dr) * Math.cos(theta), y: guideY + lift(theta) + dy, z: (rg + dr) * Math.sin(theta),
  });
  const spokeAngles = Array.from({ length: G.spokes }, (_, k) => Math.PI / 2 + (2 * Math.PI * k) / G.spokes);
  // Navet sitter under det laveste punktet på ringen, så eikene går opp til
  // undersiden av ringen og aldri kommer opp der tappen under foten går.
  const guideHubY = guideY - K - G.height / 2 - 0.6;

  const design = {
    armParts, R, m, T, postR, tubeOuter, collarSprocket,
    A, B: Bp, dA, dB, dAB,
    orbit: a, inclination: inc, K, ringTilt, guideY, guideHubY, stalkLength, stalkBelow, sleeveTop, tritonArmY, tritonArmTop, barAbove,
    lift, tritonAt, guidePoint, spokeAngles,
    tritonTubeTop: tritonArmTop + armStyle.hubRise,
  };
  attachNeptuneArm(design, { armY: H - 31, chainY: firstChainAbove(H - 31 + arm.thickness), armLength: 100 });
  design.reach = Math.max(...neptuneParts(design).map(partReach));
  return design;
}

// Høydene ved foten av Neptun-stolpen, fra armen og kjedet: kragens hjul og
// det nederste hjulet på tappen, over dem mellomhjulet, det øverste hjulet på
// tappen og Tritons hjul, og øverst bøylen. armLength trengs for retningen på kjedet.
export function attachNeptuneArm(d, { armY, chainY, armLength }) {
  const T = d.T;
  const chainTop = chainY + moonTrain.thickness + 0.3;
  const lowY = chainTop + gap, highY = lowY + T + gap, bridgeY = highY + T + gap;
  return Object.assign(d, {
    armY, armTop: armY + arm.thickness, chainY, chainTop, lowY, highY, bridgeY, armLength,
    pinTopA: bridgeY + NM.bridge.thickness, pinBottomB: highY,
  });
}

// --------------------------------------------------------- Formene ---
// Aksene som omdreiningslegemene dreier om: o er et punkt på aksen, d retningen.
// s måles fra o langs d.
const V = { o: { x: 0, y: 0, z: 0 }, d: { x: 0, y: 1, z: 0 } };
const rect = (s0, s1, r0, r1) => ({ kind: 'rect', s0, s1, r0: Math.max(0, r0), r1 });
const seg = (s0, r0, s1, r1, w) => ({ kind: 'seg', a: { s: s0, r: r0 }, b: { s: s1, r: r1 }, w });
const cap = (a, b, w) => ({ kind: 'cap', a, b, w });
const ball = (p, w) => cap(p, p, w);
const plateEnd = 1.0 * 0.3 * 1.25;           // lenkeplatene stikker så langt ut
const chainBand = (y) => [y - 0.29, y + moonTrain.thickness + 0.29];

// Uranus: kropper som dreier mot hverandre (sett fra stolpen, som står stille i rommet).
export function uranusParts(d) {
  const parts = [];
  const add = (body, name, axis, shape, extra = {}) => parts.push({ body, name, axis, shape, ...extra });
  const U = { o: { x: 0, y: H, z: 0 }, d: uranusAxisDir, key: 'U' };
  const L = { o: fromTilted(d.LD, 0), d: uranusAxisDir, key: 'L' };
  const Vk = { ...V, key: 'V' };
  const T = d.T, armParts = d.armParts, train = d.train;
  const UPc = uranusPost.parallel;
  const parR = sprocketRadius(UPc.postSprocket, UP.chainPitch), parEdge = sprocketEdge(UPc.postSprocket, UP.chainPitch);
  const drvR = sprocketRadius(UM.shaftSprocket, UM.chainPitch), drvEdge = sprocketEdge(UM.shaftSprocket, UM.chainPitch);

  // Armen og de to kjedene dreier om loddlinjen.
  add('arm', 'arm', Vk, rect(d.armY, d.armTop, d.frameOuter, 1e3), { tube: true, ground: true });
  add('arm', 'krage og rød ring', Vk, rect(d.armTop, d.armTop + armStyle.collarHeight + accent.ringWidth, d.frameOuter, armParts.planet.collarRadius), { tube: true });
  add('arm', 'månekjede', Vk, rect(...chainBand(d.chainY), drvR - plateEnd, 1e3), { id: 'kjede1' });
  add('arm', 'parallellkjede', Vk, rect(...chainBand(d.parallelY), parR - plateEnd, 1e3), { id: 'kjede2' });
  // Driveakselen med kjedehjulet nederst og det koniske hjulet øverst.
  add('driveaksel', 'driveaksel', Vk, rect(d.armTop, d.shaftTop, 0, UM.driveShaftRadius), { tube: true, shaft: true });
  add('driveaksel', 'kjedehjul', Vk, rect(d.chainY, d.chainY + moonTrain.thickness, UM.driveShaftRadius, drvEdge), { mesh: ['kjede1'] });
  bevelSlices(add, 'driveaksel', 'konisk hjul', Vk, d.bevel.driveY, UM.driveShaftRadius, tipOf(d.bevel.module, d.bevel.driveTeeth), d.bevel.driveApex, T, { id: 'bevel1' });
  // Stolperøret, braketten, polakselen og kula står stille.
  add('stolpe', 'kjedehjul', Vk, rect(d.parallelY, d.parallelY + moonTrain.thickness, d.frameOuter, parEdge), { mesh: ['kjede2'] });
  add('stolpe', 'stolperør', Vk, rect(d.parallelY, d.frameTop, UM.driveShaftRadius, d.frameOuter), { tube: true, ground: true });
  const bp = d.bracket.points, last = bp.length - 1;
  for (let i = 0; i < last - 1; i++) add('stolpe', `brakett ${i + 1}`, null, cap(bp[i], bp[i + 1], d.r));
  add('stolpe', 'myk overgang ved stolpen', { o: { x: d.frameOuter, y: bp[0].y, z: 0 }, d: unitOf(sub(bp[1], bp[0])), key: 'F0' }, rect(0, d.bracket.fillet, 0, 2 * d.r));
  // Polakselen fra albuen inn til polen; den myke overgangen ved polen smalner av.
  // (Akselen er dekket av det faste navet fram til enden av det.)
  add('stolpe', 'polaksel', U, rect(train.hub.s1, d.elbowS, 0, d.r), { tube: true });
  add('stolpe', 'myk overgang ved polen', U, rect(d.poleS, d.poleS + d.bracket.fillet / 2, 0, 2 * d.r), { tube: true });
  add('stolpe', 'myk overgang ved polen (ytre del)', U, rect(d.poleS + d.bracket.fillet / 2, d.filletEnd, 0, 1.2 * d.r), { tube: true });
  add('Uranus', 'Uranus', U, seg(0, 0, 0, 0, d.R));
  // Forlegsakselen med det koniske hjulet og hjulparene.
  add('forlegg', 'forlegsaksel', L, rect(...d.laySpan, 0, UM.shaftRadius), { tube: true, shaft: true });
  const bb = d.bearings;
  add('stolpe', 'lager i braketten', L, rect(bb.riser.s0, bb.riser.s1, UM.shaftRadius, bb.riser.radius), { tube: true });
  add('stolpe', 'lagerbukk', L, rect(bb.foot.s0, bb.foot.s1, UM.shaftRadius, bb.foot.radius), { tube: true });
  add('stolpe', 'stolpe til lagerbukken', null, cap(...bb.foot.post, UM.bearing.postRadius));
  bevelSlices(add, 'forlegg', 'konisk hjul', L, d.bevel.layS, UM.shaftRadius, tipOf(d.bevel.module, d.bevel.layTeeth), d.bevel.layApex, T, { mesh: ['bevel1'] });
  for (const [moon, p] of Object.entries(d.pairs)) {
    const s = d.levels[`${moon}Gear`];
    add('forlegg', `hjul for ${moon}`, L, rect(s - T / 2, s + T / 2, UM.shaftRadius, tipOf(p.module, p.lay)), { id: `lay-${moon}` });
  }

  // Ringene. I B står alle stille; i A står 6, α og β stille.
  const ring = d.ring;
  const fixedRings = d.variant === 'B' ? ring.rings : ring.rings.filter((x) => !['δ', 'ε'].includes(x.name));
  for (const x of fixedRings) add('ringer', `ring ${x.name}`, U, rect(-d.half, d.half, x.inner, x.outer), { glass: true });
  const spokeOuter = fixedRings.at(-1).outer;
  train.azimuths.forEach((ang, k) => {
    add('ringer', `eik ${k + 1}`, null, cap(aroundAxis(ring.inner, 0, ang), aroundAxis(spokeOuter, 0, ang), uranusRing.spokeWidth / 2));
  });

  // Månene med rørene, hjulene og det de bærer (hver sin kropp).
  const aT = UM.armThickness, aW = UM.armWidth;
  for (const [moon, mo] of Object.entries(d.moons)) {
    const t = mo.tube, p = d.pairs[moon], s = d.levels[`${moon}Gear`], body = moon === 'titania' ? 'Titania' : 'Oberon';
    add(body, 'rør', U, rect(t.s0, t.s1, t.inner, t.outer), { tube: true, shaft: true });
    add(body, 'hjul', U, rect(s - T / 2, s + T / 2, t.outer, tipOf(p.module, p.tube)), { mesh: [`lay-${moon}`] });
    add(body, moon, U, seg(mo.s, mo.orbit, mo.s, mo.orbit, mo.radius));
    if (d.variant === 'B') {
      const rr = d.rods.rodRadius;
      add(body, 'krage', U, rect(mo.armS - aT / 2, mo.armS + aT / 2, t.outer, mo.rod.from.x + rr));
      add(body, 'stag', U, seg(mo.rod.from.y, mo.rod.from.x, mo.rod.to.y, mo.rod.to.x, rr));
      add(body, 'bein', U, rect(0, mo.legTop, mo.orbit - UM.legRadius, mo.orbit + UM.legRadius));
    } else {
      const hub = d.ringHubs[moon];
      add(body, 'nav', U, rect(hub.s - UM.hub.length / 2, hub.s + UM.hub.length / 2, hub.inner, hub.outer));
      add(body, 'stag', U, seg(hub.s, hub.outer - 0.05, d.half, hub.ring.middle, uranusRing.struts.width / 2));
      add(body, `ring ${hub.ring.name}`, U, rect(-d.half, d.half, hub.ring.inner, hub.ring.outer), { glass: true });
      if (mo.s === 0) {
        add(body, 'arm', U, rect(-aT / 2, aT / 2, mo.from, mo.orbit));
      } else {
        add(body, 'ledd', U, rect(mo.s - aT / 2, -d.half, mo.from - UM.legRadius, mo.from + UM.legRadius));
        add(body, 'arm', U, rect(mo.s - aT / 2, mo.s + aT / 2, mo.from - aW / 2, mo.orbit));
      }
    }
  }
  // Det faste navet og stagene til ring 6, som i dag.
  const hub = train.hub;
  add('stolpe', 'nav', U, rect(hub.s0, hub.s1, d.r, hub.radius), { tube: true });
  train.azimuths.forEach((ang, k) => {
    add('ringer', `stag ${k + 1}`, null, cap(aroundAxis(hub.radius - 0.05, hub.s, ang), aroundAxis(train.attach.rho, train.attach.s, ang), train.strutRadius));
  });
  return parts;
}

// Konisk hjul som skiver langs aksen, hver med den største radiusen i skiva.
// drop er avstanden fra midten av hjulet til toppunktet (negativ: toppunktet ligger mot −s).
function bevelSlices(add, body, name, axis, mid, hole, tip, drop, T, extra) {
  const n = 8;
  for (let k = 0; k < n; k++) {
    const s0 = mid - T / 2 + (k * T) / n, s1 = s0 + T / n;
    const far = drop > 0 ? s0 : s1;            // den bredeste kanten av skiva
    add(body, name, axis, rect(s0, s1, hole, tip * (1 - (far - mid) / drop)), extra);
  }
}

// Neptun: kropper sett fra Neptun-stolpen (som står fast på armen).
export function neptuneParts(d, thetaSteps = 72) {
  const parts = [];
  const add = (body, name, axis, shape, extra = {}) => parts.push({ body, name, axis, shape, ...extra });
  const Vk = { ...V, key: 'V' };
  const Ax = { o: { x: d.A.x, y: 0, z: d.A.z }, d: V.d, key: 'A' };
  const Bx = { o: { x: d.B.x, y: 0, z: d.B.z }, d: V.d, key: 'B' };
  const m = d.m, T = d.T, postR = d.postR, armParts = d.armParts;
  const halfArm = armParts.planet.endRadius;   // armen er minst så bred ved stolpen

  // Stolpen, armen, tappene, bøylen, navet og føringsringen står stille.
  const armMid = d.armY + arm.thickness / 2;
  for (const z of [-(halfArm - arm.thickness / 2), 0, halfArm - arm.thickness / 2]) {
    add('stolpe', 'arm', null, cap({ x: 0, y: armMid, z }, { x: -12, y: armMid, z }, arm.thickness / 2), { noReach: true, ground: true });
  }
  add('stolpe', 'krage og rød ring', Vk, rect(d.armTop, d.armTop + armStyle.collarHeight + accent.ringWidth, postR, armParts.planet.collarRadius), { tube: true });
  add('stolpe', 'stolpe', Vk, rect(d.armTop, H, 0, postR), { tube: true, ground: true });
  add('stolpe', 'tapp A', Ax, rect(d.armTop, d.pinTopA, 0, NM.pinRadius), { tube: true });
  add('stolpe', 'tapp B', Bx, rect(d.pinBottomB, d.pinTopA, 0, NM.pinRadius), { tube: true });
  // Bøylen: en flat stang, her to tynne staver side om side.
  const by = d.bridgeY + NM.bridge.thickness / 2, bt = NM.bridge.thickness / 2;
  const across = unitOf({ x: -(d.B.z - d.A.z), y: 0, z: d.B.x - d.A.x }), off = NM.bridge.width / 2 - bt;
  for (const k of [-1, 1]) {
    const o = { x: across.x * off * k, y: 0, z: across.z * off * k };
    add('stolpe', 'bøyle', null, cap({ x: d.A.x + o.x, y: by, z: d.A.z + o.z }, { x: d.B.x + o.x, y: by, z: d.B.z + o.z }, bt));
  }
  const G = NM.guide;
  add('stolpe', 'nav til føringsringen', Vk, rect(d.guideHubY - 0.3, d.guideHubY + 0.3, postR, postR + G.hub), { tube: true });
  const N = 96;
  for (let k = 0; k < N; k++) {
    const t0 = (2 * Math.PI * k) / N, t1 = (2 * Math.PI * (k + 1)) / N;
    for (const dy of [-G.height / 2 + G.width / 2, G.height / 2 - G.width / 2]) {
      add('stolpe', 'føringsring', null, cap(d.guidePoint(t0, 0, dy), d.guidePoint(t1, 0, dy), G.width / 2), { guide: true });
    }
  }
  for (const t of d.spokeAngles) {
    const end = d.guidePoint(t, -G.width / 2, -G.height / 2);
    const start = { x: (postR + G.hub - 0.05) * Math.cos(t), y: d.guideHubY, z: (postR + G.hub - 0.05) * Math.sin(t) };
    add('stolpe', 'eik', null, cap(start, end, G.spokeRadius));
  }
  add('Neptun', 'Neptun', Vk, seg(H, 0, H, 0, d.R));

  // Kjedet: de to partene fra kjedehjulet på kragen inn mot sentrum (står stille i formen).
  const L = d.armLength, r1 = d.collarSprocket.radius, r2 = sprocketRadius(NM.tubeSprocket, NM.chainPitch);
  const nx = (r1 - r2) / L, nz = Math.sqrt(1 - nx * nx);
  // Hver part er to staver over hverandre (lenkeplatene stikker 0,375 ut til siden og 0,29 opp og ned).
  const pw = 0.375;
  for (const side of [1, -1]) for (const y of [d.chainY - 0.29 + pw, d.chainY + moonTrain.thickness + 0.29 - pw]) {
    const p0 = { x: r1 * nx, y, z: side * r1 * nz };
    const p1 = { x: p0.x - 8 * nz, y, z: p0.z + side * 8 * nx };
    add('kjede', 'kjede', null, cap(p0, p1, pw), { id: 'kjede', noReach: true });
  }
  // Kragen: rør, kjedehjul og hjul.
  add('krage', 'rør', Vk, rect(d.chainY, d.lowY + T, postR, d.tubeOuter), { tube: true, shaft: true });
  add('krage', 'kjedehjul', Vk, rect(d.chainY, d.chainY + moonTrain.thickness, d.tubeOuter, d.collarSprocket.edge), { mesh: ['kjede'] });
  add('krage', 'hjul', Vk, rect(d.lowY, d.lowY + T, d.tubeOuter, tipOf(m, NM.collarTeeth)), { id: 'krage' });
  // Dobbelthjulet på tappen A og mellomhjulet på B.
  add('forlegg', 'hylse', Ax, rect(d.lowY, d.highY + T, NM.pinRadius, NM.pinRadius + 0.12), { tube: true, shaft: true });
  add('forlegg', 'nederste hjul', Ax, rect(d.lowY, d.lowY + T, NM.pinRadius, tipOf(m, NM.layLow)), { mesh: ['krage'] });
  add('forlegg', 'øverste hjul', Ax, rect(d.highY, d.highY + T, NM.pinRadius, tipOf(m, NM.layHigh)), { id: 'høy' });
  add('mellomhjul', 'mellomhjul', Bx, rect(d.highY, d.highY + T, NM.pinRadius, tipOf(m, NM.idlerTeeth)), { mesh: ['høy', 'triton'], tube: true, shaft: true });
  // Triton: røret med hjulet og armen, hylsa (dreier om stolpen), og staven,
  // foten og Triton i 72 stillinger rundt.
  add('Triton', 'rør', Vk, rect(d.highY, d.tritonTubeTop, postR, d.tubeOuter), { tube: true, shaft: true });
  add('Triton', 'hjul', Vk, rect(d.highY, d.highY + T, d.tubeOuter, tipOf(m, NM.tritonTeeth)), { id: 'triton' });
  add('Triton', 'arm', Vk, rect(d.tritonArmY, d.tritonArmTop, d.tubeOuter, d.orbit + NM.sleeveRadius));
  add('Triton', 'hylse', Vk, rect(d.tritonArmTop, d.sleeveTop, d.orbit - NM.sleeveRadius, d.orbit + NM.sleeveRadius));
  for (let k = 0; k < thetaSteps; k++) {
    const p = d.tritonAt((2 * Math.PI * k) / thetaSteps);
    add('Triton', 'stav', null, cap(...p.stalk, NM.stalkRadius));
    add('Triton', 'fot', null, cap(...p.bar, NM.footRadius));
    add('Triton', 'tapp under foten', null, cap(...p.pin, NM.footRadius * 0.6), { rests: true });
    add('Triton', 'Triton', null, ball(p.triton, IM.size.triton));
  }
  return parts;
}

// --------------------------------------------------------- Rekkevidde ---
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const unitOf = (a) => { const l = Math.hypot(a.x, a.y, a.z); return { x: a.x / l, y: a.y / l, z: a.z / l }; };
// Hvor langt en del rekker ut fra loddlinjen gjennom stolpen (sett ovenfra).
// Et omdreiningslegeme rundt en skrå akse: ytterkanten av profilen, rundt hele aksen.
export function partReach(part) {
  const { shape, axis } = part;
  if (part.noReach) return 0;
  if (shape.kind === 'cap') return Math.max(Math.hypot(shape.a.x, shape.a.z), Math.hypot(shape.b.x, shape.b.z)) + shape.w;
  const d = axis.d, o = axis.o;
  const e1 = Math.abs(d.y) > 0.99 ? { x: 1, y: 0, z: 0 } : unitOf({ x: -d.y, y: d.x, z: 0 });
  const e2 = { x: d.y * e1.z - d.z * e1.y, y: d.z * e1.x - d.x * e1.z, z: d.x * e1.y - d.y * e1.x };
  const profile = shape.kind === 'rect'
    ? [[shape.s0, shape.r1], [shape.s1, shape.r1]]
    : [[shape.a.s, shape.a.r + shape.w], [shape.b.s, shape.b.r + shape.w]];
  if (shape.r1 >= 1e3) return 0;               // armen og kjedene rekker inn mot sentrum
  let best = 0;
  for (const [s, rr] of profile) for (let k = 0; k < 72; k++) {
    const f = (2 * Math.PI * k) / 72;
    const x = o.x + d.x * s + rr * (e1.x * Math.cos(f) + e2.x * Math.sin(f));
    const z = o.z + d.z * s + rr * (e1.z * Math.cos(f) + e2.z * Math.sin(f));
    best = Math.max(best, Math.hypot(x, z));
  }
  return best;
}

// --------------------------------------------------------- Armene ---
// Armlengdene pakkes som i mechanism.js: Uranus og Neptun er de to ytterste,
// og hver arm er så kort at det den rekker over går reachGap klar av naboen innenfor.
function packArms(uranusReach, neptuneReach, saturnOuter) {
  const gapU = planets.uranus.reachGap ?? spacing.reachGap, gapN = planets.neptune.reachGap ?? spacing.reachGap;
  const uranus = Math.ceil((saturnOuter + gapU + uranusReach) * 10) / 10;
  const neptune = Math.ceil((uranus + uranusReach + gapN + neptuneReach) * 10) / 10;
  return { uranus, neptune, maxRadius: neptune + neptuneReach };
}

// --------------------------------------------------------- Farten ---
// Runder per år, sett fra stolpen (Uranus: står stille i rommet; Neptun: står på armen).
export function uranusRates() {
  const tube = (3 * UM.driveTeeth) / UM.tubeTeeth;
  const wU = 1 / planets.uranus.period;
  const shaft = (tube - wU) * (UM.tubeSprocket / UM.shaftSprocket) + wU;
  const lay = shaft * (UM.bevel.driveTeeth / UM.bevel.layTeeth);
  const moons = Object.fromEntries(Object.entries(UM.steps).map(([n, [zl, zt]]) => [n, lay * (zl / zt)]));
  return { tube, shaft, lay, moons };
}
export function neptuneRates() {
  const tube = (3 * NM.driveTeeth) / NM.tubeTeeth;
  const wN = 1 / planets.neptune.period;
  const collar = (tube - wN) * (NM.tubeSprocket / NM.collarSprocket);
  const lay = -collar * (NM.collarTeeth / NM.layLow);
  const idler = -lay * (NM.layHigh / NM.idlerTeeth);
  const triton = -idler * (NM.idlerTeeth / NM.tritonTeeth);
  return { tube, collar, lay, idler, triton, tritonInSpace: triton + wN };
}

// --------------------------------------------------------- Delelister ---
const uranusDriveParts = [
  'hjul på mellomakselen', 'månerøret drive-uranus', 'hjul nederst på månerøret', 'kjedehjul på månerøret', 'kjede langs armen',
  'kjedehjul på driveakselen', 'driveaksel inni stolpen', 'konisk hjul på driveakselen', 'konisk hjul på forlegsakselen', 'forlegsaksel',
  'hjul på forlegsakselen (Titania)', 'hjul på forlegsakselen (Oberon)', 'lager i braketten', 'lagerbukk med stolpe',
];
const partLists = {
  A: [
    ...uranusDriveParts,
    'rør til ε (Titania)', 'rør til δ (Oberon)', 'hjul på ε-røret', 'hjul på δ-røret', 'nav på ε-røret', 'nav på δ-røret',
    '3 stag til ε', '3 stag til δ', 'arm fra ε', 'ledd og arm fra δ', 'Titania', 'Oberon',
  ],
  B: [
    ...uranusDriveParts,
    'Titania-rør', 'Oberon-rør', 'hjul på Titania-røret', 'hjul på Oberon-røret', 'krage og stag til Titania', 'krage og stag til Oberon',
    'bein til Titania', 'bein til Oberon', 'Titania', 'Oberon',
  ],
  neptune: [
    'hjul på mellomakselen', 'månerøret drive-neptune', 'hjul nederst på månerøret', 'kjedehjul på månerøret', 'kjede langs armen',
    'krage med kjedehjul og hjul', 'tapp med dobbelthjul', 'bøyle med tapp', 'mellomhjul med rød ring',
    'Tritons rør med hjul', 'Triton-arm', 'hylse', 'stav', 'fot', 'Triton',
    'nav på stolpen', 'føringsring', '3 eiker',
  ],
};
// Antall deler: "3 stag" teller som 3.
const countOf = (list) => list.reduce((n, name) => n + (Number(name.match(/^(\d+) /)?.[1]) || 1), 0);
export const removed = { A: [], B: [] };

// --------------------------------------------------------- Samlet ---
// Til prøvesiden og checkMoons: B og Neptun er modellens (fra mechanism.js),
// A regnes her med de samme høydene ved armen. model er mechanism.js.
export function iceMoonDesigns(model) {
  const neptune = model.neptuneMoonTrain;
  const result = { neptune, rates: { uranus: uranusRates(), neptune: neptuneRates() } };
  const us = model.heights.stack.uranus;
  for (const v of ['A', 'B']) {
    const uranus = v === 'B' ? model.uranusMoonTrain
      : attachUranusArm(uranusDesign('A', model.uranusTrain, model.armParts), { armY: model.heights.arm.uranus, chainY: us.chain, parallelY: us.parallel, chainTop: us.chainTop });
    const arms = v === 'B'
      ? { uranus: model.armLengths.uranus, neptune: model.armLengths.neptune, maxRadius: model.reach.neptune.outer }
      : packArms(uranus.reach, neptune.reach, model.reach.saturn.outer);
    result[v] = {
      uranus, arms,
      parts: { uranus: partLists[v], neptune: partLists.neptune, removed: removed[v] },
      count: { uranus: countOf(partLists[v]) - countOf(removed[v]), neptune: countOf(partLists.neptune) },
    };
  }
  // «I dag» er modellen slik den er nå (med B).
  result.today = { uranus: model.armLengths.uranus, neptune: model.armLengths.neptune, maxRadius: model.reach.neptune.outer, uranusReach: model.uranusMoonTrain.reach };
  result.yearDays = yearDays;
  return result;
}
