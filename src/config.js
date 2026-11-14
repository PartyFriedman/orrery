// Alle tall du vil justere, samlet på ett sted.
// Enheter: tenk på dem som millimeter.

// Inngangen: mellomakselen dreies med fast fart. All annen bevegelse
// følger av tanntallene.
export const drive = {
  speed: 3,           // omdreininger per minutt for mellomakselen
};

// Felles for hjulparet nederst (må være like for at de skal kunne gripe inn i hverandre).
export const gear = {
  module: 2,          // tannstørrelse (diameter = modul × antall tenner)
  pressureAngle: 20,  // trykkvinkel i grader (20 er standard; høyere = kraftigere, spissere tenner)
  thickness: 1.5,     // tykkelse på hjulene
  chamfer: 0.3,       // avfasing: bredden på den skrå kanten rundt alle kanter (maks 40 % av tykkelsen)
  backlash: 0.2,      // litt klaring mellom tennene, så de ikke gnisser mot hverandre
};

// Det store hjulet: sitter nederst på røret rundt sentralakselen og bærer jordarmen.
// Hullet i midten er også tykkelsen på røret.
export const bigGear = {
  teeth: 36,          // antall tenner
  holeRadius: 4,      // radius på hullet i midten
  spokes: 3,          // antall eiker (0 = helt hjul uten utsparinger)
  spokeWidth: 3,      // bredden på hver eike
  hubWidth: 4,        // hvor bred ringen rundt hullet i midten er
  rimWidth: 3,        // hvor bred tannkransen er innenfor tennene
};

// Det lille hjulet: sitter på mellomakselen og driver det store.
export const smallGear = {
  teeth: 12,
  holeRadius: 2,
  spokes: 0,          // for lite til eiker med disse målene
  spokeWidth: 1.5,
  hubWidth: 2,
  rimWidth: 2,
};

// Jordarmen, som går fra røret i midten ut til jorda.
export const arm = {
  length: 80,         // fra sentrum til jorda
  width: 4,
  thickness: 1,
};

// Månehjulverket på jordarmen. Et fast hjul på sentralakselen driver en
// pinion på armen. På samme aksel sitter et kjedehjul, og et kjede overfører
// bevegelsen til kjedehjulet under jorda, som bærer månearmen.
// Månen går (fixed/pinion) × (driveSprocket/moonSprocket) runder rundt jorda per runde armen tar.
export const moonTrain = {
  module: 1,          // tannstørrelse på fixed og pinion
  thickness: 1,
  chamfer: 0.2,
  backlash: 0.1,
  // Avstanden mellom leddene i kjedet. Kjedehjulenes størrelse følger av den
  // og tanntallet. Den justeres litt automatisk så kjedet går opp i hele ledd.
  chainPitch: 1.5,
  fixed:         { teeth: 60, holeRadius: 2,   spokes: 5, spokeWidth: 2,   hubWidth: 3, rimWidth: 2 },   // fast på sentralakselen
  pinion:        { teeth: 12, holeRadius: 1,   spokes: 0, spokeWidth: 1,   hubWidth: 1, rimWidth: 1 },   // på armen, går rundt det faste hjulet
  driveSprocket: { teeth: 47, holeRadius: 1,   spokes: 4, spokeWidth: 1.5, hubWidth: 2, rimWidth: 1.5 }, // samme aksel som pinion
  moonSprocket:  { teeth: 19, holeRadius: 1.5, spokes: 0, spokeWidth: 1,   hubWidth: 1, rimWidth: 1 },   // under jorda, bærer månearmen
  // Parallellføringen: to like store kjedehjul, ett fast på sentralakselen og
  // ett under jorda. Hullet i midten følger akselen hvert hjul sitter på.
  parallelSprocket: { teeth: 24, spokes: 4, spokeWidth: 1, hubWidth: 1.5, rimWidth: 1 },
};

// Hellingene som parallellføringen holder i samme retning i rommet.
// Retninger er grader rundt, sett ovenfra: 0 = mot høyre (+x), 90 = bakover.
export const tilt = {
  earthAxis: 23.44,         // jordaksens helning
  earthAxisDirection: 0,    // retningen jordaksen heller mot
  moonOrbit: 5.14,          // månebanens helning mot jordbanen
  moonNodeDirection: 0,     // knutelinjen, der månen krysser jordbanen (høyest 90° etter)
};

// Kulene og hvor de sitter. Sola står i samme høyde som jorda, så linjen
// mellom dem er vannrett og månen går over og under den.
export const bodies = {
  sunRadius: 10,
  earthRadius: 4,
  earthHeight: 24,    // høyden på sentrum av jorda, sola og månen
  moonRadius: 1.5,
  moonOrbit: 15,      // avstanden fra jorda til månen
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
