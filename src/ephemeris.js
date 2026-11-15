// Hvor planetene og månen står på en dato, som middellengder: vinkelen sett
// fra sola (månen: fra jorda), målt mot klokka fra vårjevndøgnspunktet, for et
// legeme som går med jevn fart i en sirkel. Det er akkurat det en orrery viser.
// Den ekte posisjonen svinger rundt middellengden fordi banene er elliptiske
// (mest for Merkur, opptil ca. 24°).
//
// Planetene: JPL, Standish, «Approximate Positions of the Planets», tabell 1
// (1800–2050), lengde ved J2000 og grader per juliansk århundre.
// Månen: Meeus, «Astronomical Algorithms», kap. 47.

const meanLongitude = {
  mercury: [252.25032350, 149472.67411175],
  venus:   [181.97909950, 58517.81538729],
  earth:   [100.46457166, 35999.37244981],  // tyngdepunktet for jorda og månen
  mars:    [-4.55343205, 19140.30268499],
  jupiter: [34.39644051, 3034.74612775],
  saturn:  [49.95424423, 1222.49362201],
  moon:    [218.3164477, 481267.88123421],  // sett fra jorda
};
const moonNode = [125.0445479, -1934.1362891]; // månens oppstigende knute

const degrees = (d) => (d * Math.PI) / 180;
const MS_PER_DAY = 86400000;
const J2000 = Date.UTC(2000, 0, 1, 12); // JD 2451545,0

// Ett år i modellen er én runde for jorda: 365,256 dager.
export const daysPerYear = (36525 * 360) / meanLongitude.earth[1];

export const centuriesSinceJ2000 = (date) => (date.getTime() - J2000) / MS_PER_DAY / 36525;

// Middellengden i radianer (ikke begrenset til én runde).
export function longitudeAt(name, date) {
  const [l0, rate] = name === 'moonNode' ? moonNode : meanLongitude[name];
  return degrees(l0 + rate * centuriesSinceJ2000(date));
}

export const addYears = (date, years) => new Date(date.getTime() + years * daysPerYear * MS_PER_DAY);
