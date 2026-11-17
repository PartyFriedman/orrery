// Sjekker de to alternativene for månene til Uranus og Neptun (prøvesiden
// moons.html), med det samme 3D-verktøyet som check.mjs bruker for Saturn,
// Mars og Uranus. Modellen er ikke endret; dette regner bare på forslagene.
// Kjør med: node scripts/checkMoons.mjs
//
// Skriver ut for hvert alternativ: armlengdene og den største radiusen mot
// i dag (ingen grense), antall nye deler, omløpstidene og minste klaring, og for Neptun:
// hylsa og banen mot Neptuns diameter, hva som skjer med bodies.height, og en
// vurdering av en vippearm i stedet for staven i hylsa.
import { run3D, lastMinimum, distance, toCheckParts, checkMounts } from './clearance3d.mjs';

const src = new URL('../src/', import.meta.url);
const C = await import(new URL('config.js', src).href);
const M = await import(new URL('mechanism.js', src).href);
const I = await import(new URL('iceMoons.js', src).href);
const { bodies, planets, spacing, iceMoons: IM, gear, armStyle, moonTrain, accent, marsMoons } = C;
const H = bodies.height, gap = spacing.gap;
const designs = I.iceMoonDesigns(M);
const f2 = (x) => x.toFixed(2);
let problems = 0;

const named = (x) => `${x.body} ${x.name}`;

// ---------------------------------------------------------------- Uranus ---
const glassGaps = {};
for (const variant of ['A', 'B']) {
  const d = designs[variant].uranus;
  const parts = toCheckParts(I.uranusParts(d));
  glassGaps[variant] = [];
  const skip = (a, b) => {
    const pair = [named(a), named(b)].sort().join('|');
    // Kula sitter fast i den myke overgangen ved polen.
    if (/^Uranus Uranus\|stolpe myk overgang ved polen/.test(pair)) return true;
    // Stagene til ring 6 (A) sitter i det faste navet.
    if (/^ringer stag \d\|stolpe nav$/.test(pair)) return true;
    // Forlegsakselen går inn i lageret i den loddrette delen av braketten.
    if (pair === 'forlegg forlegsaksel|stolpe brakett 2') return true;
    // Holderne (B) holder ringene.
    if ([a, b].some((x) => x.name.startsWith('holder')) && [a, b].some((x) => x.body === 'ringer')) return true;
    // Glippen mellom to glassringer som dreier mot hverandre regnes som lager,
    // som ved Saturn (der Cassinidelingen også er smalere enn 0,3).
    if (a.glass && b.glass) { glassGaps[variant].push(`${a.name.replace('ring ', '')}–${b.name.replace('ring ', '')} ${f2(distance(a, b))}`); return true; }
    return false;
  };
  problems += run3D(`U${variant}`, `Uranus, alternativ ${variant}, i 3D`, parts, skip);
  if (glassGaps[variant].length) console.log(`  Glipen mellom glassringer som dreier mot hverandre (lager, som ved Saturn): ${glassGaps[variant].join(', ')}`);
  designs[variant].minimum = Object.values(lastMinimum).reduce((m, r) => (r.gap < m.gap ? r : m), { gap: Infinity });
}

// ---------------------------------------------------------------- Neptun ---
{
  const d = designs.neptune;
  const parts = toCheckParts(I.neptuneParts(d, 48));
  const skip = (a, b) => {
    const pair = [named(a), named(b)].sort().join('|');
    if (/^Neptun Neptun\|stolpe stolpe$/.test(pair)) return true;          // stolpen går inn i kula
    if ((a.rests && b.guide) || (b.rests && a.guide)) return true;          // tappen under foten hviler på ringen
    // Tuppen av hjulet på kragen går inn i tannluka på det nederste hjulet på
    // tappen, og dermed nærmere tappen og hylsa enn 0,3. Det er inne i inngrepet.
    if (pair === 'forlegg hylse|krage hjul' || pair === 'krage hjul|stolpe tapp A') return true;
    return false;
  };
  problems += run3D('N', 'Neptun (likt i A og B), i 3D', parts, skip);
  designs.neptune.minimum = Object.values(lastMinimum).reduce((m, r) => (r.gap < m.gap ? r : m), { gap: Infinity });
}

