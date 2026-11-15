// Mekanismen som ren matematikk (uten three.js): hvor lange armene er, hvor
// akslene og rørene står, hvor høyt hver del ligger, hvor kjedene går, og
// hvilken vinkel hvert hjul har for en gitt inngangsvinkel.
//
// Vinkler er i radianer, målt mot klokka sett ovenfra, fra +x.
// Posisjoner er i planet: { x, y } der planets y tilsvarer -z i three.js.

import {
  drive, outerDrive, spacing, center, gear, bigGear, smallGear, arm, armStyle,
  planets, moonTrain, bodies, tilt, moonSize,
} from './config.js';

const { gap, chainGap, reachGap, moonGap } = spacing;
const pitchRadius = (module, teeth) => (module * teeth) / 2;
const degrees = (d) => (d * Math.PI) / 180;
const at = (direction, distance) => ({ x: Math.cos(direction) * distance, y: Math.sin(direction) * distance });

// Alle hjulparene nederst går til sentrum fra en aksel like langt ute
// (mellomakselen eller forlegsakselen), altså over samme avstand. Avstanden er
// modul × (tenner1 + tenner2) / 2, så hvert par får den modulen som gjør at
// akkurat det paret når over.
export const pairModule = (teeth1, teeth2) => (2 * drive.distance) / (teeth1 + teeth2);

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
};

// --- Plass rundt hver planet ---
// Månebanene pakkes utover fra planeten (eller fra ringen): hver måne går
// moonGap klar av det som er innenfor. Rundt den ytterste månen holdes litt
// ekstra av til en framtidig månearm. Ingenting av dette bygges ennå.
const moonHardware = 0.8;
export const moonSystems = Object.fromEntries(Object.entries(planets).map(([name, p]) => {
  const ring = p.ring
    ? { inner: p.ring.inner * p.radius, outer: p.ring.outer * p.radius, tilt: degrees(p.ring.tilt) }
    : null;
  const orbits = [];
  let edge = ring ? ring.outer : p.radius;
  for (const moon of p.moons ?? []) {
    const radius = moonSize(moon);
    const orbit = edge + moonGap + radius;
    orbits.push({ name: moon, radius, orbit });
    edge = orbit + radius;
  }
  const last = orbits.at(-1);
  const envelope = Math.max(ring ? ring.outer : 0, last ? last.orbit + Math.max(last.radius, moonHardware) : 0);
  return [name, { ring, orbits, envelope }];
}));

// Hvilken mekanikk som ligger over armen: jorda har månehjulverk med
// parallellføring, andre har det de reserverer plass til.
export const mechanismOf = (name) => (name === 'earth' ? 'moons+parallel' : planets[name].mechanism ?? null);

