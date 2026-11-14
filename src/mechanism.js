// Mekanismen som ren matematikk (uten three.js): hvor akslene og rørene står,
// hvor høyt hver del ligger, hvor kjedene går, og hvilken vinkel hvert hjul
// har for en gitt inngangsvinkel.
//
// Vinkler er i radianer, målt mot klokka sett ovenfra, fra +x.
// Posisjoner er i planet: { x, y } der planets y tilsvarer -z i three.js.

import { drive, center, gear, bigGear, smallGear, arm, planets, moonTrain, bodies, tilt } from './config.js';

const pitchRadius = (module, teeth) => (module * teeth) / 2;

// Alle hjulparene nederst går fra mellomakselen til sentrum, altså over samme
// avstand. Avstanden er modul × (tenner1 + tenner2) / 2, så hvert par får den
// modulen som gjør at akkurat det paret når over.
export const pairModule = (teeth1, teeth2) => (2 * drive.distance) / (teeth1 + teeth2);
const degrees = (d) => (d * Math.PI) / 180;

// Vinkelen hjul 2 må ha for å gripe inn i hjul 1, når hjul 1 har vinkelen
// angle1 og hjul 2 står i retning `direction` fra hjul 1.
// Formelen gir motsatt dreieretning, forholdet teeth1/teeth2, og plasserer en
// tann på det ene hjulet midt i et mellomrom på det andre der de møtes.
export function meshAngle(angle1, teeth1, teeth2, direction) {
  return direction + Math.PI - Math.PI / teeth2 + (teeth1 / teeth2) * (direction - angle1);
}

const { fixed, pinion, driveSprocket, moonSprocket, parallelSprocket } = moonTrain;

// Mellomakselen står foran sentralakselen (mot kameraet).
const driveDirection = -Math.PI / 2;
const driveDistance = drive.distance;

// --- Rørene rundt sentralakselen ---
// En arm som ligger høyere, må være kortere enn alle armene under den. Ellers
// treffer stolpene fra de lavere armene den når de passerer. Røret med den
// øverste armen må stikke lengst opp, og dermed ligge innerst. Det må også
// stikke lengst ned, så hjulet nederst får plass. Altså: kortest arm innerst.
//
// Det faste hjulet til månehjulverket kan ikke sitte på sentralakselen, for
// rett over jordarmen er den dekket av rørene til planetene innenfor jorda.
// Det får et eget fast rør rett innenfor jord-røret, holdt av en brakett nede.
const sortedArms = [
  ...Object.entries(planets).map(([name, p]) => ({ name, length: p.armLength })),
  { name: 'earth', length: arm.length },
].sort((a, b) => a.length - b.length);
const tubeNames = sortedArms.flatMap((a) => (a.name === 'earth' ? ['fixed', 'earth'] : [a.name]));
export const tubes = tubeNames.map((name, i) => ({
  name,
  inner: center.axleRadius + i * center.tubeWall,
  outer: center.axleRadius + (i + 1) * center.tubeWall,
}));
export const tube = Object.fromEntries(tubes.map((t) => [t.name, t]));

// Hvor nær og hvor langt fra sentrum hver arm rekker med det den bærer.
// Jorda rekker så langt som månearmen og månen.
const moonReach = bodies.moonOrbit + Math.max(bodies.moonRadius, arm.width / 4);
const reachOf = (name) => {
  if (name === 'earth') return { inner: arm.length - moonReach, outer: arm.length + moonReach };
  const p = planets[name];
  return { inner: p.armLength - Math.max(p.radius, 0.5), outer: p.armLength + Math.max(p.radius, arm.width / 2) };
};
export const reach = Object.fromEntries(sortedArms.map((a) => [a.name, reachOf(a.name)]));

// Det som stikker opp fra en lavere (lengre) arm, må ligge utenfor alt en
// høyere (kortere) arm rekker. Den innerste planeten må gå klar av sola.
const margin = 1;
if (reach[sortedArms[0].name].inner < bodies.sunRadius + margin) {
  throw new Error(`${sortedArms[0].name} er for nær sola: armen må være minst ${(sortedArms[0].length + bodies.sunRadius + margin - reach[sortedArms[0].name].inner).toFixed(1)} lang.`);
}
for (let i = 1; i < sortedArms.length; i++) {
  const inside = sortedArms[i - 1].name;
  const outside = sortedArms[i].name;
  if (reach[outside].inner < reach[inside].outer + margin) {
    throw new Error(
      `${inside} og ${outside} kommer for nær hverandre: ${inside} rekker ut til ${reach[inside].outer.toFixed(1)}, ` +
      `${outside} kommer inn til ${reach[outside].inner.toFixed(1)}. Gjør avstanden mellom armlengdene større.`
    );
  }
}

// Pinionen står på armen, i riktig avstand fra det faste hjulet.
// Armen peker langs +x i sitt eget koordinatsystem.
const pinionX = pitchRadius(moonTrain.module, fixed.teeth) + pitchRadius(moonTrain.module, pinion.teeth);

