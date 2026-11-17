// Jorda: rotasjonen (drivet fra pinionakselen eller et dagrør i tårnet, og
// overgangen til den skrå jordaksen), føringsringen for månebanen og foten som
// følger den. Ren matematikk (uten three.js), som iceMoons.js. Modellen bruker
// ruta earthDay.model (mechanism.js lager earthTrain); prøvesiden earth.html og
// scripts/checkEarth.mjs bruker alle rutene. Tallene står i earthDay og moonGuide i config.js.
// Det som trengs fra modellen (høyder, armlengder, retninger), sendes inn som
// ctx; contextFrom(M) lager det fra mechanism.js. Slik kan mechanism.js bruke denne fila.
//
// Koordinatene ved jorda («monteringsrammen»): origo på loddlinjen gjennom
// jordstolpen, y er høyden som i modellen, og x peker dit jordaksen heller
// (nordpolen heller mot +x). Rammen står stille i rommet, som parallellhjulet.
// Som ellers er three.js-z lik −y i planet: en asimut φ (grader rundt, mot
// klokka sett ovenfra fra +x) er punktet (r cos φ, y, −r sin φ).
// Langs jordaksen måles s fra jordas sentrum (positiv mot nordpolen).
import {
  bodies, arm, armStyle, gear, moonTrain, spacing, tilt as tiltCfg, earthDay as ED, moonGuide as MG, accent,
} from './config.js';
import { daysPerYear } from './ephemeris.js';

const { gap, chainGap } = spacing;
const deg = (d) => (d * Math.PI) / 180;
const plateDepth = 0.3;                        // så langt lenkeplatene stikker over og under kjedehjulet
const TC = moonTrain.thickness;                // kjedene og kjedehjulene
const sprocketR = (teeth, pitch) => (teeth * pitch) / (2 * Math.PI);
const sprocketEdge = (teeth, pitch) => sprocketR(teeth, pitch) + pitch * 0.3 * 1.3;
const tipOf = (m, z) => (m * z) / 2 + m;
const rootOf = (m, z) => (m * z) / 2 - 1.25 * m;

export const yearDays = daysPerYear;
export const target = daysPerYear + 1;         // omdreininger per år i rommet: ett døgn mer enn solen gir
const tilt = deg(tiltCfg.earthAxis), st = Math.sin(tilt), ct = Math.cos(tilt);
export const earthTilt = tilt;
export const axisDir = { x: st, y: ct, z: 0 };
const e1 = { x: ct, y: -st, z: 0 };            // vinkelrett på aksen, i hellingsplanet (mot +x og nedover)
const e2 = { x: 0, y: 0, z: 1 };               // vinkelrett på hellingsplanet
const add3 = (...vs) => vs.reduce((s, q) => ({ x: s.x + q.x, y: s.y + q.y, z: s.z + q.z }), { x: 0, y: 0, z: 0 });
const mul3 = (q, k) => ({ x: q.x * k, y: q.y * k, z: q.z * k });
const sub3 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const len3 = (q) => Math.hypot(q.x, q.y, q.z);
const unit3 = (q) => mul3(q, 1 / len3(q));
const at = (r, y, phi) => ({ x: r * Math.cos(phi), y, z: -r * Math.sin(phi) });
export const azimuth = (degAngle) => deg(degAngle);