// (Armen og kjedene står fast i tårnet; ved Uranus dreier de bare i forhold til stolpen.)
for (const variant of ['A', 'B']) problems += checkMounts(`Uranus ${variant}`, I.uranusParts(designs[variant].uranus), ['stolpe', 'ringer', 'Uranus', 'arm']);
problems += checkMounts('Neptun', I.neptuneParts(designs.neptune, 8), ['stolpe', 'Neptun']);

// ---------------------------------------------------------- Oppsummering ---
const R = planets.neptune.radius, D = 2 * R;
const n = designs.neptune;
const today = designs.today;
console.log('\n--- Armene og den største radiusen ---');
console.log(`  Modellen (med B): Uranus-armen ${f2(today.uranus)}, Neptun-armen ${f2(today.neptune)}, største radius ${f2(today.maxRadius)} (Uranus rekker ${f2(today.uranusReach)}).`);
for (const variant of ['A', 'B']) {
  const x = designs[variant];
  const change = x.arms.maxRadius - today.maxRadius;
  console.log(`  ${variant}: Uranus rekker ${f2(x.uranus.reach)}, Neptun ${f2(n.reach)}. Armene ${f2(x.arms.uranus)} og ${f2(x.arms.neptune)}, største radius ${f2(x.arms.maxRadius)} (${change >= 0 ? '+' : ''}${f2(change)} mot modellen).`);
}

console.log('\n--- Nye deler ---');
for (const variant of ['A', 'B']) {
  const x = designs[variant];
  const minus = x.parts.removed.length ? ` (minus ${x.parts.removed.join(' og ')})` : '';
  console.log(`  ${variant}: Uranus ${x.count.uranus}${minus}, Neptun ${x.count.neptune}. I alt ${x.count.uranus + x.count.neptune}.`);
  console.log(`     Uranus: ${x.parts.uranus.join(', ')}.`);
}
console.log(`     Neptun: ${designs.A.parts.neptune.join(', ')}.`);

console.log('\n--- Omløpstidene (sidereale, dager) ---');
{
  const r = designs.rates, Y = designs.yearDays;
  const rows = [
    ['Titania', Y / r.uranus.moons.titania, IM.periods.titania],
    ['Oberon', Y / r.uranus.moons.oberon, IM.periods.oberon],
    ['Triton (baklengs)', -Y / r.neptune.tritonInSpace, IM.periods.triton],
  ];
  for (const [name, got, want] of rows) {
    const err = (got / want - 1) * 100;
    console.log(`  ${name.padEnd(18)} ${got.toFixed(4)} mot ${want} (${err >= 0 ? '+' : ''}${err.toFixed(3)} %)`);
    if (Math.abs(err) > 1) problems++;
  }
  console.log(`  Triton går ${r.neptune.triton < 0 ? 'baklengs' : 'FORLENGS'} sett fra armen: kragen ${r.neptune.collar > 0 ? '+' : '−'}, dobbelthjulet ${r.neptune.lay > 0 ? '+' : '−'}, mellomhjulet ${r.neptune.idler > 0 ? '+' : '−'}, Tritons rør ${r.neptune.triton > 0 ? '+' : '−'} (tre inngrep).`);
}

console.log('\n--- Minste klaring (0,3 er kravet) ---');
for (const variant of ['A', 'B']) {
  const m = designs[variant].minimum;
  console.log(`  ${variant} Uranus: ${f2(m.gap)} (${m.a} ↔ ${m.b})`);
}
console.log(`  Neptun:   ${f2(n.minimum.gap)} (${n.minimum.a} ↔ ${n.minimum.b})`);

