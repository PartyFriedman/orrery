// Mekanismen som ren matematikk (uten three.js): hvor akslene står, hvor
// kjedene går, og hvilken vinkel hvert hjul har for en gitt inngangsvinkel.
//
// Vinkler er i radianer, målt mot klokka sett ovenfra, fra +x.
// Posisjoner er i planet: { x, y } der planets y tilsvarer -z i three.js.

import { gear, bigGear, smallGear, arm, moonTrain, bodies, tilt } from './config.js';

const pitchRadius = (module, teeth) => (module * teeth) / 2;
const degrees = (d) => (d * Math.PI) / 180;

// Vinkelen hjul 2 må ha for å gripe inn i hjul 1, når hjul 1 har vinkelen
// angle1 og hjul 2 står i retning `direction` fra hjul 1.
// Formelen gir motsatt dreieretning, forholdet teeth1/teeth2, og plasserer en
// tann på det ene hjulet midt i et mellomrom på det andre der de møtes.
export function meshAngle(angle1, teeth1, teeth2, direction) {
  return direction + Math.PI - Math.PI / teeth2 + (teeth1 / teeth2) * (direction - angle1);
}

const { fixed, pinion, driveSprocket, moonSprocket, parallelSprocket } = moonTrain;

// Mellomakselen står foran sentralakselen (mot kameraet), i riktig avstand
// for at hjulparet skal gripe inn i hverandre.
const driveDirection = -Math.PI / 2;
const driveDistance = pitchRadius(gear.module, bigGear.teeth) + pitchRadius(gear.module, smallGear.teeth);

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

// Parallellkjedet: fra et fast kjedehjul på sentralakselen til et like stort
// kjedehjul på armen under jorda. Sett fra armen dreier det faste hjulet
// baklengs like fort som armen går rundt, og kjedet overfører det 1:1. Dermed
// står hjulet under jorda stille i rommet, uansett hvor armen er.
export const parallelChain = makeChain('Parallellkjedet', layout.center, layout.earth, parallelSprocket.teeth, parallelSprocket.teeth);

// Runder månen går rundt jorda per runde armen tar (månefaser per år).
export const moonPerYear = (fixed.teeth / pinion.teeth) * (driveSprocket.teeth / moonSprocket.teeth);

const directionFrom = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);

// Alle vinklene, utledet fra inngangsvinkelen gjennom hvert inngrep.
export function anglesAt(input) {
  // Inngangen dreier mellomakselen med klokka, så armen går mot klokka (som jorda).
  const driveAngle = -input;

  // Hjulparet nederst: det store hjulet på røret er det armen sitter fast i.
  const armAngle = meshAngle(driveAngle, smallGear.teeth, bigGear.teeth, directionFrom(layout.drive, layout.center));

  // Herfra regner vi i armens koordinatsystem. Alt som sitter fast på
  // sentralakselen står stille i verden, så sett fra armen dreier det baklengs.
  const fixedAngle = -armAngle;
  const pinionAngle = meshAngle(fixedAngle, fixed.teeth, pinion.teeth, 0);

  const moonChainOffset = moonChain.offsetFor(pinionAngle);
  const moonAngle = moonChain.angle2For(moonChainOffset);

  const parallelChainOffset = parallelChain.offsetFor(fixedAngle);
  const parallelAngle = parallelChain.angle2For(parallelChainOffset);

  return { driveAngle, armAngle, fixedAngle, pinionAngle, moonChainOffset, moonAngle, parallelChainOffset, parallelAngle };
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
