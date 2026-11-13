// Alle tall du vil justere, samlet på ett sted.
// Enheter: tenk på dem som millimeter.

// Felles for alle hjulene (må være like for at de skal kunne gripe inn i hverandre).
export const gear = {
  module: 2,          // tannstørrelse (diameter = modul × antall tenner)
  pressureAngle: 20,  // trykkvinkel i grader (20 er standard; høyere = kraftigere, spissere tenner)
  thickness: 1.5,     // tykkelse på hjulene
  chamfer: 0.3,       // avfasing: bredden på den skrå kanten rundt alle kanter (maks 40 % av tykkelsen)
  backlash: 0.2,      // litt klaring mellom tennene, så de ikke gnisser mot hverandre
  speed: 1,           // farten på det store hjulet, i omdreininger per minutt
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
  // Bakgrunn: svak gradient ovenfra og ned.
  backgroundTop: '#3a3d40',
  backgroundBottom: '#121314',

  // Materialet (satengmatt hvit lakk).
  gearColor: '#f4f6f7',   // nesten hvit, så toppflaten ikke brenner ut
  roughness: 0.4,         // 0 = speil, 1 = helt matt
  gloss: 0.70,            // klarlakk-glans oppå (0 = ingen, 1 = full)
  glossRoughness: 0.3,    // hvor myk glansen er (lav = skarpere refleksjoner)

  // Lys.
  exposure: 1.2,              // total lysstyrke i bildet
  environmentIntensity: 0.2,  // mykt lys og refleksjoner fra omgivelsene
  lightIntensity: 5.0,        // styrken på hovedlyset
  lightHeight: 22,            // grader over gulvet (lavt = streiflys, 90 = rett ovenfra)
  lightDirection: 150,        // grader rundt: 0 = fra høyre, 90 = bakfra, 180 = fra venstre
  lightSpread: 1.1,           // hvor bred lyskjeglen er (lavere = mer dramatisk fall mot kantene)
  shadowStrength: 0.55,       // hvor mørk skyggen på gulvet er (0–1)
  shadowSoftness: 6,          // hvor myk skyggekanten er
};