// Triton mot Neptuns diameter.
console.log(`\n--- Triton mot Neptuns diameter (${f2(D)}) ---`);
{
  const sleeve = n.sleeveTop - n.tritonArmTop;
  const orbitSpan = 2 * n.K + 2 * IM.size.triton;
  const whole = H + n.K + IM.size.triton - n.tritonArmY;
  console.log(`  Banen heller ${f2(n.inclination * 180 / Math.PI)}° (baklengs, ${IM.neptune.tilt}°), knutelinjen på tvers av armen. Føringsringen heller ${f2(n.ringTilt * 180 / Math.PI)}°.`);
  console.log(`  Triton går ${f2(n.K)} opp og ned: banen er ${f2(orbitSpan)} høy, ${f2(orbitSpan / D)} × diameteren.`);
  console.log(`  Hylsa er ${f2(sleeve)} høy, ${f2(sleeve / D)} × diameteren. Staven er ${f2(n.stalkLength + n.stalkBelow)} lang.`);
  console.log(`  Føringsringen står ${f2(H - n.guideY)} under Neptuns sentrum, Triton-armen ${f2(H - n.tritonArmTop)} under (oversiden).`);
  console.log(`  Fra Triton-armen til Tritons høyeste punkt: ${f2(whole)}, ${f2(whole / D)} × diameteren.`);
  console.log(`  Banen sett ovenfra er en sirkel (${f2(n.orbit)} fra stolpen). I det skrå planet er den en ellipse ${f2(2 * n.orbit / Math.cos(n.inclination))} × ${f2(2 * n.orbit)} (forhold ${f2(1 / Math.cos(n.inclination))}), med Neptun i midten.`);
}

// Høydene: B er bygget inn i modellen, så bodies.height er allerede satt så alt
// får plass (npm run check gir feilmelding hvis den er for lav).
console.log(`
--- Høydene ---
  bodies.height er ${H} i modellen. Triton-armen står ${f2(n.tritonArmY)}, og hjulene ved foten av Neptun-stolpen når opp til ${f2(n.pinTopA)}.`);

// Vippearm i stedet for staven i hylsa (bare vurdert).
console.log('\n--- Vippearm (bare vurdert, ikke bygget) ---');
{
  const a = n.orbit, i = n.inclination, rT = IM.size.triton;
  // Leddet sitter på stolpen, under Neptun: minst kula + klaring + et lite nav.
  const depth = R + gap + 0.4;
  const offset = depth * Math.sin(i);          // banens sentrum ligger så langt fra Neptuns, nedover i planet
  const rhoMin = offset + R + gap + rT;        // banen må gå klar av Neptun der den er nærmest
  // Hvor langt en sirkel med radius rho i det skrå planet (sentrum forskjøvet nedover) rekker ut fra stolpen, sett ovenfra.
  const reachOf = (rho) => {
    let best = 0;
    for (let k = 0; k < 360; k++) {
      const f = (2 * Math.PI * k) / 360;
      const u = -offset + rho * Math.cos(f);   // langs planet, oppover langs helningen
      best = Math.max(best, Math.hypot(u * Math.cos(i), rho * Math.sin(f)));
    }
    return best;
  };
  const armLen = Math.sqrt(rhoMin ** 2 + (depth * Math.cos(i)) ** 2);
  console.log(`  Med leddet ${f2(depth)} under Neptuns sentrum ligger Triton på en kule rundt leddet, og banen blir en sirkel i det skrå planet.`);
  console.log(`  Men sirkelens sentrum ligger ${f2(offset)} fra Neptuns sentrum (nedover i planet), ikke i Neptun.`);
  console.log(`  For å gå klar av Neptun må sirkelen ha radius minst ${f2(rhoMin)} (armen ${f2(armLen)} lang), og da rekker Triton ${f2(reachOf(rhoMin) + rT)} fra stolpen, mot ${f2(n.reach)} med staven.`);
  console.log(`  Staven i hylsa: ellipse ${f2(1 / Math.cos(i))} : 1, med Neptun i midten, og den rekker ${f2(n.reach)}.`);
  console.log('  Vippearmen gir en rund bane, men ikke rundt Neptun, og den gjør modellen bredere. Føringsringen trengs fortsatt for å styre vinkelen.');
}

console.log(problems ? `\n${problems} problem(er) funnet.` : '\nAlt i orden.');
process.exitCode = problems ? 1 : 0;
