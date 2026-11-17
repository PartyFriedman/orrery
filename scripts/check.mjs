// Sjekker at mekanismen henger sammen.
//   npm run check       rask: alt under, men simuleringen B med et lite utvalg
//                       (200 tilfeldige tidspunkt og passeringer innen 20 omdreininger)
//   npm run check:full  alt, med hele simuleringen B (20 000 og 2 000). Kjøres før PR.
// 3D-klaringen (D–G) er rask og er med i begge. Det er B som tar mest tid.
//
//   1. Omløpstidene, slik tanntallene gir dem, er innen 1 % av målet, og alle
//      planetene går samme vei.
//   2. Rullene i alle kjedene ligger i setene på kjedehjulene, og
//      parallellhjulet står stille i rommet.
//   3. Kollisjoner:
//      A: hver del får et ringområde (minste og største avstand fra sentrum) og
//         et høydebånd. For hvert par deler som beveger seg i forhold til
//         hverandre må enten ringene eller høydebåndene gå minst 0,3 klar av
//         hverandre. Gjelder for alle vinkler, og dermed hele syklusen.
//      B: simulering i planet (sirkler og kapsler med høydebånd): hvert
//         øyeblikk to armer står rett over hverandre innenfor et vindu, pluss
//         tilfeldige tidspunkt (fra en fast startverdi, så de er like hver gang).
//         Kontroll av A med de faktiske formene.
//      C: hjulverket ved Jupiter, med ringområder rundt Jupiter-stolpen: krage,
//         forlegsaksel, månerør, hjul, månearmer, stolper og måner.
//      D, E og F: alt ved Saturn, Mars og Uranus i 3D, sett fra stolpen. G: Neptun.
//      Festet: hver aksel sitter i en fast del (Uranus og Neptun).
//   Reservert plass (stabler over armene, måner og Saturns ring) er med.
//   Jupiters måner: omløpstidene, at de tre innerste går 4 : 2 : 1 sett fra
//   armen, og at Laplace-vinkelen (Io − 3 × Europa + 2 × Ganymedes) står stille.
//
// Bruk: node scripts/check.mjs [antall tilfeldige tidspunkt] [vindu for passeringer, i omdreininger]
// eller node scripts/check.mjs quick. Standard er 20 000 og 2 000.
// Avslutter med feilkode hvis noe er galt. Skriver tiden den brukte til slutt.

import {
  segDist, meshes, v, sub, plus, mul, dot, cross, len, unit, makeAxis, rect, line, distance, run3D, toCheckParts, checkMounts,
} from './clearance3d.mjs';

const src = new URL('../src/', import.meta.url);
const started = performance.now();
const QUICK = process.argv[2] === 'quick';
const RANDOM = QUICK ? 200 : Number(process.argv[2] ?? 20000);
const WINDOW = QUICK ? 20 : Number(process.argv[3] ?? 2000);
console.log(QUICK
  ? 'Rask sjekk: simuleringen B med 200 tilfeldige tidspunkt og passeringer innen 20 omdreininger. Alt: npm run check:full.\n'
  : `Full sjekk: simuleringen B med ${RANDOM} tilfeldige tidspunkt og passeringer innen ${WINDOW} omdreininger.\n`);
const C = await import(new URL('config.js', src).href);
const M = await import(new URL('mechanism.js', src).href);
const { daysPerYear } = await import(new URL('ephemeris.js', src).href);
const I = await import(new URL('iceMoons.js', src).href);
const { drive, outerDrive, center, gear, bigGear, smallGear, arm, armStyle, planets, moonTrain, bodies, tilt, accent } = C;
const JM = C.jupiterMoons;
const SMc = C.saturnMoons;
const MMc = C.marsMoons;
const CD = C.counterDrive, UPc = C.uranusPost, UMc = C.iceMoons.uranus, NMc = C.iceMoons.neptune;
const {
  tube, tubes, heights: h, layout, anglesAt, pairModule, moonChain, parallelChain,
  driveChain, driveFrame, layChain, layFrame, idlerHub,
  moonRing, moonLift, earthAxis, armParts: AP, armLengths, moonSystems, mechanismOf, order, reach,
  jupiterChain, jupiterLayout, jupiterTrain: JT, worldAngleOf,
  saturnTrain: ST, saturnChain, saturnParallelChain, saturnLayout, saturnAxis, saturnBracket, saturnToPost, inputPerYear,
  marsTrain: MT, marsChain, marsParallelChain, marsLayout, marsAxis, marsBracket, marsToPost,
  uranusTrain: UT, uranusParallelChain, uranusLayout, uranusAxis, uranusBracket, uranusToPost,
  uranusMoonTrain: UMT, uranusMoonChain, uranusMoonNames, neptuneMoonTrain: NMT, neptuneChain, neptuneLayout,
} = M;
const mMoons = planets.mars.moons;
const jMoons = planets.jupiter.moons;
const sMoons = planets.saturn.moons;
const wrapAngle = (x) => Math.atan2(Math.sin(x), Math.cos(x));
let problems = 0;

// ---------- 1: omløpstider ----------
{
  const turns = 60000, a0 = anglesAt(0), a1 = anglesAt(turns * 2 * Math.PI);
  const years = (a1.armAngle - a0.armAngle) / (2 * Math.PI);
  console.log('Omløpstider:');
  for (const n of Object.keys(planets)) {
    const rev = (a1.planetAngles[n] - a0.planetAngles[n]) / (2 * Math.PI);
    const P = years / rev, err = (P / planets[n].period - 1) * 100;
    const ok = Math.abs(err) <= 1 && rev > 0;
    if (!ok) problems++;
    console.log(`  ${n.padEnd(8)} ${P.toFixed(4)} år (mål ${planets[n].period}, feil ${err.toFixed(3)} %)${rev > 0 ? '' : ' FEIL VEI'}${ok ? '' : '  <-- FEIL'}`);
  }
  const moon = (a1.moonAngle - a0.moonAngle) / (a1.armAngle - a0.armAngle);
  console.log(`  månen    ${moon.toFixed(6)} runder per år (skal være ${M.moonPerYear.toFixed(6)})`);
  if (Math.abs(moon - M.moonPerYear) > 1e-6) problems++;

  // Jupiters måner: sidereal omløpstid i dager, og forholdet sett fra armen.
  const rel = {};
  for (const n of jMoons) {
    const rev = (worldAngleOf(n, a1) - worldAngleOf(n, a0)) / (2 * Math.PI);
    rel[n] = (a1.jupiterMoonAngles[n] - a0.jupiterMoonAngles[n]) / (2 * Math.PI);
    const P = (years * daysPerYear) / rev, err = (P / JM.periods[n] - 1) * 100;
    const ok = Math.abs(err) <= 1 && rev > 0;
    if (!ok) problems++;
    console.log(`  ${n.padEnd(8)} ${P.toFixed(4)} dager (mål ${JM.periods[n]}, feil ${err.toFixed(3)} %)${rev > 0 ? '' : ' FEIL VEI'}${ok ? '' : '  <-- FEIL'}`);
  }
  // Saturns måner: sidereal omløpstid i dager. Båndene dreier om Saturns akse
  // på stolpen, som står stille i rommet, så vinkelen sett fra stolpen er sidereal.
  for (const n of sMoons) {
    const b = M.saturnBandOf[n];
    const rev = (a1.saturnBands[b] - a0.saturnBands[b]) / (2 * Math.PI);
    const P = (years * daysPerYear) / rev, err = (P / SMc.periods[n] - 1) * 100;
    const ok = Math.abs(err) <= 1 && rev > 0;
    if (!ok) problems++;
    console.log(`  ${n.padEnd(9)} ${P.toFixed(4)} dager (mål ${SMc.periods[n]}, feil ${err.toFixed(3)} %, bånd ${b})${rev > 0 ? '' : ' FEIL VEI'}${ok ? '' : '  <-- FEIL'}`);
  }
  // Mars' måner: sidereal omløpstid i dager (bæreren og solhjulet dreier om
  // Mars' akse på stolpen, som står stille i rommet).
  for (const n of mMoons) {
    const rev = (a1.marsMoonAngles[n] - a0.marsMoonAngles[n]) / (2 * Math.PI);
    const P = (years * daysPerYear) / rev, err = (P / MMc.periods[n] - 1) * 100;
    const ok = Math.abs(err) <= 1 && rev > 0;
    if (!ok) problems++;
    console.log(`  ${n.padEnd(9)} ${P.toFixed(5)} dager (mål ${MMc.periods[n]}, feil ${err.toFixed(3)} %)${rev > 0 ? '' : ' FEIL VEI'}${ok ? '' : '  <-- FEIL'}`);
  }
  // Uranus' måner: rørene dreier om Uranus' akse på stolpen, som står stille
  // i rommet, så vinkelen sett fra stolpen er sidereal. Positivt er samme vei
  // som Uranus dreier (mot polen med akselen).
  for (const n of uranusMoonNames) {
    const rev = (a1.uranusMoonAngles[n] - a0.uranusMoonAngles[n]) / (2 * Math.PI);
    const P = (years * daysPerYear) / rev, err = (P / C.iceMoons.periods[n] - 1) * 100;
    const ok = Math.abs(err) <= 1 && rev > 0;
    if (!ok) problems++;
    console.log(`  ${n.padEnd(9)} ${P.toFixed(4)} dager (mål ${C.iceMoons.periods[n]}, feil ${err.toFixed(3)} %)${rev > 0 ? '' : ' FEIL VEI'}${ok ? '' : '  <-- FEIL'}`);
  }
  // Triton: Neptun-armen pluss Tritons rør. Triton går baklengs.
  {
    const rev = (worldAngleOf('triton', a1) - worldAngleOf('triton', a0)) / (2 * Math.PI);
    const P = -(years * daysPerYear) / rev, err = (P / C.iceMoons.periods.triton - 1) * 100;
    const ok = Math.abs(err) <= 1 && rev < 0;
    if (!ok) problems++;
    console.log(`  triton    ${P.toFixed(4)} dager baklengs (mål ${C.iceMoons.periods.triton}, feil ${err.toFixed(3)} %)${rev < 0 ? '' : ' FEIL VEI (skal gå baklengs)'}${ok ? '' : '  <-- FEIL'}`);
  }
  {
    // Planetgiret: solhjulet går 1 + ring·planet1/(sun·planet2) ganger så fort som bæreren.
    const PG = MMc.planetary, want = 1 + (PG.ring * PG.planet1) / (PG.sun * PG.planet2);
    const got = (a1.marsSun - a0.marsSun) / (a1.marsCarrier - a0.marsCarrier);
    const ok = Math.abs(got / want - 1) < 1e-9;
    if (!ok) problems++;
    console.log(`  Planetgiret ved Mars: solhjulet/bæreren ${got.toFixed(6)} (skal være ${want.toFixed(6)})${ok ? '' : '  <-- FEIL'}`);
  }
  const ioEu = rel.io / rel.europa, euGa = rel.europa / rel.ganymede;
  const exact = Math.abs(ioEu - 2) < 1e-9 && Math.abs(euGa - 2) < 1e-9;
  if (!exact) problems++;
  console.log(`  Sett fra Jupiter-armen: Io/Europa ${ioEu.toFixed(9)}, Europa/Ganymedes ${euGa.toFixed(9)} (skal være 2 og 2)${exact ? '' : '  <-- FEIL'}`);
}

