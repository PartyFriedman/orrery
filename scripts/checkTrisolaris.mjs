// Sjekken for testsiden trisolaris.html: npm run check:trisolaris
// (node scripts/checkTrisolaris.mjs [tidspunkt per runde], standard 720).
// Alt regnes fra delelista i src/trisolarisDesign.js, den samme som tegnes.
//   1. Banen: solene regnet fra mekanikken (sveivene, planethjulene, tappene,
//      sleidene og utgangen) mot den eksakte åttetallsbanen, per variant, og
//      at solene aldri kommer nærmere hverandre enn klaringen.
//   2. Forholdene: planethjulene går 5 og 4 ganger så fort som θ, Y-sveiven 2,
//      og hjulene sitter fast på akslene sine (vinkelen mellom dem er fast).
//   3. Dreieretningene gjennom alle vinkelgirene (farten er lik der tennene møtes).
//   4. Klaringene mellom alle deler som ikke skal berøre hverandre, over en
//      runde (ringen og planeten over hele omløpstiden til planeten). Delene er loddrette sylindre, liggende staver og ringen; to deler
//      er klar av hverandre når de er klaringen fra hverandre i høyden eller i planet.
//   5. Festene: hver del som beveger seg sitter i noe som står stille eller selv er festet.
//   6. Antall deler per variant.
import { performance } from 'node:perf_hooks';
import {
  partsFor, stateAt, variants, machines, exactPoint, drive, touching, mounts, summary, meshContact, drivenRate, AXES,
} from '../src/trisolarisDesign.js';
import { buildTrisolaris } from '../src/trisolarisBuild.js';
import { trisolaris as T, accent } from '../src/config.js';
import { pointToSegment, segmentDistance } from '../src/segments.js';

const started = performance.now();
const samples = Number(process.argv[2]) || 720;
const C = T.clearance;
const TAU = 2 * Math.PI;
const fmt = (x, d = 3) => x.toFixed(d).replace('.', ',');
let failures = 0;
const fail = (text) => { failures++; console.log(`  FEIL: ${text}`); };
const thetas = Array.from({ length: samples }, (_, k) => (TAU * k) / samples);

// --- 1. Banen ---
console.log(`\n1. Banen (${samples} tidspunkt per runde)`);
for (const [key, v] of Object.entries(variants)) {
  let worst = 0, closest = Infinity;
  for (const th of thetas) {
    const s = stateAt(th, key);
    for (const n of Object.keys(machines)) {
      const e = exactPoint(th + machines[n].phase);
      worst = Math.max(worst, Math.hypot(s.suns[n].x - e.x, s.suns[n].z - e.z));
    }
    const names = Object.keys(s.suns);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      const a = s.suns[names[i]], b = s.suns[names[j]];
      closest = Math.min(closest, Math.hypot(a.x - b.x, a.z - b.z) - 2 * T.sunRadius);
    }
  }
  console.log(`  ${v.title}: største feil ${fmt(worst)} (${fmt((100 * worst) / T.halfWidth, 2)} % av halve bredden; Fourier-regningen sier ${fmt(v.error)}), solene minst ${fmt(closest, 2)} fra hverandre`);
  if (Math.abs(worst - v.error) > 0.01) fail(`${key}: mekanikken gir ${fmt(worst)}, ikke ${fmt(v.error)}`);
  if (closest < C) fail(`${key}: solene kommer ${fmt(closest)} fra hverandre`);
}

