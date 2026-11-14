// Alle tall du vil justere, samlet på ett sted.
// Enheter: tenk på dem som millimeter.

// Inngangen: mellomakselen dreies med fast fart. All annen bevegelse
// følger av tanntallene.
export const drive = {
  speed: 1,           // omdreininger per minutt for mellomakselen
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

// Formen på armene (planetarmene, jordarmen og månearmen): de smalner av fra
// navet ut mot kula, har runde ender, møter navet med en myk overgang, og
// stolpen møter armen med en krage.
export const armStyle = {
  tipWidth: 0.40,     // bredden ytterst, som andel av bredden ved navet
  fillet: 2,          // hvor langt ut langs armen den myke overgangen inn i navet går
  chamfer: 0.2,       // avfasing langs kantene
  hubRise: 0.2,       // så mye navet stikker opp over og ned under armen
  collarWidth: 0.4,   // hvor langt kragen går ut fra stolpen nederst
  collarHeight: 0.65,  // høyden på kragen
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

// Planetene og månen er kuler av paneler med smale, mørke fuger imellom, og
// hver har sitt eget mønster. Sola beholder sin glatte form foreløpig.
// Mønstre: 'triangles' (geodesiske trekanter), 'quads' (firkanter fra en kube),
// 'kites' (drager), 'rhombi' (ruter), 'pentagons' (femkanter med ringer rundt).
// Sekskanter er spart til Saturn.
// subdivisions: hvor mange biter hver grunnflate deles i langs kanten.
export const panels = {
  shape: 'curved',    // 'curved' = panelene følger kula (rund silhuett), 'flat' = flate plater
  seamWidth: 0.04,    // bredden på fugene
  seamDepth: 0.12,    // hvor dypt fugene går ned til den mørke kjernen
  // seamWidth og seamDepth kan også settes på hver kule under, for eksempel
  // bredere fuger på sola og store planeter. Da gjelder den verdien for den kula.
  mercury: { pattern: 'kites',     subdivisions: 1 },  // 60 drager
  venus:   { pattern: 'rhombi',    subdivisions: 2 },  // 120 ruter
  earth:   { pattern: 'triangles', subdivisions: 2 },  // 80 trekanter
  mars:    { pattern: 'quads',     subdivisions: 3 },  // 54 firkanter
  moon:    { pattern: 'pentagons', subdivisions: 1 },  // 12 femkanter med en ring av trapeser rundt (72 paneler)
  // Sola: fire like paneler fra et tetraeder, der hver kant er en S-kurve (som
  // Trionda-ballen). amplitude er hvor langt S-en svinger ut (andel av
  // kantlengden). bulge gjør hver bue bredere ytterst: 0 gir rolige bølger,
  // rundt 1 gir tydelige armer. For store verdier gir en feilmelding.
  sun:     { pattern: 'trionda', amplitude: 0.32, bulge: 0.2, seamWidth: 0.1 },  // sola er stor: bredere fuger
};

// Rødt brukes sparsomt: sola, og en tynn ring der hver planetstolpe møter armen.
export const accent = {
  red: '#960820',         // fargen på det røde
  sunStyle: 'glass',    // 'lacquer' = blank rød lakk, 'glass' = rødt glass med lys innenfra
  glow: 1,                // hvor sterkt glasssola lyser innenfra (bare for 'glass')
  ringWidth: 0.16,        // tykkelsen på den røde ringen rundt planetstolpene
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

  // Mørkt metall i fugene mellom panelene.
  seamColor: '#303538',
  seamMetalness: 0.6,
  seamRoughness: 0.45,

  // Lys.
  exposure: 1.0,              // total lysstyrke i bildet
  environmentIntensity: 0.2,  // mykt lys og refleksjoner fra omgivelsene
  lightIntensity: 5.0,        // styrken på hovedlyset
  lightHeight: 22,            // grader over gulvet (lavt = streiflys, 90 = rett ovenfra)
  lightDirection: 150,        // grader rundt: 0 = fra høyre, 90 = bakfra, 180 = fra venstre
  lightSpread: 1.1,           // hvor bred lyskjeglen er (lavere = mer dramatisk fall mot kantene)
  shadowStrength: 0.55,       // hvor mørk skyggen på gulvet er (0–1)
  shadowSoftness: 6,          // hvor myk skyggekanten er
};
