// Alle tall du vil justere, samlet på ett sted.
// Enheter: tenk på dem som millimeter.

// Tiden: modellen starter på startDate med planetene der de faktisk står den
// dagen (middellengder fra JPL), og glidebryteren nede på siden styrer hvor
// fort tiden går. Helt til venstre står den stille; ellers går skalaen jevnt
// (logaritmisk) fra slowest til fastest. Farten er i dager per sekund.
export const time = {
  startDate: 'today', // 'today' eller en dato som '2026-11-15'
  slowest: 0.25,      // laveste fart over null (6 timer per sekund)
  fastest: 365,       // høyeste fart (omtrent ett år per sekund)
  start: 2,           // farten når siden åpnes (0 = står stille)
};

// Inngangen: mellomakselen driver alt. All bevegelse følger av tanntallene.
export const drive = {
  distance: 40,      // avstanden fra mellomakselen (og forlegsakselen) til sentrum; alle hjulpar og begge kjedene nederst må nå over den
  shaftRadius: 2,     // tykkelsen på mellomakselen
};

// Jupiter og Saturn: omløpstidene er for lange for ett hjulpar. To kjeder
// nederst i tårnet gir utvekslingen i to trinn, så ingen kjedehjul blir store:
// det første går fra mellomakselen til et løst dobbelt kjedehjul på
// sentralakselen, det andre derfra til forlegsakselen. Kjedene beholder
// dreieretningen. Fra forlegsakselen går et hjulpar inn til hvert rør.
// Forlegsakselen står like langt fra sentrum som mellomakselen, så hjulparene
// når over samme avstand.
export const outerDrive = {
  driveSprocket: 12,  // kjedehjulet på mellomakselen (første kjede)
  idlerLarge: 48,     // det løse hjulet på sentralakselen, nederst (første kjede)
  idlerSmall: 12,     // det løse hjulet, ett plan over (andre kjede)
  laySprocket: 34,    // kjedehjulet på forlegsakselen (andre kjede)
  chainPitch: 1.5,    // ledd-lengden i begge kjedene
  angle: 60,          // hvor forlegsakselen står: grader mot klokka fra mellomakselen, rundt sentrum
};

// Mellomrom. Mindre tall gir en mer kompakt modell.
export const spacing = {
  gap: 0.3,           // mellomrom i høyden mellom deler over hverandre
  chainGap: 0.9,      // ekstra luft mellom to kjeder over hverandre (lenkeplatene stikker 0,3 ut)
  reachGap: 0.8,      // minste avstand mellom det to naboarmer rekker over
  moonGap: 0.3,       // minste avstand mellom månebaner (og fra planeten til den første)
};

// Størrelsene på planetene og månene, i komprimert skala:
//   radius = earth × (ekte radius / jordas radius) ^ exponent
// exponent 0 gjør alle like store, 1 gir ekte forhold. Måner får det samme,
// ganget med moonScale, men aldri mindre enn minMoon. Sola har egen radius.
export const sizes = {
  earth: 2,           // jordas radius
  exponent: 0.2,
  moonScale: 0.5,
  minMoon: 0.3,
  km: {               // ekte radier i km
    mercury: 2439.7, venus: 6051.8, earth: 6371.0, mars: 3389.5, jupiter: 69911, saturn: 58232,
    moon: 1737.4, phobos: 11.3, deimos: 6.2,
    io: 1821.6, europa: 1560.8, ganymede: 2634.1, callisto: 2410.3, titan: 2574.7,
  },
};
export const planetSize = (name) => sizes.earth * (sizes.km[name] / sizes.km.earth) ** sizes.exponent;
export const moonSize = (name) => Math.max(sizes.minMoon, sizes.moonScale * planetSize(name));

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
  thickness: 1.0,     // tykkelse på hjulene
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

