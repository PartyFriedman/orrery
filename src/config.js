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

// Uranus og Neptun: omløpstidene er for lange til et hjulpar fra forlegsakselen
// (pinjongen ville blitt tynnere enn akselen). I stedet driver et ekstra hjul på
// Saturn-røret en motaksel i tårnet, like langt fra sentrum som de andre
// akslene. Fra motakselen går et hjulpar inn til Uranus-røret, Neptun-røret og
// par-uranus (se planets og uranusPost).
export const counterDrive = {
  saturnTeeth: 69,    // hjul nr. 2 på Saturn-røret, ett plan over det første
  shaftTeeth: 41,     // hjulet på motakselen som det driver
  angle: -60,         // hvor motakselen står: grader mot klokka fra mellomakselen, rundt sentrum
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
    io: 1821.6, europa: 1560.8, ganymede: 2634.1, callisto: 2410.3,
    enceladus: 252.1, titan: 2574.7, iapetus: 734.5,
    uranus: 25362, neptune: 24622,
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

// Saturns ring: tre bånd av frostet glass som dreier hver for seg rundt Saturns
// skrå akse og bærer hver sin måne (se saturnMoons). Ringen holder retningen i
// rommet, som jordaksen. Radiene er i ganger Saturns radius, bredder og
// tykkelser i mm. Samme tall brukes på testsiden rings.html (variant C).
// Cassinidelingen (spalten) deler ringen i to. Innenfor spalten deles ringen i
// bands − 1 like brede bånd (med 3 blir det C- og B-ringen), og utenfor ligger
// A-ringen. bands: 1 gir ingen deling utover spalten. I modellen må det være
// 3 bånd, ett per måne.
// De andre variantene på testsiden (ikke i modellen):
//   A satin       satengmatt hvit skive, spalten er åpen (båndene brukes ikke)
//   B instrument  tynne, konsentriske ringer i mørkt metall
//   D mix         glass innerst, satengmatt hvitt ytterst, mørk spalte
export const saturnRing = {
  inner: 1.2,           // innerkanten (ekte C-ring: 1,24)
  outer: 2.27,          // ytterkanten (ekte A-ring: 2,27)
  tilt: 26.7,           // hellingen mot banen, i grader
  gapCenter: 1.99,      // midten av spalten (ekte: 1,99)
  gapWidth: 0.076,      // bredden på spalten (ekte: 0,076, her ca. 0,24 mm)
  bands: 3,             // antall bånd, med A-ringen utenfor spalten
  bandSeam: 0.04,       // fugen mellom båndene i mm (0 = båndene møtes uten fuge)
  thickness: 0.12,      // tykkelsen på skiva
  chamfer: 0.03,        // avfasing langs kantene
  satin: { color: '#f4f6f7', roughness: 0.4, gloss: 0.7, glossRoughness: 0.3 },  // som hjulene (look)
  instrument: {
    rings: 14,          // antall ringer, fordelt på hver side av spalten etter bredden
    ringWidth: 0.06,    // bredden på hver ring
    thickness: 0.2,     // høyden på hver ring
    color: '#303538', metalness: 0.8, roughness: 0.35,
  },
  glass: {
    // Én tone per bånd, innenfra og ut (C, B, A). Har ringen flere bånd, brukes den siste.
    // transmission: hvor mye lys som går gjennom (gjennomskinnelighet: 1 = klart, 0 = ugjennomsiktig).
    // roughness: hvor frostet (0 = klart glass, 1 = helt matt).
    tones: [
      { color: '#aeb3b6', transmission: 0.9, roughness: 0.45 },   // C: svakest
      { color: '#f4f6f7', transmission: 0.5, roughness: 0.5 },    // B: lysest og tettest
      { color: '#d9dcde', transmission: 0.75, roughness: 0.45 },  // A
    ],
    ior: 1.5,           // lysbrytingen
    depth: 0.6,         // hvor tykt glasset virker for lysbrytingen
  },
  // Kantlys: glasset lyser svakt opp langs kantene og der man ser det på skrå,
  // som kanten på en glassplate. strength 0 = av.
  rim: { color: '#ffffff', strength: 0.35, sharpness: 3 },  // sharpness: høyere = smalere kant
  // Stagene under ringen: hvert bånd bæres av sine egne stag fra et nav på den
  // skrå akselen, som en paraply. Navene ligger så stagene går klar av kula.
  struts: { count: 3, width: 0.16, color: look.gearColor, metalness: 0.6, roughness: 0.45 },
  mix: {
    glassBands: 2,      // antall bånd innenfra som er glass (2 = alt innenfor spalten, 1 = bare C-ringen)
    gapColor: '#303538', gapMetalness: 0.6, gapRoughness: 0.45,  // den mørke spalten (som fugene)
    gapDepth: 0.5,      // tykkelsen på den mørke spalten, som andel av skiva
  },
  view: {               // kameraet på testsiden
    turn: 60,           // sekunder per runde rundt ringen
    bob: 24,            // sekunder fra lavest til høyest og ned igjen
    lowest: 0,          // laveste høyde i grader (0 = rett fra siden, så ringen sees fra kanten)
    highest: 70,        // høyeste høyde i grader
  },
};

// Saturns måner. Hvert glassbånd i ringen dreier for seg og bærer én måne på en
// arm over ringen: A-båndet (ytterst) Enceladus, rett ut i ringplanet; B-båndet
// Titan og C-båndet (innerst) Iapetus, på armer i lag over ringen. Månene står
// utenfor ringen i riktig rekkefølge.
// Drivet: et månerør i tårnet (drive-saturn) og et kjede langs Saturn-armen til
// en driveaksel midt i Saturn-stolpen. Øverst på driveakselen fører et skrått
// tannhjulspar (vinkelgiren) bevegelsen over i en skrå forlegsaksel, parallell
// med Saturns akse, og den driver de tre båndrørene rundt aksen:
//   Enceladus (A-røret): steps.enceladus, Titan (B-røret): steps.titan.
//   Iapetus (C-røret): fra et ekstra hjul på Titan-røret via en løs hylse på
//   forlegsakselen (iapetusStage: [Titan → hylse], [hylse → Iapetus]).
// Saturn-stolpen står stille i rommet: et eget rør i tårnet (par-saturn) dreier
// sakte, og kjedet parallelSprocket gjør at stolpen holder retningen. Det
// regnes eksakt, og gir feilmelding hvis tanntallene ikke går opp:
//   (parallel.layTeeth/parallel.tubeTeeth − saturn.layTeeth/saturn.tubeTeeth)
//   × (parallel.centerSprocket/parallel.postSprocket) = −saturn.layTeeth/saturn.tubeTeeth
// periods er bare målet (sidereale omløpstider i dager).
export const saturnMoons = {
  periods: { enceladus: 1.370218, titan: 15.945448, iapetus: 79.331002 },
  driveTeeth: 49,       // hjulet på mellomakselen som driver månerøret
  tubeTeeth: 30,        // hjulet nederst på månerøret
  tubeSprocket: 96,     // kjedehjulet på månerøret, over Saturn-armen
  shaftSprocket: 10,    // kjedehjulet nederst på driveakselen ved Saturn
  chainPitch: 1.0,      // ledd-lengden i begge kjedene langs Saturn-armen
  parallel: {
    layTeeth: 10,       // hjulet på forlegsakselen i tårnet som driver par-saturn
    tubeTeeth: 90,      // hjulet nederst på par-saturn
    centerSprocket: 90, // kjedehjulet på par-saturn
    postSprocket: 12,   // kjedehjulet nederst på stolpen ved Saturn
  },
  bevel: { driveTeeth: 24, layTeeth: 12, module: 0.15 },  // vinkelgiren: hjulet på driveakselen og på forlegsakselen
  layDistance: 7,       // fra Saturns akse til den skrå forlegsakselen
  steps: {              // [hjulet på forlegsakselen, hjulet på båndrøret]
    enceladus: [57, 20],
    titan: [12, 49],
  },
  iapetusStage: [[18, 53], [29, 49]],  // [Titan-røret → hylsa], [hylsa → Iapetus-røret]
  bandMoons: { A: 'enceladus', B: 'titan', C: 'iapetus' },  // hvilken måne hvert bånd bærer
  axleRadius: 0.4,      // den faste, skrå akselen gjennom Saturn
  tubeWall: 0.3,        // veggen i hvert båndrør
  shaftRadius: 0.4,     // den skrå forlegsakselen
  driveShaftRadius: 0.5, // driveakselen midt i stolpen
  frameWall: 0.3,       // veggen i stolperøret rundt driveakselen
  thickness: 0.5,       // tykkelsen på hjulene ved Saturn
  chamfer: 0.1,
  backlash: 0.05,
  armThickness: 0.25,   // månearmene over ringen
  armWidth: 0.5,
  legRadius: 0.15,      // de korte leddene opp fra båndene
  armLift: { titan: 0, iapetus: 0 },  // ekstra høyde over det som trengs, for hvert lag
  // Materialet på månearmene, leddene og føttene. Standard er satengmatt hvitt
  // som hjulene. Mørkt metall som i fugene: color '#303538', metalness 0.6,
  // roughness 0.45, gloss 0.
  armMaterial: { color: '#f4f6f7', metalness: 0, roughness: 0.4, gloss: 0.7 },
};

// Fobos og Deimos, med planetgir. Månene går i Mars' ekvatorplan (tilt), som
// holder retningen i rommet. Drivet:
//   månerøret i tårnet (drive-mars) → kjede langs Mars-armen → driveakselen
//   midt i Mars-stolpen → et dobbelt kryssledd (kardang) på toppen av stolpen
//   → en skrå drivaksel, parallell med Mars' akse, drive.distance ved siden av
//   den → et stort hjul, et mellomhjul (så dreieretningen blir riktig) og et
//   lite hjul på bæreren i planetgiret.
// Planetgiret rett under Mars: ringhjulet står fast, bæreren med planethjulene
// går med Deimos, og solhjulet med Fobos, (1 + ring × planet1 / (sun × planet2))
// ganger så fort. Planethjulene er trinnet: planet1 griper i solhjulet,
// planet2 i ringhjulet. Mars sitter rett over giret på en fast aksel som går
// ned gjennom giret til en skål under bæreren; skåla holder ringhjulet. En
// knekt brakett fra toppen av stolperøret holder ringhjulet i siden.
// Mars-stolpen holdes i samme retning i rommet av par-mars og parallellkjedet,
// og det regnes eksakt (feilmelding hvis tanntallene ikke går opp):
//   (parallel.driveTeeth/parallel.tubeTeeth − mars.driveTeeth/mars.tubeTeeth)
//   × (parallel.centerSprocket/parallel.postSprocket) = −mars.driveTeeth/mars.tubeTeeth
// periods er bare målet (sidereale omløpstider i dager).
export const marsMoons = {
  periods: { phobos: 0.31891023, deimos: 1.2624407 },
  tilt: 25.19,          // Mars' akse mot banen, i grader
  size: { phobos: 0.16, deimos: 0.12 },  // radiusen på månene (Mars er ca. 1,76)
  driveTeeth: 39,       // hjulet på mellomakselen som driver månerøret
  tubeTeeth: 13,        // hjulet nederst på månerøret
  tubeSprocket: 96,     // kjedehjulet på månerøret, over Mars-armen
  shaftSprocket: 8,     // kjedehjulet nederst på driveakselen ved Mars
  chainPitch: 1.0,      // ledd-lengden i begge kjedene langs Mars-armen
  parallel: {
    driveTeeth: 9,      // hjulet på mellomakselen som driver par-mars
    tubeTeeth: 62,      // hjulet nederst på par-mars
    centerSprocket: 66, // kjedehjulet på par-mars
    postSprocket: 12,   // kjedehjulet nederst på Mars-stolpen
  },
  drive: {              // fra den skrå drivakselen til bæreren
    distance: 4.4,      // fra Mars' akse til den skrå drivakselen (bestemmer også høyden på kryssleddet)
    bigTeeth: 34,       // det store hjulet på drivakselen
    idlerTeeth: 37,     // mellomhjulet (står på en tapp ute ved ringhjulet)
    smallTeeth: 12,     // det lille hjulet på bærerrøret
    module: 0.16,
  },
  planetary: {          // planetgiret under Mars
    sun: 23, planet1: 16, planet2: 12, ring: 51,  // ring = sun + planet1 + planet2 (planet2 lite, så akselen får plass mellom planethjulene)
    count: 3,           // antall planethjul
    module: 0.12,
  },
  axleRadius: 0.2,      // den faste akselen gjennom Mars
  tubeWall: 0.2,        // veggen i sol- og bærerrøret
  driveShaftRadius: 0.5, // driveakselen midt i stolpen
  frameWall: 0.3,       // veggen i stolperøret rundt driveakselen
  tiltShaftRadius: 0.25, // den skrå drivakselen
  pinRadius: 0.12,      // tappen mellomhjulet står på
  bowlThickness: 0.2,   // skåla under bæreren
  thickness: 0.35,      // tykkelsen på hjulene ved Mars
  chamfer: 0.06,
  backlash: 0.04,
  armThickness: 0.2,    // månearmene
  armWidth: 0.3,
  postRadius: 0.06,     // stolpene opp til månene
  jointRadius: 0.3,     // kryssleddet
  bracket: { radius: 0.2, fillet: 0.35 },  // den knekte braketten, og hvor langt de myke overgangene går
  armMaterial: { color: '#f4f6f7', metalness: 0, roughness: 0.4, gloss: 0.7 },  // månearmer og stolper
};

// Uranus' ringer: tynne ringer av mørkt glass i ekvatorplanet, som ligger nesten
// loddrett, fordi Uranus ligger på siden. Ringene holder retningen i rommet
// sammen med kula (se uranusPost). Radiene er i ganger Uranus' radius (de ekte
// hovedringene), bredder og tykkelser i mm. Legg til eller fjern ringer i lista;
// de ekte radiene til de andre: 5: 1.665, 4: 1.679, η: 1.860, γ: 1.878.
// scale drar ringene inn mot kula, som planetstørrelsene: radius = 1 + (r − 1) × scale.
// 1 gir de ekte radiene; 0.78 legger ε på ca. 1,8 og gjør Uranus- og Neptun-armen ca. 1,2 kortere.
export const uranusRing = {
  tilt: 97.77,          // aksens helning mot banen, i grader (over 90: aksen heller under vannrett)
  scale: 1,
  rings: [
    { name: '6', radius: 1.650, width: 0.05 },
    { name: 'α', radius: 1.763, width: 0.06 },
    { name: 'β', radius: 1.800, width: 0.06 },
    { name: 'δ', radius: 1.904, width: 0.06 },
    { name: 'ε', radius: 2.017, width: 0.14 },  // den bredeste og tydeligste
  ],
  thickness: 0.08,      // tykkelsen på ringene
  chamfer: 0.02,
  // Glasset, som i Saturns ring (variant C), men mørkt. Én tone per ring,
  // innenfra og ut; er det færre toner enn ringer, brukes den siste.
  // transmission: hvor mye lys som går gjennom (1 = klart). roughness: hvor frostet.
  glass: {
    tones: [{ color: '#3a3f44', transmission: 0.5, roughness: 0.4 }],
    ior: 1.5,
    depth: 0.3,
  },
  rim: { color: '#ffffff', strength: 0.35, sharpness: 3 },  // kantlys (strength 0 = av)
  // Ringene bæres av stag fra et nav på polakselen ut til den innerste ringen,
  // og tynne eiker i ringplanet binder ringene sammen.
  struts: { count: 3, width: 0.1, color: '#303538', metalness: 0.6, roughness: 0.45 },
  spokeWidth: 0.08,     // eikene i ringplanet
};

// Uranus holdes i polen, som en globus på siden: stolpen slutter under ringene,
// og en knekt brakett går vannrett ut langs polretningen, rett opp, og inn som
// en aksel i Uranus' pol. Et nav på polakselen bærer stagene til ringene.
// Stolpen står stille i rommet, som Saturn-stolpen: et eget rør i tårnet
// (par-uranus) dreier sakte, drevet fra motakselen, og et kjede langs armen gjør
// at stolpen holder retningen. Det regnes eksakt (feilmelding hvis tanntallene
// ikke går opp):
//   (parallel.counterTeeth/parallel.tubeTeeth − uranus.counterTeeth/uranus.tubeTeeth)
//   × (centerSprocket/postSprocket) = −uranus.counterTeeth/uranus.tubeTeeth
export const uranusPost = {
  parallel: {
    counterTeeth: 11,     // hjulet på motakselen som driver par-uranus
    tubeTeeth: 60,        // hjulet nederst på par-uranus
    centerSprocket: 100,  // kjedehjulet på par-uranus, over Uranus-armen
    postSprocket: 12,     // kjedehjulet nederst på Uranus-stolpen
  },
  chainPitch: 1.0,
  bracket: { radius: 0.25, fillet: 0.4 },  // braketten og polakselen, og hvor langt de myke overgangene går
  hub: { radius: 0.55, length: 0.5 },      // navet på polakselen som stagene går ut fra
};

// Månene til Uranus og Neptun. Brukes bare av prøvesiden moons.html (to
// alternativer for Uranus, A og B, og samme Neptun i begge) til du har valgt.
// Modellen leser ikke disse tallene ennå.
// Drivet er det samme som ved Jupiter og Saturn: et månerør i tårnet (fra
// mellomakselen, 3 runder per år) og ett kjede langs armen. Alt annet sitter ved planeten.
export const iceMoons = {
  periods: { titania: 8.706234, oberon: 13.463239, triton: 5.876854 },  // sidereale omløpstider i dager (bare målet)
  size: { titania: 0.16, oberon: 0.16, triton: 0.2 },
  // Uranus, som Saturn snudd på siden: kjedet går til en driveaksel inni
  // stolpen (stolpen blir et rør rundt den), en vinkelgir på toppen av stolpen
  // fører drivet over i en forlegsaksel parallell med Uranus' akse, og ett
  // hjulpar per måne går opp til rørene på polakselen.
  //   månerøret: 3 × driveTeeth / tubeTeeth runder per år
  //   driveakselen (sett fra stolpen, som står stille i rommet):
  //     (månerøret − Uranus) × tubeSprocket / shaftSprocket + Uranus
  //   forlegsakselen: driveakselen × bevel.driveTeeth / bevel.layTeeth
  //   månen: forlegsakselen × steps[måne][0] / steps[måne][1]
  uranus: {
    driveTeeth: 19, tubeTeeth: 39, tubeSprocket: 115, shaftSprocket: 12, chainPitch: 1.0,  // kjedehjulet ved sentrum må være større enn drive-uranus (radius 16,5)
    bevel: { driveTeeth: 30, layTeeth: 12, module: 0.15 },
    // Fra polakselen til forlegsakselen (under den). Månene går utenfor ringene
    // og ned forbi toppen av stolpen, så vinkelgiren må ligge under dem.
    layDistance: { A: 6.0, B: 7.7 },
    // Hvor hjulet på driveakselen ligger i vinkelgiren: 'above' er over
    // toppunktet (driveakselen går opp gjennom det), og bare det gir riktig
    // retning på månene. Hjulet ligger da høyere, så vinkelgiren må ligge så
    // lavt (layDistance) at Oberon går klar over den. A er bare på prøvesiden.
    bevelSide: { A: 'below', B: 'above' },
    steps: { titania: [35, 29], oberon: [32, 41] },  // [hjulet på forlegsakselen, hjulet på månerøret], nær 1 : 1
    thickness: 0.4,       // hjulene
    tubeWall: 0.3,        // månerørene på polakselen
    shaftRadius: 0.4,     // forlegsakselen
    driveShaftRadius: 0.5, frameWall: 0.3,  // driveakselen og stolperøret rundt den
    armThickness: 0.2, armWidth: 0.2, legRadius: 0.06,  // armene (A), kragene (B), stagene (B: armWidth er tykkelsen) og beina, smalere enn månene (0,32)
    hub: { length: 0.5, rise: 0.3 },        // navene på ringrørene (A)
    // Lagrene til forlegsakselen: ett i den loddrette delen av braketten og ett på
    // en bukk fra den vannrette delen (wall: veggen rundt akselen, length: lengden).
    bearing: { wall: 0.35, length: 0.5, postRadius: 0.15 },
  },
  // Neptun, som Jupiter med én måne: kjedet går til en krage på stolpen.
  // Kragen driver et dobbelthjul på en tapp (forlegsakselen), og det driver
  // Tritons rør gjennom ett mellomhjul. Mellomhjulet (rød ring) er grunnen
  // til at Triton går baklengs: tre inngrep i stedet for to.
  //   kragen (sett fra armen): (månerøret − Neptun) × tubeSprocket / collarSprocket
  //   Triton (sett fra armen): −kragen × (collarTeeth / layLow) × (layHigh / tritonTeeth)
  neptune: {
    driveTeeth: 41, tubeTeeth: 47, tubeSprocket: 117, collarSprocket: 10, chainPitch: 1.0,  // kjedehjulet ved sentrum må være større enn drive-neptune (radius 17,5)
    module: 0.1,
    collarTeeth: 39, layLow: 10, layHigh: 12, idlerTeeth: 16, tritonTeeth: 23,
    idlerSide: 1,         // hvilken side av armen mellomhjulet står på (1 eller −1)
    thickness: 0.5, tubeWall: 0.25, pinRadius: 0.15,
    bridge: { width: 0.4, thickness: 0.2 },  // bøylen fra tappen til mellomhjulet
    // Triton: banen heller tilt grader (over 90 = baklengs), knutelinjen på
    // tvers av armen. Triton går rundt stolpen i fast avstand (orbit), på en stav
    // som glir i en hylse ytterst på armen. En fot på staven hviler på en skrå
    // føringsring (som jordas måne), festet på stolpen under Neptun.
    orbit: 3.12, tilt: 130,
    // Føringsringen er et smalt bånd med loddrette sider. Den er høy nok til at
    // tappen under foten går klar av eikene under den der ringen stiger.
    guide: { radius: 2.5, width: 0.12, height: 0.8, hub: 0.4, spokes: 3, spokeRadius: 0.06 },
    armThickness: 0.4, sleeveRadius: 0.2, stalkRadius: 0.1, footRadius: 0.1,
    pinLength: 0.8,       // tappen under foten som hviler på ringen (lang nok til at foten går klar av ringen der den stiger)
  },
};

// Planetene (unntatt jorda): hver har sitt eget rør med et hjul nederst og en
// arm øverst. Omløpstiden følger av tanntallene:
//   driveTeeth: hjulet sitter på mellomakselen.
//     år per runde = (tubeTeeth / driveTeeth) × (smallGear.teeth / bigGear.teeth)
//   layTeeth: hjulet sitter på forlegsakselen (se outerDrive).
//     år per runde = (tubeTeeth / layTeeth) × (idlerLarge / driveSprocket) × (laySprocket / idlerSmall)
//                    × (smallGear.teeth / bigGear.teeth)
//   counterTeeth: hjulet sitter på motakselen (se counterDrive).
//     år per runde = Saturns år × (counterDrive.shaftTeeth / counterDrive.saturnTeeth) × (tubeTeeth / counterTeeth)
// period er bare målet den sammenlignes med.
// armLength: 'auto' gir den korteste armen som går klar av naboene, eller et tall.
// reachGap (valgfritt): mellomrommet til naboarmen innenfor, i stedet for spacing.reachGap.
// moons og ring: plass som reserveres rundt planeten (Jupiters måner er bygget).
// mechanism: mekanikken over armen ved sentrum:
//   'moons' = fast hjul, pinion og månekjede; 'moons+parallel' = også parallellkjede
//   (for en akse eller ring som skal holde retningen i rommet). Disse er bare reservert.
//   'moonDrive' = et månerør drevet fra mellomakselen og et kjede langs armen (se jupiterMoons).
//   'ringMoons' = Saturns dreiende ringbånd med månene, og stolpen som holder retningen (se saturnMoons).
//   'epicyclic' = Mars' planetgir med kardang og gaffel (se marsMoons).
//   'parallelMoons' = en stolpe som står stille i rommet, med par-røret og kjedet (uranusPost), og
//     Titania og Oberon drevet fra et månerør og et kjede (Uranus, se iceMoons.uranus).
//   'idlerMoon' = Triton, drevet fra et månerør og et kjede gjennom et mellomhjul (Neptun, se iceMoons.neptune).
export const planets = {
  mercury: { period: 0.2408, driveTeeth: 29, tubeTeeth: 21, armLength: 'auto', radius: planetSize('mercury') },
  venus:   { period: 0.6152, driveTeeth: 19, tubeTeeth: 35, armLength: 'auto', radius: planetSize('venus') },
  mars:    {
    period: 1.8809, driveTeeth: 11, tubeTeeth: 62, armLength: 'auto', radius: planetSize('mars'),
    moons: ['phobos', 'deimos'], mechanism: 'epicyclic',   // planetgir, se marsMoons
  },
  jupiter: {
    period: 11.862, layTeeth: 14, tubeTeeth: 44, armLength: 'auto', radius: planetSize('jupiter'),
    moons: ['io', 'europa', 'ganymede', 'callisto'], mechanism: 'moonDrive',
  },
  saturn:  {
    period: 29.457, layTeeth: 10, tubeTeeth: 78, armLength: 'auto', radius: planetSize('saturn'),
    ring: saturnRing,  // radiene og hellingen står i saturnRing
    moons: ['enceladus', 'titan', 'iapetus'], mechanism: 'ringMoons',
  },
  uranus:  {
    period: 84.0205, counterTeeth: 10, tubeTeeth: 48, armLength: 'auto', radius: planetSize('uranus'),
    ring: uranusRing,  // ringene og hellingen står i uranusRing
    mechanism: 'parallelMoons',  // stolpen holder retningen i rommet (uranusPost), og Titania og Oberon (iceMoons.uranus)
  },
  neptune: {
    period: 164.79, counterTeeth: 12, tubeTeeth: 113, armLength: 'auto', radius: planetSize('neptune'),
    mechanism: 'idlerMoon',  // Triton, drevet gjennom et mellomhjul (iceMoons.neptune)
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
  height: 61.0, // høyden på sentrum av sola og alle planetene (feilmelding hvis den er for lav; 45,5 før Uranus og Neptun, 55,1 før månene deres)
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
  earth:   { pattern: 'spiral', subdivisions: 2 },  // 80 trekanter
  mars:    { pattern: 'quads',     subdivisions: 3, amplitude: 0.32, bulge: 0.8, seamWidth: 0.01 },  // 54 firkanter
  moon:    { pattern: 'pentagons', subdivisions: 1 },  // 12 femkanter med en ring av trapeser rundt (72 paneler)
  jupiter: { pattern: 'bands',     subdivisions: 3 },  // 7 bånd à 16 firkanter, og en 16-kant over hver pol
  io:       { pattern: 'quads', subdivisions: 1 },     // Jupiters måner: 6 firkanter hver
  europa:   { pattern: 'quads', subdivisions: 1 },
  ganymede: { pattern: 'quads', subdivisions: 1 },
  callisto: { pattern: 'quads', subdivisions: 1 },
  phobos:   { pattern: 'quads', subdivisions: 1 },     // Mars' måner
  deimos:   { pattern: 'quads', subdivisions: 1 },
  saturn:  { pattern: 'hexagons',  subdivisions: 3 },  // 80 sekskanter og 12 femkanter
  enceladus: { pattern: 'quads', subdivisions: 1 },    // Saturns måner
  titan:     { pattern: 'quads', subdivisions: 1 },
  // Iapetus: uregelmessige fasetter, og panelene på siden som vender framover
  // (fartsretningen) i mørkt metall. split: 'leading' = den ledende halvdelen er mørk.
  iapetus:   { pattern: 'facets', subdivisions: 30, split: 'leading' },
  titania:  { pattern: 'quads', subdivisions: 1 },    // Uranus' måner
  oberon:   { pattern: 'quads', subdivisions: 1 },
  triton:   { pattern: 'quads', subdivisions: 1 },    // Neptuns måne
  uranus:  { pattern: 'triangles', subdivisions: 2 },  // 80 trekanter
  neptune: { pattern: 'rhombi',    subdivisions: 2 },  // 120 ruter
  // Sola: fire like paneler fra et tetraeder, der hver kant er en S-kurve (som
  // Trionda-ballen). amplitude er hvor langt S-en svinger ut (andel av
  // kantlengden). bulge gjør hver bue bredere ytterst: 0 gir rolige bølger,
  // rundt 1 gir tydelige armer. For store verdier gir en feilmelding.
  // Fugebredden på sola følger solradiusen (0,1 ved radius 10).
sun:     { pattern: 'plexusA', amplitude: 0.32, bulge: 0.2, seamWidth: 0.01 * bodies.sunRadius },
};

// Raske deler (månene, Saturns bånd og stag, hjulene og kjedene ved månene)
// flimrer når de flytter seg langt mellom to bilder. Over en grense får de i
// stedet et lysende spor (månene), en svak vifte bak seg (stag og armer) eller
// en glatt form (tannhjul og kjeder). Grensen er hvor mange grader en del dreier
// per bilde, så den gjelder alle deler, uansett fart og bildefrekvens.
export const blur = {
  threshold: 4,       // grader per bilde: under dette vises delen som den er
  fade: 8,            // over så mange grader til (fra threshold) er sporet, vifta eller den glatte formen helt inne
  trailLength: 1.5,   // sporet bak en måne: buen siden forrige bilde, ganget med dette
  trailColor: '#ffffff',
  trailOpacity: 0.6,  // hvor sterkt sporet lyser der det starter (ved månen)
  ringAbove: 90,      // grader per bilde: over dette blir sporet en hel, svak ring
  ringOpacity: 0.25,  // hvor sterk ringen er
  fanCopies: 6,       // antall gjennomsiktige kopier i vifta bak stag og armer
  fanOpacity: 0.25,   // hvor tydelig den nærmeste kopien er
  fanMaxAngle: 45,    // grader: vifta blir aldri bredere enn dette
};

// Rødt brukes sparsomt: sola, og en tynn ring der hver planetstolpe møter armen.
// Fargene. accent er det røde i mekanikken (ringene ved stolpene, mellomhjulet
// ved Neptun). bodies er én farge per kule, sola inkludert: toppen av panelene
// får fargen i den samme blanke lakken som før (look), og fugene er mørkt
// metall som før. Iapetus beholder den mørke halvdelen (panels.iapetus.split).
export const colors = {
  accent: '#f3f595',
  bodies: {
    sun: '#f3f595',       // glasset og lyset inni (accent.sunStyle)
    mercury: '#a8a29a',   // grå
    venus: '#e8d9a8',     // blek gul
    earth: '#6f93c4',     // blå
    moon: '#cbc8c1',      // lys grå
    mars: '#c06a43',      // rustrød
    phobos: '#8e8174', deimos: '#a39888',      // gråbrune
    jupiter: '#d9b88f',   // beige
    io: '#e6d46e',        // svovelgul
    europa: '#e3d8c0',    // lys krem
    ganymede: '#a79a88',  // gråbrun
    callisto: '#6f665d',  // mørk brun
    saturn: '#e6d3a0',    // blek gul
    enceladus: '#f4f6f7', // hvit
    titan: '#d49a52',     // oransje
    iapetus: '#d3cab8',   // lys beige
    uranus: '#a9dde2',    // lys turkis
    titania: '#bcb2a6', oberon: '#a1968a',     // gråbrune
    neptune: '#5577c9',   // blå
    triton: '#d9c7c1',    // rosagrå
  },
};

export const accent = {
  sunStyle: 'glass',    // 'lacquer' = blank lakk, 'glass' = glass med lys innenfra (fargen er colors.bodies.sun)
  glow: 1,                // hvor sterkt glasssola lyser innenfra (bare for 'glass')
  ringWidth: 0.16,        // tykkelsen på den røde ringen rundt planetstolpene
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
    nodes: 180,           // tettheten: antall noder
    //nodeSize: 0.045,      // radius på nodekulene
    //edgeWidth: 0.012,     // radius på stengene
    fill: 1,            // andel fasetter som er fylt (0–1)
    speed: 0.05,          // hvor fort nodene driver (svingninger per sekund)
    drift: 0.3,           // hvor langt de driver, som andel av avstanden mellom noder
    core: 0.90,           // kjernens radius, som andel av kula (0 = ingen kjerne)
    seed: 3,              // et annet tall gir en annen tilfeldig fordeling
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
    nodes: 370,
    nodeSize: 0.8,        // størrelsen på de lysende punktene (med glorie)
    linkDistance: 0.6,   // linjer mellom punkter nærmere enn dette (andel av radius)
    speed: 0.08,          // hvor fort punktene vandrer (radianer per sekund)
    depth: 0.08,          // hvor mye punktene ligger over og under kula (andel av radius)
    seed: 3,
  },
};
