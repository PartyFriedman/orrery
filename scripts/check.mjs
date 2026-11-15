// Sjekker at mekanismen henger sammen. Kjør med `npm run check`.
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
//         tilfeldige tidspunkt. Kontroll av A med de faktiske formene.
//      C: hjulverket ved Jupiter, med ringområder rundt Jupiter-stolpen: krage,
//         forlegsaksel, månerør, hjul, månearmer, stolper og måner.
//   Reservert plass (stabler over armene, måner og Saturns ring) er med.
//   Jupiters måner: omløpstidene, at de tre innerste går 4 : 2 : 1 sett fra
//   armen, og at Laplace-vinkelen (Io − 3 × Europa + 2 × Ganymedes) står stille.
//
// Bruk: node scripts/check.mjs [antall tilfeldige tidspunkt] [vindu for passeringer, i omdreininger]
// Standard er 20 000 og 2 000. Avslutter med feilkode hvis noe er galt.

const src = new URL('../src/', import.meta.url);
const RANDOM = Number(process.argv[2] ?? 20000);
const WINDOW = Number(process.argv[3] ?? 2000);
const C = await import(new URL('config.js', src).href);
const M = await import(new URL('mechanism.js', src).href);
const { daysPerYear } = await import(new URL('ephemeris.js', src).href);
const { drive, outerDrive, center, gear, bigGear, smallGear, arm, armStyle, planets, moonTrain, bodies, tilt, accent } = C;
const JM = C.jupiterMoons;
const {
  tube, tubes, heights: h, layout, anglesAt, pairModule, moonChain, parallelChain,
  driveChain, driveFrame, layChain, layFrame, idlerHub,
  moonRing, moonLift, earthAxis, armParts: AP, armLengths, moonSystems, mechanismOf, order, reach,
  jupiterChain, jupiterLayout, jupiterTrain: JT, worldAngleOf,
} = M;
const jMoons = planets.jupiter.moons;
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
    ]) { rollers += n; worst = Math.max(worst, w); }
  }
  let drift = 0;
  const w0 = anglesAt(0).armAngle + anglesAt(0).parallelAngle;
  for (let t = 0; t < 50; t += 0.37) {
    const a = anglesAt(t), d = a.armAngle + a.parallelAngle - w0;
    drift = Math.max(drift, Math.abs(Math.atan2(Math.sin(d), Math.cos(d))));
  }
  if (worst > 1e-6 || drift > 1e-9) problems++;
  console.log(`\nKjeder: ${rollers} ruller sjekket, største avvik fra setet ${worst.toExponential(1)}. Parallellhjulets drift ${drift.toExponential(1)} rad.`);
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
}

// ---------- 3: kollisjoner ----------
console.log('');
const H = bodies.height, d = drive.distance, armT = arm.thickness, mT = moonTrain.thickness;
const rise = armStyle.hubRise, cH = armStyle.collarHeight;
const tipOf = (m, n) => (m * n) / 2 + m;
const sTip = (r, chain) => r + chain.rollerRadius * 1.3;
const plateEnd = (chain) => chain.rollerRadius * 1.25;
const chainBand = (y) => [y - 0.29, y + mT + 0.29];
const around = (dist, r) => [dist - r, dist + r];
const radiusOf = (name) => (name === 'earth' ? bodies.earthRadius : planets[name].radius);
const teethFor = (name) => (name === 'earth' ? [smallGear.teeth, bigGear.teeth] : [planets[name].driveTeeth ?? planets[name].layTeeth, planets[name].tubeTeeth]);
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
  const body = name !== 'earth' && planets[name].layTeeth ? 'lay' : 'drive';
  add(body, `hjul for ${name}`, ...around(d, tipOf(m, c)), h.bottom[name], h.bottom[name] + gear.thickness, { mesh: [`tubegear-${name}`] });
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
  if (mechanismOf(name) === 'moonDrive') continue; // Jupiters hjulverk, under
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