// --- 2. Forholdene ---
console.log('\n2. Forholdene');
{
  const h = 1e-4;
  const rate = (f) => (f(1.1 + h) - f(1.1 - h)) / (2 * h);
  const ms = (th, n) => stateAt(th, 'C').machines[n];
  for (const n of Object.keys(machines)) {
    const rates = {
      'X-armen': rate((t) => ms(t, n).psiA), 'Y-armen': rate((t) => ms(t, n).psiB),
      'X-planethjulet': rate((t) => ms(t, n).gX), 'Y-planethjulet': rate((t) => ms(t, n).gY),
      'Y-hjulet nederst': rate((t) => ms(t, n).yGear),
    };
    const wanted = { 'X-armen': 1, 'Y-armen': 2, 'X-planethjulet': 5, 'Y-planethjulet': 4, 'Y-hjulet nederst': 2 };
    const text = Object.entries(rates).map(([k, r]) => `${k} ${fmt(r, 4)}`).join(', ');
    console.log(`  ${n}: ${text}`);
    for (const [k, r] of Object.entries(rates)) if (Math.abs(r - wanted[k]) > 1e-6) fail(`${n}: ${k} går ${fmt(r, 4)}, skal gå ${wanted[k]}`);
    // Y-hjulet nederst og Y-armen sitter på samme aksel.
    const offs = [0.3, 2.9, 5.1].map((t) => { const m = ms(t, n); return ((m.yGear - m.psiB) % TAU + TAU) % TAU; });
    if (Math.max(...offs) - Math.min(...offs) > 1e-9) fail(`${n}: Y-hjulet nederst og Y-armen dreier ikke sammen`);
  }
  console.log(`  Planeten: én runde per ${fmt(drive.planetPeriod, 2)} runder i åttetallet (ring ${T.ring.teeth}, pinjong ${T.ring.pinionTeeth})`);
}

// --- 3. Dreieretningene ---
console.log('\n3. Dreieretningene gjennom vinkelgirene');
for (const [label, g1, r1, g2, r2] of drive.meshes) {
  const P = meshContact(g1, g2);
  const a = AXES[g2.axis];
  const d = { x: P.x - g2.c.x, y: P.y - g2.c.y, z: P.z - g2.c.z };
  const along = d.x * a.x + d.y * a.y + d.z * a.z;
  const radial = Math.sqrt(Math.max(0, d.x ** 2 + d.y ** 2 + d.z ** 2 - along ** 2));
  const got = drivenRate(g1, r1, g2);
  console.log(`  ${label}: ${fmt(r1, 2)} → ${fmt(got, 2)} (møtes ${fmt(Math.abs(radial - g2.r), 4)} fra delesirkelen, ${fmt(Math.abs(along), 4)} fra planet)`);
  if (Math.abs(got - r2) > 1e-9) fail(`${label}: farten blir ${fmt(got)}, skal være ${fmt(r2)}`);
  if (Math.abs(radial - g2.r) > 1e-6 || Math.abs(along) > 1e-6) fail(`${label}: hjulene møtes ikke på delesirklene`);
}