// ---------- 2: kjeder og parallellføring ----------
{
  const seat = (chain, c1, c2, t1, t2, ang1, ang2, off) => {
    let worst = 0, n = 0;
    for (let i = 0; i < chain.links; i++) {
      const p = chain.point(off + i * chain.pitch);
      for (const [c, r, teeth, ang] of [[c1, chain.radius1, t1, ang1], [c2, chain.radius2, t2, ang2]]) {
        if (Math.abs(Math.hypot(p.x - c.x, p.y - c.y) - r) > 1e-6) continue;
        n++;
        const step = (2 * Math.PI) / teeth, rel = Math.atan2(p.y - c.y, p.x - c.x) - ang;
        worst = Math.max(worst, Math.abs(rel - Math.round(rel / step) * step) * r);
      }
    }
    return [n, worst];
  };
  let rollers = 0, worst = 0;
  const O0 = { x: 0, y: 0 };
  for (const t of [0, 0.7, 3.1, 11.9, 1234.5]) {
    const a = anglesAt(t);
    for (const [n, w] of [
      seat(driveChain, O0, { x: driveFrame.span, y: 0 }, outerDrive.driveSprocket, outerDrive.idlerLarge, a.driveAngle - driveFrame.angle, a.idlerAngle - driveFrame.angle, a.driveChainOffset),
      seat(layChain, O0, { x: layFrame.span, y: 0 }, outerDrive.idlerSmall, outerDrive.laySprocket, a.idlerAngle - layFrame.angle, a.layAngle - layFrame.angle, a.layChainOffset),
      seat(moonChain, layout.pinion, layout.earth, moonTrain.driveSprocket.teeth, moonTrain.moonSprocket.teeth, a.moonDriveAngle, a.moonAngle, a.moonChainOffset),
      seat(parallelChain, layout.center, layout.earth, moonTrain.parallelSprocket.teeth, moonTrain.parallelSprocket.teeth, a.fixedAngle, a.parallelAngle, a.parallelChainOffset),
      seat(jupiterChain, layout.center, jupiterLayout.post, JM.tubeSprocket, JM.collarSprocket, a.jupiterTubeAngle - a.planetAngles.jupiter, a.collarAngle, a.jupiterChainOffset),
      seat(saturnChain, layout.center, saturnLayout.post, SMc.tubeSprocket, SMc.shaftSprocket, a.saturnTubeAngle - a.planetAngles.saturn, a.saturnShaftAngle, a.saturnChainOffset),
      seat(saturnParallelChain, layout.center, saturnLayout.post, SMc.parallel.centerSprocket, SMc.parallel.postSprocket, a.saturnParTubeAngle - a.planetAngles.saturn, a.saturnFrameAngle, a.saturnParChainOffset),
      seat(marsChain, layout.center, marsLayout.post, MMc.tubeSprocket, MMc.shaftSprocket, a.marsTubeAngle - a.planetAngles.mars, a.marsShaftAngle, a.marsChainOffset),
      seat(marsParallelChain, layout.center, marsLayout.post, MMc.parallel.centerSprocket, MMc.parallel.postSprocket, a.marsParTubeAngle - a.planetAngles.mars, a.marsFrameAngle, a.marsParChainOffset),
      seat(uranusParallelChain, layout.center, uranusLayout.post, UPc.parallel.centerSprocket, UPc.parallel.postSprocket, a.uranusParTubeAngle - a.planetAngles.uranus, a.uranusFrameAngle, a.uranusParChainOffset),
      seat(uranusMoonChain, layout.center, uranusLayout.post, UMc.tubeSprocket, UMc.shaftSprocket, a.uranusTubeAngle - a.planetAngles.uranus, a.uranusShaftAngle, a.uranusChainOffset),
      seat(neptuneChain, layout.center, neptuneLayout.post, NMc.tubeSprocket, NMc.collarSprocket, a.neptuneTubeAngle - a.planetAngles.neptune, a.neptuneCollarAngle, a.neptuneChainOffset),
    ]) { rollers += n; worst = Math.max(worst, w); }
  }
  let drift = 0, saturnDrift = 0, marsDrift = 0, uranusDrift = 0;
  const w0 = anglesAt(0).armAngle + anglesAt(0).parallelAngle;
  const s0 = anglesAt(0).planetAngles.saturn + anglesAt(0).saturnFrameAngle;
  const m0 = anglesAt(0).planetAngles.mars + anglesAt(0).marsFrameAngle;
  const u0 = anglesAt(0).planetAngles.uranus + anglesAt(0).uranusFrameAngle;
  const wrapAbs = (x) => Math.abs(Math.atan2(Math.sin(x), Math.cos(x)));
  for (let t = 0; t < 5000; t += 3.7) {
    const a = anglesAt(t);
    drift = Math.max(drift, wrapAbs(a.armAngle + a.parallelAngle - w0));
    saturnDrift = Math.max(saturnDrift, wrapAbs(a.planetAngles.saturn + a.saturnFrameAngle - s0));
    marsDrift = Math.max(marsDrift, wrapAbs(a.planetAngles.mars + a.marsFrameAngle - m0));
    uranusDrift = Math.max(uranusDrift, wrapAbs(a.planetAngles.uranus + a.uranusFrameAngle - u0));
  }
  if (worst > 1e-6 || drift > 1e-9 || saturnDrift > 1e-9 || marsDrift > 1e-9 || uranusDrift > 1e-9) problems++;
  console.log(`\nKjeder: ${rollers} ruller sjekket, største avvik fra setet ${worst.toExponential(1)}. Drift i rommet: parallellhjulet ved jorda ${drift.toExponential(1)} rad, Saturn-stolpen ${saturnDrift.toExponential(1)} rad, Mars-stolpen ${marsDrift.toExponential(1)} rad, Uranus-stolpen ${uranusDrift.toExponential(1)} rad.`);
  // Kryssleddet ved Mars: K (toppen av stolpen) skal ligge både på loddlinjen
  // gjennom stolpen og på den skrå drivakselen; de to leddene har like vinkler,
  // så drivakselen går like jevnt som driveakselen.
  {
    const K = marsToPost(MT.drive.distance, MT.drive.jointS);
    const off = Math.hypot(K.x, K.y - h.stack.mars.joint);
    const ok = off < 1e-9;
    if (!ok) problems++;
    console.log(`Kryssleddet ved Mars: på toppen av stolpen (høyde ${h.stack.mars.joint.toFixed(2)}), avvik fra drivakselen ${off.toExponential(1)}, to ledd à ${(marsAxis.tilt * 90 / Math.PI).toFixed(2)}°${ok ? '' : '  <-- FEIL'}`);
  }
}

// ---------- 2b: startposisjon ----------
// Ved inngang 0 skal hver planet og månen stå på middellengden for
// startdatoen, og jordaksen og knutelinjen i riktig retning i verden.
{
  const a = anglesAt(0), eq = (tilt.equinoxDirection * Math.PI) / 180;
  const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));
  const deg = (x) => ((((x * 180) / Math.PI) % 360) + 360) % 360;
  const world = a.armAngle + a.parallelAngle;
  const parts = [
    ...Object.keys(planets).map((n) => [n, a.planetAngles[n], M.targets[n]]),
    ['earth', a.armAngle, M.targets.earth],
    ['moon', a.armAngle + a.moonAngle, M.targets.moon],
    ...jMoons.map((n) => [n, worldAngleOf(n, a), M.targets[n]]),
    ['jordakse', world + earthAxis.direction, eq + Math.PI / 2],
    ['knute', world + moonRing.node, moonRing.nodeWorld],
    ...sMoons.map((n) => [n, worldAngleOf(n, a), M.targets[n]]),
    ['Saturnakse', a.planetAngles.saturn + a.saturnFrameAngle + saturnAxis.direction, saturnAxis.poleWorld],
    ...mMoons.map((n) => [n, worldAngleOf(n, a), M.targets[n]]),
    ['Marsakse', a.planetAngles.mars + a.marsFrameAngle + marsAxis.direction, marsAxis.poleWorld],
    ['Uranusakse', a.planetAngles.uranus + a.uranusFrameAngle + uranusAxis.direction, uranusAxis.poleWorld],
    ...uranusMoonNames.map((n) => [n, worldAngleOf(n, a), M.targets[n]]),
    ['triton', worldAngleOf('triton', a), M.targets.triton],
  ];
  console.log(`\nStartposisjon ${M.startDate.toISOString().slice(0, 10)} (middellengde, grader fra vårjevndøgn):`);
  let worstStart = 0;
  for (const [n, got, want] of parts) {
    const err = Math.abs(wrap(got - want));
    worstStart = Math.max(worstStart, err);
    console.log(`  ${n.padEnd(8)} ${deg(got - eq).toFixed(2).padStart(7)}°${err > 1e-9 ? `  <-- FEIL (${err.toExponential(1)} rad)` : ''}`);
  }
  if (worstStart > 1e-9) problems++;

  // Laplace-vinkelen: 180° på startdatoen, og den skal stå stille.
  const laplace = (x) => {
    const [l1, l2, l3] = ['io', 'europa', 'ganymede'].map((n) => worldAngleOf(n, x));
    return l1 - 3 * l2 + 2 * l3;
  };
  const start = laplace(a);
  let drift = 0;
  for (const t of [1, 77.7, 1234.5, 98765.4]) drift = Math.max(drift, Math.abs(wrapAngle(laplace(anglesAt(t)) - start)));
  const off = Math.abs(wrapAngle(start - Math.PI));
  if (off > 1e-3 || drift > 1e-6) problems++;
  console.log(`  Laplace-vinkelen ${deg(start).toFixed(4)}° (skal være 180°), drift ${drift.toExponential(1)} rad${off > 1e-3 || drift > 1e-6 ? '  <-- FEIL' : ''}`);

  // Saturns ring sett fra sola: hvor mange grader den er åpen (positivt = sola
  // lyser på nordsiden). På ringplanpasseringen 23.03.2025 skal den stå nesten
  // på kanten; modellen bruker middellengder, så det er noen grader slingring.
  // Ved sommersolverv i nord (24.05.2017) skal sola lyse på nordsiden.
  const ringOpening = (iso) => {
    const years = (new Date(iso) - M.startDate) / 86400000 / daysPerYear;
    const x = anglesAt(years * inputPerYear);
    const sat = x.planetAngles.saturn;
    const pole = sat + x.saturnFrameAngle + saturnAxis.direction;
    return (Math.asin(Math.sin(saturnAxis.tilt) * Math.cos(sat + Math.PI - pole)) * 180) / Math.PI;
  };
  const crossing = ringOpening('2025-03-23'), solstice = ringOpening('2017-05-24');
  const ringOk = Math.abs(crossing) <= 5 && solstice > 15;
  if (!ringOk) problems++;
  console.log(`  Saturns ring sett fra sola: ${crossing.toFixed(1)}° åpen 23.03.2025 (ringplanpassering, skal være nær 0), ${solstice.toFixed(1)}° 24.05.2017 (skal være stor og positiv: nordsiden)${ringOk ? '' : '  <-- FEIL'}`);

  // Mars' ekvatorplan sett fra sola: nær 0 ved nordlig vårjevndøgn på Mars
  // (12.11.2024, Ls 0) og stort og positivt ved nordlig sommersolverv
  // (12.07.2023, Ls 90). Mars-banen er elliptisk, så middellengden kan være
  // opptil ca. 10° fra den ekte; toleransen er 6°.
  const marsSun = (iso) => {
    const years = (new Date(iso) - M.startDate) / 86400000 / daysPerYear;
    const x = anglesAt(years * inputPerYear);
    const mars = x.planetAngles.mars;
    const pole = mars + x.marsFrameAngle + marsAxis.direction;
    return (Math.asin(Math.sin(marsAxis.tilt) * Math.cos(mars + Math.PI - pole)) * 180) / Math.PI;
  };
  const marsEquinox = marsSun('2024-11-12'), marsSolstice = marsSun('2023-07-12');
  const marsOk = Math.abs(marsEquinox) <= 6 && marsSolstice > 15;
  if (!marsOk) problems++;
  console.log(`  Sola sett fra Mars' ekvator: ${marsEquinox.toFixed(1)}° 12.11.2024 (vårjevndøgn, skal være nær 0), ${marsSolstice.toFixed(1)}° 12.07.2023 (sommersolverv i nord, skal være stor og positiv)${marsOk ? '' : '  <-- FEIL'}`);

  // Uranus' ringer sett fra sola: på kanten ved jevndøgn (07.12.2007), og nesten
  // rett mot sola ved solverv (sydpolen mot sola i 1985). Middellengder, så det
  // er noen grader slingring.
  const uranusSun = (iso) => {
    const years = (new Date(iso) - M.startDate) / 86400000 / daysPerYear;
    const x = anglesAt(years * inputPerYear);
    const ur = x.planetAngles.uranus;
    const pole = ur + x.uranusFrameAngle + uranusAxis.direction;
    return (Math.asin(Math.sin(uranusAxis.tilt) * Math.cos(ur + Math.PI - pole)) * 180) / Math.PI;
  };
  const uranusEquinox = uranusSun('2007-12-07'), uranusSolstice = uranusSun('1985-12-01');
  const uranusOk = Math.abs(uranusEquinox) <= 5 && Math.abs(uranusSolstice) > 60;
  if (!uranusOk) problems++;
  console.log(`  Uranus' ringer sett fra sola: ${uranusEquinox.toFixed(1)}° 07.12.2007 (jevndøgn, skal være nær 0), ${uranusSolstice.toFixed(1)}° 01.12.1985 (solverv, skal være over 60° fra ringplanet)${uranusOk ? '' : '  <-- FEIL'}`);
}

// ---------- 3: kollisjoner ----------
console.log('');
const H = bodies.height, d = drive.distance, armT = arm.thickness, mT = moonTrain.thickness;
const rise = armStyle.hubRise, cH = armStyle.collarHeight;
const tipOf = (m, n) => (m * n) / 2 + m;
const rootOf = (m, n) => (m * n) / 2 - 1.25 * m;
const sTip = (r, chain) => r + chain.rollerRadius * 1.3;
const plateEnd = (chain) => chain.rollerRadius * 1.25;
const chainBand = (y) => [y - 0.29, y + mT + 0.29];
const around = (dist, r) => [dist - r, dist + r];
const radiusOf = (name) => (name === 'earth' ? bodies.earthRadius : planets[name].radius);
const teethFor = (name) => (name === 'earth' ? [smallGear.teeth, bigGear.teeth]
  : [planets[name].driveTeeth ?? planets[name].layTeeth ?? planets[name].counterTeeth, planets[name].tubeTeeth]);
// Akselen i tårnet som driver røret: mellomakselen, forlegsakselen eller motakselen.
const shaftOf = (name) => (name === 'earth' ? 'drive' : planets[name].layTeeth ? 'lay' : planets[name].counterTeeth ? 'counter' : 'drive');
const fixedTip = tipOf(moonTrain.module, moonTrain.fixed.teeth);
const parallelTip = sTip(parallelChain.radius1, parallelChain);
const bigSprocketReach = sTip(moonChain.radius1, moonChain);                       // 47-hjulet ved pinionen
const endReach = (name) => Math.max(sTip(moonChain.radius2, moonChain), mechanismOf(name) === 'moons+parallel' ? sTip(parallelChain.radius2, parallelChain) : 0);
const laneReach = (name) => (mechanismOf(name) === 'moons+parallel' ? sTip(parallelChain.radius2, parallelChain) : sTip(moonChain.radius2, moonChain));
const vReserve = (name) => {
  const s = moonSystems[name];
  if (!s) return 0;
  const ringV = s.ring ? s.ring.outer * Math.sin(s.ring.tilt) + 0.3 : 0;
  const moonV = Math.max(0, ...s.orbits.map((o) => o.radius)) + 0.5;
  return Math.max(ringV, moonV);
};

// ---------- A: områder som gjelder for alle vinkler ----------
const parts = [];
const add = (body, name, r0, r1, y0, y1, extra = {}) => parts.push({ body, name, r: [Math.max(0, r0), r1], y: [y0, y1], ...extra });

