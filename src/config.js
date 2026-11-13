// Alle tall du vil justere, samlet på ett sted.
// Enheter: tenk på dem som millimeter.

// Felles for alle hjulene (må være like for at de skal kunne gripe inn i hverandre).
export const gear = {
  module: 2,          // tannstørrelse (diameter = modul × antall tenner)
  pressureAngle: 20,  // trykkvinkel i grader (20 er standard; høyere = kraftigere, spissere tenner)
  thickness: 1.5,     // tykkelse på hjulene
  backlash: 0.2,      // litt klaring mellom tennene, så de ikke gnisser mot hverandre
  speed: 2,           // farten på det store hjulet, i omdreininger per minutt
};

// Det store hjulet (driver).
export const bigGear = {
  teeth: 36,          // antall tenner
  holeRadius: 4,      // radius på hullet i midten
  spokes: 3,          // antall eiker (0 = helt hjul uten utsparinger)
  spokeWidth: 3,      // bredden på hver eike
  hubWidth: 4,        // hvor bred ringen rundt hullet i midten er
  rimWidth: 3,        // hvor bred tannkransen er innenfor tennene
};

// Det lille hjulet (drives av det store).
export const smallGear = {
  teeth: 12,          // antall tenner
  holeRadius: 2,
  spokes: 0,          // for lite til eiker med disse målene
  spokeWidth: 1.5,
  hubWidth: 2,
  rimWidth: 2,
};

export const look = {
  background: '#d6d6d6', // lys grå bakgrunn
  gearColor: '#ffffff',  // matt hvitt
};