// --- Kjede mellom to punkter på x-aksen (som makeChain i mechanism.js) ---
// Hjul 1 ved x1, hjul 2 ved x2 (> x1). Kjedet går opp i hele ledd.
export function chainPath(name, x1, x2, teeth1, teeth2, chainPitch) {
  const span = x2 - x1;
  const loopLength = (p) => {
    const a = sprocketR(teeth1, p), b = sprocketR(teeth2, p);
    const alpha = Math.acos((a - b) / span);
    return 2 * Math.sqrt(span ** 2 - (a - b) ** 2) + 2 * alpha * b + (2 * Math.PI - 2 * alpha) * a;
  };
  const needed = sprocketR(teeth1, chainPitch) + sprocketR(teeth2, chainPitch) + chainPitch * 2;
  if (span < needed) throw new Error(`${name}: kjedehjulene står for nær hverandre (${span.toFixed(2)}, trenger ${needed.toFixed(2)}).`);
  const links = Math.round(loopLength(chainPitch) / chainPitch);
  let low = chainPitch * 0.8, high = chainPitch * 1.2;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (loopLength(mid) / mid > links) low = mid; else high = mid;
  }
  const pitch = (low + high) / 2;
  const r1 = sprocketR(teeth1, pitch), r2 = sprocketR(teeth2, pitch);
  const alpha = Math.acos((r1 - r2) / span);
  const straight = Math.sqrt(span ** 2 - (r1 - r2) ** 2);
  const length = links * pitch;
  const arc2Start = straight, backStart = arc2Start + 2 * alpha * r2, arc1Start = backStart + straight;
  const from = { x: x1, y: 0 }, to = { x: x2, y: 0 };
  const onCircle = (c, r, a) => ({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
  const lerp = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
  return {
    links, pitch, rollerRadius: chainPitch * 0.3, radius1: r1, radius2: r2, x1, x2,
    point(u) {
      u = ((u % length) + length) % length;
      if (u < arc2Start) return lerp(onCircle(from, r1, -alpha), onCircle(to, r2, -alpha), u / straight);
      if (u < backStart) return onCircle(to, r2, -alpha + (u - arc2Start) / r2);
      if (u < arc1Start) return lerp(onCircle(to, r2, alpha), onCircle(from, r1, alpha), (u - backStart) / straight);
      return onCircle(from, r1, alpha + (u - arc1Start) / r1);
    },
    offsetFor: (angle1) => arc1Start - alpha * r1 + angle1 * r1,
    angle2For: (offset) => -alpha + (offset - arc2Start) / r2,
  };
}

// --- Høydene ved jordarmen for hver drivkilde ---
// P: et nytt kjedeplan mellom det faste hjulet og parallellkjedet. T: tårnet får
// et nytt plan (dagrørets hjul), og kjedet ligger rett over armen, under det faste hjulet.
// Månearmen ligger et mellomrom over lenkeplatene på månekjedet.
export function stackFor(source, ctx) {
  const s0 = ctx.heights.stack.earth;
  const st0 = { level1: s0.level1, parallel: s0.parallel, moonChain: s0.moonChain, pinionTop: s0.pinionTop };
  let s;
  if (source === 'P') {
    const armY = ctx.heights.arm.earth, armTop = armY + arm.thickness;
    const level1 = s0.level1;
    const day = level1 + TC + gap + plateDepth;
    const parallel = day + TC + chainGap;
    s = { tower: 0, armY, armTop, level1, day, parallel };
  } else if (source === 'T') {
    const tower = gear.thickness + gap;
    const armY = ctx.heights.arm.earth + tower, armTop = armY + arm.thickness;
    const day = armTop + Math.max(armStyle.hubRise + plateDepth, armStyle.collarHeight + accent.ringWidth) + gap;
    const level1 = day + TC + plateDepth + gap;
    const parallel = level1 + TC + gap + plateDepth;
    s = { tower, armY, armTop, level1, day, parallel };
  } else throw new Error(`earthDay: ukjent drivkilde '${source}'. Bruk 'P' eller 'T'.`);
  s.fixedTop = s.parallel + TC;
  s.moonChain = s.parallel + TC + chainGap;
  s.pinionTop = s.moonChain + TC + plateDepth;
  s.moonArm = s.moonChain + TC + plateDepth + gap;
  s.rise = s.pinionTop - st0.pinionTop;          // så mye armene innenfor jorda (og sola) må løftes
  s.model = st0;
  return s;
}

// --- Omdreiningene (runder per år) ---
export function ratesFor(c) {
  const fixedPinion = moonTrain.fixed.teeth / moonTrain.pinion.teeth;   // pinionakselen sett fra armen
  const r = { pinion: fixedPinion };
  if (c.source === 'P') {
    const P = ED.P;
    r.lay = fixedPinion * (P.pinionSprocket / P.laySprocket);          // forlegsakselen sett fra armen (kjedet beholder retningen)
    r.shaftArm = -r.lay * (P.layGear / P.shaftGear);                  // et inngrep snur
  } else {
    const T = ED.T;
    r.tube = (3 * T.driveTeeth) / T.tubeTeeth;                         // dagrøret i rommet (mellomakselen går −3)
    r.shaftArm = (r.tube - 1) * (T.tubeSprocket / T.shaftSprocket);
  }
  r.shaft = r.shaftArm + 1;                                            // sett fra stolperøret, som går −1 sett fra armen
  if (c.top === 'V') {
    r.k = ED.V.shaftTeeth / ED.V.earthTeeth;
    r.sign = -1;                                                       // to koniske hjul under toppunktet: motsatt vei
  } else if (c.top === 'K') {
    const kk = ED.K[c.source];
    r.k = kk.bigTeeth / kk.smallTeeth;
    r.sign = kk.idlerTeeth ? 1 : -1;                                   // kryssleddet 1 : 1, hjulparet snur, mellomhjulet snur tilbake
    if (kk.idlerTeeth) r.idler = -r.shaft * (kk.bigTeeth / kk.idlerTeeth);
  } else throw new Error(`earthDay: ukjent overgang '${c.top}'. Bruk 'V' eller 'K'.`);
  r.earth = r.sign * r.k * r.shaft;
  r.siderealDay = daysPerYear / r.earth;
  r.error = (r.earth / target - 1) * 100;
  if (r.earth <= 0) throw new Error(`earthDay: med ${c.source} og ${c.top} går jorda baklengs. ${c.top === 'V' ? 'V passer bare med P.' : 'Gi K et mellomhjul (idlerTeeth).'}`);
  return r;
}

// Stjernetiden i Greenwich (GMST, Meeus 12.4) på en dato, i radianer: vinkelen
// fra vårjevndøgnsretningen til Greenwich-meridianen, målt østover.
export function gmst(date) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const d = 280.46061837 + 360.98564736629 * (jd - 2451545.0);
  return deg(((d % 360) + 360) % 360);
}