// Fast
add('fixed', 'sentralaksel', 0, center.axleRadius, 0, H, { tube: true });
add('fixed', 'sola', 0, bodies.sunRadius, H - bodies.sunRadius, H + bodies.sunRadius);
let bracketTop = 0;
for (const t of tubes.filter((t) => t.fixed)) {
  const top = t.name === 'fixed' ? h.fixedTop : h.stack[t.owner].fixedTop;
  add('fixed', `fast rør ${t.owner}`, t.inner, t.outer, h.bottom[t.name], top, { tube: true });
  add('fixed', `brakett ${t.owner}`, t.outer, d + arm.width * 0.375, h.bottom[t.name], h.bottom[t.name] + armT);
  bracketTop = Math.max(bracketTop, h.bottom[t.name] + armT);
  const s = h.stack[t.owner];
  add('fixed', `fast hjul ${t.owner}${t.owner === 'earth' ? '' : ' (reservert)'}`, t.outer, fixedTip, s.level1, s.level1 + mT, { mesh: [`stack-${t.owner}`] });
  if (s.parallel) add('fixed', `fast kjedehjul ${t.owner}${t.owner === 'earth' ? '' : ' (reservert)'}`, t.outer, parallelTip, s.parallel, s.parallel + mT, { mesh: [`stack-${t.owner}`] });
}
add('fixed', 'brakettstolpe', ...around(d, arm.width * 0.3), 0, bracketTop);

// Aksler i tårnet (står stille, men hjulene dreier på stedet)
add('drive', 'mellomaksel', ...around(d, drive.shaftRadius), 0, h.driveTop);
add('lay', 'forlegsaksel', ...around(d, drive.shaftRadius), 0, h.driveTop);
for (const name of order) {
  const [c, t] = teethFor(name);
  const m = pairModule(c, t);
  add(shaftOf(name), `hjul for ${name}`, ...around(d, tipOf(m, c)), h.bottom[name], h.bottom[name] + gear.thickness, { mesh: [`tubegear-${name}`] });
}
// Motakselen og hjul nr. 2 på Saturn-røret, som driver den.
const counterModule = pairModule(CD.shaftTeeth, CD.saturnTeeth);
if (M.usesCounter) {
  const y2 = h.counterGear;
  add('counter', 'motaksel', ...around(d, drive.shaftRadius), 0, h.driveTop);
  add('counter', 'hjul fra Saturn-røret', ...around(d, tipOf(counterModule, CD.shaftTeeth)), y2, y2 + gear.thickness, { mesh: ['tubegear-saturn2'] });
  add('saturn', 'rørhjul 2', tube.saturn.outer, tipOf(counterModule, CD.saturnTeeth), y2, y2 + gear.thickness, { id: 'tubegear-saturn2' });
}
// De to kjedene nederst og det løse hjulet på sentralakselen
add('drive', 'lite kjedehjul', ...around(d, sTip(driveChain.radius1, driveChain)), h.driveChain, h.driveChain + mT);
add('idler', 'stort løst kjedehjul', center.axleRadius, sTip(driveChain.radius2, driveChain), h.driveChain, h.driveChain + mT);
add('idler', 'nav på løst hjul', center.axleRadius, idlerHub, h.driveChain + mT, h.layChain);
add('idler', 'lite løst kjedehjul', center.axleRadius, sTip(layChain.radius1, layChain), h.layChain, h.layChain + mT);
add('lay', 'kjedehjul på forlegsakselen', ...around(d, sTip(layChain.radius2, layChain)), h.layChain, h.layChain + mT);
for (const [body, chain, frame, y, name] of [
  ['driveChain', driveChain, driveFrame, h.driveChain, 'kjede til sentralakselen'],
  ['layChain', layChain, layFrame, h.layChain, 'kjede til forlegsakselen'],
]) {
  let lo = Infinity, hi = 0;
  const L = chain.links * chain.pitch, a = frame.angle;
  for (let u = 0; u < L; u += 0.05) {
    const p = chain.point(u);
    const x = frame.origin.x + p.x * Math.cos(a) - p.y * Math.sin(a), yy = frame.origin.y + p.x * Math.sin(a) + p.y * Math.cos(a);
    const r = Math.hypot(x, yy); lo = Math.min(lo, r); hi = Math.max(hi, r);
  }
  add(body, name, lo - plateEnd(chain), hi + plateEnd(chain), ...chainBand(y));
}

// Planetene (og jorda)
for (const name of order) {
  const t = tube[name], L = armLengths[name], y = h.arm[name], top = y + armT;
  const part = name === 'earth' ? AP.earth : AP.planet;
  const [c, tt] = teethFor(name);
  const m = pairModule(c, tt);
  add(name, 'rør', t.inner, t.outer, h.bottom[name], y, { tube: true });
  add(name, 'rørhjul', t.outer, tipOf(m, tt), h.bottom[name], h.bottom[name] + gear.thickness, { id: `tubegear-${name}` });
  add(name, 'nav', t.outer, t.outer + 1, y - rise, top + rise, { tube: true });
  add(name, 'arm', t.outer, L + part.endRadius, y, top);
  add(name, 'krage og rød ring', ...around(L, part.collarRadius), top, top + cH);
  const s = h.stack[name];
  if (name === 'earth') continue;
  const r = radiusOf(name);
  add(name, 'stolpe', ...around(L, part.postRadius), top, H);
  add(name, 'kule', ...around(L, r), H - r, H + r);
  if (['moonDrive', 'ringMoons', 'epicyclic', 'parallelMoons', 'idlerMoon'].includes(mechanismOf(name))) continue; // Jupiter, Saturn, Mars, Uranus og Neptun, under
  if (s) add(name, 'reservert stabel', t.outer + 1, L + endReach(name), s.level1, s.pinionTop, { id: `stack-${name}` });
  const env = moonSystems[name].envelope;
  if (env > 0) add(name, 'reservert plass til måner/ring', ...around(L, env), s ? s.moonArm : top, H + vReserve(name));
}
// Jupiters måner: månerøret i midten, og kjedet og hjulverket som går med
// armen. Det som går rundt seg imellom ved Jupiter, sjekkes i C.
const chainRange = (chain, c = { x: 0, y: 0 }) => {
  let lo = Infinity, hi = 0;
  for (let u = 0; u < chain.links * chain.pitch; u += 0.05) {
    const p = chain.point(u), r = Math.hypot(p.x - c.x, p.y - c.y);
    lo = Math.min(lo, r); hi = Math.max(hi, r);
  }
  return [lo - plateEnd(chain), hi + plateEnd(chain)];
};
const jS = h.stack.jupiter, jL = armLengths.jupiter, jDrive = tube['drive-jupiter'];
const jDriveModule = pairModule(JM.driveTeeth, JM.tubeTeeth);
const jLowest = jS.moonArm[jMoons.at(-1)] - rise;
{
  const y0 = h.bottom['drive-jupiter'];
  add('drive', 'hjul for månerøret', ...around(d, tipOf(jDriveModule, JM.driveTeeth)), y0, y0 + gear.thickness, { mesh: ['tubegear-jupiterDrive'] });
  add('jupiterDrive', 'månerør', jDrive.inner, jDrive.outer, y0, jS.tubeTop, { tube: true });
  add('jupiterDrive', 'rørhjul', jDrive.outer, tipOf(jDriveModule, JM.tubeTeeth), y0, y0 + gear.thickness, { id: 'tubegear-jupiterDrive' });
  add('jupiterDrive', 'kjedehjul på månerøret', jDrive.outer, sTip(jupiterChain.radius1, jupiterChain), jS.chain, jS.chain + mT, { mesh: ['jupiterkjede'] });
  add('jupiter', 'kjede til månene', ...chainRange(jupiterChain), ...chainBand(jS.chain), { id: 'jupiterkjede' });
  add('jupiter', 'krage og forlegsaksel med hjul', ...around(jL, JT.reach), jS.chain - 0.29, jS.layTop);
  add('jupiter', 'månerør, månearmer og måner', ...around(jL, moonSystems.jupiter.envelope), jLowest, H + vReserve('jupiter'));
}
// Saturn: månerøret og par-saturn i midten, kjedene langs armen, og alt ved
// Saturn (ringen, månene og hjulkassen) som ett område rundt stolpen. Det som
// går rundt seg imellom ved Saturn, sjekkes i D.
const sS = h.stack.saturn, sL = armLengths.saturn;
const sDrive = tube['drive-saturn'], sPar = tube['par-saturn'];
const sDriveModule = pairModule(SMc.driveTeeth, SMc.tubeTeeth);
const sParModule = pairModule(SMc.parallel.layTeeth, SMc.parallel.tubeTeeth);
const saturnEnvelope = sL - reach.saturn.inner;
// Hvor høyt over Saturns sentrum ringen og månene rekker (aksen heller, så de går opp og ned).
const saturnTopV = Math.max(
  ST.ring.outer * Math.sin(saturnAxis.tilt) + 0.3,
  ...Object.values(ST.arms).map((m) => m.orbit * Math.sin(saturnAxis.tilt) + m.s * Math.cos(saturnAxis.tilt) + m.radius + 0.3),
);
const saturnLow = sS.bracket - saturnBracket.radius - 0.1;  // det laveste ved Saturn over kjedene (braketten)
{
  const yD = h.bottom['drive-saturn'], yP = h.bottom['par-saturn'];
  add('drive', 'hjul for månerøret til Saturn', ...around(d, tipOf(sDriveModule, SMc.driveTeeth)), yD, yD + gear.thickness, { mesh: ['tubegear-saturnDrive'] });
  add('lay', 'hjul for par-saturn', ...around(d, tipOf(sParModule, SMc.parallel.layTeeth)), yP, yP + gear.thickness, { mesh: ['tubegear-saturnPar'] });
  add('saturnDrive', 'månerør', sDrive.inner, sDrive.outer, yD, sS.driveTubeTop, { tube: true });
  add('saturnDrive', 'rørhjul', sDrive.outer, tipOf(sDriveModule, SMc.tubeTeeth), yD, yD + gear.thickness, { id: 'tubegear-saturnDrive' });
  add('saturnDrive', 'kjedehjul på månerøret', sDrive.outer, sTip(saturnChain.radius1, saturnChain), sS.chain, sS.chain + mT, { mesh: ['saturnkjede'] });
  add('saturnPar', 'par-saturn', sPar.inner, sPar.outer, yP, sS.parTubeTop, { tube: true });
  add('saturnPar', 'rørhjul', sPar.outer, tipOf(sParModule, SMc.parallel.tubeTeeth), yP, yP + gear.thickness, { id: 'tubegear-saturnPar' });
  add('saturnPar', 'kjedehjul på par-saturn', sPar.outer, sTip(saturnParallelChain.radius1, saturnParallelChain), sS.parallel, sS.parallel + mT, { mesh: ['saturnparallell'] });
  add('saturn', 'månekjede', ...chainRange(saturnChain), ...chainBand(sS.chain), { id: 'saturnkjede' });
  add('saturn', 'parallellkjede', ...chainRange(saturnParallelChain), ...chainBand(sS.parallel), { id: 'saturnparallell' });
  add('saturn', 'Saturn med ring, måner og hjulkasse', ...around(sL, saturnEnvelope), saturnLow, H + saturnTopV);
}
// Mars: som Saturn. Månerøret og par-mars drives begge fra mellomakselen.
const mS = h.stack.mars, mL = armLengths.mars;
const mDrive = tube['drive-mars'], mPar = tube['par-mars'];
const mDriveModule = pairModule(MMc.driveTeeth, MMc.tubeTeeth);
const mParModule = pairModule(MMc.parallel.driveTeeth, MMc.parallel.tubeTeeth);
const marsEnvelope = mL - reach.mars.inner;
const marsTopV = Math.max(MT.axleSpan[1], MT.radius,
  ...Object.values(MT.arms).map((m) => m.orbit * Math.sin(marsAxis.tilt) + m.radius)) + 0.3;