// --- Formene til klaringen og festene ---
const rotate = (p, a) => ({ x: p.x * Math.cos(a) + p.z * Math.sin(a), z: -p.x * Math.sin(a) + p.z * Math.cos(a) });
function shapeOf(part, state) {
  const mv = part.move ? part.move(state) : { x: 0, z: 0, angle: 0 };
  const T2 = (p) => { const r = rotate(p, mv.angle); return { x: mv.x + r.x, z: mv.z + r.z }; };
  const d = part.draw;
  const circle = (c, r, y0, y1) => ({ kind: 'circle', c: T2(c), r, y0, y1 });
  const capsule = (a, b, r, y0, y1) => ({ kind: 'capsule', a: T2(a), b: T2(b), r, y0, y1 });
  switch (d.type) {
    case 'cyl': return circle(d.at, d.r, d.y0, d.y1);
    case 'collar': return circle(d.at, d.r0, d.y0, d.y1);
    case 'gear': return circle(d.at ?? { x: 0, z: 0 }, d.module * (d.teeth / 2 + 1), d.y0, d.y0 + d.thickness);
    case 'arm': return capsule({ x: 0, z: 0 }, { x: d.length, z: 0 }, Math.max(T.crank.rootHalf, T.crank.endRadius), d.y0, d.y0 + d.thickness);
    case 'bar': return capsule(d.a, d.b, d.width / 2, d.y0, d.y0 + d.thickness);
    case 'rod': return capsule(d.a, d.b, d.r, Math.min(d.a.y, d.b.y) - d.r, Math.max(d.a.y, d.b.y) + d.r);
    case 'bevel': {
      const tip = d.module * (d.teeth / 2 + 1), t = T.gearThickness;
      if (d.axis === 'y') return circle(d.c, tip, d.c.y - t / 2, d.c.y + t / 2);
      const across = d.axis === 'x' ? { x: 0, z: tip } : { x: tip, z: 0 };
      return capsule({ x: d.c.x - across.x, z: d.c.z - across.z }, { x: d.c.x + across.x, z: d.c.z + across.z }, t / 2, d.c.y - tip, d.c.y + tip);
    }
    case 'ringGear': return { kind: 'annulus', inner: d.module * (d.teeth / 2 - 1), outer: d.outer, y0: d.y0, y1: d.y0 + d.thickness };
    case 'sphere': return circle(d.c, d.r, d.c.y - d.r, d.c.y + d.r);
    case 'torus': return circle(d.at, d.r + accent.ringWidth, d.y - accent.ringWidth / 2, d.y + accent.ringWidth / 2);
    case 'pillow': return circle(d.at, d.r + 0.26, 0, d.y + d.r + 0.26);
    case 'bearing': return capsule(d.a, d.b, Math.max(d.r, d.shaft + 0.26), Math.min(d.a.y, d.b.y) - d.shaft - 0.26, Math.max(d.a.y, d.b.y) + d.shaft + 0.26);
    case 'roller': {
      const dir = { x: Math.cos(d.angle) * (d.width / 2), z: -Math.sin(d.angle) * (d.width / 2) };
      return capsule({ x: d.c.x - dir.x, z: d.c.z - dir.z }, { x: d.c.x + dir.x, z: d.c.z + dir.z }, d.r, d.c.y - d.r, d.c.y + d.r);
    }
    default: throw new Error(`Ukjent deltype '${d.type}' (${part.name})`);
  }
}
const P2 = (p) => ({ x: p.x, y: p.z });
function planGap(s, t) {
  if (s.kind === 'annulus') return annulusGap(s, t);
  if (t.kind === 'annulus') return annulusGap(t, s);
  if (s.kind === 'circle' && t.kind === 'circle') return Math.hypot(s.c.x - t.c.x, s.c.z - t.c.z) - s.r - t.r;
  if (s.kind === 'circle') return pointToSegment(P2(s.c), P2(t.a), P2(t.b)) - s.r - t.r;
  if (t.kind === 'circle') return pointToSegment(P2(t.c), P2(s.a), P2(s.b)) - s.r - t.r;
  return segmentDistance(P2(s.a), P2(s.b), P2(t.a), P2(t.b)) - s.r - t.r;
}
function annulusGap(ring, t) {
  const points = t.kind === 'circle' ? [t.c] : Array.from({ length: 21 }, (_, i) => ({ x: t.a.x + ((t.b.x - t.a.x) * i) / 20, z: t.a.z + ((t.b.z - t.a.z) * i) / 20 }));
  let gap = Infinity;
  for (const p of points) {
    const d = Math.hypot(p.x, p.z);
    gap = Math.min(gap, Math.max(ring.inner - (d + t.r), d - t.r - ring.outer));
  }
  return gap;
}
const verticalGap = (s, t) => Math.max(t.y0 - s.y1, s.y0 - t.y1);

// Delene som skal berøre hverandre (touching i trisolarisDesign.js).
const machineOf = (name) => (/^[ABC]:/.test(name) ? name[0] : null);
const baseOf = (name) => name.replace(/^[ABC]:/, '');
const matches = (base, key) => base === key || base.startsWith(`${key} `) || (base.startsWith(key) && /^\d/.test(base.slice(key.length)));
function allowed(a, b) {
  const ma = machineOf(a.name), mb = machineOf(b.name);
  if (ma && mb && ma !== mb) return false;
  const x = baseOf(a.name), y = baseOf(b.name);
  return touching.some(([k1, k2]) => (matches(x, k1) && matches(y, k2)) || (matches(x, k2) && matches(y, k1)));
}

