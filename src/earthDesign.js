// Jorda: rotasjonen (drivet fra pinionakselen og vinkelgiret til den skrå
// jordaksen), føringsringen for månebanen og foten som følger den. Ren
// matematikk (uten three.js), som iceMoons.js. mechanism.js lager earthTrain
// med earthDesign, og earthBuild.js tegner den. Tallene står i earthDay og
// moonGuide i config.js. Det som trengs fra modellen (høyder, armlengder,
// retninger), sendes inn som ctx, så mechanism.js kan bruke denne fila.
//
// Koordinatene ved jorda («monteringsrammen»): origo på loddlinjen gjennom
// jordstolpen, y er høyden som i modellen, og x peker dit jordaksen heller
// (nordpolen heller mot +x). Rammen står stille i rommet, som parallellhjulet.
// Som ellers er three.js-z lik −y i planet: en asimut φ (grader rundt, mot
// klokka sett ovenfra fra +x) er punktet (r cos φ, y, −r sin φ).
// Langs jordaksen måles s fra jordas sentrum (positiv mot nordpolen).
import { bodies, arm, armStyle, moonTrain, spacing, tilt as tiltCfg, earthDay as ED, moonGuide as MG } from './config.js';
import { daysPerYear } from './ephemeris.js';

const { gap, chainGap } = spacing;
const deg = (d) => (d * Math.PI) / 180;
const plateDepth = 0.3;                        // så langt lenkeplatene stikker over og under kjedehjulet
const TC = moonTrain.thickness;                // kjedene og kjedehjulene
const sprocketR = (teeth, pitch) => (teeth * pitch) / (2 * Math.PI);
const sprocketEdge = (teeth, pitch) => sprocketR(teeth, pitch) + pitch * 0.3 * 1.3;
const tipOf = (m, z) => (m * z) / 2 + m;
const rootOf = (m, z) => (m * z) / 2 - 1.25 * m;

export const target = daysPerYear + 1;         // omdreininger per år i rommet: ett døgn mer enn solen gir
const tilt = deg(tiltCfg.earthAxis), st = Math.sin(tilt), ct = Math.cos(tilt);
const axisDir = { x: st, y: ct, z: 0 };
const add3 = (...vs) => vs.reduce((s, q) => ({ x: s.x + q.x, y: s.y + q.y, z: s.z + q.z }), { x: 0, y: 0, z: 0 });
const mul3 = (q, k) => ({ x: q.x * k, y: q.y * k, z: q.z * k });
const sub3 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const len3 = (q) => Math.hypot(q.x, q.y, q.z);
const unit3 = (q) => mul3(q, 1 / len3(q));
const at = (r, y, phi) => ({ x: r * Math.cos(phi), y, z: -r * Math.sin(phi) });

// --- Høydene ved jordarmen ---
// Dagkjedet ligger i et eget plan mellom det faste hjulet og parallellkjedet.
// Månearmen ligger et mellomrom over lenkeplatene på månekjedet.
function stackFor(ctx) {
  const s0 = ctx.heights.stack.earth;
  const armY = ctx.heights.arm.earth, armTop = armY + arm.thickness;
  const level1 = s0.level1;
  const day = level1 + TC + gap + plateDepth;
  const parallel = day + TC + chainGap;
  const s = { armY, armTop, level1, day, parallel };
  s.fixedTop = s.parallel + TC;
  s.moonChain = s.parallel + TC + chainGap;
  s.pinionTop = s.moonChain + TC + plateDepth;
  s.moonArm = s.moonChain + TC + plateDepth + gap;
  s.rise = s.pinionTop - s0.pinionTop;          // så mye armene innenfor jorda (og sola) må løftes
  return s;
}