export const layout = {
  drive: { x: Math.cos(driveDirection) * driveDistance, y: Math.sin(driveDirection) * driveDistance },
  center: { x: 0, y: 0 },
  pinion: { x: pinionX, y: 0 },
  earth: { x: arm.length, y: 0 },
};

// --- Kjeder ---
// Et kjede går rundt to kjedehjul langs armen (det første nærmest sentrum).
// Begge hjulene dreier samme vei. Kjedehjulenes radius er valgt så buen mellom
// to tenner er nøyaktig én ledd-lengde, så rullene ligger i setene hele veien.
const sprocketRadius = (teeth, pitch) => (teeth * pitch) / (2 * Math.PI);
const rollerRadius = moonTrain.chainPitch * 0.3;

function makeChain(name, from, to, teeth1, teeth2) {
  const span = to.x - from.x;

  // Lengden av kjedebanen for en gitt ledd-lengde.
  const loopLength = (p) => {
    const a = sprocketRadius(teeth1, p);
    const b = sprocketRadius(teeth2, p);
    const alpha = Math.acos((a - b) / span);
    return 2 * Math.sqrt(span ** 2 - (a - b) ** 2) + 2 * alpha * b + (2 * Math.PI - 2 * alpha) * a;
  };

  // Kjedehjulene må få plass ved siden av hverandre, med litt luft.
  const needed =
    sprocketRadius(teeth1, moonTrain.chainPitch) + sprocketRadius(teeth2, moonTrain.chainPitch) + moonTrain.chainPitch * 2;
  if (span < needed) {
    throw new Error(
      `${name}: arm.length må være minst ${(from.x + needed).toFixed(1)} med disse kjedehjulene (er ${arm.length}). ` +
      `Gjør armen lengre, eller chainPitch / module mindre.`
    );
  }

  // Et ekte kjede har et helt antall ledd. Vi runder av til nærmeste hele antall
  // og justerer ledd-lengden bittelitt så kjedet går nøyaktig opp.
  const links = Math.round(loopLength(moonTrain.chainPitch) / moonTrain.chainPitch);
  let low = moonTrain.chainPitch * 0.8;
  let high = moonTrain.chainPitch * 1.2;
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

  // Banen går mot klokka: langs undersiden ut fra sentrum, rundt hjul 2,
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

    // Punktet en avstand `u` langs kjedet, i armens koordinatsystem.
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

// Månekjedet: fra kjedehjulet på pinion-akselen til kjedehjulet under jorda.
export const moonChain = makeChain('Månekjedet', layout.pinion, layout.earth, driveSprocket.teeth, moonSprocket.teeth);

// Parallellkjedet: fra et fast kjedehjul på det faste røret til et like stort
// kjedehjul på armen under jorda. Sett fra armen dreier det faste hjulet
// baklengs like fort som armen går rundt, og kjedet overfører det 1:1. Dermed
// står hjulet under jorda stille i rommet, uansett hvor armen er.
export const parallelChain = makeChain('Parallellkjedet', layout.center, layout.earth, parallelSprocket.teeth, parallelSprocket.teeth);

// Runder månen går rundt jorda per runde armen tar (månefaser per år).
export const moonPerYear = (fixed.teeth / pinion.teeth) * (driveSprocket.teeth / moonSprocket.teeth);

// Omløpstiden i år for en planet, slik tanntallene gir den. Mellomakselen går
// bigGear/smallGear ganger per år, og røret går driveTeeth/tubeTeeth ganger
// per omdreining av mellomakselen.
export function planetPeriod(name) {
  const p = planets[name];
  return (p.tubeTeeth / p.driveTeeth) * (smallGear.teeth / bigGear.teeth);
}

const directionFrom = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const toCenter = directionFrom(layout.drive, layout.center);

// Alle vinklene, utledet fra inngangsvinkelen gjennom hvert inngrep.
export function anglesAt(input) {
  // Inngangen dreier mellomakselen med klokka, så armene går mot klokka (som planetene).
  const driveAngle = -input;

  // Hjulparene nederst: hvert rør får sin vinkel fra sitt hjul på mellomakselen.
  const armAngle = meshAngle(driveAngle, smallGear.teeth, bigGear.teeth, toCenter);
  const planetAngles = {};
  for (const [name, p] of Object.entries(planets)) {
    planetAngles[name] = meshAngle(driveAngle, p.driveTeeth, p.tubeTeeth, toCenter);
  }

  // Herfra regner vi i jordarmens koordinatsystem. Alt som sitter fast på det
  // faste røret står stille i verden, så sett fra armen dreier det baklengs.
  const fixedAngle = -armAngle;
  const pinionAngle = meshAngle(fixedAngle, fixed.teeth, pinion.teeth, 0);

  const moonChainOffset = moonChain.offsetFor(pinionAngle);
  const moonAngle = moonChain.angle2For(moonChainOffset);

  const parallelChainOffset = parallelChain.offsetFor(fixedAngle);
  const parallelAngle = parallelChain.angle2For(parallelChainOffset);

  return {
    driveAngle, armAngle, planetAngles, fixedAngle, pinionAngle,
    moonChainOffset, moonAngle, parallelChainOffset, parallelAngle,
  };
}

// --- Det som sitter på parallellhjulet ---
// Parallellhjulet har en fast retning i verden. Den følger av hvordan kjedet
// ligger, og er den samme for alle inngangsvinkler.
const start = anglesAt(0);
const parallelWorldAngle = start.armAngle + start.parallelAngle;

// Jordaksen monteres på parallellhjulet så den heller mot ønsket retning i verden.
export const earthAxis = {
  tilt: degrees(tilt.earthAxis),
  direction: degrees(tilt.earthAxisDirection) - parallelWorldAngle, // på parallellhjulet
};

// Månebanen: en skrå føringsring på jordstolpen. Månestaven glir opp og ned i
// en hylse på månearmen, og en fot på staven hviler på ringen. Foten ligger litt
// innenfor månestaven, så ringen heller litt brattere enn selve månebanen.
const footRadius = bodies.moonOrbit - 1.5;
const ringTilt = Math.atan((Math.tan(degrees(tilt.moonOrbit)) * bodies.moonOrbit) / footRadius);
export const moonRing = {
  radius: footRadius,
  halfWidth: 0.5,
  tilt: ringTilt,
  node: degrees(tilt.moonNodeDirection) - parallelWorldAngle, // på parallellhjulet
  // Hvor høyt og lavt ringen går (ytterkanten), så hylsa kan få plass under.
  maxLift: Math.tan(ringTilt) * (footRadius + 0.5),
};

// Hvor mye ringen løfter månen nå. Månearmen står i vinkelen moonAngle og
// ringen i parallelAngle (begge sett fra armen), så forskjellen er hvor på
// ringen foten ligger.
export function moonLift(angles) {
  const onRing = angles.moonAngle - angles.parallelAngle - moonRing.node;
  return Math.tan(moonRing.tilt) * moonRing.radius * Math.sin(onRing);
}

// --- Høyder ---
// Nederst ligger ett hjulpar per rør, innenfra og ut (det faste røret har en
// brakett i stedet). Over mellomakselen ligger armene, utenfra og inn, så den
// lengste armen er nederst. Over jordarmen ligger månehjulverket, og armene
// innenfor jorda må ligge over det.
const gap = 0.5;
const chainGap = 1.2;   // ekstra luft mellom to kjeder over hverandre
const plateDepth = 0.3; // så langt stikker lenkeplatene under og over kjedehjulet
export const heights = (() => {
  const h = { gap, chainGap, bottom: {}, arm: {} };

  let y = 2;
  for (const t of tubes) {
    h.bottom[t.name] = y;
    y += (t.name === 'fixed' ? arm.thickness : gear.thickness) + gap;
  }
  h.driveTop = y; // toppen av mellomakselen

  let a = h.driveTop + gap;
  for (const t of [...tubes].reverse()) {
    if (t.name === 'fixed') continue;
    h.arm[t.name] = a;
    if (t.name === 'earth') {
      const armTop = a + arm.thickness;
      h.level1 = armTop + gap;                                        // fast hjul og pinion
      h.parallel = h.level1 + moonTrain.thickness + gap + plateDepth;  // parallellkjedet, platene går over det faste hjulet
      h.moonChain = h.parallel + moonTrain.thickness + chainGap;       // månekjedet
      h.pinionTop = h.moonChain + moonTrain.thickness + gap * 0.6;     // toppen av pinion-akselen
      h.moonArm = h.moonChain + moonTrain.thickness + gap;             // månearmen (bare ute ved jorda)
      h.fixedTop = h.parallel + moonTrain.thickness;                   // toppen av det faste røret
      a = h.pinionTop + gap;
    } else {
      a += arm.thickness + gap;
    }
  }
  h.topArm = a - gap; // toppen av den øverste armen

  // Sola må henge over den øverste armen.
  if (bodies.height - bodies.sunRadius < h.topArm + gap) {
    throw new Error(`bodies.height må være minst ${(h.topArm + gap + bodies.sunRadius).toFixed(1)} så sola går klar av armene (er ${bodies.height}).`);
  }

  // Månestaven glir opp og ned i en hylse på månearmen, og en fot på staven
  // hviler på den skrå ringen rett under jorda. Hylsa må romme hele vandringen.
  h.ring = bodies.height - bodies.earthRadius - 1;
  h.sleeveTop = h.ring - moonRing.maxLift - 0.5;
  const neededSleeve = 2 * moonRing.maxLift + 0.5;
  if (h.sleeveTop - h.moonArm < neededSleeve) {
    const minHeight = bodies.height + neededSleeve - (h.sleeveTop - h.moonArm);
    throw new Error(`bodies.height må være minst ${minHeight.toFixed(1)} så månestaven får plass til å gå opp og ned (er ${bodies.height}).`);
  }
  return h;
})();
