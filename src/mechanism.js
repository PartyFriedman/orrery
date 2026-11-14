// Mekanismen som ren matematikk (uten three.js): hvor akslene står, hvor
// kjedet går, og hvilken vinkel hvert hjul har for en gitt inngangsvinkel.
//
// Vinkler er i radianer, målt mot klokka sett ovenfra, fra +x.
// Posisjoner er i planet: { x, y } der planets y tilsvarer -z i three.js.

import { gear, bigGear, smallGear, arm, moonTrain } from './config.js';

const pitchRadius = (module, teeth) => (module * teeth) / 2;

// Vinkelen hjul 2 må ha for å gripe inn i hjul 1, når hjul 1 har vinkelen
// angle1 og hjul 2 står i retning `direction` fra hjul 1.
// Formelen gir motsatt dreieretning, forholdet teeth1/teeth2, og plasserer en
// tann på det ene hjulet midt i et mellomrom på det andre der de møtes.
export function meshAngle(angle1, teeth1, teeth2, direction) {
  return direction + Math.PI - Math.PI / teeth2 + (teeth1 / teeth2) * (direction - angle1);
}

const { fixed, pinion, driveSprocket, moonSprocket } = moonTrain;

// Mellomakselen står foran sentralakselen (mot kameraet), i riktig avstand
// for at hjulparet skal gripe inn i hverandre.
const driveDirection = -Math.PI / 2;
const driveDistance = pitchRadius(gear.module, bigGear.teeth) + pitchRadius(gear.module, smallGear.teeth);

// Pinionen står på armen, i riktig avstand fra det faste hjulet.
// Armen peker langs +x i sitt eget koordinatsystem.
const pinionX = pitchRadius(moonTrain.module, fixed.teeth) + pitchRadius(moonTrain.module, pinion.teeth);

export const layout = {
  drive: { x: Math.cos(driveDirection) * driveDistance, y: Math.sin(driveDirection) * driveDistance },
  pinion: { x: pinionX, y: 0 },
  earth: { x: arm.length, y: 0 },
};

// --- Kjedet ---
// Kjedet går rundt to kjedehjul: det store på pinion-akselen og det lille under
// jorda. Begge dreier samme vei, så kjedet beholder retningen.
//
// Kjedehjulenes radius er valgt så buen mellom to tenner er nøyaktig én
// ledd-lengde. Da ligger rullene i setene hele veien rundt.
const sprocketRadius = (teeth, pitch) => (teeth * pitch) / (2 * Math.PI);
const span = arm.length - pinionX; // avstanden mellom kjedehjulene

// Lengden av kjedebanen for en gitt ledd-lengde.
function loopLength(pitch) {
  const r1 = sprocketRadius(driveSprocket.teeth, pitch);
  const r2 = sprocketRadius(moonSprocket.teeth, pitch);
  const alpha = Math.acos((r1 - r2) / span);
  return 2 * Math.sqrt(span ** 2 - (r1 - r2) ** 2) + 2 * alpha * r2 + (2 * Math.PI - 2 * alpha) * r1;
}

// Kjedehjulene må få plass ved siden av hverandre, med litt luft.
const rollerRadius = moonTrain.chainPitch * 0.3;
const clearance = moonTrain.chainPitch * 2;
const sprocketsWidth =
  sprocketRadius(driveSprocket.teeth, moonTrain.chainPitch) +
  sprocketRadius(moonSprocket.teeth, moonTrain.chainPitch) +
  clearance;
if (span < sprocketsWidth) {
  throw new Error(
    `arm.length må være minst ${(pinionX + sprocketsWidth).toFixed(1)} med disse kjedehjulene (er ${arm.length}). ` +
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
const r1 = sprocketRadius(driveSprocket.teeth, pitch);
const r2 = sprocketRadius(moonSprocket.teeth, pitch);
const alpha = Math.acos((r1 - r2) / span); // hvor kjedet slipper hjulene
const straight = Math.sqrt(span ** 2 - (r1 - r2) ** 2);
const length = links * pitch;

// Banen går mot klokka: langs undersiden ut til jorda, rundt det lille hjulet,
// langs oversiden tilbake og rundt det store hjulet.
const arcSmallStart = straight;
const straightBackStart = arcSmallStart + 2 * alpha * r2;
const arcBigStart = straightBackStart + straight;

export const chain = { links, pitch, rollerRadius, driveRadius: r1, moonRadius: r2 };

// Punktet på kjedebanen en avstand `u` langs kjedet, i armens koordinatsystem.
export function chainPoint(u) {
  u = ((u % length) + length) % length;
  const p1 = layout.pinion;
  const p2 = layout.earth;
  const onCircle = (c, r, angle) => ({ x: c.x + r * Math.cos(angle), y: c.y + r * Math.sin(angle) });
  if (u < arcSmallStart) {
    const a = onCircle(p1, r1, -alpha);
    const b = onCircle(p2, r2, -alpha);
    const k = u / straight;
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  }
  if (u < straightBackStart) return onCircle(p2, r2, -alpha + (u - arcSmallStart) / r2);
  if (u < arcBigStart) {
    const a = onCircle(p2, r2, alpha);
    const b = onCircle(p1, r1, alpha);
    const k = (u - straightBackStart) / straight;
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  }
  return onCircle(p1, r1, alpha + (u - arcBigStart) / r1);
}

// Runder månen går rundt jorda per runde armen tar (månefaser per år).
export const moonPerYear = (fixed.teeth / pinion.teeth) * (driveSprocket.teeth / moonSprocket.teeth);

const directionFrom = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const center = { x: 0, y: 0 };

// Alle vinklene, utledet fra inngangsvinkelen gjennom hvert inngrep.
export function anglesAt(input) {
  // Inngangen dreier mellomakselen med klokka, så armen går mot klokka (som jorda).
  const driveAngle = -input;

  // Hjulparet nederst: det store hjulet på røret er det armen sitter fast i.
  const armAngle = meshAngle(driveAngle, smallGear.teeth, bigGear.teeth, directionFrom(layout.drive, center));

  // Herfra regner vi i armens koordinatsystem. Det faste hjulet står stille i
  // verden, så sett fra armen dreier det baklengs.
  const fixedAngle = -armAngle;
  const pinionAngle = meshAngle(fixedAngle, fixed.teeth, pinion.teeth, 0);

  // Kjedehjulet sitter på pinion-akselen og drar kjedet med seg: en bue på
  // hjulet er like lang som strekket kjedet flytter seg. Startpunktet er valgt
  // så rull nr. 0 ligger i et sete på det store hjulet.
  const chainOffset = arcBigStart - alpha * r1 + pinionAngle * r1;

  // Kjedet drar det lille hjulet like langt langs sin bue. Vinkelen er valgt så
  // rullene som ligger på det lille hjulet, også ligger i setene.
  const moonAngle = -alpha + (chainOffset - arcSmallStart) / r2;

  return { driveAngle, armAngle, fixedAngle, pinionAngle, chainOffset, moonAngle };
}