const marsLow = mS.bracket - 2 * marsBracket.radius - 0.1;  // det laveste ved Mars over kjedene (braketten)
{
  const yD = h.bottom['drive-mars'], yP = h.bottom['par-mars'];
  add('drive', 'hjul for månerøret til Mars', ...around(d, tipOf(mDriveModule, MMc.driveTeeth)), yD, yD + gear.thickness, { mesh: ['tubegear-marsDrive'] });
  add('drive', 'hjul for par-mars', ...around(d, tipOf(mParModule, MMc.parallel.driveTeeth)), yP, yP + gear.thickness, { mesh: ['tubegear-marsPar'] });
  add('marsDrive', 'månerør', mDrive.inner, mDrive.outer, yD, mS.driveTubeTop, { tube: true });
  add('marsDrive', 'rørhjul', mDrive.outer, tipOf(mDriveModule, MMc.tubeTeeth), yD, yD + gear.thickness, { id: 'tubegear-marsDrive' });
  add('marsDrive', 'kjedehjul på månerøret', mDrive.outer, sTip(marsChain.radius1, marsChain), mS.chain, mS.chain + mT, { mesh: ['marskjede'] });
  add('marsPar', 'par-mars', mPar.inner, mPar.outer, yP, mS.parTubeTop, { tube: true });
  add('marsPar', 'rørhjul', mPar.outer, tipOf(mParModule, MMc.parallel.tubeTeeth), yP, yP + gear.thickness, { id: 'tubegear-marsPar' });
  add('marsPar', 'kjedehjul på par-mars', mPar.outer, sTip(marsParallelChain.radius1, marsParallelChain), mS.parallel, mS.parallel + mT, { mesh: ['marsparallell'] });
  add('mars', 'månekjede', ...chainRange(marsChain), ...chainBand(mS.chain), { id: 'marskjede' });
  add('mars', 'parallellkjede', ...chainRange(marsParallelChain), ...chainBand(mS.parallel), { id: 'marsparallell' });
  add('mars', 'Mars med måner, planetgir og gaffel', ...around(mL, marsEnvelope), marsLow, H + marsTopV);
}
// Uranus: par-uranus (drevet fra motakselen) og månerøret drive-uranus (fra
// mellomakselen) i midten, de to kjedene langs armen, og alt ved Uranus (kula,
// ringene, månene, braketten og hjulene) som ett område rundt stolpen. Det ved
// Uranus sjekkes for seg i F.
const uS = h.stack.uranus, uL = armLengths.uranus, uPar = tube['par-uranus'], uDrive = tube['drive-uranus'];
const uParModule = pairModule(UPc.parallel.counterTeeth, UPc.parallel.tubeTeeth);
const uDriveModule = pairModule(UMc.driveTeeth, UMc.tubeTeeth);
const uranusEnvelope = uL - reach.uranus.inner;
// Ringene og månene står nesten loddrett (aksen ligger nesten vannrett).
const uranusTopV = Math.max(UT.ring.outer, UMT.moons.oberon.orbit + UMT.moons.oberon.radius) * Math.sin(uranusAxis.tilt) + 0.3;
const uranusLow = uS.bracket - uranusBracket.radius - uranusBracket.fillet - 0.1;  // braketten med den myke overgangen
{
  const yD = h.bottom['drive-uranus'];
  add('drive', 'hjul for månerøret til Uranus', ...around(d, tipOf(uDriveModule, UMc.driveTeeth)), yD, yD + gear.thickness, { mesh: ['tubegear-uranusDrive'] });
  add('uranusDrive', 'månerør', uDrive.inner, uDrive.outer, yD, uS.driveTubeTop, { tube: true });
  add('uranusDrive', 'rørhjul', uDrive.outer, tipOf(uDriveModule, UMc.tubeTeeth), yD, yD + gear.thickness, { id: 'tubegear-uranusDrive' });
  add('uranusDrive', 'kjedehjul på månerøret', uDrive.outer, sTip(uranusMoonChain.radius1, uranusMoonChain), uS.chain, uS.chain + mT, { mesh: ['uranuskjede'] });
  add('uranus', 'månekjede', ...chainRange(uranusMoonChain), ...chainBand(uS.chain), { id: 'uranuskjede' });
  const yP = h.bottom['par-uranus'];
  add('counter', 'hjul for par-uranus', ...around(d, tipOf(uParModule, UPc.parallel.counterTeeth)), yP, yP + gear.thickness, { mesh: ['tubegear-uranusPar'] });
  add('uranusPar', 'par-uranus', uPar.inner, uPar.outer, yP, uS.parTubeTop, { tube: true });
  add('uranusPar', 'rørhjul', uPar.outer, tipOf(uParModule, UPc.parallel.tubeTeeth), yP, yP + gear.thickness, { id: 'tubegear-uranusPar' });
  add('uranusPar', 'kjedehjul på par-uranus', uPar.outer, sTip(uranusParallelChain.radius1, uranusParallelChain), uS.parallel, uS.parallel + mT, { mesh: ['uranusparallell'] });
  add('uranus', 'parallellkjede', ...chainRange(uranusParallelChain), ...chainBand(uS.parallel), { id: 'uranusparallell' });
  add('uranus', 'Uranus med ringer, måner og brakett', ...around(uL, uranusEnvelope), uranusLow, H + uranusTopV);
}
// Neptun: månerøret drive-neptune i midten, kjedet langs armen, og alt ved
// Neptun (kragen, hjulene, Triton og føringsringen) som ett område rundt
// stolpen. Det ved Neptun sjekkes for seg i G.
const nS = h.stack.neptune, nL = armLengths.neptune, nDrive = tube['drive-neptune'];
const nDriveModule = pairModule(NMc.driveTeeth, NMc.tubeTeeth);
const neptuneEnvelope = nL - reach.neptune.inner;
const neptuneTopV = NMT.K + C.iceMoons.size.triton + 0.3;                     // Triton når den står høyest
{
  const yD = h.bottom['drive-neptune'];
  add('drive', 'hjul for månerøret til Neptun', ...around(d, tipOf(nDriveModule, NMc.driveTeeth)), yD, yD + gear.thickness, { mesh: ['tubegear-neptuneDrive'] });
  add('neptuneDrive', 'månerør', nDrive.inner, nDrive.outer, yD, nS.tubeTop, { tube: true });
  add('neptuneDrive', 'rørhjul', nDrive.outer, tipOf(nDriveModule, NMc.tubeTeeth), yD, yD + gear.thickness, { id: 'tubegear-neptuneDrive' });
  add('neptuneDrive', 'kjedehjul på månerøret', nDrive.outer, sTip(neptuneChain.radius1, neptuneChain), nS.chain, nS.chain + mT, { mesh: ['neptunkjede'] });
  add('neptune', 'kjede til Triton', ...chainRange(neptuneChain), ...chainBand(nS.chain), { id: 'neptunkjede' });
  add('neptune', 'Neptun med Triton, føringsring og hjul', ...around(nL, neptuneEnvelope), nS.chain - 0.29, H + neptuneTopV);
}
// Jordas hjulverk og det som står ved jorda
{
  const E = armLengths.earth, top = h.arm.earth + armT, s = h.stack.earth;
  const pinTip = tipOf(moonTrain.module, moonTrain.pinion.teeth);
  add('earth', 'pinion', ...around(layout.pinion.x, pinTip), s.level1, s.level1 + mT, { id: 'stack-earth' });
  add('earth', 'pinion-aksel', ...around(layout.pinion.x, moonTrain.pinion.holeRadius), top, s.pinionTop);
  add('earth', 'stort månekjedehjul', ...around(layout.pinion.x, sTip(moonChain.radius1, moonChain)), s.moonChain, s.moonChain + mT);
  const range = (chain) => { let lo = Infinity, hi = 0; for (let u = 0; u < chain.links * chain.pitch; u += 0.05) { const p = chain.point(u); const r = Math.hypot(p.x, p.y); lo = Math.min(lo, r); hi = Math.max(hi, r); } return [lo - plateEnd(chain), hi + plateEnd(chain)]; };
  add('earth', 'månekjede', ...range(moonChain), ...chainBand(s.moonChain));
  add('earth', 'parallellkjede', ...range(parallelChain), ...chainBand(s.parallel), { id: 'stack-earth' });
  add('earth', 'parallellhjul ved jorda', ...around(E, sTip(parallelChain.radius2, parallelChain)), s.parallel, s.parallel + mT);
  add('earth', 'månekjedehjul', ...around(E, sTip(moonChain.radius2, moonChain)), s.moonChain, s.moonChain + mT);
  add('earth', 'jordstolpe', ...around(E, AP.earth.postRadius), top, H);
  add('earth', 'jorda', ...around(E, bodies.earthRadius), H - bodies.earthRadius, H + bodies.earthRadius);
  add('earth', 'jordakse', ...around(E, (bodies.earthRadius + 1.5) * Math.sin(earthAxis.tilt) + 0.25), H - bodies.earthRadius - 0.6, H + bodies.earthRadius + 1.5);
  add('earth', 'månearm', ...around(E, bodies.moonOrbit + AP.moon.endRadius), h.moonArm, h.moonArm + armT);
  add('earth', 'hylse', ...around(E, bodies.moonOrbit + AP.moon.collarRadius), h.moonArm + armT, h.sleeveTop);
  add('earth', 'månestav', ...around(E, bodies.moonOrbit + 0.35), h.moonArm + 0.1, H + moonRing.maxLift);
  add('earth', 'ring', ...around(E, moonRing.radius + moonRing.halfWidth), h.ring - moonRing.maxLift - 0.3, h.ring + moonRing.maxLift + 0.3);
  add('earth', 'månen', ...around(E, bodies.moonOrbit + bodies.moonRadius), H - moonRing.maxLift - bodies.moonRadius, H + moonRing.maxLift + bodies.moonRadius);
}

const statics = new Set(['fixed', 'drive', 'lay', 'counter', 'idler', 'driveChain', 'layChain']);
const minA = {};
let failures = 0;
for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
  const a = parts[i], b = parts[j];
  if (a.body === b.body || (statics.has(a.body) && statics.has(b.body)) || meshes(a, b)) continue;
  const yGap = Math.max(a.y[0], b.y[0]) - Math.min(a.y[1], b.y[1]);
  const rGap = Math.max(a.r[0], b.r[0]) - Math.min(a.r[1], b.r[1]);
  const gap = Math.max(yGap, rGap);
  const allowed = a.tube && b.tube ? -1e-9 : 0.3 - 1e-6;
  const key = [a.body, b.body].sort().join('–');
  const rec = { gap, a: `${a.body} ${a.name}`, b: `${b.body} ${b.name}`, ok: gap >= allowed, by: yGap >= rGap ? 'høyde' : 'radius' };
  if (!rec.ok) { failures++; if (failures <= 20) console.log('FOR TETT (A):', rec.a, '↔', rec.b, rec.gap.toFixed(3), rec.by); }
  if (!(a.tube && b.tube) && (!minA[key] || gap < minA[key].gap)) minA[key] = rec;
}
problems += failures;
console.log(`A: ${parts.length} deler, ${failures} par for tette. Minste klaring per par av kropper (lager mellom rør ikke tatt med):`);
for (const [k, r] of Object.entries(minA).sort()) console.log(`  ${k.padEnd(20)} ${r.gap.toFixed(2).padStart(6)} (${r.by})  ${r.a} ↔ ${r.b}`);

// ---------- B: simulering i planet ----------
const rot = (p, ang) => ({ x: p.x * Math.cos(ang) - p.y * Math.sin(ang), y: p.x * Math.sin(ang) + p.y * Math.cos(ang) });
const circ = (p, r, y0, y1, tag) => ({ k: 'c', a: p, r, y0, y1, tag });
const caps = (p, q, r, y0, y1, tag) => ({ k: 's', a: p, b: q, r, y0, y1, tag });
const O = { x: 0, y: 0 };