// --- Føringsringen og foten ---
// Utstrekningen over og under midtlinjen der foten møter ringen, og hvor stagene fester.
function guideFor(c) {
  const rc = MG.radius;
  const F1 = MG.F1, F2 = MG.F2;
  const g = { kind: c.guide, follower: c.follower, rc };
  const slope = Math.atan(bodies.moonOrbit * Math.tan(deg(tiltCfg.moonOrbit)) / rc);  // ringplanets helning
  g.planeTilt = slope;
  if (c.guide === 'G1') {
    const { width: w, height: h } = MG.G1;
    Object.assign(g, { w, h, inner: rc - w / 2, outer: rc + w / 2, half: h / 2, attachR: rc - w / 2 });
  } else if (c.guide === 'G2') {
    const rt = MG.G2.tube;
    Object.assign(g, { rt, inner: rc - rt, outer: rc + rt, half: rt, attachR: rc - rt });
  } else if (c.guide === 'G3') {
    const th = MG.G3.thickness;
    Object.assign(g, { th, inner: 0, outer: rc + MG.G3.edge, half: th / 2 / Math.cos(slope) });
  } else throw new Error(`moonGuide: ukjent ring '${c.guide}'. Bruk 'G1', 'G2' eller 'G3'.`);

  if (c.follower === 'F1') {
    const rho = F1.rollerRadius;
    // Rullene (kuler på G3) ligger oppå og under ringen, gaffelen utenfor ytterkanten.
    g.rollerCenter = g.half + rho / Math.cos(c.guide === 'G3' ? slope : 0);
    // Gaffelen går utenfor ringen, og minst gap fra der stagene fester (på innsiden).
    g.barInner = Math.max(g.outer + 0.08, (g.attachR ?? -Infinity) + 0.02 + MG.strutRadius + gap);
    g.barR = g.barInner + F1.barWidth / 2;
    g.barHalf = g.rollerCenter + rho + 0.05;
    g.extent = g.barHalf;
    g.footFrom = g.barR + F1.barWidth / 2;
    g.balls = c.guide === 'G3';
  } else if (c.follower === 'F2') {
    if (c.guide !== 'G2') throw new Error('moonGuide: glideskoen (F2) passer bare på den runde ringen (G2).');
    g.shoeIn = g.rt + F2.clearance;
    g.shoeOut = g.shoeIn + F2.wall;
    g.extent = g.shoeOut;
    g.footFrom = rc + g.shoeOut;
  } else throw new Error(`moonGuide: ukjent fot '${c.follower}'. Bruk 'F1' eller 'F2'.`);
  return g;
}

