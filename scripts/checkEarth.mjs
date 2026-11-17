// Sjekker rutene på prøvesiden earth.html (jordrotasjonen, føringsringen og
// foten), med det samme 3D-verktøyet som check.mjs bruker for Saturn, Mars og
// Uranus. Modellen er ikke endret; dette regner bare på forslagene.
// Kjør med: node scripts/checkEarth.mjs
//
// For hver rute: døgnlengden og retningen, startvinkelen (stjernetiden),
// høyden jorda trenger, minste klaring (0,3) og hva hver aksel er festet i.
import { run3D, lastMinimum, toCheckParts, checkMounts } from './clearance3d.mjs';

const src = new URL('../src/', import.meta.url);
const C = await import(new URL('config.js', src).href);
const M = await import(new URL('mechanism.js', src).href);
const E = await import(new URL('earthDesign.js', src).href);
const { earthDay: ED, bodies } = C;
const f2 = (x) => x.toFixed(2);
const named = (x) => `${x.body} ${x.name}`;
let problems = 0;
const notes = {};

for (const name of Object.keys(ED.cells)) {
  const d = E.earthDesign(name, E.contextFrom(M));
  const c = d.cell;
  console.log(`\n================ ${name}: ${c.source} + ${c.top} + ${c.guide} + ${c.follower} ================`);

  // Døgnlengden.
  const r = d.rate;
  const ok = Math.abs(r.error) <= 0.05 && r.earth > 0;
  if (!ok) problems++;
  console.log(`Døgnet: ${r.siderealDay.toFixed(6)} dager per omdreining i rommet (mål ${ED.siderealDay}), ${r.error >= 0 ? '+' : ''}${r.error.toFixed(4)} %${ok ? '' : '  <-- FEIL'}`);
  console.log(`  ${r.earth.toFixed(3)} omdreininger per år (mål ${E.target.toFixed(3)}), prograd. Soldøgnet blir ${(E.yearDays / (r.earth - 1)).toFixed(6)} dager.`);
  console.log(`  Driveakselen ${r.shaft.toFixed(2)} runder per år sett fra stolperøret${r.lay ? `, forlegsakselen ${r.lay.toFixed(2)} sett fra armen` : ''}${r.tube ? `, dagrøret ${r.tube.toFixed(2)} i rommet` : ''}, utveksling ved jorda ${r.k.toFixed(3)}${r.idler ? ' (med mellomhjul)' : ''}.`);
  console.log(`  Ved 2 dager/s og 60 bilder/s dreier jorda ${(2 * 360 / 60 * r.earth / E.target * (E.target / E.yearDays)).toFixed(1)}° per bilde.`);

  // Høydene.
  console.log(`Høyden på jordas sentrum: ${f2(d.H)} (modellen i dag ${bodies.height}, ${d.Hrise >= 0 ? '+' : ''}${f2(d.Hrise)}).`);
  console.log(`  Krav: sola over armene ${f2(d.Hsun)}, tårnet og resten av modellen ${f2(d.Hmodel)}, overgangen over ringen ${f2(d.Hstage)}${Number.isFinite(d.Hk) ? `, kryssleddet over navet ${f2(d.Hk)}` : ''}${Number.isFinite(d.Hbr) ? `, braketten over skiva ${f2(d.Hbr)}` : ''}.`);
  console.log(`  Jordstabelen: arm ${f2(d.stack.armY)}, dagkjede ${f2(d.stack.day)}, fast hjul ${f2(d.stack.level1)}, parallellkjede ${f2(d.stack.parallel)}, månekjede ${f2(d.stack.moonChain)}, månearm ${f2(d.moonArmY)}. Armene innenfor løftes ${f2(d.stack.rise)}.`);
  console.log(`  Ringen midt på ${f2(d.ringY)} (går ${f2(d.K)} opp og ned), hylsa ${f2(d.sleeveTop - d.moonArmTop)} høy, stolperøret til ${f2(d.frameTop)}.`);
  if (c.top === 'V') console.log(`  Vinkelgiret: ${f2(d.top.Lc)} fra jordas sentrum langs kjeglene; hjulet på spindelen ${f2(-d.top.sE - d.R)} under sørpolen, hjulet på driveakselen ${f2(d.top.dropV)} under sentrum.`);
  else console.log(`  Kryssleddet ${f2(d.top.dropK)} under jordas sentrum; den skrå akselen ${f2(d.top.dK)} fra jordaksen.`);

  // Klaringen i 3D.
  const parts = toCheckParts(E.earthParts(d, 48));
  notes[name] = [];
  const skip = (a, b) => {
    const pair = [named(a), named(b)].sort().join('|');
    if ((a.rests && b.guide) || (b.rests && a.guide)) return true;        // foten går på ringen
    if ([a.body, b.body].sort().join('|') === 'driveaksel|skrå aksel') return true;   // møtes i kryssleddet
    // Glideskoen går rundt staget der det fester i ringen (åpningen innover).
    const shoeSide = (x) => x.shoe || (c.follower === 'F2' && x.name === 'fot');
    if ((shoeSide(a) && /^stolpe stag/.test(named(b))) || (shoeSide(b) && /^stolpe stag/.test(named(a)))) {
      if (!notes[name].includes('sko')) notes[name].push('sko');
      return true;
    }
    // Braketten sitter utenpå stolperøret, med driveakselen inni.
    if (pair === 'driveaksel driveaksel|stolpe brakett 1') return true;
    // Lagrene, platen og tappen holder akslene som går gjennom dem.
    if ((a.holds ?? []).includes(b.body) || (b.holds ?? []).includes(a.body)) return true;
    return false;
  };
  problems += run3D(name, `Rute ${name} i 3D`, parts, skip);
  const min = Object.values(lastMinimum).reduce((m, x) => (x.gap < m.gap ? x : m), { gap: Infinity });
  console.log(`  Minste klaring: ${f2(min.gap)} (${min.a} ↔ ${min.b})`);
  if (notes[name].includes('sko')) console.log('  Unntak: glideskoen (og foten der den fester i skoen) går rundt stagene der de fester i ringen (åpningen vender innover), så der er klaringen mindre enn 0,3.');
  problems += checkMounts(`Rute ${name}`, E.earthParts(d, 8), E.staticBodies);

  console.log(`Nye deler: ${d.count} (${d.parts.join(', ')}). Fjernes: ${E.removed.join(', ')}.`);
}

// Startvinkelen: Greenwich-meridianen står stjernetiden fra vårjevndøgnsretningen.
const g = E.gmst(M.startDate);
console.log(`\nStartvinkelen ${M.startDate.toISOString()}: stjernetiden i Greenwich er ${(g * 180 / Math.PI).toFixed(3)}°, så Greenwich-meridianen står så langt østover fra vårjevndøgnsretningen.`);

console.log(problems ? `\n${problems} problem(er) funnet.` : '\nAlt i orden.');
process.exitCode = problems ? 1 : 0;