// Jordarmen, som går fra røret i midten ut til jorda. Bredden og tykkelsen
// gjelder alle armene (planetarmene er 3/4 så brede).
export const arm = {
  length: 'auto',     // fra sentrum til jorda; 'auto' = så kort som mekanikken tillater
  width: 4,
  thickness: 0.6,
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

// Planetene (unntatt jorda): hver har sitt eget rør med et hjul nederst og en
// arm øverst. Omløpstiden følger av tanntallene:
//   driveTeeth: hjulet sitter på mellomakselen.
//     år per runde = (tubeTeeth / driveTeeth) × (smallGear.teeth / bigGear.teeth)
//   layTeeth: hjulet sitter på forlegsakselen (se outerDrive).
//     år per runde = (tubeTeeth / layTeeth) × (idlerLarge / driveSprocket) × (laySprocket / idlerSmall)
//                    × (smallGear.teeth / bigGear.teeth)
// period er bare målet den sammenlignes med.
// armLength: 'auto' gir den korteste armen som går klar av naboene, eller et tall.
// moons og ring: plass som reserveres rundt planeten (Jupiters måner er bygget).
// mechanism: mekanikken over armen ved sentrum:
//   'moons' = fast hjul, pinion og månekjede; 'moons+parallel' = også parallellkjede
//   (for en akse eller ring som skal holde retningen i rommet). Disse er bare reservert.
//   'moonDrive' = et månerør drevet fra mellomakselen og et kjede langs armen (se jupiterMoons).
export const planets = {
  mercury: { period: 0.2408, driveTeeth: 29, tubeTeeth: 21, armLength: 'auto', radius: planetSize('mercury') },
  venus:   { period: 0.6152, driveTeeth: 19, tubeTeeth: 35, armLength: 'auto', radius: planetSize('venus') },
  mars:    {
    period: 1.8809, driveTeeth: 11, tubeTeeth: 62, armLength: 'auto', radius: planetSize('mars'),
    moons: ['phobos', 'deimos'], mechanism: 'moons+parallel',   // Mars heller 25°
  },
  jupiter: {
    period: 11.862, layTeeth: 14, tubeTeeth: 44, armLength: 'auto', radius: planetSize('jupiter'),
    moons: ['io', 'europa', 'ganymede', 'callisto'], mechanism: 'moonDrive',
  },
  saturn:  {
    period: 29.457, layTeeth: 10, tubeTeeth: 78, armLength: 'auto', radius: planetSize('saturn'),
    ring: { inner: 1.2, outer: 2.27, tilt: 26.7 },  // ringen i ganger planetens radius, og hellingen
    moons: ['titan'], mechanism: 'moons+parallel',
  },
};

// Månehjulverket på jordarmen. Et fast hjul driver en pinion på armen. Det
// faste hjulet sitter på et eget fast rør mellom Venus-røret og jord-røret
// (sentralakselen er dekket av Merkur- og Venus-rørene der). På samme aksel sitter et kjedehjul, og et kjede overfører
// bevegelsen til kjedehjulet under jorda, som bærer månearmen.
// Månen går (fixed/pinion) × (driveSprocket/moonSprocket) runder rundt jorda per runde armen tar.
// Pinionens plass og kjedehjulenes størrelse bestemmer den korteste jordarmen.
export const moonTrain = {
  module: 0.35,          // tannstørrelse på fixed og pinion
  thickness: 0.6,
  chamfer: 0.15,
  backlash: 0.1,
  // Avstanden mellom leddene i kjedet. Kjedehjulenes størrelse følger av den
  // og tanntallet. Den justeres litt automatisk så kjedet går opp i hele ledd.
  chainPitch: 1.0,
  fixed:         { teeth: 60,                  spokes: 5, spokeWidth: 2,   hubWidth: 3, rimWidth: 2 },   // fast på det faste røret
  pinion:        { teeth: 12, holeRadius: 1,   spokes: 0, spokeWidth: 1,   hubWidth: 1, rimWidth: 1 },   // på armen, går rundt det faste hjulet
  driveSprocket: { teeth: 47, holeRadius: 1,   spokes: 4, spokeWidth: 1.5, hubWidth: 2, rimWidth: 1.5 }, // samme aksel som pinion
  moonSprocket:  { teeth: 19, holeRadius: 1.5, spokes: 0, spokeWidth: 1,   hubWidth: 1, rimWidth: 1 },   // under jorda, bærer månearmen
  // Parallellføringen: to like store kjedehjul, ett fast i midten og ett under
  // jorda. Hullet i midten følger røret eller tappen hvert hjul sitter på.
  parallelSprocket: { teeth: 36, spokes: 4, spokeWidth: 1, hubWidth: 1.5, rimWidth: 1 },
};

// Jupiters fire måner. Månene går for fort til et fast hjul ved sentrum, så de
// drives fra mellomakselen: et hjulpar i tårnet dreier et månerør (inni
// Jupiter-røret), og et kjede over Jupiter-armen tar bevegelsen ut til en
// krage som går løst på Jupiter-stolpen. Kragen driver en forlegsaksel på
// armen, og forlegsakselen driver ett rør per måne rundt stolpen:
//   Io, Europa og Ganymedes: 32→16, 24→24, 16→32. Sett fra armen går de
//   nøyaktig 4 : 2 : 1, som i den ekte resonansen.
//   Callisto: 10→47, det samme paret som kragen baklengs.
// Rørene ligger med Io innerst, så Io har hjulet nederst og armen øverst.
// Runder per runde månerøret tar, sett fra armen:
//   (tubeSprocket / collarSprocket) × (collarTeeth / collarPinion) × (forlegg / måne)
// periods er bare målet (sidereale omløpstider i dager).
export const jupiterMoons = {
  periods: { io: 1.769138, europa: 3.551181, ganymede: 7.154553, callisto: 16.689018 },
  driveTeeth: 27,       // hjulet på mellomakselen
  tubeTeeth: 20,        // hjulet nederst på månerøret
  tubeSprocket: 66,     // kjedehjulet øverst på månerøret, over Jupiter-armen
  collarSprocket: 12,   // kjedehjulet nederst på kragen ved Jupiter
  chainPitch: 1.0,      // ledd-lengden i kjedet langs armen
  collarTeeth: 47,      // tannhjulet på kragen
  collarPinion: 10,     // hjulet på forlegsakselen som kragen driver
  steps: {              // [hjulet på forlegsakselen, hjulet på månerøret]
    io: [32, 16],
    europa: [24, 24],
    ganymede: [16, 32],
    callisto: [10, 47],
  },
  layDistance: 6,       // fra Jupiter-stolpen inn til forlegsakselen (alle parene når over den)
  shaftRadius: 0.5,     // forlegsakselen
  tubeWall: 0.3,        // veggen i hvert månerør
  thickness: 0.5,       // tykkelsen på hjulene ved Jupiter
  chamfer: 0.1,
  backlash: 0.05,
  armThickness: 0.4,    // månearmene
  armWidth: 0.9,        // bredden på månearmene ved røret
  postRadius: 0.2,      // stolpene opp til månene
  topGap: 1.0,          // fra undersiden av Jupiter ned til toppen av den øverste månearmen
};

// Hellingene som parallellføringen holder i samme retning i rommet.
// Retninger er grader rundt, sett ovenfra: 0 = mot høyre (+x), 90 = bakover.
// equinoxDirection er retningen fra sola mot vårjevndøgnspunktet (lengde 0°),
// som alle planetposisjonene måles fra. Retningen jordaksen heller mot (lengde
// 90°) og månens knutelinje (på startdatoen) følger av den.
export const tilt = {
  earthAxis: 23.44,         // jordaksens helning
  moonOrbit: 5.14,          // månebanens helning mot jordbanen
  equinoxDirection: 0,      // retningen mot lengde 0°
};

// Kulene og hvor de sitter. Sola og planetene står i samme høyde, så linjen
// mellom jorda og sola er vannrett og månen går over og under den.
export const bodies = {
  sunRadius: 6,
  earthRadius: planetSize('earth'),
  height: 43,         // høyden på sentrum av sola og alle planetene (feilmelding hvis den er for lav)
  moonRadius: moonSize('moon'),
  moonOrbit: 4,       // avstanden fra jorda til månen (lavere gir for liten føringsring under jorda)
};

// Planetene og månen er kuler av paneler med smale, mørke fuger imellom, og
// hver har sitt eget mønster. Sola beholder sin glatte form foreløpig.
// Mønstre: 'triangles' (geodesiske trekanter), 'quads' (firkanter fra en kube),
// 'kites' (drager), 'rhombi' (ruter), 'pentagons' (femkanter med ringer rundt),
// 'bands' (breddebånd, med en mangekant over hver pol) og 'hexagons'
// (sekskanter, med de 12 femkantene en kule må ha; spart til Saturn).
// Nyere (se panels.js og testsiden panels.html): 'facets' (uregelmessige
// trekanter; subdivisions = antall hjørner, f.eks. 30 for få og store),
// 'boats', 'spiral', 'caps', 'volleyball', 'woven' og 'seam'.
// Plexus-kuler i stedet for paneler: 'plexusA', 'plexusB' og 'plexusC' (se plexus under).
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
  jupiter: { pattern: 'bands',     subdivisions: 3 },  // 7 bånd à 16 firkanter, og en 16-kant over hver pol
  io:       { pattern: 'quads', subdivisions: 1 },     // Jupiters måner: 6 firkanter hver
  europa:   { pattern: 'quads', subdivisions: 1 },
  ganymede: { pattern: 'quads', subdivisions: 1 },
  callisto: { pattern: 'quads', subdivisions: 1 },
  saturn:  { pattern: 'hexagons',  subdivisions: 3 },  // 80 sekskanter og 12 femkanter
  // Sola: fire like paneler fra et tetraeder, der hver kant er en S-kurve (som
  // Trionda-ballen). amplitude er hvor langt S-en svinger ut (andel av
  // kantlengden). bulge gjør hver bue bredere ytterst: 0 gir rolige bølger,
  // rundt 1 gir tydelige armer. For store verdier gir en feilmelding.
  // Fugebredden på sola følger solradiusen (0,1 ved radius 10).
  sun:     { pattern: 'trionda', amplitude: 0.32, bulge: 0.2, seamWidth: 0.01 * bodies.sunRadius },
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

  // Kjedene (ruller og lenkeplater). Standard er det samme som hjulene.
  // Mørkt metall som i fugene: '#303538', metalness 0.6, roughness 0.45.
  chainColor: '#303538',
  chainMetalness: 1,      // 0 = lakk, 1 = metall
  chainRoughness: 0.5,    // 0 = speil, 1 = helt matt
  chainGloss: 0.70,       // klarlakk-glans oppå (0 = ingen)

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

// Plexus-kuler. Vises på testsiden plexus.html, og på en kule i modellen når den
// har pattern 'plexusA', 'plexusB' eller 'plexusC' i panels over. Tallene her
// gjelder en kule med radius plexus.radius; på andre kuler skaleres nodene og
// stengene med radiusen. Tall i panels erstatter dem her for den ene kula, for
// eksempel jupiter: { pattern: 'plexusB', nodes: 50 }.
// A og B: noder spredt uregelmessig på kula og bundet sammen i trekanter. Nodene
// er små kuler i hvit lakk, kantene tynne stenger i mørkt metall. Noen fasetter
// er fylt, resten åpne, og inni ligger en fasettert kjerne. Nodene driver sakte
// rundt hvert sitt hvilepunkt langs kula, og kantene følger etter.
// C: den typiske «motion graphics»-plexusen, til sammenligning: lysende punkter
// som vandrer over kula, og tynne linjer mellom alle som er nær hverandre. Linjene
// tones ut med avstanden, og kommer og går mens punktene flytter seg.
export const plexus = {
  radius: 3,              // kulenes radius på testsiden
  A: {                    // tett og fin
    nodes: 280,           // tettheten: antall noder
    nodeSize: 0.045,      // radius på nodekulene
    edgeWidth: 0.012,     // radius på stengene
    fill: 0.3,            // andel fasetter som er fylt (0–1)
    speed: 0.05,          // hvor fort nodene driver (svingninger per sekund)
    drift: 0.3,           // hvor langt de driver, som andel av avstanden mellom noder
    core: 0.55,           // kjernens radius, som andel av kula (0 = ingen kjerne)
    seed: 1,              // et annet tall gir en annen tilfeldig fordeling
  },
  B: {                    // grov, med få og store fasetter
    nodes: 34,
    nodeSize: 0.13,
    edgeWidth: 0.035,
    fill: 0.45,
    speed: 0.04,
    drift: 0.22,
    core: 0.6,
    seed: 7,
  },
  C: {                    // typisk motion graphics
    nodes: 170,
    nodeSize: 0.8,        // størrelsen på de lysende punktene (med glorie)
    linkDistance: 0.55,   // linjer mellom punkter nærmere enn dette (andel av radius)
    speed: 0.08,          // hvor fort punktene vandrer (radianer per sekund)
    depth: 0.08,          // hvor mye punktene ligger over og under kula (andel av radius)
    seed: 3,
  },
};
