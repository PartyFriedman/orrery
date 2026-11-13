// Alle tall du vil justere, samlet på ett sted.
// Enheter: tenk på dem som millimeter.

export const gear = {
  teeth: 36,          // antall tenner
  module: 2,          // tannstørrelse (diameter = modul × antall tenner)
  pressureAngle: 20,  // trykkvinkel i grader (20 er standard; høyere = kraftigere, spissere tenner)
  thickness: 1.5,     // tykkelse på hjulet
  holeRadius: 4,      // radius på hullet i midten
  speed: 2,           // rotasjonshastighet i omdreininger per minutt

  // Eiker (utsparinger mellom nav og tannkrans)
  spokes: 3,          // antall eiker (0 = helt hjul uten utsparinger)
  spokeWidth: 3,      // bredden på hver eike
  hubWidth: 4,        // hvor bred ringen rundt hullet i midten er
  rimWidth: 3,        // hvor bred tannkransen er innenfor tennene
};

export const look = {
  background: '#d6d6d6', // lys grå bakgrunn
  gearColor: '#ffffff',  // matt hvitt
};