// Kjedehjulene ute ved planeten (og kjedet rundt dem) rekker så langt ut fra
// planetens sentrum.
const chainEnd = (teeth) => sprocketRadius(teeth, moonTrain.chainPitch) + moonTrain.chainPitch * 0.3 * 1.3;
const mechanismEnd = (name) => {
  const kind = mechanismOf(name);
  if (!kind) return 0;
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
    const shortest = Math.ceil(Math.max(mechanismMinimum(name), outside + reachGap + env.inner) * 10) / 10;
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
const tubeNames = order.flatMap((name) => {
  if (!mechanismOf(name)) return [name];
  return [name === 'earth' ? 'fixed' : `fixed-${name}`, name];
});
export const tubes = tubeNames.map((name, i) => ({
  name,
  fixed: name.startsWith('fixed'),
  owner: name === 'fixed' ? 'earth' : name.replace('fixed-', ''),
  inner: center.axleRadius + i * center.tubeWall,
  outer: center.axleRadius + (i + 1) * center.tubeWall,
}));
export const tube = Object.fromEntries(tubes.map((t) => [t.name, t]));

// --- Akslene i tårnet ---
// Mellomakselen står foran sentralakselen (mot kameraet). Forlegsakselen står
// like langt fra sentrum, en vinkel videre rundt.
const driveDirection = -Math.PI / 2;
const layDirection = driveDirection + degrees(outerDrive.angle);

export const layout = {
  drive: at(driveDirection, drive.distance),
  lay: at(layDirection, drive.distance),
  center: { x: 0, y: 0 },
  pinion: { x: pinionX, y: 0 },
  earth: { x: armLengths.earth, y: 0 },
};

// Kjedet fra mellomakselen til forlegsakselen. Det regnes ut langs +x fra
// mellomakselen og dreies på plass med outerFrame.
export const outerFrame = {
  origin: layout.drive,
  angle: Math.atan2(layout.lay.y - layout.drive.y, layout.lay.x - layout.drive.x),
};
const layDistance = Math.hypot(layout.lay.x - layout.drive.x, layout.lay.y - layout.drive.y);
export const outerChain = makeChain(
  'Kjedet til forlegsakselen', { x: 0, y: 0 }, { x: layDistance, y: 0 },
  outerDrive.driveSprocket, outerDrive.laySprocket, outerDrive.chainPitch
);

// Månekjedet: fra kjedehjulet på pinion-akselen til kjedehjulet under jorda.
export const moonChain = makeChain('Månekjedet', layout.pinion, layout.earth, driveSprocket.teeth, moonSprocket.teeth);

// Parallellkjedet: fra et fast kjedehjul på det faste røret til et like stort
// kjedehjul på armen under jorda. Sett fra armen dreier det faste hjulet
// baklengs like fort som armen går rundt, og kjedet overfører det 1:1. Dermed
// står hjulet under jorda stille i rommet, uansett hvor armen er.
export const parallelChain = makeChain('Parallellkjedet', layout.center, layout.earth, parallelSprocket.teeth, parallelSprocket.teeth);

// Runder månen går rundt jorda per runde armen tar (månefaser per år).
export const moonPerYear = (fixed.teeth / pinion.teeth) * (driveSprocket.teeth / moonSprocket.teeth);

// Hvor mange ganger røret går rundt per omdreining av mellomakselen.
const tubeRate = (p) => (p.layTeeth
  ? (outerDrive.driveSprocket / outerDrive.laySprocket) * (p.layTeeth / p.tubeTeeth)
  : p.driveTeeth / p.tubeTeeth);

// Omløpstiden i år for en planet, slik tanntallene gir den. Mellomakselen går
// bigGear/smallGear ganger per år.
export function planetPeriod(name) {
  return (smallGear.teeth / bigGear.teeth) / tubeRate(planets[name]);
}

const directionFrom = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const driveToCenter = directionFrom(layout.drive, layout.center);
const layToCenter = directionFrom(layout.lay, layout.center);

// Alle vinklene, utledet fra inngangsvinkelen gjennom hvert inngrep.
export function anglesAt(input) {
  // Inngangen dreier mellomakselen med klokka, så armene går mot klokka (som planetene).
  const driveAngle = -input;

  // Kjedet til forlegsakselen (i kjedets eget koordinatsystem), som beholder
  // dreieretningen.
  const outerChainOffset = outerChain.offsetFor(driveAngle - outerFrame.angle);
  const layAngle = outerChain.angle2For(outerChainOffset) + outerFrame.angle;

  // Hjulparene nederst: hvert rør får sin vinkel fra sitt hjul på mellomakselen
  // eller forlegsakselen.
  const armAngle = meshAngle(driveAngle, smallGear.teeth, bigGear.teeth, driveToCenter);
  const planetAngles = {};
  for (const [name, p] of Object.entries(planets)) {
    planetAngles[name] = p.layTeeth
      ? meshAngle(layAngle, p.layTeeth, p.tubeTeeth, layToCenter)
      : meshAngle(driveAngle, p.driveTeeth, p.tubeTeeth, driveToCenter);
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
    driveAngle, outerChainOffset, layAngle, armAngle, planetAngles, fixedAngle, pinionAngle,
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
// Nederst i tårnet ligger kjedet til forlegsakselen (der står bare
// sentralakselen, så det store kjedehjulet får plass), og over det ett hjulpar
// per rør innenfra og ut (de faste rørene har en brakett i stedet). Over
// tårnet ligger armene, utenfra og inn, så den lengste armen er nederst. Over
// en arm med månehjulverk ligger en stabel (fast hjul og pinion, eventuelt
// parallellkjede, og månekjede), og armene innenfor må ligge over den.
const plateDepth = 0.3; // så langt stikker lenkeplatene under og over kjedehjulet
export const heights = (() => {
  const h = { gap, chainGap, bottom: {}, arm: {}, stack: {} };

  h.outerChain = plateDepth + gap;
  let y = h.outerChain + moonTrain.thickness + plateDepth + gap;
  for (const t of tubes) {
    h.bottom[t.name] = y;
    y += (t.fixed ? arm.thickness : gear.thickness) + gap;
  }
  h.driveTop = y; // toppen av tårnet

  let a = h.driveTop + gap;
  for (const t of [...tubes].reverse()) {
    if (t.fixed) continue;
    h.arm[t.name] = a;
    const armTop = a + arm.thickness;
    h.topArm = armTop + armStyle.hubRise; // toppen av navet på den øverste armen så langt
    const kind = mechanismOf(t.name);
    if (!kind) {
      a = armTop + 2 * armStyle.hubRise + gap; // plass til navet over og navet til neste arm
      continue;
    }
    const s = { level1: armTop + armStyle.hubRise + gap };                 // fast hjul og pinion, klar av navet
    if (kind === 'moons+parallel') {
      s.parallel = s.level1 + moonTrain.thickness + gap + plateDepth;      // parallellkjedet, platene går over det faste hjulet
      s.moonChain = s.parallel + moonTrain.thickness + chainGap;           // månekjedet
      s.fixedTop = s.parallel + moonTrain.thickness;                       // toppen av det faste røret
    } else {
      s.moonChain = s.level1 + moonTrain.thickness + gap + plateDepth;
      s.fixedTop = s.level1 + moonTrain.thickness;
    }
    s.pinionTop = s.moonChain + moonTrain.thickness + plateDepth;          // toppen av pinion-akselen, over lenkeplatene
    s.moonArm = s.moonChain + moonTrain.thickness + gap;                   // månearmen (bare ute ved planeten)
    h.stack[t.name] = s;
    a = s.pinionTop + armStyle.hubRise + gap; // navet til neste arm går klar av kjedet
  }
  Object.assign(h, h.stack.earth); // jordas stabel: level1, parallel, moonChain, pinionTop, moonArm, fixedTop

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
  for (const [name, p] of Object.entries(planets)) check(name, p.driveTeeth ?? p.layTeeth, p.tubeTeeth);

  // Kjedet til forlegsakselen ligger nederst, der bare sentralakselen står.
  const big = outerChain.radius2 + outerChain.rollerRadius * 1.3;
  if (drive.distance - big < center.axleRadius + clear) {
    throw new Error('Det store kjedehjulet på forlegsakselen går inn i sentralakselen: øk drive.distance eller gjør outerDrive.laySprocket mindre.');
  }
  if (outerChain.radius1 - outerChain.rollerRadius * 1.1 < drive.shaftRadius + 0.2) {
    throw new Error('Det lille kjedehjulet på mellomakselen er for lite til akselen: øk outerDrive.driveSprocket.');
  }
}