function shapesAt(input) {
  const a = anglesAt(input);
  const S = {
    fixed: [], drive: [], lay: [], counter: [], idler: [], driveChain: [], layChain: [],
    jupiterDrive: [], saturnDrive: [], saturnPar: [], marsDrive: [], marsPar: [], uranusPar: [], uranusDrive: [], neptuneDrive: [],
  };
  {
    const yU = h.bottom['drive-uranus'], yN = h.bottom['drive-neptune'];
    S.drive.push(circ(layout.drive, tipOf(uDriveModule, UMc.driveTeeth), yU, yU + gear.thickness, 'hjul for uranusDrive'));
    S.uranusDrive.push(circ(O, tipOf(uDriveModule, UMc.tubeTeeth), yU, yU + gear.thickness, 'rørhjul uranusDrive'));
    S.uranusDrive.push(circ(O, sTip(uranusMoonChain.radius1, uranusMoonChain), uS.chain, uS.chain + mT, 'kjedehjul på månerøret til Uranus'));
    S.drive.push(circ(layout.drive, tipOf(nDriveModule, NMc.driveTeeth), yN, yN + gear.thickness, 'hjul for neptuneDrive'));
    S.neptuneDrive.push(circ(O, tipOf(nDriveModule, NMc.tubeTeeth), yN, yN + gear.thickness, 'rørhjul neptuneDrive'));
    S.neptuneDrive.push(circ(O, sTip(neptuneChain.radius1, neptuneChain), nS.chain, nS.chain + mT, 'kjedehjul på månerøret til Neptun'));
  }
  {
    const yP = h.bottom['par-uranus'];
    S.counter.push(circ(layout.counter, tipOf(uParModule, UPc.parallel.counterTeeth), yP, yP + gear.thickness, 'hjul for uranusPar'));
    S.uranusPar.push(circ(O, tipOf(uParModule, UPc.parallel.tubeTeeth), yP, yP + gear.thickness, 'rørhjul uranusPar'));
    S.uranusPar.push(circ(O, sTip(uranusParallelChain.radius1, uranusParallelChain), uS.parallel, uS.parallel + mT, 'kjedehjul på par-uranus'));
    if (M.usesCounter) {
      S.counter.push(circ(layout.counter, drive.shaftRadius, 0, h.driveTop, 'motaksel'));
      S.counter.push(circ(layout.counter, tipOf(counterModule, CD.shaftTeeth), h.counterGear, h.counterGear + gear.thickness, 'hjul for saturn2'));
    }
  }
  {
    const yD = h.bottom['drive-mars'], yP = h.bottom['par-mars'];
    S.drive.push(circ(layout.drive, tipOf(mDriveModule, MMc.driveTeeth), yD, yD + gear.thickness, 'hjul for marsDrive'));
    S.marsDrive.push(circ(O, tipOf(mDriveModule, MMc.tubeTeeth), yD, yD + gear.thickness, 'rørhjul marsDrive'));
    S.marsDrive.push(circ(O, sTip(marsChain.radius1, marsChain), mS.chain, mS.chain + mT, 'kjedehjul på månerøret til Mars'));
    S.drive.push(circ(layout.drive, tipOf(mParModule, MMc.parallel.driveTeeth), yP, yP + gear.thickness, 'hjul for marsPar'));
    S.marsPar.push(circ(O, tipOf(mParModule, MMc.parallel.tubeTeeth), yP, yP + gear.thickness, 'rørhjul marsPar'));
    S.marsPar.push(circ(O, sTip(marsParallelChain.radius1, marsParallelChain), mS.parallel, mS.parallel + mT, 'kjedehjul på par-mars'));
  }
  {
    const y0 = h.bottom['drive-jupiter'];
    S.drive.push(circ(layout.drive, tipOf(jDriveModule, JM.driveTeeth), y0, y0 + gear.thickness, 'hjul for jupiterDrive'));
    S.jupiterDrive.push(circ(O, tipOf(jDriveModule, JM.tubeTeeth), y0, y0 + gear.thickness, 'rørhjul jupiterDrive'));
    S.jupiterDrive.push(circ(O, sTip(jupiterChain.radius1, jupiterChain), jS.chain, jS.chain + mT, 'kjedehjul på månerøret'));
  }
  {
    const yD = h.bottom['drive-saturn'], yP = h.bottom['par-saturn'];
    S.drive.push(circ(layout.drive, tipOf(sDriveModule, SMc.driveTeeth), yD, yD + gear.thickness, 'hjul for saturnDrive'));
    S.saturnDrive.push(circ(O, tipOf(sDriveModule, SMc.tubeTeeth), yD, yD + gear.thickness, 'rørhjul saturnDrive'));
    S.saturnDrive.push(circ(O, sTip(saturnChain.radius1, saturnChain), sS.chain, sS.chain + mT, 'kjedehjul på månerøret til Saturn'));
    S.lay.push(circ(layout.lay, tipOf(sParModule, SMc.parallel.layTeeth), yP, yP + gear.thickness, 'hjul for saturnPar'));
    S.saturnPar.push(circ(O, tipOf(sParModule, SMc.parallel.tubeTeeth), yP, yP + gear.thickness, 'rørhjul saturnPar'));
    S.saturnPar.push(circ(O, sTip(saturnParallelChain.radius1, saturnParallelChain), sS.parallel, sS.parallel + mT, 'kjedehjul på par-saturn'));
  }
  S.fixed.push(circ(O, bodies.sunRadius, H - bodies.sunRadius, H + bodies.sunRadius, 'sola'));
  for (const t of tubes.filter((t) => t.fixed)) {
    const s = h.stack[t.owner];
    S.fixed.push(circ(O, fixedTip, s.level1, s.level1 + mT, `fast hjul ${t.owner}`));
    if (s.parallel) S.fixed.push(circ(O, parallelTip, s.parallel, s.parallel + mT, `fast kjedehjul ${t.owner}`));
    S.fixed.push(caps({ x: 0, y: t.outer }, { x: 0, y: d }, arm.width * 0.375, h.bottom[t.name], h.bottom[t.name] + armT, 'brakett'));
  }
  S.fixed.push(circ({ x: 0, y: d }, arm.width * 0.3, 0, bracketTop, 'brakettstolpe'));
  S.drive.push(circ(layout.drive, drive.shaftRadius, 0, h.driveTop, 'mellomaksel'));
  S.lay.push(circ(layout.lay, drive.shaftRadius, 0, h.driveTop, 'forlegsaksel'));
  for (const name of order) {
    const [c, t] = teethFor(name);
    const m = pairModule(c, t);
    const shaft = shaftOf(name);
    S[shaft].push(circ(layout[shaft], tipOf(m, c), h.bottom[name], h.bottom[name] + gear.thickness, `hjul for ${name}`));
  }
  S.drive.push(circ(layout.drive, sTip(driveChain.radius1, driveChain), h.driveChain, h.driveChain + mT, 'lite kjedehjul'));
  S.idler.push(circ(O, sTip(driveChain.radius2, driveChain), h.driveChain, h.driveChain + mT, 'stort løst kjedehjul'));
  S.idler.push(circ(O, idlerHub, h.driveChain + mT, h.layChain, 'nav på løst hjul'));
  S.idler.push(circ(O, sTip(layChain.radius1, layChain), h.layChain, h.layChain + mT, 'lite løst kjedehjul'));
  S.lay.push(circ(layout.lay, sTip(layChain.radius2, layChain), h.layChain, h.layChain + mT, 'kjedehjul på forlegsakselen'));
  for (const [key, chain, frame, y, off, tag] of [
    ['driveChain', driveChain, driveFrame, h.driveChain, a.driveChainOffset, 'kjede til sentralakselen'],
    ['layChain', layChain, layFrame, h.layChain, a.layChainOffset, 'kjede til forlegsakselen'],
  ]) {
    const [y0, y1] = chainBand(y);
    const w = (p) => { const q = rot(p, frame.angle); return { x: q.x + frame.origin.x, y: q.y + frame.origin.y }; };
    let prev = w(chain.point(off));
    for (let i = 1; i <= chain.links; i++) {
      const p = w(chain.point(off + i * chain.pitch));
      S[key].push(caps(prev, p, plateEnd(chain), y0, y1, tag));
      prev = p;
    }
  }
  for (const name of order) {
    const ang = name === 'earth' ? a.armAngle : a.planetAngles[name];
    const u = { x: Math.cos(ang), y: Math.sin(ang) };
    const at = (dist) => ({ x: u.x * dist, y: u.y * dist });
    const L = armLengths[name], y = h.arm[name], top = y + armT;
    const part = name === 'earth' ? AP.earth : AP.planet;
    const [c, t] = teethFor(name);
    const list = (S[name] = []);
    list.push(circ(O, tipOf(pairModule(c, t), t), h.bottom[name], h.bottom[name] + gear.thickness, `rørhjul ${name}`));
    list.push(caps(at(tube[name].outer + 1), at(L), part.rootHalf, y, top, 'arm'));
    list.push(circ(at(L), part.collarRadius, top, top + cH, 'krage'));
    if (name === 'earth') continue;
    const r = radiusOf(name);
    list.push(circ(at(L), part.postRadius, top, H, 'stolpe'));
    list.push(circ(at(L), r, H - r, H + r, 'kule'));
    const s = h.stack[name];
    if (mechanismOf(name) === 'moonDrive') {
      // Kjedet, forlegsakselen med hjul, kragen og månene, med de faktiske formene.
      const [y0, y1] = chainBand(s.chain);
      let prev = rot(jupiterChain.point(a.jupiterChainOffset), ang);
      for (let i = 1; i <= jupiterChain.links; i++) {
        const p = rot(jupiterChain.point(a.jupiterChainOffset + i * jupiterChain.pitch), ang);
        list.push(caps(prev, p, plateEnd(jupiterChain), y0, y1, 'jupiterkjede'));
        prev = p;
      }
      const lay = at(jupiterLayout.lay.x), post = at(L);
      list.push(circ(lay, JM.shaftRadius, top, s.layTop, 'forlegsaksel ved Jupiter'));
      list.push(circ(post, sTip(jupiterChain.radius2, jupiterChain), s.chain, s.chain + mT, 'kjedehjul på kragen'));
      list.push(circ(post, tipOf(JT.collar.module, JM.collarTeeth), s.collarGear, s.collarGear + JM.thickness, 'hjul på kragen'));
      list.push(circ(lay, tipOf(JT.collar.module, JM.collarPinion), s.collarGear, s.collarGear + JM.thickness, 'hjul på forlegsakselen'));
      const orbits = Object.fromEntries(moonSystems.jupiter.orbits.map((o) => [o.name, o]));
      for (const n of jMoons) {
        const m = JT.moons[n], g = s.moonGear[n], y = s.moonArm[n];
        list.push(circ(post, tipOf(m.module, m.moonTeeth), g, g + JM.thickness, `hjul til ${n}`));
        list.push(circ(lay, tipOf(m.module, m.layTeeth), g, g + JM.thickness, 'hjul på forlegsakselen'));
        list.push(circ(post, m.outer + 0.25, g, y + JM.armThickness + rise, `rør til ${n}`));
        const mAng = ang + a.jupiterMoonAngles[n], o = orbits[n];
        const mp = { x: post.x + Math.cos(mAng) * o.orbit, y: post.y + Math.sin(mAng) * o.orbit };
        list.push(caps(post, mp, AP.jupiterMoon.rootHalf, y, y + JM.armThickness, `månearm ${n}`));
        list.push(circ(mp, JM.postRadius, y + JM.armThickness, H, `stolpe ${n}`));
        list.push(circ(mp, o.radius, H - o.radius, H + o.radius, n));
      }
      continue;
    }
    if (mechanismOf(name) === 'epicyclic') {
      // Kjedene langs armen, kjedehjulene ved stolpen, og området rundt Mars.
      for (const [chain, off, y, tag] of [
        [marsChain, a.marsChainOffset, s.chain, 'marskjede'],
        [marsParallelChain, a.marsParChainOffset, s.parallel, 'marsparallell'],
      ]) {
        const [y0, y1] = chainBand(y);
        let prev = rot(chain.point(off), ang);
        for (let i = 1; i <= chain.links; i++) {
          const p = rot(chain.point(off + i * chain.pitch), ang);
          list.push(caps(prev, p, plateEnd(chain), y0, y1, tag));
          prev = p;
        }
      }
      list.push(circ(at(L), sTip(marsChain.radius2, marsChain), s.chain, s.chain + mT, 'kjedehjul på driveakselen'));
      list.push(circ(at(L), sTip(marsParallelChain.radius2, marsParallelChain), s.parallel, s.parallel + mT, 'kjedehjul på stolpen'));
      list.push(circ(at(L), marsEnvelope, marsLow, H + marsTopV, 'Mars med måner, planetgir og gaffel'));
      continue;
    }
    if (mechanismOf(name) === 'ringMoons') {
      // Kjedene langs armen, kjedehjulene ved stolpen, og området rundt Saturn.
      for (const [chain, off, y, tag] of [
        [saturnChain, a.saturnChainOffset, s.chain, 'saturnkjede'],
        [saturnParallelChain, a.saturnParChainOffset, s.parallel, 'saturnparallell'],
      ]) {
        const [y0, y1] = chainBand(y);
        let prev = rot(chain.point(off), ang);
        for (let i = 1; i <= chain.links; i++) {
          const p = rot(chain.point(off + i * chain.pitch), ang);
          list.push(caps(prev, p, plateEnd(chain), y0, y1, tag));
          prev = p;
        }
      }
      list.push(circ(at(L), sTip(saturnChain.radius2, saturnChain), s.chain, s.chain + mT, 'kjedehjul på driveakselen'));
      list.push(circ(at(L), sTip(saturnParallelChain.radius2, saturnParallelChain), s.parallel, s.parallel + mT, 'kjedehjul på stolpen'));
      list.push(circ(at(L), saturnEnvelope, saturnLow, H + saturnTopV, 'Saturn med ring, måner og hjulkasse'));
      continue;
    }
    if (mechanismOf(name) === 'parallelMoons') {
      // De to kjedene langs armen, kjedehjulene ved stolpen, og området rundt Uranus.
      for (const [chain, off, y, tag] of [
        [uranusMoonChain, a.uranusChainOffset, s.chain, 'uranuskjede'],
        [uranusParallelChain, a.uranusParChainOffset, s.parallel, 'uranusparallell'],
      ]) {
        const [y0, y1] = chainBand(y);
        let prev = rot(chain.point(off), ang);
        for (let i = 1; i <= chain.links; i++) {
          const p = rot(chain.point(off + i * chain.pitch), ang);
          list.push(caps(prev, p, plateEnd(chain), y0, y1, tag));
          prev = p;
        }
      }
      list.push(circ(at(L), sTip(uranusMoonChain.radius2, uranusMoonChain), s.chain, s.chain + mT, 'kjedehjul på driveakselen'));
      list.push(circ(at(L), sTip(uranusParallelChain.radius2, uranusParallelChain), s.parallel, s.parallel + mT, 'kjedehjul på stolpen'));
      list.push(circ(at(L), uranusEnvelope, uranusLow, H + uranusTopV, 'Uranus med ringer, måner og brakett'));
      continue;
    }
    if (mechanismOf(name) === 'idlerMoon') {
      // Kjedet langs armen, kragen, og området rundt Neptun (hjulene, Triton og føringsringen).
      const [y0, y1] = chainBand(s.chain);
      let prev = rot(neptuneChain.point(a.neptuneChainOffset), ang);
      for (let i = 1; i <= neptuneChain.links; i++) {
        const p = rot(neptuneChain.point(a.neptuneChainOffset + i * neptuneChain.pitch), ang);
        list.push(caps(prev, p, plateEnd(neptuneChain), y0, y1, 'neptunkjede'));
        prev = p;
      }
      list.push(circ(at(L), neptuneEnvelope, s.chainTop, H + neptuneTopV, 'Neptun med Triton, føringsring og hjul'));
      continue;
    }
    if (s) {
      list.push(caps(at(tube[name].outer + 1), at(L), laneReach(name), s.level1, s.pinionTop, `reservert stabel ${name}`));
      list.push(circ(at(layout.pinion.x), bigSprocketReach, s.level1, s.pinionTop, `reservert stabel ${name}`));
      list.push(circ(at(L), endReach(name), s.level1, s.pinionTop, `reservert stabel ${name}`));
    }
    const env = moonSystems[name].envelope;
    if (env > 0) list.push(circ(at(L), env, s ? s.moonArm : top, H + vReserve(name), 'reservert plass til måner/ring'));
  }
  // Hjul nr. 2 på Saturn-røret (til motakselen).
  if (M.usesCounter) S.saturn.push(circ(O, tipOf(counterModule, CD.saturnTeeth), h.counterGear, h.counterGear + gear.thickness, 'rørhjul saturn2'));
  // Jorda i detalj
  const A = a.armAngle, w = (p) => rot(p, A), e = w(layout.earth), s = h.stack.earth, top = h.arm.earth + armT;
  const Se = S.earth;
  const pin = w(layout.pinion);
  Se.push(circ(pin, tipOf(moonTrain.module, moonTrain.pinion.teeth), s.level1, s.level1 + mT, 'pinion'));
  Se.push(circ(pin, moonTrain.pinion.holeRadius, top, s.pinionTop, 'pinion-aksel'));
  Se.push(circ(pin, sTip(moonChain.radius1, moonChain), s.moonChain, s.moonChain + mT, 'stort månekjedehjul'));
  for (const [chain, off, y, tag] of [[moonChain, a.moonChainOffset, s.moonChain, 'månekjede'], [parallelChain, a.parallelChainOffset, s.parallel, 'parallellkjede']]) {
    const [y0, y1] = chainBand(y);
    let prev = w(chain.point(off));
    for (let i = 1; i <= chain.links; i++) { const p = w(chain.point(off + i * chain.pitch)); Se.push(caps(prev, p, plateEnd(chain), y0, y1, tag)); prev = p; }
  }
  Se.push(circ(e, sTip(parallelChain.radius2, parallelChain), s.parallel, s.parallel + mT, 'parallellhjul'));
  Se.push(circ(e, sTip(moonChain.radius2, moonChain), s.moonChain, s.moonChain + mT, 'månekjedehjul'));
  Se.push(circ(e, AP.earth.postRadius, top, H, 'jordstolpe'));
  Se.push(circ(e, bodies.earthRadius, H - bodies.earthRadius, H + bodies.earthRadius, 'jorda'));
  const mAng = A + a.moonAngle, v = { x: Math.cos(mAng), y: Math.sin(mAng) };
  const mp = { x: e.x + v.x * bodies.moonOrbit, y: e.y + v.y * bodies.moonOrbit };
  const lift = moonLift(a);
  Se.push(caps(e, mp, AP.moon.rootHalf, h.moonArm, h.moonArm + armT, 'månearm'));
  Se.push(circ(mp, AP.moon.collarRadius, h.moonArm + armT, h.moonArm + armT + cH, 'krage på hylsa'));
  Se.push(circ(mp, 0.8, h.moonArm + armT, h.sleeveTop, 'hylse'));
  Se.push(circ(mp, bodies.moonRadius, H + lift - bodies.moonRadius, H + lift + bodies.moonRadius, 'månen'));
  const pAng = A + a.parallelAngle + moonRing.node;
  for (let k = 0; k < 36; k++) {
    const psi = (k / 36) * Math.PI * 2;
    const p = { x: e.x + Math.cos(pAng + psi) * moonRing.radius, y: e.y + Math.sin(pAng + psi) * moonRing.radius };
    const z = h.ring + Math.tan(moonRing.tilt) * moonRing.radius * Math.sin(psi);
    Se.push(circ(p, moonRing.halfWidth + 0.05, z - 0.3, z + 0.3, 'ring'));
  }
  return S;
}