// --- Hele utformingen for en rute på prøvesiden ---
// Det modellen gir videre (se mechanism.js): høyder, armlengder, rør og retninger.
export const contextFrom = (M) => ({
  heights: M.heights, armLengths: M.armLengths, layout: M.layout, tube: M.tube, armParts: M.armParts,
  node: M.moonRing.node - M.earthAxis.direction, dayChain: M.earthDayChain,
});
// name er en rute i earthDay.cells. ctx.H (valgfritt) er høyden jorda står i;
// uten den regnes den laveste høyden som går, ellers gir for lav høyde feilmelding.
export function earthDesign(name, ctx) {
  const c = ED.cells[name];
  if (!c) throw new Error(`earthDay.cells: ingen rute '${name}'.`);
  const s = stackFor(c.source, ctx);
  const rate = ratesFor(c);
  const R = bodies.earthRadius;
  const L = ctx.armLengths.earth;
  const dsR = ED.driveShaftRadius, frameOuter = dsR + ED.frameWall, spR = ED.spindleRadius;
  const moonTubeOuter = frameOuter + MG.tubeWall;
  const orbit = bodies.moonOrbit;
  const K = orbit * Math.tan(deg(tiltCfg.moonOrbit));              // så mye månen går opp og ned
  const g = guideFor(c);
  const d = { name, cell: c, ctx, stack: s, rate, R, L, dsR, frameOuter, spR, moonTubeOuter, orbit, K, g, tilt };

  // Månearmen, månerøret og hylsa.
  d.moonArmY = s.moonArm;
  d.moonArmTop = s.moonArm + MG.arm.thickness;
  d.moonTubeTop = d.moonArmTop + armStyle.hubRise;
  // Staven går ned i månearmen (aldri under den, der månekjedet går), og hylsa
  // holder den når den står høyest.
  d.pinBelow = 0.05;                                               // fra undersiden av månearmen til bunnen av staven når den står lavest
  const sleeveNeeded = d.moonArmY + d.pinBelow + 2 * K + 0.3;      // staven står minst 0,3 inne i hylsa
  // Navet til ringen sitter på stolperøret over månerøret.
  d.hubY0 = d.moonTubeTop + gap;                                    // det laveste navet kan sitte
  d.hubY1 = d.hubY0 + MG.hub.height;
  d.hubR = frameOuter + MG.hub.radius;
  // Ringen: så lavt som mulig over månearmen, og så foten går klar av hylsa.
  const ringFromArm = d.moonArmTop + gap + K + g.extent;
  const ringFromSleeve = sleeveNeeded + gap + MG.footRadius + K;
  const ringFromHub = d.hubY0 + MG.hub.height / 2;                // navet sitter i høyde med ringen, over månerøret
  d.ringY = Math.max(ringFromArm, ringFromSleeve, ringFromHub);
  d.sleeveTop = d.ringY - K - MG.footRadius - gap;
  d.ringTop = d.ringY + K + g.extent;                               // det høyeste ringen eller foten når
  // Navet i høyde med ringen, så stagene går nesten vannrett inn til midten av ringen.
  d.hubY0 = d.ringY - MG.hub.height / 2;
  d.hubY1 = d.ringY + MG.hub.height / 2;

  // --- Overgangen til jordaksen ---
  // Alt her er gitt i forhold til jordas sentrum H; H settes til slutt så det
  // laveste går klar over ringen og foten.
  const bl = ED.bearing.length, bw = ED.bearing.wall, br = ED.bracket.radius;
  let lowestRel;                                                    // det laveste punktet, i forhold til H
  const top = { kind: c.top };
  if (c.top === 'V') {
    const V = ED.V, m = V.module, fw = V.faceWidth;
    const gammaE = Math.atan(st / (V.shaftTeeth / V.earthTeeth + ct));
    const gammaV = tilt - gammaE;
    const rE = (m * V.earthTeeth) / 2, rV = (m * V.shaftTeeth) / 2;
    const Lc = rE / Math.sin(gammaE);                               // fra toppunktet (jordas sentrum) langs kjeglen
    Object.assign(top, {
      m, fw, gammaE, gammaV, rE, rV, Lc,
      sE: -Lc * Math.cos(gammaE),                                   // midten av hjulet på spindelen, langs aksen
      dropV: Lc * Math.cos(gammaV),                                 // fra jordas sentrum ned til midten av hjulet på driveakselen
      tipE: tipOf(m, V.earthTeeth), tipV: tipOf(m, V.shaftTeeth),
    });
    if (rootOf(m, V.earthTeeth) < spR + 0.12) throw new Error('earthDay.V: hjulet på spindelen er for lite til spindelen. Øk module eller earthTeeth.');
    const lowE = top.sE * ct - top.tipE * st - (fw / 2) * ct;
    const lowV = -top.dropV - fw / 2;
    lowestRel = Math.min(lowE, lowV);
    // Lageret rett over hjulet på spindelen; spindelen slutter like under hjulet.
    top.bearing = [top.sE + fw / 2 + gap, top.sE + fw / 2 + gap + bl];
    top.spindle = [top.sE - fw / 2 - 0.08, R + 0.45];
  } else {
    const kk = ED.K[c.source], m = kk.module, Tk = ED.K.thickness, pt = ED.K.plateThickness;
    const rB = (m * kk.bigTeeth) / 2, rS = (m * kk.smallTeeth) / 2;
    if (rootOf(m, kk.smallTeeth) < spR + 0.1) throw new Error('earthDay.K: det lille hjulet er for lite til spindelen. Øk module eller smallTeeth.');
    let dK = rB + rS, idler = null;
    if (kk.idlerTeeth) {
      // Med mellomhjul: de to hjulene må ikke gripe i hverandre.
      dK = tipOf(m, kk.bigTeeth) + tipOf(m, kk.smallTeeth) + gap;
      const rI = (m * kk.idlerTeeth) / 2, dS = rS + rI, dD = rB + rI;
      const ix = (dS * dS - dD * dD + dK * dK) / (2 * dK), iz2 = dS * dS - ix * ix;
      if (iz2 <= 0.01) throw new Error('earthDay.K: mellomhjulet når ikke fram til begge hjulene. Øk idlerTeeth.');
      idler = { rI, tip: tipOf(m, kk.idlerTeeth), ix, iz: ED.K.idlerSide * Math.sqrt(iz2), pinR: 0.1 };
    }
    const sP = -R - gap - pt / 2;                                   // midten av platen med lagrene
    const sG = sP - Math.max(pt / 2, ED.bracket.radius) - gap - Tk / 2;   // midten av tannhjulene (braketten kommer inn ved platen)
    Object.assign(top, {
      m, Tk, pt, rB, rS, dK, idler, sP, sG,
      tipB: tipOf(m, kk.bigTeeth), tipS: tipOf(m, kk.smallTeeth),
      jr: ED.K.jointRadius,
      dropK: dK / st,                                               // fra jordas sentrum ned til kryssleddet
      sK: -dK * ct / st,                                            // kryssleddet langs aksen
    });
    // Det laveste: det store hjulet (på e1-siden, nedover), og mellomhjulet.
    const lowB = (sG * ct - dK * st) - top.tipB * st - (Tk / 2) * ct;
    const lowS = sG * ct - top.tipS * st - (Tk / 2) * ct;
    let lowI = Infinity;
    if (idler) lowI = sG * ct - idler.ix * st - idler.tip * Math.hypot(st, 0) - (Tk / 2) * ct;
    lowestRel = Math.min(lowB, lowS, lowI);
    top.spindle = [sG - Tk / 2 - 0.08, R + 0.45];
    top.bearing = [sP - pt / 2, sP + pt / 2];
    top.tilted = [top.sK, sP + pt / 2];                             // den skrå drivakselen, fra K inn i platen
  }
  d.top = top;

  // --- Høyden på jordas sentrum ---
  // Modellen krever: sola over den øverste armen (armene innenfor jorda løftes
  // med jordstabelen), og T løfter hele tårnet.
  const Hsun = ctx.heights.topArm + s.rise + gap + bodies.sunRadius;
  const Hmodel = Math.max(bodies.height + s.tower, Hsun);
  const Hstage = d.ringTop + gap - lowestRel;
  let Hk = -Infinity;
  if (c.top === 'K') Hk = d.hubY1 + gap + top.jr + top.dropK;      // kryssleddet over navet til ringen
  // Med skiva (G3) må braketten gå ut over den, så stolperøret må nå over skiva.
  let Hbr = -Infinity;
  if (c.guide === 'G3') {
    const frameDrop = c.top === 'K' ? top.dropK + top.jr + gap : top.dropV + top.fw / 2 + gap;
    Hbr = d.ringTop + gap + 2 * br + 0.05 + frameDrop;
  }
  const Hneeded = Math.max(Hstage, Hk, Hbr);
  if (ctx.H !== undefined && ctx.H < Hneeded - 1e-9) {
    throw new Error(`bodies.height må være minst ${(Math.ceil(Hneeded * 100) / 100).toFixed(2)} så overgangen til jordaksen og føringsringen får plass under jorda (er ${ctx.H}).`);
  }
  const H = ctx.H ?? Math.max(Hmodel, Hneeded);
  Object.assign(d, { H, Hsun, Hmodel, Hstage, Hk, Hbr, Hrise: H - bodies.height });
  const C = { x: 0, y: H, z: 0 };
  const onAxis = (sv, off = { x: 0, y: 0, z: 0 }) => add3(C, mul3(axisDir, sv), off);
  d.C = C;
  d.onAxis = onAxis;

  // --- Stolperøret, driveakselen og braketten ---
  d.frameBottom = s.parallel;                                       // stolperøret begynner ved parallellhjulet
  const side = top.idler ? -Math.sign(top.idler.iz) : 1;            // braketten går ut på den siden som er ledig (z)
  if (c.top === 'V') {
    top.yV = H - top.dropV;
    d.shaftTop = top.yV + top.fw / 2 + 0.05;
    d.frameTop = top.yV - top.fw / 2 - gap;
    // Braketten: fra stolperøret ut til siden (z), opp til lageret, og inn til det.
    const yb = d.frameTop - br - 0.05;
    const zOut = side * (top.tipV + gap + br + 0.1);
    const bc = onAxis((top.bearing[0] + top.bearing[1]) / 2);
    const rb = spR + bw;
    const toward = unit3({ x: -bc.x, y: 0, z: zOut - bc.z });       // fra lageret mot braketten, vannrett
    // Vinkelrett på aksen: ta bort komponenten langs aksen.
    const along = toward.x * axisDir.x + toward.y * axisDir.y;
    const perp = unit3(sub3(toward, mul3(axisDir, along)));
    const end = add3(bc, mul3(perp, rb));
    d.bracket = [{ x: 0, y: yb, z: side * frameOuter }, { x: 0, y: yb, z: zOut }, { x: 0, y: end.y, z: zOut }, end];
  } else {
    top.K = { x: 0, y: H - top.dropK, z: 0 };
    d.shaftTop = top.K.y;
    d.frameTop = top.K.y - top.jr - gap;
    const plateMid = onAxis(top.sP, mul3(e1, top.dK / 2));
    const eyeR = Math.max(spR, ED.driveShaftRadius * 0.8) + bw;
    top.eyeR = eyeR;
    top.tiltedR = ED.driveShaftRadius * 0.8;
    // Braketten går ut på spindelsiden (−x), under det lille hjulet, opp, og inn
    // til lageret til spindelen fra utsiden. Drivet og mellomhjulet er på de andre sidene.
    const yb = d.frameTop - br - 0.05;
    const end = onAxis(top.sP, mul3(e1, -eyeR));
    const gearEdge = onAxis(top.sG, mul3(e1, -top.tipS)).x;
    const xOut = Math.min(gearEdge - (top.Tk / 2) * st, end.x) - gap - br - 0.02;
    d.bracket = [{ x: -frameOuter, y: yb, z: 0 }, { x: xOut, y: yb, z: 0 }, { x: xOut, y: end.y, z: 0 }, end];
    top.plateMid = plateMid;
  }
  d.shaftBottom = s.armTop - 0.05;

  // --- Ringen, stagene og foten ---
  d.node = ctx.node;                                                // knutelinjen i monteringsrammen (står fast i rommet)
  d.lift = (phi) => K * Math.sin(phi - d.node);                    // hvor mye staven (og ringen der) er løftet
  d.ringAt = (phi, dr = 0, dy = 0) => at(g.rc + dr, d.ringY + d.lift(phi) + dy, phi);
  d.strutAngles = c.guide === 'G3' ? [] : MG.strutAzimuths.map(deg);
  d.struts = d.strutAngles.map((phi) => [at(d.hubR - 0.05, (d.hubY0 + d.hubY1) / 2, phi), at(g.attachR + 0.02, d.ringY + d.lift(phi), phi)]);
  // Staven, foten og månen når månearmen står i vinkelen phi (i monteringsrammen).
  d.sliderAt = (phi) => {
    const lift = d.lift(phi), yc = d.ringY + lift;
    const out = {
      lift,
      moon: at(orbit, H + lift, phi),
      pin: [at(orbit, d.moonArmY + d.pinBelow + K + lift, phi), at(orbit, H + lift, phi)],
      foot: [at(g.footFrom - 0.02, yc, phi), at(orbit, yc, phi)],
    };
    if (g.follower === 'F1') {
      out.bar = [at(g.barR, yc - g.barHalf, phi), at(g.barR, yc + g.barHalf, phi)];
      out.rollers = [1, -1].map((k) => at(g.rc, yc + k * g.rollerCenter, phi));
      out.axles = [1, -1].map((k) => [at(g.barInner, yc + k * g.rollerCenter, phi), at(g.rc - MG.F1.rollerWidth / 2 - 0.02, yc + k * g.rollerCenter, phi)]);
    }
    return out;
  };

  // --- Delene P og T har ved foten av stolpen ---
  if (c.source === 'P') {
    const P = ED.P;
    d.lay = {
      D: (P.module * (P.layGear + P.shaftGear)) / 2,
      tipC: tipOf(P.module, P.layGear), tipD: tipOf(P.module, P.shaftGear),
      shaftR: 0.25,
    };
    d.lay.x = L - d.lay.D;
    if (rootOf(P.module, P.shaftGear) < dsR + 0.15) throw new Error('earthDay.P: hjulet på driveakselen er for lite til akselen.');
    d.dayChain = ctx.dayChain ?? chainPath('Dagkjedet (P)', ctx.layout.pinion.x, d.lay.x, P.pinionSprocket, P.laySprocket, P.chainPitch);
    d.lay.top = s.day + TC + 0.1;
    const pinionTip = (moonTrain.module * moonTrain.pinion.teeth) / 2 + moonTrain.module;
    if (d.lay.x - d.lay.tipC < ctx.layout.pinion.x + pinionTip + gap) throw new Error('earthDay.P: hjulet på forlegsakselen går for nær pinionen. Gjør det mindre (layGear eller module).');
    const fixedOuter = ctx.tube.fixed.outer;
    if (ctx.layout.pinion.x - sprocketEdge(P.pinionSprocket, P.chainPitch) < fixedOuter + gap) throw new Error('earthDay.P: kjedehjulet på pinionakselen går for nær det faste røret. Gjør det mindre.');
  } else {
    const T = ED.T;
    d.dayChain = chainPath('Dagkjedet (T)', 0, L, T.tubeSprocket, T.shaftSprocket, T.chainPitch);
    d.dayTube = { inner: ctx.tube.fixed.outer, outer: ctx.tube.fixed.outer + 1, top: s.day + TC };
    if (sprocketEdge(T.tubeSprocket, T.chainPitch) > ctx.layout.pinion.x - 1 - gap) throw new Error('earthDay.T: kjedehjulet på dagrøret går for nær pinionakselen.');
  }

  // Rekkevidden fra stolpen (sett ovenfra) og delelistene.
  d.parts = partList(c);
  d.count = d.parts.reduce((n, p) => n + (Number(p.match(/^(\d+) /)?.[1]) || 1), 0);
  return d;
}