// --- 4. Klaringene ---
console.log(`\n4. Klaringene (minst ${fmt(C, 2)}, ${samples} tidspunkt per runde)`);
for (const key of Object.keys(variants)) {
  const parts = partsFor(key);
  const pairs = [];
  for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
    const a = parts[i], b = parts[j];
    if (a.body === b.body || allowed(a, b)) continue;
    pairs.push([i, j, Boolean(a.move || b.move)]);
  }
  const worst = new Map();   // par → { gap, theta }
  // Ringen og planeten går én runde på planetPeriod runder i åttetallet, så de
  // parene sjekkes over hele den tiden (med samme tetthet per runde i planeten).
  const rounds = Math.ceil(drive.planetPeriod - 1e-9);
  const ringTimes = Array.from({ length: samples * 2 }, (_, k) => (TAU * rounds * k) / (samples * 2));
  const ringPairs = pairs.filter(([i, j]) => parts[i].body === 'ring' || parts[j].body === 'ring');
  const sweep = (times, list) => times.forEach((th, k) => {
    const state = stateAt(th, key);
    const shapes = parts.map((p) => (p.move || k === 0 ? shapeOf(p, state) : null));
    for (const [i, j, moves] of list) {
      if (!moves && k > 0) continue;
      const s = shapes[i] ?? (shapes[i] = shapeOf(parts[i], state)), t = shapes[j] ?? (shapes[j] = shapeOf(parts[j], state));
      if (verticalGap(s, t) >= C - 1e-9) continue;
      const gap = planGap(s, t);
      const id = `${i}|${j}`;
      if (!worst.has(id) || gap < worst.get(id).gap) worst.set(id, { gap, theta: th, i, j });
    }
  });
  sweep(thetas, pairs);
  sweep(ringTimes, ringPairs);
  const sorted = [...worst.values()].sort((a, b) => a.gap - b.gap);
  const bad = sorted.filter((w) => w.gap < C - 1e-9);
  console.log(`  ${variants[key].title}: ${parts.length} deler, ${pairs.length} par, ${bad.length} for nær`);
  for (const w of bad.slice(0, 25)) fail(`${key}: ${parts[w.i].name} – ${parts[w.j].name}: ${fmt(w.gap)} ved θ = ${fmt((w.theta * 180) / Math.PI, 1)}°`);
  for (const w of sorted.filter((x) => x.gap >= C - 1e-9).slice(0, 5)) {
    console.log(`    trangest: ${parts[w.i].name} – ${parts[w.j].name}: ${fmt(w.gap)} ved θ = ${fmt((w.theta * 180) / Math.PI, 1)}°`);
  }
}

// --- 5. Festene ---
console.log('\n5. Festene');
for (const key of Object.keys(variants)) {
  const parts = partsFor(key);
  const byName = new Map(parts.map((p) => [p.name, p]));
  const bodies = new Set(parts.filter((p) => p.move || p.spin).map((p) => p.body));
  const lines = [];
  for (const body of bodies) {
    const mount = mounts.find((m) => m.body === body);
    if (!mount) { fail(`${key}: ${body} beveger seg, men står ikke i mounts`); continue; }
    const via = byName.get(mount.via), by = byName.get(mount.by);
    if (!via || !by) { fail(`${key}: festet til ${body} (${mount.via} i ${mount.by}) finnes ikke`); continue; }
    let worstGap = -Infinity;
    for (const th of [0, 1.7, 3.9]) {
      const state = stateAt(th, key);
      const s = shapeOf(via, state), t = shapeOf(by, state);
      const gap = Math.max(planGap(s, t), verticalGap(s, t));
      worstGap = Math.max(worstGap, gap);
    }
    if (worstGap > 0.01) fail(`${key}: ${mount.via} berører ikke ${mount.by} (${fmt(worstGap)} unna)`);
    else lines.push(`${body} i ${mount.by}`);
  }
  console.log(`  ${variants[key].title}: ${lines.length} enheter festet`);
}

// --- 6. Antall deler ---
console.log('\n6. Antall deler (uten kulene)');
for (const key of Object.keys(variants)) {
  const { counts } = buildTrisolaris(key);
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  console.log(`  ${variants[key].title}: ${total} (${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(', ')})`);
}

console.log(`\nMålene: baneplanet i høyde ${fmt(summary.H, 2)}, maskinene ${fmt(summary.Oz, 2)} fra midten, stolpene i x = ±${fmt(summary.Xg, 2)},`
  + ` ringen r = ${fmt(summary.ringPitch, 2)}, planeten ${fmt(summary.planetPost, 2)} fra midten, alt innenfor ${fmt(summary.reach, 1)} og ${fmt(summary.height, 1)} høyt.`);
console.log(failures ? `\n${failures} feil.` : '\nAlt i orden.');
console.log(`(${fmt((performance.now() - started) / 1000, 1)} s)`);
process.exit(failures ? 1 : 0);
