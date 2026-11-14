// Mekanismen som ren matematikk (uten three.js): hvor akslene står, og hvilken
// vinkel hvert hjul har for en gitt inngangsvinkel.
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

const { fixed, pinion, wheel, idler, moonWheel } = moonTrain;
const m = moonTrain.module;

// Mellomakselen står foran sentralakselen (mot kameraet), i riktig avstand
// for at hjulparet skal gripe inn i hverandre.
const driveDirection = -Math.PI / 2;
const driveDistance = pitchRadius(gear.module, bigGear.teeth) + pitchRadius(gear.module, smallGear.teeth);

// Månehjulverket, i armens eget koordinatsystem (armen peker langs +x).
const pinionX = pitchRadius(m, fixed.teeth) + pitchRadius(m, pinion.teeth);
const wheelToIdler = pitchRadius(m, wheel.teeth) + pitchRadius(m, idler.teeth);
const idlerToMoon = pitchRadius(m, idler.teeth) + pitchRadius(m, moonWheel.teeth);

// Mellomhjulet må stå i riktig avstand både fra wheel og fra månehjulet.
// Er armen kortere enn det rette strekket, skyves det ut til siden (en trekant).
const span = arm.length - pinionX;
const minLength = pinionX + Math.abs(wheelToIdler - idlerToMoon);
const maxLength = pinionX + wheelToIdler + idlerToMoon;
if (span <= Math.abs(wheelToIdler - idlerToMoon) || span > wheelToIdler + idlerToMoon) {
  throw new Error(
    `arm.length må være mellom ${minLength.toFixed(1)} og ${maxLength} med disse tanntallene (er ${arm.length}).`
  );
}
const along = (span ** 2 + wheelToIdler ** 2 - idlerToMoon ** 2) / (2 * span);
const side = Math.sqrt(Math.max(0, wheelToIdler ** 2 - along ** 2));

export const layout = {
  drive: { x: Math.cos(driveDirection) * driveDistance, y: Math.sin(driveDirection) * driveDistance },
  pinion: { x: pinionX, y: 0 },
  idler: { x: pinionX + along, y: -side },
  earth: { x: arm.length, y: 0 },
};

const directionFrom = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const center = { x: 0, y: 0 };

// Runder månen går rundt jorda per runde armen tar (månefaser per år).
export const moonPerYear = (fixed.teeth / pinion.teeth) * (wheel.teeth / moonWheel.teeth);

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
  // wheel sitter på samme aksel som pinion og har samme vinkel.
  const idlerAngle = meshAngle(pinionAngle, wheel.teeth, idler.teeth, directionFrom(layout.pinion, layout.idler));
  const moonAngle = meshAngle(idlerAngle, idler.teeth, moonWheel.teeth, directionFrom(layout.idler, layout.earth));

  return { driveAngle, armAngle, fixedAngle, pinionAngle, idlerAngle, moonAngle };
}
