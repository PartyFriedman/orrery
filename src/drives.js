// Drevene: hver del i mekanikken vet hvilke kropper den driver. Merket legges
// der delene lages (model.js og earthBuild.js), med drives(del, ...navn), og en
// del arver merket fra nærmeste forelder som har et. Brukes av drivvisningen
// (driveView.js) og av npm run check, som gir feil om en del ikke hører til
// noe drev.
//
// Regelen: en del hører til drevet til en kropp når kroppens stilling
// (posisjon eller retning) avhenger av den, eller når den bærer en slik del
// (aksel, rør, brakett, lager, fast hjul). 'all' hører til alle drev
// (sentralakselen og mellomakselen).

export const ALL = 'all';

export const moonsOf = {
  earth: ['moon'],
  mars: ['phobos', 'deimos'],
  jupiter: ['io', 'europa', 'ganymede', 'callisto'],
  saturn: ['titan', 'enceladus', 'iapetus'],
  uranus: ['titania', 'oberon'],
  neptune: ['triton'],
};

// En planet og månene den bærer.
export const system = (planet) => [planet, ...(moonsOf[planet] ?? [])];

// Merker en del (eller gruppe, eller en liste av dem) med kroppene den driver,
// og gir den tilbake.
export const drives = (object, ...names) => {
  for (const o of [object].flat()) o.userData.drives = names.flat();
  return object;
};

// Kroppene en del driver: merket på delen eller nærmeste forelder, ellers null.
export function drivesOf(object) {
  for (let o = object; o; o = o.parent) if (o.userData.drives) return o.userData.drives;
  return null;
}

// Navnet på kula en del er en del av (addPlanetSphere merker gruppa), ellers null.
export function bodyOf(object) {
  for (let o = object; o; o = o.parent) if (o.userData.body) return o.userData.body;
  return null;
}