// Nye deler (det som fjernes står i removed).
function partList(c) {
  const list = [];
  if (c.source === 'P') list.push('kjedehjul på pinionakselen', 'dagkjede', 'forlegsaksel ved stolpen', 'kjedehjul og tannhjul på den', 'tannhjul på driveakselen');
  else list.push('hjul på mellomakselen', 'dagrør i tårnet med hjul', 'kjedehjul på dagrøret', 'dagkjede', 'kjedehjul på driveakselen');
  list.push('driveaksel i stolperøret');
  if (c.top === 'V') list.push('2 koniske hjul', 'spindel', 'lager', 'brakett');
  else {
    list.push('kryssledd', 'skrå aksel', '2 tannhjul', 'spindel', 'plate med 2 lagre', 'brakett');
    if (ED.K[c.source].idlerTeeth) list.push('mellomhjul med tapp');
  }
  if (c.guide === 'G3') list.push('nav', 'skrå skive');
  else list.push('nav', '3 stag', c.guide === 'G1' ? 'smal ring' : 'rund ring');
  if (c.follower === 'F1') list.push('gaffel', `2 ${c.guide === 'G3' ? 'kuler' : 'ruller'}`);
  else list.push('glidesko');
  return list;
}
export const removed = ['ekvatorringen', 'den gamle ringen (nav, 3 eiker, bånd)', 'den gamle foten', 'den tykke stolpen inn i jorda'];