// --- Omdreiningene (runder per år) ---
// Pinionakselen → dagkjedet → forlegsakselen → tannhjulsparet → driveakselen →
// vinkelgiret → jorda.
export function earthRates() {
  const fixedPinion = moonTrain.fixed.teeth / moonTrain.pinion.teeth;   // pinionakselen sett fra armen
  const r = { pinion: fixedPinion };
  const P = ED.P;
  r.lay = fixedPinion * (P.pinionSprocket / P.laySprocket);            // forlegsakselen sett fra armen (kjedet beholder retningen)
  r.shaftArm = -r.lay * (P.layGear / P.shaftGear);                    // et inngrep snur
  r.shaft = r.shaftArm + 1;                                            // sett fra stolperøret, som går −1 sett fra armen
  r.k = ED.V.shaftTeeth / ED.V.earthTeeth;
  r.sign = -1;                                                         // to koniske hjul under toppunktet: motsatt vei
  r.earth = r.sign * r.k * r.shaft;
  r.siderealDay = daysPerYear / r.earth;
  r.error = (r.earth / target - 1) * 100;
  if (r.earth <= 0) throw new Error('earthDay: jorda går baklengs. Sjekk tanntallene i earthDay.P og earthDay.V.');
  return r;
}

// Stjernetiden i Greenwich (GMST, Meeus 12.4) på en dato, i radianer: vinkelen
// fra vårjevndøgnsretningen til Greenwich-meridianen, målt østover.
export function gmst(date) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const d = 280.46061837 + 360.98564736629 * (jd - 2451545.0);
  return deg(((d % 360) + 360) % 360);
}

// --- Føringsringen (et smalt bånd med loddrette sider) og foten (en gaffel med to ruller) ---
// Utstrekningen over og under midtlinjen der foten møter ringen, og hvor stagene fester.
function guideFor() {
  const rc = MG.radius;
  const F = MG.follower;
  const { width: w, height: h } = MG.ring;
  const g = { rc, w, h, inner: rc - w / 2, outer: rc + w / 2, half: h / 2, attachR: rc - w / 2 };
  const rho = F.rollerRadius;
  // Rullene ligger oppå og under ringen, gaffelen utenfor ytterkanten.
  g.rollerCenter = g.half + rho;
  // Gaffelen går utenfor ringen, og minst gap fra der stagene fester (på innsiden).
  g.barInner = Math.max(g.outer + 0.08, g.attachR + 0.02 + MG.strutRadius + gap);
  g.barR = g.barInner + F.barWidth / 2;
  g.barHalf = g.rollerCenter + rho + 0.05;
  g.extent = g.barHalf;
  g.footFrom = g.barR + F.barWidth / 2;
  return g;
}