const seg = (s) => (s.k === 'c' ? [s.a, s.a] : [s.a, s.b]);
const allowedPair = (s, t) => {
  const tags = [s.tag, t.tag].sort().join('|');
  if (/^hjul for (\w+)\|rørhjul \1$/.test(tags)) return true;                         // hjulpar i inngrep
  if (tags === 'fast hjul earth|pinion' || tags === 'fast kjedehjul earth|parallellkjede') return true;
  if (tags === 'jupiterkjede|kjedehjul på månerøret') return true;                    // kjedet ligger rundt kjedehjulet
  if (tags === 'kjedehjul på månerøret til Saturn|saturnkjede') return true;
  if (tags === 'kjedehjul på par-saturn|saturnparallell') return true;
  if (tags === 'kjedehjul på månerøret til Mars|marskjede') return true;
  if (tags === 'kjedehjul på par-mars|marsparallell') return true;
  if (tags === 'kjedehjul på par-uranus|uranusparallell') return true;
  if (tags === 'kjedehjul på månerøret til Uranus|uranuskjede') return true;
  if (tags === 'kjedehjul på månerøret til Neptun|neptunkjede') return true;
  // Hvert kjede nederst ligger rundt sine egne kjedehjul og akslene de sitter på.
  const wraps = {
    'kjede til sentralakselen': ['mellomaksel', 'lite kjedehjul', 'stort løst kjedehjul'],
    'kjede til forlegsakselen': ['lite løst kjedehjul', 'forlegsaksel', 'kjedehjul på forlegsakselen'],
  };
  for (const [chain, list] of Object.entries(wraps)) for (const other of list) if (tags === [chain, other].sort().join('|')) return true;
  for (const n of order) if (new RegExp(`^fast (hjul|kjedehjul) ${n}\\|reservert stabel ${n}$`).test(tags)) return true;
  return false;
};
const minB = {};
// allowedPair avhenger bare av navnene på de to formene, så svaret huskes per navnepar.
const allowedCache = new Map();
const allowedCached = (s, t) => {
  const k = s.tag < t.tag ? `${s.tag}\n${t.tag}` : `${t.tag}\n${s.tag}`;
  let v = allowedCache.get(k);
  if (v === undefined) allowedCache.set(k, (v = allowedPair(s, t)));
  return v;
};
// Formene i en kropp samlet i grupper med samme høydebånd (alle leddene i et
// kjede ligger for eksempel i samme bånd), med en ramme rundt hver gruppe i
// planet. Regnet én gang per tidspunkt. check hopper over grupper i et annet
// høydebånd, og grupper som ligger lenger unna enn den minste avstanden som er
// funnet for de to kroppene. Den regner også avstanden før den spør om paret
// får ligge inntil hverandre. Ingen av delene endrer resultatet: det som hoppes
// over, kan ikke gi en mindre avstand enn den som allerede er funnet.
const groupCache = new WeakMap();
const groupsOf = (list) => {
  let g = groupCache.get(list);
  if (g) return g;
  const byBand = new Map();
  for (const s of list) {
    const k = `${s.y0}|${s.y1}`;
    let e = byBand.get(k);
    if (!e) byBand.set(k, (e = { y0: s.y0, y1: s.y1, x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, shapes: [] }));
    e.shapes.push(s);
    for (const p of seg(s)) {
      e.x0 = Math.min(e.x0, p.x - s.r); e.x1 = Math.max(e.x1, p.x + s.r);
      e.z0 = Math.min(e.z0, p.y - s.r); e.z1 = Math.max(e.z1, p.y + s.r);
    }
  }
  groupCache.set(list, (g = [...byBand.values()]));
  return g;
};
function check(S, A, B) {
  const key = A < B ? `${A}–${B}` : `${B}–${A}`;
  for (const ga of groupsOf(S[A])) for (const gb of groupsOf(S[B])) {
    if (Math.max(ga.y0, gb.y0) > Math.min(ga.y1, gb.y1)) continue;
    if (minB[key]) {
      const dx = Math.max(ga.x0 - gb.x1, gb.x0 - ga.x1, 0), dz = Math.max(ga.z0 - gb.z1, gb.z0 - ga.z1, 0);
      if (Math.hypot(dx, dz) >= minB[key].gap) continue;
    }
    for (const s of ga.shapes) for (const t of gb.shapes) {
      const [p, q] = seg(s), [r, u] = seg(t);
      const gap = segDist(p, q, r, u) - s.r - t.r;
      if (minB[key] && gap >= minB[key].gap) continue;   // kan ikke gi en mindre avstand
      if (allowedCached(s, t)) continue;
      // Delene skrives i fast rekkefølge (etter kroppen), så linjen er lik fra gang til gang.
      const [a, b] = A < B ? [`${A} ${s.tag}`, `${B} ${t.tag}`] : [`${B} ${t.tag}`, `${A} ${s.tag}`];
      minB[key] = { gap, a, b };
    }
  }
}

const moving = order;
const all = [...statics, ...moving, 'jupiterDrive', 'saturnDrive', 'saturnPar', 'marsDrive', 'marsPar', 'uranusPar', 'uranusDrive', 'neptuneDrive'];
const ang = (n, x) => (n === 'earth' ? x.armAngle : x.planetAngles[n]);
const rateOf = (n) => { const a0 = anglesAt(0), a1 = anglesAt(2 * Math.PI); return (ang(n, a1) - ang(n, a0)) / (2 * Math.PI); };
let samples = 0;
// 1) Hvert øyeblikk to armer står rett over hverandre, innenfor et vindu
for (let i = 0; i < moving.length; i++) for (let j = i + 1; j < moving.length; j++) {
  const A = moving[i], B = moving[j];
  const rel0 = ang(A, anglesAt(0)) - ang(B, anglesAt(0));
  const relRate = (rateOf(A) - rateOf(B)) * 2 * Math.PI;
  const count = Math.floor(Math.abs(relRate * WINDOW) / (2 * Math.PI));
  for (let k = 0; k < count; k++) for (const off of [-0.1, 0, 0.1]) {
    const t = (-(2 * Math.PI) * k * Math.sign(relRate) + off - rel0) / relRate;
    const S = shapesAt(2 * Math.PI * t);
    check(S, A, B);
    for (const st of statics) check(S, A, st), check(S, B, st);
    samples++;
  }
}
// 2) Tilfeldige tidspunkt, alle par. Tallene kommer fra en fast startverdi
// (mulberry32), så de er de samme hver gang og to kjøringer kan sammenlignes.
const random = ((seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
})(20261117);
for (let k = 0; k < RANDOM; k++) {
  const S = shapesAt(random() * 1e9);
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) check(S, all[i], all[j]);
  samples++;
}
console.log(`\nB: ${samples} tidspunkt (passeringer innen ${WINDOW} omdreininger + ${RANDOM} tilfeldige). Minste klaring i planet der delene overlapper i høyde:`);
for (const [k, r] of Object.entries(minB).sort()) console.log(`  ${k.padEnd(20)} ${r.gap.toFixed(2).padStart(6)}  ${r.a} ↔ ${r.b}${r.gap < 0.3 ? '  <-- FOR TETT' : ''}`);
problems += Object.values(minB).filter((r) => r.gap < 0.3).length;

// ---------- C: hjulverket ved Jupiter ----------
// Som A, men med avstander fra Jupiter-stolpen. Armen, stolpen, kula, kjedet og
// forlegsakselen står stille sett fra armen (hjulene på forlegsakselen dreier
// på stedet); kragen og de fire månerørene går rundt. Forlegsakselen står
// layDistance fra stolpen, så hjulene der får ringen layDistance ± tuppradius.
{
  const cParts = [];
  const addC = (body, name, r0, r1, y0, y1, extra = {}) => cParts.push({ body, name, r: [Math.max(0, r0), r1], y: [y0, y1], ...extra });
  const s = jS, armTopJ = h.arm.jupiter + armT, ld = JM.layDistance, R = planets.jupiter.radius;
  const jStatics = new Set(['arm', 'forlegg', 'kjede']);
  addC('arm', 'arm', 0, Infinity, h.arm.jupiter, armTopJ);
  addC('arm', 'krage og rød ring', 0, AP.planet.collarRadius, armTopJ, armTopJ + cH + accent.ringWidth);
  addC('arm', 'stolpe', 0, AP.planet.postRadius, armTopJ, H, { tube: true });
  addC('arm', 'Jupiter', 0, R, H - R, H + R);
  addC('kjede', 'kjede', chainRange(jupiterChain, jupiterLayout.post)[0], Infinity, ...chainBand(s.chain), { id: 'kjede' });
  addC('forlegg', 'forlegsaksel', ...around(ld, JM.shaftRadius), armTopJ, s.layTop);
  addC('forlegg', 'hjul for kragen', ...around(ld, tipOf(JT.collar.module, JM.collarPinion)), s.collarGear, s.collarGear + JM.thickness, { id: 'lay-krage' });
  addC('krage', 'krage', JT.collar.inner, JT.collar.outer, s.chain, s.collarGear + JM.thickness, { tube: true });
  addC('krage', 'kjedehjul', JT.collar.outer, sTip(jupiterChain.radius2, jupiterChain), s.chain, s.chain + mT, { mesh: ['kjede'] });
  addC('krage', 'hjul', JT.collar.outer, tipOf(JT.collar.module, JM.collarTeeth), s.collarGear, s.collarGear + JM.thickness, { mesh: ['lay-krage'] });
  for (const o of moonSystems.jupiter.orbits) {
    const n = o.name, m = JT.moons[n], g = s.moonGear[n], y = s.moonArm[n];
    addC('forlegg', `hjul for ${n}`, ...around(ld, tipOf(m.module, m.layTeeth)), g, g + JM.thickness, { id: `lay-${n}` });
    addC(n, 'rør', m.inner, m.outer, g, y, { tube: true });
    addC(n, 'hjul', m.outer, tipOf(m.module, m.moonTeeth), g, g + JM.thickness, { mesh: [`lay-${n}`] });
    addC(n, 'nav', m.outer, m.outer + 0.25, y - rise, y + JM.armThickness + rise, { tube: true });
    addC(n, 'arm', m.outer, o.orbit + AP.jupiterMoon.endRadius, y, y + JM.armThickness);
    addC(n, 'stolpe', ...around(o.orbit, JM.postRadius), y + JM.armThickness, H);
    addC(n, 'månen', ...around(o.orbit, o.radius), H - o.radius, H + o.radius);
  }
  const minC = {};
  let cFail = 0;
  for (let i = 0; i < cParts.length; i++) for (let j = i + 1; j < cParts.length; j++) {
    const a = cParts[i], b = cParts[j];
    if (a.body === b.body || (jStatics.has(a.body) && jStatics.has(b.body)) || meshes(a, b)) continue;
    const yGap = Math.max(a.y[0], b.y[0]) - Math.min(a.y[1], b.y[1]);
    const rGap = Math.max(a.r[0], b.r[0]) - Math.min(a.r[1], b.r[1]);
    const gap = Math.max(yGap, rGap);
    const allowed = a.tube && b.tube ? -1e-9 : 0.3 - 1e-6;
    const rec = { gap, a: `${a.body} ${a.name}`, b: `${b.body} ${b.name}`, by: yGap >= rGap ? 'høyde' : 'radius' };
    if (gap < allowed) { cFail++; if (cFail <= 20) console.log('FOR TETT (C):', rec.a, '↔', rec.b, gap.toFixed(3), rec.by); }
    const key = [a.body, b.body].sort().join('–');
    if (!(a.tube && b.tube) && (!minC[key] || gap < minC[key].gap)) minC[key] = rec;
  }
  problems += cFail;
  // Forlegsakselen står inne i kjedesløyfa: begge står stille sett fra armen.
  const layOk = JT.layToChain >= 0.3;
  if (!layOk) problems++;
  console.log(`\nC: Jupiter, ${cParts.length} deler, ${cFail} par for tette. Minste klaring per par (fra Jupiter-stolpen):`);
  for (const [k, r] of Object.entries(minC).sort()) console.log(`  ${k.padEnd(20)} ${r.gap.toFixed(2).padStart(6)} (${r.by})  ${r.a} ↔ ${r.b}`);
  console.log(`  forlegsaksel – kjede ${JT.layToChain.toFixed(2).padStart(6)} (i planet)${layOk ? '' : '  <-- FOR TETT'}`);
}