// --------------------------------------------------------- Formene ---
// Til 3D-sjekken (scripts/clearance3d.mjs), i monteringsrammen. Hver del som
// dreier om loddlinjen (sett fra rammen, som står stille i rommet), er et
// omdreiningslegeme; jorda, spindelen og den skrå akselen dreier om sine
// egne akser. Staven og foten tas med i steps stillinger rundt.
const rect = (s0, s1, r0, r1) => ({ kind: 'rect', s0, s1, r0: Math.max(0, r0), r1 });
const seg = (s0, r0, s1, r1, w) => ({ kind: 'seg', a: { s: s0, r: r0 }, b: { s: s1, r: r1 }, w });
const cap = (a, b, w) => ({ kind: 'cap', a, b, w });
const ball = (p, w) => cap(p, p, w);
const chainBand = (y, pitch = 1) => [y - plateDepth * pitch, y + TC + plateDepth * pitch];

export function earthParts(d, steps = 48) {
  const parts = [];
  const addP = (body, name, axis, shape, extra = {}) => parts.push({ body, name, axis, shape, ...extra });
  const V = { o: { x: 0, y: 0, z: 0 }, d: { x: 0, y: 1, z: 0 }, key: 'V' };
  const E = { o: d.C, d: axisDir, key: 'E' };
  const s = d.stack, g = d.g, top = d.top, c = d.cell;
  const sl = MG.sleeveRadius;

  // Armen (dreier om stolpen sett fra rammen), med kjedene som går ut fra den.
  addP('arm', 'arm', V, rect(s.armY, s.armTop, d.dsR, 1e3), { tube: true, ground: true });
  addP('arm', 'parallellkjede', V, rect(...chainBand(s.parallel), sprocketR(moonTrain.parallelSprocket.teeth, 1) - 0.4, 1e3), { id: 'kjede-par' });
  addP('arm', 'månekjede', V, rect(...chainBand(s.moonChain), sprocketR(moonTrain.moonSprocket.teeth, 1) - 0.4, 1e3), { id: 'kjede-måne' });
  if (c.source === 'P') {
    const P = ED.P, lay = d.lay;
    addP('arm', 'dagkjede', V, rect(...chainBand(s.day, P.chainPitch), lay.D - sprocketEdge(P.laySprocket, P.chainPitch) - 0.05, 1e3), { id: 'kjede-dag' });
    addP('forlegg', 'forlegsaksel', V, rect(s.armTop, lay.top, lay.D - lay.shaftR, lay.D + lay.shaftR), { tube: true, shaft: true, mesh: ['kjede-dag'] });
    addP('forlegg', 'tannhjul', V, rect(s.level1, s.level1 + ED.shaftGearThickness, lay.D - lay.tipC, lay.D + lay.tipC), { id: 'hjul-C' });
    addP('forlegg', 'kjedehjul', V, rect(s.day, s.day + TC, lay.D - sprocketEdge(P.laySprocket, P.chainPitch), lay.D + sprocketEdge(P.laySprocket, P.chainPitch)), { mesh: ['kjede-dag'] });
    addP('driveaksel', 'tannhjul', V, rect(s.level1, s.level1 + ED.shaftGearThickness, d.dsR, lay.tipD), { mesh: ['hjul-C'] });
  } else {
    const T = ED.T;
    addP('arm', 'krage og rød ring', V, rect(s.armTop, s.armTop + armStyle.collarHeight + accent.ringWidth, d.dsR + 0.1, d.ctx.armParts.earth.collarRadius), { tube: true });
    addP('arm', 'dagkjede', V, rect(...chainBand(s.day), sprocketR(T.shaftSprocket, T.chainPitch) - 0.4, 1e3), { id: 'kjede-dag' });
    addP('driveaksel', 'kjedehjul', V, rect(s.day, s.day + TC, d.dsR, sprocketEdge(T.shaftSprocket, T.chainPitch)), { mesh: ['kjede-dag'] });
  }
  addP('driveaksel', 'driveaksel', V, rect(d.shaftBottom, d.shaftTop, 0, d.dsR), { tube: true, shaft: true });

  // Stolperøret med parallellhjulet, navet og ringen (står stille).
  addP('stolpe', 'stolperør', V, rect(d.frameBottom, d.frameTop, d.dsR, d.frameOuter), { tube: true, ground: true });
  addP('stolpe', 'parallellhjul', V, rect(s.parallel, s.parallel + TC, d.frameOuter, sprocketEdge(moonTrain.parallelSprocket.teeth, 1)), { mesh: ['kjede-par'] });
  addP('stolpe', 'nav', V, rect(d.hubY0, d.hubY1, d.frameOuter, d.hubR), { tube: true });
  d.struts.forEach(([a, b], k) => addP('stolpe', `stag ${k + 1}`, null, cap(a, b, MG.strutRadius)));
  const N = 96;
  for (let k = 0; k < N; k++) {
    const p0 = (2 * Math.PI * k) / N, p1 = (2 * Math.PI * (k + 1)) / N;
    if (g.kind === 'G1') {
      for (const dy of [-g.h / 2 + g.w / 2, 0, g.h / 2 - g.w / 2]) addP('stolpe', 'ring', null, cap(d.ringAt(p0, 0, dy), d.ringAt(p1, 0, dy), g.w / 2), { guide: true });
    } else if (g.kind === 'G2') {
      addP('stolpe', 'ring', null, cap(d.ringAt(p0), d.ringAt(p1), g.rt), { guide: true });
    } else {
      for (const f of [0.3, 0.6, 0.85, 1]) {
        const r = d.hubR + (g.outer - d.hubR) * f;
        const pt = (p) => at(r, d.ringY + d.lift(p) * (r / g.rc), p);
        addP('stolpe', 'skive', null, cap(pt(p0), pt(p1), g.th / 2), { guide: true });
      }
    }
  }
  // Braketten og lagrene.
  const bp = d.bracket;
  // Den siste biten av braketten sitter på lageret (V) eller platen (K), utenpå akslene der.
  const held = c.top === 'V' ? ['jorda'] : ['jorda', 'skrå aksel', 'mellomhjul'];
  for (let i = 0; i < bp.length - 1; i++) addP('stolpe', `brakett ${i + 1}`, null, cap(bp[i], bp[i + 1], ED.bracket.radius), i === bp.length - 2 ? { holds: held } : {});
  const rb = d.spR + ED.bearing.wall;
  if (c.top === 'V') {
    addP('stolpe', 'lager', E, rect(...top.bearing, d.spR, rb), { tube: true });
  } else {
    const Dax = { o: add3(d.C, mul3(e1, top.dK)), d: axisDir, key: 'D' };
    addP('stolpe', 'lager til spindelen', E, rect(...top.bearing, d.spR, top.eyeR), { tube: true });
    addP('stolpe', 'lagerøye', Dax, rect(...top.bearing, top.tiltedR, top.eyeR), { tube: true });
    // Platen mellom lagrene: to staver side om side (bredden er 2 × eyeR).
    for (const k of [-1, 1]) {
      const off = mul3(e2, k * (top.eyeR - top.pt / 2));
      addP('stolpe', 'plate', null, cap(d.onAxis(top.sP, add3(mul3(e1, top.eyeR), off)), d.onAxis(top.sP, add3(mul3(e1, top.dK - top.eyeR), off)), top.pt / 2), { holds: held });
    }
    addP('skrå aksel', 'skrå aksel', Dax, rect(top.tilted[0] + top.jr * 0.6, top.tilted[1], 0, top.tiltedR), { tube: true, shaft: true });
    addP('skrå aksel', 'stort hjul', Dax, rect(top.sG - top.Tk / 2, top.sG + top.Tk / 2, top.tiltedR, top.tipB), { id: 'hjul-stort' });
    addP('driveaksel', 'kryssledd', null, ball(top.K, top.jr), {});
    if (top.idler) {
      const I = top.idler;
      const Iax = { o: add3(d.C, mul3(e1, I.ix), mul3(e2, I.iz)), d: axisDir, key: 'I' };
      addP('stolpe', 'tapp til mellomhjulet', Iax, rect(top.sG - top.Tk / 2 - 0.05, top.sP, 0, I.pinR), { tube: true, holds: ['mellomhjul'] });
      // Et øre fra platen ut til tappen.
      addP('stolpe', 'øre til tappen', null, cap(d.onAxis(top.sP, add3(mul3(e1, top.eyeR), mul3(e2, Math.sign(I.iz) * (top.eyeR - top.pt / 2)))), d.onAxis(top.sP, add3(mul3(e1, I.ix), mul3(e2, I.iz))), top.pt / 2), { holds: held });
      addP('mellomhjul', 'mellomhjul', Iax, rect(top.sG - top.Tk / 2, top.sG + top.Tk / 2, I.pinR, I.tip), { tube: true, shaft: true, mesh: ['hjul-stort', 'hjul-lite'] });
    }
  }
  // Jorda: spindelen, hjulet og kula.
  addP('jorda', 'spindel', E, rect(...top.spindle, 0, d.spR), { tube: true, shaft: true });
  addP('jorda', 'jorda', E, seg(0, 0, 0, 0, d.R));
  if (c.top === 'V') {
    bevelSlices(addP, 'jorda', 'konisk hjul', E, top.sE, d.spR, top.tipE, top.Lc * Math.cos(top.gammaE), top.fw, { mesh: ['konisk-V'] });
    bevelSlices(addP, 'driveaksel', 'konisk hjul', V, top.yV, d.dsR, top.tipV, top.dropV, top.fw, { id: 'konisk-V' });
  } else {
    addP('jorda', 'lite hjul', E, rect(top.sG - top.Tk / 2, top.sG + top.Tk / 2, d.spR, top.tipS), { id: 'hjul-lite', mesh: top.idler ? [] : ['hjul-stort'] });
  }

  // Månen: røret, kjedehjulet, armen og hylsa dreier om stolpen.
  addP('månen', 'månerør', V, rect(s.moonChain, d.moonTubeTop, d.frameOuter, d.moonTubeOuter), { tube: true, shaft: true });
  addP('månen', 'kjedehjul', V, rect(s.moonChain, s.moonChain + TC, d.moonTubeOuter, sprocketEdge(moonTrain.moonSprocket.teeth, 1)), { mesh: ['kjede-måne'] });
  addP('månen', 'månearm', V, rect(d.moonArmY, d.moonArmTop, d.moonTubeOuter, d.orbit + sl));
  addP('månen', 'hylse', V, rect(d.moonArmTop, d.sleeveTop, d.orbit - sl, d.orbit + sl));
  for (let k = 0; k < steps; k++) {
    const p = d.sliderAt((2 * Math.PI * k) / steps);
    addP('månen', 'stav', null, cap(...p.pin, MG.pinRadius));
    addP('månen', 'fot', null, cap(...p.foot, MG.footRadius), { rests: true });
    addP('månen', 'månen', null, ball(p.moon, bodies.moonRadius));
    if (p.bar) {
      addP('månen', 'gaffel', null, cap(...p.bar, MG.F1.barWidth / 2), { rests: true });
      for (const a of p.axles) addP('månen', 'aksel til rulle', null, cap(...a, MG.F1.axleRadius), { rests: true });
      for (const r of p.rollers) addP('månen', g.balls ? 'kule' : 'rulle', null, ball(r, MG.F1.rollerRadius), { rests: true });
    } else {
      const phi = (2 * Math.PI * k) / steps, yc = d.ringY + p.lift;
      addP('månen', 'glidesko', null, ball(at(g.rc, yc, phi), g.shoeOut), { rests: true, shoe: true });
    }
  }
  return parts;
}

// Konisk hjul som skiver langs aksen, hver med den største radiusen i skiva.
// drop er avstanden fra midten av hjulet til toppunktet (toppunktet mot +s).
function bevelSlices(addP, body, name, axis, mid, hole, tip, drop, T, extra) {
  const n = 6;
  for (let k = 0; k < n; k++) {
    const s0 = mid - T / 2 + (k * T) / n, s1 = s0 + T / n;
    addP(body, name, axis, rect(s0, s1, hole, tip * (1 - (s0 - mid) / drop)), extra);
  }
}

// Kroppene som står stille i monteringsrammen (til festesjekken).
export const staticBodies = ['stolpe', 'arm'];