// --- Hele utformingen ---
// ctx.H er høyden jorda står i; for lav høyde gir feilmelding. ctx.dayChain er
// dagkjedet fra mechanism.js.
export function earthDesign(ctx) {
  const s = stackFor(ctx);
  const rate = earthRates();
  const R = bodies.earthRadius;
  const L = ctx.armLengths.earth;
  const dsR = ED.driveShaftRadius, frameOuter = dsR + ED.frameWall, spR = ED.spindleRadius;
  const moonTubeOuter = frameOuter + MG.tubeWall;
  const orbit = bodies.moonOrbit;
  const K = orbit * Math.tan(deg(tiltCfg.moonOrbit));              // så mye månen går opp og ned
  const g = guideFor();
  const d = { ctx, stack: s, rate, R, L, dsR, frameOuter, spR, moonTubeOuter, orbit, K, g, tilt };

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

  // --- Vinkelgiret til jordaksen ---
  // Aksene møtes bare i jordas sentrum, så toppunktet ligger der. Alt her er
  // gitt i forhold til jordas sentrum H; H må være så høy at det laveste går
  // klar over ringen og foten.
  const bl = ED.bearing.length, bw = ED.bearing.wall, br = ED.bracket.radius;
  const V = ED.V, m = V.module, fw = V.faceWidth;
  const gammaE = Math.atan(st / (V.shaftTeeth / V.earthTeeth + ct));
  const gammaV = tilt - gammaE;
  const rE = (m * V.earthTeeth) / 2, rV = (m * V.shaftTeeth) / 2;
  const Lc = rE / Math.sin(gammaE);                                 // fra toppunktet (jordas sentrum) langs kjeglen
  const top = {
    m, fw, gammaE, gammaV, rE, rV, Lc,
    sE: -Lc * Math.cos(gammaE),                                     // midten av hjulet på spindelen, langs aksen
    dropV: Lc * Math.cos(gammaV),                                   // fra jordas sentrum ned til midten av hjulet på driveakselen
    tipE: tipOf(m, V.earthTeeth), tipV: tipOf(m, V.shaftTeeth),
  };
  if (rootOf(m, V.earthTeeth) < spR + 0.12) throw new Error('earthDay.V: hjulet på spindelen er for lite til spindelen. Øk module eller earthTeeth.');
  const lowE = top.sE * ct - top.tipE * st - (fw / 2) * ct;
  const lowV = -top.dropV - fw / 2;
  const lowestRel = Math.min(lowE, lowV);                           // det laveste punktet, i forhold til H
  // Lageret rett over hjulet på spindelen; spindelen slutter like under hjulet.
  top.bearing = [top.sE + fw / 2 + gap, top.sE + fw / 2 + gap + bl];
  top.spindle = [top.sE - fw / 2 - 0.08, R + 0.45];
  d.top = top;

  // --- Høyden på jordas sentrum ---
  // Modellen krever sola over den øverste armen (armene innenfor jorda løftes
  // med jordstabelen).
  const Hsun = ctx.heights.topArm + s.rise + gap + bodies.sunRadius;
  const Hstage = d.ringTop + gap - lowestRel;
  if (ctx.H < Hstage - 1e-9) {
    throw new Error(`bodies.height må være minst ${(Math.ceil(Hstage * 100) / 100).toFixed(2)} så overgangen til jordaksen og føringsringen får plass under jorda (er ${ctx.H}).`);
  }
  const H = ctx.H;
  Object.assign(d, { H, Hsun, Hstage });
  const C = { x: 0, y: H, z: 0 };
  const onAxis = (sv, off = { x: 0, y: 0, z: 0 }) => add3(C, mul3(axisDir, sv), off);
  d.C = C;

  // --- Stolperøret, driveakselen og braketten ---
  d.frameBottom = s.parallel;                                       // stolperøret begynner ved parallellhjulet
  top.yV = H - top.dropV;
  d.shaftTop = top.yV + top.fw / 2 + 0.05;
  d.frameTop = top.yV - top.fw / 2 - gap;
  // Braketten: fra stolperøret ut til siden (z), opp til lageret, og inn til det.
  const yb = d.frameTop - br - 0.05;
  const zOut = top.tipV + gap + br + 0.1;
  const bc = onAxis((top.bearing[0] + top.bearing[1]) / 2);
  const rb = spR + bw;
  const toward = unit3({ x: -bc.x, y: 0, z: zOut - bc.z });         // fra lageret mot braketten, vannrett
  // Vinkelrett på aksen: ta bort komponenten langs aksen.
  const along = toward.x * axisDir.x + toward.y * axisDir.y;
  const perp = unit3(sub3(toward, mul3(axisDir, along)));
  const end = add3(bc, mul3(perp, rb));
  d.bracket = [{ x: 0, y: yb, z: frameOuter }, { x: 0, y: yb, z: zOut }, { x: 0, y: end.y, z: zOut }, end];
  d.shaftBottom = s.armTop - 0.05;

  // --- Ringen, stagene og foten ---
  d.node = ctx.node;                                                // knutelinjen i monteringsrammen (står fast i rommet)
  d.lift = (phi) => K * Math.sin(phi - d.node);                    // hvor mye staven (og ringen der) er løftet
  d.ringAt = (phi, dr = 0, dy = 0) => at(g.rc + dr, d.ringY + d.lift(phi) + dy, phi);
  d.strutAngles = MG.strutAzimuths.map(deg);
  d.struts = d.strutAngles.map((phi) => [at(d.hubR - 0.05, (d.hubY0 + d.hubY1) / 2, phi), at(g.attachR + 0.02, d.ringY + d.lift(phi), phi)]);
  // Staven, foten og månen når månearmen står i vinkelen phi (i monteringsrammen).
  d.sliderAt = (phi) => {
    const lift = d.lift(phi), yc = d.ringY + lift;
    return {
      lift,
      moon: at(orbit, H + lift, phi),
      pin: [at(orbit, d.moonArmY + d.pinBelow + K + lift, phi), at(orbit, H + lift, phi)],
      foot: [at(g.footFrom - 0.02, yc, phi), at(orbit, yc, phi)],
      bar: [at(g.barR, yc - g.barHalf, phi), at(g.barR, yc + g.barHalf, phi)],
      rollers: [1, -1].map((k) => at(g.rc, yc + k * g.rollerCenter, phi)),
      axles: [1, -1].map((k) => [at(g.barInner, yc + k * g.rollerCenter, phi), at(g.rc - MG.follower.rollerWidth / 2 - 0.02, yc + k * g.rollerCenter, phi)]),
    };
  };

  // --- Forlegsakselen ved foten av stolpen, med dagkjedet ---
  const P = ED.P;
  d.lay = {
    D: (P.module * (P.layGear + P.shaftGear)) / 2,
    tipC: tipOf(P.module, P.layGear), tipD: tipOf(P.module, P.shaftGear),
    shaftR: 0.25,
  };
  d.lay.x = L - d.lay.D;
  if (rootOf(P.module, P.shaftGear) < dsR + 0.15) throw new Error('earthDay.P: hjulet på driveakselen er for lite til akselen.');
  d.dayChain = ctx.dayChain;
  d.lay.top = s.day + TC + 0.1;
  const pinionTip = (moonTrain.module * moonTrain.pinion.teeth) / 2 + moonTrain.module;
  if (d.lay.x - d.lay.tipC < ctx.layout.pinion.x + pinionTip + gap) throw new Error('earthDay.P: hjulet på forlegsakselen går for nær pinionen. Gjør det mindre (layGear eller module).');
  const fixedOuter = ctx.tube.fixed.outer;
  if (ctx.layout.pinion.x - sprocketEdge(P.pinionSprocket, P.chainPitch) < fixedOuter + gap) throw new Error('earthDay.P: kjedehjulet på pinionakselen går for nær det faste røret. Gjør det mindre.');
  return d;
}

