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
  uranus:  [313.23810451, 428.48202785],
  neptune: [-55.12002969, 218.45945325],
  moon:   [218.3164477, 481267.88123421],  // sett fra jorda
};
const moonNode = [125.0445479, -1934.1362891]; // månens oppstigende knute

// Jupiters måner: Lieske (E2×3), via Meeus kap. 44. Middellengde sett fra
// Jupiter ved JD 2443000,5 og grader per dag, mot vårjevndøgn B1950. Presesjonen
// fram til J2000 (0,698°) legges til, så de måles som planetene. Konstantene
// holder Laplace-forholdet: Io − 3 × Europa + 2 × Ganymedes = 180°.
const jovianEpoch = 2443000.5 - 2451545.0; // dager fra J2000
const toJ2000 = 1.3966626 * 0.5 + 0.0003088 * 0.25;
const jovian = {
  io:       [106.07719, 203.488955790],
  europa:   [175.73161, 101.374724735],
  ganymede: [120.55883, 50.317609207],
  callisto: [84.44459, 21.571071177],
};
for (const [name, [l0, perDay]] of Object.entries(jovian)) {
  meanLongitude[name] = [l0 - perDay * jovianEpoch + toJ2000, perDay * 36525];
}

// Saturns måner: middelelementer fra JPL (SAT441, epoke J2000, i Laplace-planet).
// Middellengden er node + perisentrumsargument + middelanomali, og den går en
// runde per omløpstid (dager). Lavpresisjon: nok til å vise omtrent hvor månene
// står, ikke til å regne ut ekte posisjoner.
const saturnian = {
  enceladus: [0.0 + 119.5 + 57.0, 1.370218],
  titan:     [78.6 + 78.3 + 11.7, 15.945448],
  iapetus:   [86.5 + 254.5 + 74.8, 79.331002],
};
for (const [name, [l0, period]] of Object.entries(saturnian)) {
  meanLongitude[name] = [l0, (360 / period) * 36525];
}

// Mars' måner: middelelementer fra JPL (epoke J2000, i Laplace-planet), som for Saturn.
const martian = {
  phobos: [169.2 + 216.3 + 189.7, 0.31891023],
  deimos: [54.3 + 0.0 + 205.0, 1.2624407],
};
for (const [name, [l0, period]] of Object.entries(martian)) {
  meanLongitude[name] = [l0, (360 / period) * 36525];
}

// Uranus' og Neptuns måner: middelelementer fra JPL (epoke J2000, i Laplace-planet),
// som for Saturn og Mars. Lavpresisjon. Triton går baklengs, så lengden minker.
const iceMoons = {
  titania: [99.8 + 284.4 + 24.6, 8.706234],
  oberon: [279.8 + 104.4 + 283.1, 13.463239],
  triton: [177.608 + 0.0 + 352.257, -5.876854],
};
for (const [name, [l0, period]] of Object.entries(iceMoons)) {
  meanLongitude[name] = [l0, (360 / period) * 36525];
}

// Mars' nordpol (IAU 2015: rektascensjon og deklinasjon ved J2000, med
// endring per århundre), regnet om til lengde på ekliptikken. Mars' ekvator
// har sin oppstigende knute på ekliptikken 90° forbi.
const marsPoleEquatorial = { ra: [317.68143, -0.1061], dec: [52.88650, -0.0609] };
// Uranus' nordpol etter IAU (den som ligger nord for ekliptikken; Uranus dreier
// baklengs). Den står fast.
const uranusPoleEquatorial = { ra: [257.311, 0], dec: [-15.175, 0] };
const obliquity = 23.4392911;

// Saturns ring: den oppstigende knuten til ringplanet på ekliptikken (Meeus kap. 45).
// Saturns nordpol heller mot lengde knute − 90°.
const saturnRingNode = [169.508470, 1.394681];

const degrees = (d) => (d * Math.PI) / 180;
const MS_PER_DAY = 86400000;
const J2000 = Date.UTC(2000, 0, 1, 12); // JD 2451545,0

// Ett år i modellen er én runde for jorda: 365,256 dager.
export const daysPerYear = (36525 * 360) / meanLongitude.earth[1];

const centuriesSinceJ2000 = (date) => (date.getTime() - J2000) / MS_PER_DAY / 36525;

// Middellengden i radianer (ikke begrenset til én runde).
export function longitudeAt(name, date) {
  const [l0, rate] = name === 'moonNode' ? moonNode : name === 'saturnRingNode' ? saturnRingNode : meanLongitude[name];
  return degrees(l0 + rate * centuriesSinceJ2000(date));
}

// Lengden på ekliptikken som Mars' nordpol heller mot, i radianer.
function poleLongitude(pole, date) {
  const T = centuriesSinceJ2000(date);
  const ra = degrees(pole.ra[0] + pole.ra[1] * T);
  const dec = degrees(pole.dec[0] + pole.dec[1] * T);
  const e = degrees(obliquity);
  return Math.atan2(Math.sin(ra) * Math.cos(e) + Math.tan(dec) * Math.sin(e), Math.cos(ra));
}
export const marsPoleLongitude = (date) => poleLongitude(marsPoleEquatorial, date);
// Lengden på ekliptikken som Uranus' nordpol (IAU) heller mot, i radianer.
export const uranusPoleLongitude = (date) => poleLongitude(uranusPoleEquatorial, date);

export const addYears =(date, years) => new Date(date.getTime() + years * daysPerYear * MS_PER_DAY);