// ---------- D: alt ved Saturn, i 3D ----------
// Sett fra Saturn-stolpen (som står stille i rommet) dreier alt annet ved
// Saturn om sin egen akse: armen, kjedene og driveakselen om loddlinjen,
// forlegsakselen og hylsa om den skrå forlegsakselen, og båndene med stag,
// armer og måner om Saturns akse. Hver del er derfor et omdreiningslegeme om
// sin akse (en profil i planet gjennom aksen: rektangler og tykke streker), og
// det dekker alle vinkler. Braketten og platen står stille, og er staver.
// Avstanden mellom to deler med samme akse regnes i profilplanet; ellers fra
// punkter på overflaten av den ene til den andre, begge veier.
{
  const tl = saturnAxis.tilt, u = v(Math.sin(tl), Math.cos(tl), 0);
  const P = (x, s, z = 0) => saturnToPost(x, s, z);
  const LD = ST.layDistance, T = SMc.thickness, half = SMc.armThickness / 2;
  const Vax = makeAxis(v(0, 0, 0), v(0, 1, 0));   // loddlinjen gjennom stolpen
  const Uax = makeAxis(P(0, 0), u);                 // Saturns akse
  const Lax = makeAxis(P(LD, 0), u);                // den skrå forlegsakselen
  const dParts = [];
  const addD = (body, name, ax, shape, extra = {}) => dParts.push({ body, name, ax, shape, ...extra });

  // Saturn-armen og kjedene (dreier om loddlinjen sett fra stolpen).
  const armY = h.arm.saturn, armTopS = armY + armT, postR = AP.planet.postRadius;
  addD('arm', 'arm', Vax, rect(armY, armTopS, postR, 1e3), { tube: true });
  addD('arm', 'krage og rød ring', Vax, rect(armTopS, armTopS + cH + accent.ringWidth, postR, AP.planet.collarRadius), { tube: true });
  addD('arm', 'månekjede', Vax, rect(...chainBand(sS.chain), saturnChain.radius2 - plateEnd(saturnChain), 1e3), { id: 'kjede1' });
  addD('arm', 'parallellkjede', Vax, rect(...chainBand(sS.parallel), saturnParallelChain.radius2 - plateEnd(saturnParallelChain), 1e3), { id: 'kjede2' });
  // Driveakselen.
  // De koniske hjulene smalner mot toppen (mot toppunktet av kjeglen); de deles
  // i skiver, hver med den største tuppradiusen i skiva.
  const bevelSlices = (body, name, ax, mid, holeRadius, teeth, drop, extra) => {
    const n = 10, tip = tipOf(ST.bevel.module, teeth);
    for (let k = 0; k < n; k++) {
      const s0 = mid - T / 2 + (k * T) / n, s1 = s0 + T / n;
      addD(body, name, ax, rect(s0, s1, holeRadius, tip * (1 - (s0 - mid) / drop)), extra);
    }
  };
  addD('driveaksel', 'driveaksel', Vax, rect(armTopS, sS.shaftTop, 0, SMc.driveShaftRadius), { tube: true });
  addD('driveaksel', 'kjedehjul', Vax, rect(sS.chain, sS.chain + mT, SMc.driveShaftRadius, sTip(saturnChain.radius2, saturnChain)), { mesh: ['kjede1'] });
  bevelSlices('driveaksel', 'konisk hjul', Vax, sS.bevelGear, SMc.driveShaftRadius, ST.bevel.driveTeeth, ST.bevel.drop1, { id: 'bevel1' });
  // Stolpen med braketten, platen, akselen og kula (står stille).
  const frameOuter = SMc.driveShaftRadius + SMc.frameWall;
  addD('stolpe', 'kjedehjul', Vax, rect(sS.parallel, sS.parallel + mT, frameOuter, sTip(saturnParallelChain.radius2, saturnParallelChain)), { mesh: ['kjede2'] });
  addD('stolpe', 'stolperør', Vax, rect(sS.parallel, sS.frameTop, SMc.driveShaftRadius, frameOuter), { tube: true });
  const bp = saturnBracket.points;
  for (let i = 0; i < bp.length - 1; i++) addD('stolpe', `brakett ${i + 1}`, null, { kind: 'cap', a: bp[i], b: bp[i + 1], w: saturnBracket.radius });
  // Platen fram til lageret rundt forlegsakselen (lageret er med under).
  // Platen er en flat stang (tykkelse plateThickness, bredde det dobbelte); her
  // tre tynne staver side om side, som rekker like langt inn mot forlegsakselen.
  const plateW = ST.plateThickness, plateTip = LD - ST.plateBearing + 0.05 - plateW / 2;
  for (const z of [-plateW / 2, 0, plateW / 2]) {
    addD('stolpe', 'plate', null, { kind: 'cap', a: P(0, ST.level.plate, z), b: P(plateTip, ST.level.plate, z), w: plateW / 2 });
  }
  addD('stolpe', 'lager i platen', Lax, rect(ST.level.plate - plateW / 2, ST.level.plate + plateW / 2, SMc.shaftRadius, ST.plateBearing), { tube: true });
  addD('stolpe', 'aksel', Uax, rect(...ST.axleSpan, 0, SMc.axleRadius), { tube: true });
  addD('stolpe', 'Saturn', Uax, line(0, 0, 0, 0, ST.radius));
  // Forlegsakselen og hylsa.
  addD('forlegg', 'forlegsaksel', Lax, rect(...ST.laySpan, 0, SMc.shaftRadius), { tube: true });
  bevelSlices('forlegg', 'konisk hjul', Lax, ST.bevel.layGear, SMc.shaftRadius, ST.bevel.layTeeth, ST.bevel.drop2, { mesh: ['bevel1'] });
  for (const n of ['enceladus', 'titan']) {
    const p = ST.pairs[n], s = ST.level[n];
    addD('forlegg', `hjul for ${n}`, Lax, rect(s - T / 2, s + T / 2, SMc.shaftRadius, tipOf(p.module, p.lay)), { id: `lay-${n}` });
  }
  addD('hylse', 'hylse', Lax, rect(...ST.sleeveSpan, SMc.shaftRadius, ST.sleeve.outer), { tube: true });
  for (const n of ['titan2', 'iapetus']) {
    const p = ST.pairs[n], s = ST.level[n];
    addD('hylse', `hjul (${n})`, Lax, rect(s - T / 2, s + T / 2, ST.sleeve.outer, tipOf(p.module, p.lay)), { id: `hylse-${n}` });
  }
  // Båndene med rør, hjul, nav, stag, glass, månearm og måne.
  const gearsOn = { A: [['enceladus', 'lay-enceladus']], B: [['titan', 'lay-titan'], ['titan2', 'hylse-titan2']], C: [['iapetus', 'hylse-iapetus']] };
  const moonOn = { A: 'enceladus', B: 'titan', C: 'iapetus' };
  const ringHalf = C.saturnRing.thickness / 2;
  for (const b of ['C', 'B', 'A']) {
    const t = ST.tubeOf[b], hub = ST.hubs[b], band = ST.band[b];
    addD(b, 'rør', Uax, rect(...ST.tubeSpan[b], t.inner, t.outer), { tube: true });
    for (const [n, partner] of gearsOn[b]) {
      const p = ST.pairs[n], s = ST.level[n];
      addD(b, `hjul (${n})`, Uax, rect(s - T / 2, s + T / 2, t.outer, tipOf(p.module, p.tube)), { mesh: [partner] });
    }
    addD(b, 'nav', Uax, rect(hub.s - hub.length / 2, hub.s + hub.length / 2, t.outer, hub.radius));
    addD(b, 'stag', Uax, line(hub.s, hub.radius - 0.05, -ringHalf, hub.attach, ST.strutRadius));
    addD(b, 'glass', Uax, rect(-ringHalf, ringHalf, band.inner, band.outer), { glass: true });
    const n = moonOn[b], m = ST.arms[n];
    addD(b, `arm til ${n}`, Uax, rect(m.s - half, m.s + half, m.from - SMc.armWidth / 2, m.orbit));
    if (m.s > 0) {
      addD(b, `ledd til ${n}`, Uax, rect(ringHalf, m.s + half, m.from - SMc.legRadius, m.from + SMc.legRadius));
      addD(b, `fot til ${n}`, Uax, rect(ringHalf, ringHalf + 0.08, m.from - ST.footRadius, m.from + ST.footRadius));
    }
    addD(b, n, Uax, line(m.s, m.orbit, m.s, m.orbit, m.radius));
  }

  // Fugen mellom C og B og Cassinidelingen mellom B og A er smalere enn 0,3,
  // men regnes som lager mellom båndene (avtalt; bredden står i saturnRing).
  const gapsBetweenBands = [];
  problems += run3D('D', 'Saturn i 3D', dParts, (a, b) => {
    if (!(a.glass && b.glass)) return false;
    gapsBetweenBands.push(`${[a.body, b.body].sort().join('–')} ${distance(a, b).toFixed(2)}`);
    return true;
  });
  console.log(`  Glipen mellom glassbåndene (lager): ${gapsBetweenBands.join(', ')}`);
}