// --------------------------------------------------------- Formene ---
// Til 3D-sjekken (scripts/clearance3d.mjs), i monteringsrammen. Hver del som
// dreier om loddlinjen (sett fra rammen, som står stille i rommet), er et
// omdreiningslegeme; jorda og spindelen dreier om jordaksen. Staven og foten
// tas med i steps stillinger rundt.
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
  const s = d.stack, g = d.g, top = d.top;
  const sl = MG.sleeveRadius;

  // Armen (dreier om stolpen sett fra rammen), med kjedene som går ut fra den.
  addP('arm', 'arm', V, rect(s.armY, s.armTop, d.dsR, 1e3), { tube: true, ground: true });
  addP('arm', 'parallellkjede', V, rect(...chainBand(s.parallel), sprocketR(moonTrain.parallelSprocket.teeth, 1) - 0.4, 1e3), { id: 'kjede-par' });
  addP('arm', 'månekjede', V, rect(...chainBand(s.moonChain), sprocketR(moonTrain.moonSprocket.teeth, 1) - 0.4, 1e3), { id: 'kjede-måne' });
  const P = ED.P, lay = d.lay;
  addP('arm', 'dagkjede', V, rect(...chainBand(s.day, P.chainPitch), lay.D - sprocketEdge(P.laySprocket, P.chainPitch) - 0.05, 1e3), { id: 'kjede-dag' });
  addP('forlegg', 'forlegsaksel', V, rect(s.armTop, lay.top, lay.D - lay.shaftR, lay.D + lay.shaftR), { tube: true, shaft: true, mesh: ['kjede-dag'] });
  addP('forlegg', 'tannhjul', V, rect(s.level1, s.level1 + ED.shaftGearThickness, lay.D - lay.tipC, lay.D + lay.tipC), { id: 'hjul-C' });
  addP('forlegg', 'kjedehjul', V, rect(s.day, s.day + TC, lay.D - sprocketEdge(P.laySprocket, P.chainPitch), lay.D + sprocketEdge(P.laySprocket, P.chainPitch)), { mesh: ['kjede-dag'] });
  addP('driveaksel', 'tannhjul', V, rect(s.level1, s.level1 + ED.shaftGearThickness, d.dsR, lay.tipD), { mesh: ['hjul-C'] });
  addP('driveaksel', 'driveaksel', V, rect(d.shaftBottom, d.shaftTop, 0, d.dsR), { tube: true, shaft: true });

  // Stolperøret med parallellhjulet, navet og ringen (står stille).
  addP('stolpe', 'stolperør', V, rect(d.frameBottom, d.frameTop, d.dsR, d.frameOuter), { tube: true, ground: true });
  addP('stolpe', 'parallellhjul', V, rect(s.parallel, s.parallel + TC, d.frameOuter, sprocketEdge(moonTrain.parallelSprocket.teeth, 1)), { mesh: ['kjede-par'] });
  addP('stolpe', 'nav', V, rect(d.hubY0, d.hubY1, d.frameOuter, d.hubR), { tube: true });
  d.struts.forEach(([a, b], k) => addP('stolpe', `stag ${k + 1}`, null, cap(a, b, MG.strutRadius)));
  const N = 96;
  for (let k = 0; k < N; k++) {
    const p0 = (2 * Math.PI * k) / N, p1 = (2 * Math.PI * (k + 1)) / N;
    for (const dy of [-g.h / 2 + g.w / 2, 0, g.h / 2 - g.w / 2]) addP('stolpe', 'ring', null, cap(d.ringAt(p0, 0, dy), d.ringAt(p1, 0, dy), g.w / 2), { guide: true });
  }
  // Braketten og lageret. Den siste biten av braketten sitter på lageret, utenpå spindelen.
  const bp = d.bracket;
  for (let i = 0; i < bp.length - 1; i++) addP('stolpe', `brakett ${i + 1}`, null, cap(bp[i], bp[i + 1], ED.bracket.radius), i === bp.length - 2 ? { holds: ['jorda'] } : {});
  const rb = d.spR + ED.bearing.wall;
  addP('stolpe', 'lager', E, rect(...top.bearing, d.spR, rb), { tube: true });
  // Jorda: spindelen, hjulet og kula.
  addP('jorda', 'spindel', E, rect(...top.spindle, 0, d.spR), { tube: true, shaft: true });
  addP('jorda', 'jorda', E, seg(0, 0, 0, 0, d.R));
  bevelSlices(addP, 'jorda', 'konisk hjul', E, top.sE, d.spR, top.tipE, top.Lc * Math.cos(top.gammaE), top.fw, { mesh: ['konisk-V'] });
  bevelSlices(addP, 'driveaksel', 'konisk hjul', V, top.yV, d.dsR, top.tipV, top.dropV, top.fw, { id: 'konisk-V' });

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
    addP('månen', 'gaffel', null, cap(...p.bar, MG.follower.barWidth / 2), { rests: true });
    for (const a of p.axles) addP('månen', 'aksel til rulle', null, cap(...a, MG.follower.axleRadius), { rests: true });
    for (const r of p.rollers) addP('månen', 'rulle', null, ball(r, MG.follower.rollerRadius), { rests: true });
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