const statics = new Set(['fixed', 'drive', 'lay', 'idler', 'driveChain', 'layChain']);
const meshes = (a, b) => (a.mesh ?? []).includes(b.id) || (b.mesh ?? []).includes(a.id);
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
  const S = { fixed: [], drive: [], lay: [], idler: [], driveChain: [], layChain: [], jupiterDrive: [] };
  {
    const y0 = h.bottom['drive-jupiter'];
    S.drive.push(circ(layout.drive, tipOf(jDriveModule, JM.driveTeeth), y0, y0 + gear.thickness, 'hjul for jupiterDrive'));
    S.jupiterDrive.push(circ(O, tipOf(jDriveModule, JM.tubeTeeth), y0, y0 + gear.thickness, 'rørhjul jupiterDrive'));
    S.jupiterDrive.push(circ(O, sTip(jupiterChain.radius1, jupiterChain), jS.chain, jS.chain + mT, 'kjedehjul på månerøret'));
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
    const lay = name !== 'earth' && planets[name].layTeeth;
    (lay ? S.lay : S.drive).push(circ(lay ? layout.lay : layout.drive, tipOf(m, c), h.bottom[name], h.bottom[name] + gear.thickness, `hjul for ${name}`));
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
    if (s) {
      list.push(caps(at(tube[name].outer + 1), at(L), laneReach(name), s.level1, s.pinionTop, `reservert stabel ${name}`));
      list.push(circ(at(layout.pinion.x), bigSprocketReach, s.level1, s.pinionTop, `reservert stabel ${name}`));
      list.push(circ(at(L), endReach(name), s.level1, s.pinionTop, `reservert stabel ${name}`));
    }
    const env = moonSystems[name].envelope;
    if (env > 0) list.push(circ(at(L), env, s ? s.moonArm : top, H + vReserve(name), 'reservert plass til måner/ring'));
  }
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

function segDist(p, q, r, s) {
  const d1 = { x: q.x - p.x, y: q.y - p.y }, d2 = { x: s.x - r.x, y: s.y - r.y }, w0 = { x: p.x - r.x, y: p.y - r.y };
  const a = d1.x * d1.x + d1.y * d1.y, b = d1.x * d2.x + d1.y * d2.y, c = d2.x * d2.x + d2.y * d2.y;
  const dd = d1.x * w0.x + d1.y * w0.y, e = d2.x * w0.x + d2.y * w0.y;
  const clamp = (x) => Math.max(0, Math.min(1, x));
  let sc = a > 0 ? clamp(-dd / a) : 0, tc = c > 0 ? clamp((b * sc + e) / c) : 0;
  sc = a > 0 ? clamp((b * tc - dd) / a) : 0;
  return Math.hypot(w0.x + sc * d1.x - tc * d2.x, w0.y + sc * d1.y - tc * d2.y);
}
const seg = (s) => (s.k === 'c' ? [s.a, s.a] : [s.a, s.b]);
const allowedPair = (s, t) => {
  const tags = [s.tag, t.tag].sort().join('|');
  if (/^hjul for (\w+)\|rørhjul \1$/.test(tags)) return true;                         // hjulpar i inngrep
  if (tags === 'fast hjul earth|pinion' || tags === 'fast kjedehjul earth|parallellkjede') return true;
  if (tags === 'jupiterkjede|kjedehjul på månerøret') return true;                    // kjedet ligger rundt kjedehjulet
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
function check(S, A, B) {
  for (const s of S[A]) for (const t of S[B]) {
    if (Math.max(s.y0, t.y0) > Math.min(s.y1, t.y1)) continue;
    if (allowedPair(s, t)) continue;
    const [p, q] = seg(s), [r, u] = seg(t);
    const gap = segDist(p, q, r, u) - s.r - t.r;
    const key = [A, B].sort().join('–');
    if (!minB[key] || gap < minB[key].gap) minB[key] = { gap, a: `${A} ${s.tag}`, b: `${B} ${t.tag}` };
  }
}

const moving = order;
const all = [...statics, ...moving, 'jupiterDrive'];
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
// 2) Tilfeldige tidspunkt, alle par
for (let k = 0; k < RANDOM; k++) {
  const S = shapesAt(Math.random() * 1e9);
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

console.log(problems ? `\n${problems} problem(er) funnet.` : '\nAlt i orden.');
process.exitCode = problems ? 1 : 0;
