// Alle tall du vil justere, samlet på ett sted.
// Enheter: tenk på dem som millimeter.

// Inngangen: mellomakselen dreies med fast fart. All annen bevegelse
// følger av tanntallene.
export const drive = {
  speed: 3,           // omdreininger per minutt for mellomakselen
  distance: 48,       // avstanden fra mellomakselen til sentrum; alle hjulpar må nå over den
  shaftRadius: 2,     // tykkelsen på mellomakselen
};

// Sentralakselen og rørene rundt den. Rørene ligger innenfra og ut i den
// rekkefølgen armene trenger (kortest arm innerst), og radiene følger av den.
export const center = {
  axleRadius: 1.5,    // den faste sentralakselen
  tubeWall: 1,        // hvor mye tykkere hvert rør er enn det inni
};

// Felles for hjulparene nederst. Tannstørrelsen (modulen) regnes ut for hvert
// par, så paret når nøyaktig fra mellomakselen til sentrum.
export const gear = {
  pressureAngle: 20,  // trykkvinkel i grader (20 er standard; høyere = kraftigere, spissere tenner)
  thickness: 1.5,     // tykkelse på hjulene
  chamfer: 0.3,       // avfasing: bredden på den skrå kanten rundt alle kanter (maks 40 % av tykkelsen)
  backlash: 0.2,      // litt klaring mellom tennene, så de ikke gnisser mot hverandre
};

// Det store hjulet: sitter nederst på jordas rør og bærer jordarmen.
// Hullet i midten følger røret.
export const bigGear = {
  teeth: 36,          // antall tenner
  spokes: 3,          // antall eiker (0 = helt hjul uten utsparinger)
  spokeWidth: 3,      // bredden på hver eike
  hubWidth: 4,        // hvor bred ringen rundt hullet i midten er
  rimWidth: 3,        // hvor bred tannkransen er innenfor tennene
};

// Det lille hjulet: sitter på mellomakselen og driver det store.
export const smallGear = {
  teeth: 12,
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

// Merkur, Venus og Mars: hver har sitt eget rør med et hjul nederst, drevet fra
// mellomakselen, og en arm øverst. Omløpstiden følger av tanntallene:
// år per runde = (tubeTeeth / driveTeeth) × (smallGear.teeth / bigGear.teeth).
// period er bare målet den sammenlignes med. radius er kulas størrelse
// (jorda har bodies.earthRadius).
export const planets = {
  mercury: { period: 0.2408, driveTeeth: 29, tubeTeeth: 21, armLength: 30,  radius: 1.5 },
  venus:   { period: 0.6152, driveTeeth: 19, tubeTeeth: 35, armLength: 52,  radius: 3.8 },
  mars:    { period: 1.8809, driveTeeth: 11, tubeTeeth: 62, armLength: 108, radius: 2.1 },
};

// Månehjulverket på jordarmen. Et fast hjul driver en pinion på armen. Det
// faste hjulet sitter på et eget fast rør mellom Venus-røret og jord-røret
// (sentralakselen er dekket av Merkur- og Venus-rørene der). På samme aksel sitter et kjedehjul, og et kjede overfører
// bevegelsen til kjedehjulet under jorda, som bærer månearmen.
// Månen går (fixed/pinion) × (driveSprocket/moonSprocket) runder rundt jorda per runde armen tar.
export const moonTrain = {
  module: 0.7,          // tannstørrelse på fixed og pinion
  thickness: 1,
  chamfer: 0.2,
  backlash: 0.1,
  // Avstanden mellom leddene i kjedet. Kjedehjulenes størrelse følger av den
  // og tanntallet. Den justeres litt automatisk så kjedet går opp i hele ledd.
  chainPitch: 1.5,
  fixed:         { teeth: 60,                  spokes: 5, spokeWidth: 2,   hubWidth: 3, rimWidth: 2 },   // fast på det faste røret
  pinion:        { teeth: 12, holeRadius: 1,   spokes: 0, spokeWidth: 1,   hubWidth: 1, rimWidth: 1 },   // på armen, går rundt det faste hjulet
  driveSprocket: { teeth: 47, holeRadius: 1,   spokes: 4, spokeWidth: 1.5, hubWidth: 2, rimWidth: 1.5 }, // samme aksel som pinion
  moonSprocket:  { teeth: 19, holeRadius: 1.5, spokes: 0, spokeWidth: 1,   hubWidth: 1, rimWidth: 1 },   // under jorda, bærer månearmen
  // Parallellføringen: to like store kjedehjul, ett fast i midten og ett under
  // jorda. Hullet i midten følger røret eller tappen hvert hjul sitter på.
  parallelSprocket: { teeth: 32, spokes: 4, spokeWidth: 1, hubWidth: 1.5, rimWidth: 1 },
};

// Hellingene som parallellføringen holder i samme retning i rommet.
// Retninger er grader rundt, sett ovenfra: 0 = mot høyre (+x), 90 = bakover.
export const tilt = {
  earthAxis: 23.44,         // jordaksens helning
  earthAxisDirection: 0,    // retningen jordaksen heller mot
  moonOrbit: 5.14,          // månebanens helning mot jordbanen
  moonNodeDirection: 0,     // knutelinjen, der månen krysser jordbanen (høyest 90° etter)
};

// Kulene og hvor de sitter. Sola og planetene står i samme høyde, så linjen
// mellom jorda og sola er vannrett og månen går over og under den.
export const bodies = {
  sunRadius: 10,
  earthRadius: 4,
  height: 34,         // høyden på sentrum av sola og alle planetene
  moonRadius: 1.1,    // 27 % av jorda, som i virkeligheten
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