// ---------- E: alt ved Mars, i 3D ----------
// Som D: sett fra Mars-stolpen dreier armen, kjedene og driveakselen om
// loddlinjen, den skrå drivakselen og mellomhjulet om hver sin akse parallelt
// med Mars' akse, og bæreren (med planethjulene som en ring rundt aksen) og
// solhjulet om Mars' akse. Ringhjulet, skåla, tappen, braketten, akselen og
// Mars står stille.
{
  const tl = marsAxis.tilt, u = v(Math.sin(tl), Math.cos(tl), 0);
  const P = (x, s, z = 0) => marsToPost(x, s, z);
  const T = MMc.thickness, half = MMc.armThickness / 2, pl = MT.plateThickness, PG = MMc.planetary, mm = MT.module;
  const MD = MT.drive, dm = MD.module;
  const Vax = makeAxis(v(0, 0, 0), v(0, 1, 0));            // loddlinjen gjennom stolpen
  const Uax = makeAxis(P(0, 0), u);                          // Mars' akse
  const Dax = makeAxis(P(MD.distance, 0), u);                // den skrå drivakselen
  const Iax = makeAxis(P(MD.idler.x, 0, -MD.idler.z), u);    // mellomhjulet og tappen
  const eParts = [];
  const addE = (body, name, ax, shape, extra = {}) => eParts.push({ body, name, ax, shape, ...extra });

  // Mars-armen og kjedene.
  const armY = h.arm.mars, armTopM = armY + armT, postR = AP.planet.postRadius;
  addE('arm', 'arm', Vax, rect(armY, armTopM, postR, 1e3), { tube: true });
  addE('arm', 'krage og rød ring', Vax, rect(armTopM, armTopM + cH + accent.ringWidth, postR, AP.planet.collarRadius), { tube: true });
  addE('arm', 'månekjede', Vax, rect(...chainBand(mS.chain), marsChain.radius2 - plateEnd(marsChain), 1e3), { id: 'kjede1' });
  addE('arm', 'parallellkjede', Vax, rect(...chainBand(mS.parallel), marsParallelChain.radius2 - plateEnd(marsParallelChain), 1e3), { id: 'kjede2' });
  // Driveakselen opp til kryssleddet på toppen av stolpen.
  addE('driveaksel', 'driveaksel', Vax, rect(armTopM, mS.shaftTop, 0, MMc.driveShaftRadius), { tube: true, id: 'loddrett' });
  addE('driveaksel', 'kjedehjul', Vax, rect(mS.chain, mS.chain + mT, MMc.driveShaftRadius, sTip(marsChain.radius2, marsChain)), { mesh: ['kjede1'] });
  addE('driveaksel', 'kryssledd', Vax, line(mS.joint, 0, mS.joint, 0, MMc.jointRadius), { id: 'kardang' });
  // Stolpen med braketten, ringhjulet, skåla, tappen, akselen og Mars (står stille).
  const frameOuter = MMc.driveShaftRadius + MMc.frameWall;
  addE('stolpe', 'kjedehjul', Vax, rect(mS.parallel, mS.parallel + mT, frameOuter, sTip(marsParallelChain.radius2, marsParallelChain)), { mesh: ['kjede2'] });
  addE('stolpe', 'stolperør', Vax, rect(mS.parallel, mS.frameTop, MMc.driveShaftRadius, frameOuter), { tube: true });
  // Braketten starter på overflaten av stolperøret og slutter på utsiden av
  // ringhjulet. Stavene kortes inn med radiusen i endene, så den runde enden
  // ikke stikker inn i røret og ringhjulet (det som er inni dem, er dem).
  const bp = marsBracket.points.map((p) => v(p.x, p.y, p.z)), br = marsBracket.radius, last = bp.length - 1;
  const trimmed = bp.map((p, i) => (i === 0 ? plus(p, mul(unit(sub(bp[1], p)), br))
    : i === last ? plus(p, mul(unit(sub(bp[last - 1], p)), br)) : p));
  for (let i = 0; i < last; i++) addE('stolpe', `brakett ${i + 1}`, null, { kind: 'cap', a: trimmed[i], b: trimmed[i + 1], w: br });
  // De myke overgangene i endene: en kjegle fra 2 × radius ned til radius,
  // her som en sylinder med 2 × radius, fra overflaten og ut.
  for (const [a0, a1] of [[bp[0], bp[1]], [bp[last], bp[last - 1]]]) {
    addE('stolpe', 'myk overgang', makeAxis(a0, unit(sub(a1, a0))), rect(0, marsBracket.fillet, 0, 2 * br));
  }
  addE('stolpe', 'ringhjul', Uax, rect(MT.level.ringLayer - T / 2, MT.level.ringLayer + T / 2, MT.ring.tip, MT.ring.outer), { id: 'ring' });
  const bt = MMc.bowlThickness, wallTop = MT.level.ringLayer - T / 2;
  addE('stolpe', 'bunnen i skåla', Uax, rect(MT.level.bowl - bt / 2, MT.level.bowl + bt / 2, 0, MT.ring.outer));
  addE('stolpe', 'veggen i skåla', Uax, rect(MT.level.bowl + bt / 2, wallTop, MT.ring.outer - 0.2, MT.ring.outer));
  // Knasten ut fra ringhjulet (en flat stang i ringhjulets plan) og tappen opp til mellomhjulet.
  {
    // Knasten (tykkelse T, bredde 4 × tapp) som en sylinder rundt den, fra kanten av ringhjulet og ut.
    const ang = MD.idlerPhi, at = (r) => P(r * Math.cos(ang), MT.level.ringLayer, -r * Math.sin(ang));
    const lugR = Math.hypot(T / 2, 2 * MMc.pinRadius);
    addE('stolpe', 'knast', makeAxis(at(MT.ring.outer), unit(sub(at(MD.idlerRho), at(MT.ring.outer)))), rect(0, MD.idlerRho - MT.ring.outer + 2 * MMc.pinRadius, 0, lugR));
    addE('stolpe', 'tapp', Iax, rect(...MT.pinSpan, 0, MMc.pinRadius), { tube: true });
  }
  addE('stolpe', 'aksel', Uax, rect(...MT.axleSpan, 0, MMc.axleRadius), { tube: true });
  addE('stolpe', 'Mars', Uax, line(0, 0, 0, 0, MT.radius));
  // Den skrå drivakselen med det store hjulet (møter driveakselen i kryssleddet).
  addE('drivaksel', 'drivaksel', Dax, rect(...MT.driveShaftSpan, 0, MMc.tiltShaftRadius), { mesh: ['kardang', 'loddrett'] });
  addE('drivaksel', 'stort hjul', Dax, rect(MT.level.drive - T / 2, MT.level.drive + T / 2, MMc.tiltShaftRadius, tipOf(dm, MMc.drive.bigTeeth)), { id: 'stort' });
  // Mellomhjulet på tappen.
  addE('mellomhjul', 'mellomhjul', Iax, rect(MT.level.drive - T / 2, MT.level.drive + T / 2, MMc.pinRadius, tipOf(dm, MMc.drive.idlerTeeth)),
    { tube: true, mesh: ['stort', 'lite'] });
  // Bæreren: platene, pinnene og planethjulene (som en ring rundt aksen), det
  // lille hjulet, røret og Deimos.
  const c = MT.carrierRadius, spider = 0.35 / 2;
  addE('bærer', 'lite hjul', Uax, rect(MT.level.drive - T / 2, MT.level.drive + T / 2, MT.carrierTube.outer, tipOf(dm, MMc.drive.smallTeeth)), { id: 'lite' });
  addE('bærer', 'nedre plate', Uax, rect(MT.level.carrierBottom - pl / 2, MT.level.carrierBottom + pl / 2, MMc.axleRadius, c + spider), { tube: true });
  addE('bærer', 'øvre plate', Uax, rect(MT.level.carrierTop - pl / 2, MT.level.carrierTop + pl / 2, MT.carrierTube.inner, c + spider), { tube: true });
  addE('bærer', 'planethjul (sol)', Uax, rect(MT.level.sunLayer - T / 2, MT.level.sunLayer + T / 2, c - tipOf(mm, PG.planet1), c + tipOf(mm, PG.planet1)), { id: 'planet1' });
  addE('bærer', 'planethjul (ring)', Uax, rect(MT.level.ringLayer - T / 2, MT.level.ringLayer + T / 2, c - tipOf(mm, PG.planet2), c + tipOf(mm, PG.planet2)), { mesh: ['ring'] });
  addE('bærer', 'bærerrør', Uax, rect(...MT.carrierTubeSpan, MT.carrierTube.inner, MT.carrierTube.outer), { tube: true });
  // Solhjulet og Fobos.
  addE('sol', 'solhjul', Uax, rect(MT.level.sunLayer - T / 2, MT.level.sunLayer + T / 2, MT.sunTube.outer, tipOf(mm, PG.sun)), { mesh: ['planet1'] });
  addE('sol', 'solrør', Uax, rect(...MT.sunTubeSpan, MT.sunTube.inner, MT.sunTube.outer), { tube: true });
  for (const [body, name, tubeR] of [['bærer', 'deimos', MT.carrierTube.outer], ['sol', 'phobos', MT.sunTube.outer]]) {
    const m = MT.arms[name], hubR = tubeR + 0.15;
    addE(body, `nav til ${name}`, Uax, rect(m.s - MT.hubLength / 2, m.s + MT.hubLength / 2, tubeR, hubR));
    addE(body, `arm til ${name}`, Uax, rect(m.s - half, m.s + half, hubR - MMc.armWidth / 2, m.orbit + MMc.armWidth / 2));
    addE(body, `stolpe til ${name}`, Uax, rect(m.s + half, 0, m.orbit - MMc.postRadius, m.orbit + MMc.postRadius));
    addE(body, name, Uax, line(0, m.orbit, 0, m.orbit, m.radius));
  }
  // Mellomhjulet griper i det lille hjulet på bærerrøret, og tuppene går like
  // ved røret over og under det lille hjulet: klaringen der er den vanlige
  // mellom tuppene og foten på det lille hjulet, pluss foten minus røret.
  const idlerToTube = [];
  problems += run3D('E', 'Mars i 3D', eParts, (a, b) => {
    const names = [`${a.body} ${a.name}`, `${b.body} ${b.name}`].sort().join('|');
    if (names !== 'bærer bærerrør|mellomhjul mellomhjul') return false;
    idlerToTube.push(distance(a, b));
    return true;
  });
  const idlerRoom = rootOf(MT.drive.module, MMc.drive.smallTeeth) - MT.carrierTube.outer;
  console.log(`  Mellomhjulet mot bærerrøret ved siden av det lille hjulet: ${idlerToTube.map((d) => d.toFixed(2)).join(', ')} (foten på det lille hjulet står ${idlerRoom.toFixed(2)} utenfor røret)`);
}

// ---------- F: alt ved Uranus, i 3D ----------
// Sett fra Uranus-stolpen (som står stille i rommet) dreier armen, kjedene og
// driveakselen om loddlinjen, forlegsakselen om sin akse, og rørene til
// Titania og Oberon (med krage, stag, bein og måne) om Uranus' akse. Braketten,
// lagrene, polakselen, navet, ringene og kula står stille. Formene står i
// iceMoons.js (uranusParts), de samme som prøvesiden moons.html bruker.
{
  const fParts = toCheckParts(I.uranusParts(UMT));
  const gaps = [];
  const skip = (a, b) => {
    const pair = [`${a.body} ${a.name}`, `${b.body} ${b.name}`].sort().join('|');
    if (/^Uranus Uranus\|stolpe myk overgang ved polen/.test(pair)) return true;       // kula sitter i den myke overgangen
    if (/^ringer stag \d\|stolpe nav$/.test(pair)) return true;                         // stagene sitter i navet
    if (pair === 'forlegg forlegsaksel|stolpe brakett 2') return true;                   // akselen går inn i lageret i braketten
    // Ringene ligger tettere enn 0,3, men står stille sammen (som før).
    if (a.glass && b.glass) { gaps.push(distance(a, b)); return true; }
    return false;
  };
  problems += run3D('F', 'Uranus i 3D', fParts, skip);
  problems += checkMounts('Uranus', I.uranusParts(UMT), ['stolpe', 'ringer', 'Uranus', 'arm']);
}

// ---------- G: alt ved Neptun, i 3D ----------
// Sett fra Neptun-stolpen (som står fast på armen): kragen og Tritons rør
// dreier om stolpen, dobbelthjulet og mellomhjulet om tappene, og staven med
// foten og Triton i 36 stillinger rundt (de går opp og ned med føringsringen).
// Armen, kjedet, tappene, bøylen, navet, eikene og føringsringen står stille.
{
  const gParts = toCheckParts(I.neptuneParts(NMT, 36));
  const skip = (a, b) => {
    const pair = [`${a.body} ${a.name}`, `${b.body} ${b.name}`].sort().join('|');
    if (pair === 'Neptun Neptun|stolpe stolpe') return true;                               // stolpen går inn i kula
    if ((a.rests && b.guide) || (b.rests && a.guide)) return true;                         // tappen under foten hviler på ringen
    // Tuppen av hjulet på kragen går inn i tannluka på det nederste hjulet på tappen.
    return pair === 'forlegg hylse|krage hjul' || pair === 'krage hjul|stolpe tapp A';
  };
  problems += run3D('G', 'Neptun i 3D', gParts, skip);
  problems += checkMounts('Neptun', I.neptuneParts(NMT, 8), ['stolpe', 'Neptun']);
}

// ---------- Raske deler ----------
// Hvor mange grader de raskeste delene dreier per bilde ved startfarten
// (time.start dager per sekund) og 60 bilder per sekund. Over blur.threshold
// får de lysspor, vifte eller glatt form (blur.js). Bare til informasjon.
{
  const fps = 60, yearsPerFrame = C.time.start / daysPerYear / fps;
  const a0 = anglesAt(0), a1 = anglesAt(yearsPerFrame * inputPerYear * 1000);
  const perFrame = (f) => Math.abs((f(a1) - f(a0)) / 1000) * 180 / Math.PI;
  const rows = [
    ...jMoons.map((n) => [`${n} (arm)`, (x) => x.jupiterMoonAngles[n]]),
    ['Jupiter: forlegsaksel', (x) => x.jupiterLayAngle],
    ...['A', 'B', 'C'].map((b) => [`Saturn: bånd ${b} med stag`, (x) => x.saturnBands[b]]),
    ['Saturn: forlegsaksel', (x) => x.saturnLayAngle],
    ...mMoons.map((n) => [`${n} (arm)`, (x) => x.marsMoonAngles[n]]),
    ['Mars: planethjul', (x) => x.marsPlanetSpins[0]],
    ['Mars: drivaksel og stort hjul', (x) => x.marsDriveAngle],
    ['Mars: mellomhjul', (x) => x.marsIdlerAngle],
    ['Mars: lite hjul og bærer', (x) => x.marsCarrier],
    ['månen (arm)', (x) => x.moonAngle],
    ['kjede til Jupiters måner', (x) => x.jupiterChainOffset / jupiterChain.radius2],
    ['kjede til Saturns måner', (x) => x.saturnChainOffset / saturnChain.radius2],
    ['kjede til Mars\' måner', (x) => x.marsChainOffset / marsChain.radius2],
  ];
  console.log(`\nRaske deler ved ${C.time.start} dager/s og ${fps} bilder/s (grader per bilde; over ${C.blur.threshold}° tones lyssporet inn):`);
  for (const [name, f] of rows) {
    const deg = perFrame(f);
    const mark = deg > C.blur.threshold + C.blur.fade ? 'lysspor' : deg > C.blur.threshold ? 'delvis' : '';
    console.log(`  ${name.padEnd(28)} ${deg.toFixed(1).padStart(6)}°  ${mark}`);
  }
}

// ---------- Største radius ----------
// Hvor langt den ytterste delen rekker fra sentrum, og endringen siden forrige
// kjøring (lagret i scripts/lastCheck.json). Bare til informasjon, ingen grense.
{
  const { readFileSync, writeFileSync } = await import('node:fs');
  const file = new URL('./lastCheck.json', import.meta.url);
  const [outermost, r] = Object.entries(reach).reduce((best, e) => (e[1].outer > best[1].outer ? e : best));
  const largest = r.outer;
  let last = null;
  try { last = JSON.parse(readFileSync(file, 'utf8')).largestRadius; } catch { /* første kjøring */ }
  const change = last === null ? '' : `, forrige gang ${last.toFixed(2)}, ${largest - last >= 0 ? '+' : '−'}${Math.abs(largest - last).toFixed(2)}`;
  console.log(`\nStørste radius: ${largest.toFixed(2)} (${outermost}${change})`);
  writeFileSync(file, `${JSON.stringify({ largestRadius: Number(largest.toFixed(4)) }, null, 2)}\n`);
}

console.log(problems ? `\n${problems} problem(er) funnet.` : '\nAlt i orden.');
console.log(`Tid: ${((performance.now() - started) / 1000).toFixed(1)} s (${QUICK ? 'rask' : 'full'} sjekk).`);
process.exitCode = problems ? 1 : 0;
