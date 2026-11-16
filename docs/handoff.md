# Handoff: orrery (mekanisk solsystem i three.js) – 16.11.2026

## Prosjekt og status
- Mappe: `c:\Users\oyvin\Desktop\Projects\Vibekoding\claudecode_VScode\orrery` (Vite + three.js, `npm run dev` / `npm run build`). Repo: PartyFriedman/orrery, publiseres til GitHub Pages fra `main` via `.github/workflows/deploy.yml` (base `/orrery/` i `vite.config.js`).
- Gren: `Ice-Giants`. Uranus og Neptun (uten måner) er bygget her, ikke committet (se Uranus og Neptun). Mars (grenen `Mars-moons`) er committet. Merget så langt:
  - PR #6 (`Outer-Planets`): Jupiter og Saturn, med to kjeder via et løst hjul på sentralakselen («Changes large cog»).
  - PR #7 (`Speed-Control`, commit «Add Time Control»): glidebryter for tid, med planetene stilt inn etter ekte dato (se Tid og dato).
  - PR #8 (`Jupiter-moons`): Jupiters fire måner med synlig 4:2:1-resonans (se Jupiters måner), eget materiale på kjedene, og nye panelmønstre, plexus-kuler og to testsider (se Utseende og Testsider). Bygget går gjennom, og `npm run check` sier «Alt i orden».
- Planetene har fortsatt de gamle mønstrene. Brukeren vil beholde mønstrene, men gi kulene farger (se Utseende). Ikke bygget ennå.

## Arbeidsregler (fra brukeren)
- Svar på norsk. Forklar kort hva som endret seg.
- **Aldri commit eller push uten at brukeren ber om det.** Sjekk gren først; brukeren lager en ny gren per steg og merger via PR.
- Store steg: planmodus først, så bygging etter godkjenning.
- Brukeren justerer tall i `src/config.js` selv. Behold verdiene deres.
- **Ikke sett i gang med noe før brukeren ber om det.** Når brukeren deler noe eller sier hva de vil, svar kort og vent.
- Stilguide: `docs/styleguide_orrery.md`. Kun hvitt, mørkt metall og rødt på de mekaniske delene. Planetene og månene skal få farger og blank finish som ligner de ekte himmellegemene, med valg i config.
- Planetene: få, store flater fungerer bedre enn mange små. Unngå typisk sportsballgeometri (fotball, volleyball, tennisball, båter som en badeball). Moodboard: `images/inspiration/Planets moonboard.png` (uregelmessig fasettert lavpoly-kule og plexus).

## Filer
- `src/config.js`: alle innstillinger (se under).
- `src/mechanism.js`: ren matematikk uten three.js. Pakker armlengder automatisk, ordner rørene, regner ut høyder, akselposisjoner og kjeder (`makeChain`), og alle vinkler fra inngangen (`anglesAt`). Har feilmeldinger når noe ikke passer.
- `src/main.js`: scene, lys, kamera og alle deler. `addGear`, `addSprocket`, `addChain`, `addArm`, `addPlanetSphere`, `addSun`.
- `src/ephemeris.js`: middellengder for planetene (JPL, Standish tabell 1, også Uranus og Neptun), polene til Mars og Uranus (IAU), månen og knutelinjen (Meeus), og Jupiters måner (Lieske via Meeus kap. 44, B1950 + 0,698° presesjon til J2000). `daysPerYear` = 365,256 (én runde for jorda).
- `src/timeControl.js`: glidebryteren nede på siden (DOM), med dato og fart. Stilen ligger i `src/style.css`.
- `src/gear.js`: evolventtannhjul, kjedehjul og `extrudeFlat`.
- `src/arm.js`: armer som smalner av, med myk overgang inn i navet.
- `src/panels.js`: panelkuler, med mørke fuger. Panelene er buede eller flate.
  - Mangekanter (`const patterns`): `triangles`, `quads`, `kites`, `rhombi`, `pentagons`, `bands`, `hexagons`, `volleyball`, `woven` og `facets`.
  - Store paneler med buede kanter (`regionPatterns`): `boats`, `spiral`, `caps` og `seam`. De krympes med `insetRegion` (stereografisk projeksjon, fugen skalert så den blir like bred overalt) og fylles som `trionda` (sola: 4 S-kantede paneler fra et tetraeder).
  - `delaunayFlip` retter earcut-trekanter.
- `src/scatter.js`: uregelmessige, jevnt spredte punkter på en kule (`spread`, «best candidate»), trekantene mellom dem (`triangulate`, konvekst skall) og et tilfeldighetstall med seed (`random`). Brukes av `facets` og plexus.
- `src/plexus.js`: plexus-kulene `plexusA`, `plexusB` og `plexusC` (`createPlexus`). `addPlanetSphere` i `main.js` bruker den når en kule har et plexus-mønster, og animasjonen kaller `plexusUpdates` med vanlig tid.
- `src/testStage.js`: felles scene for testsidene (lys, kamera og materialer som i modellen, og navn under hver kule). `createRenderer`, `createLitScene` og `createMaterials` kan brukes for seg (rings.html gjør det).
- `src/ringLayout.js`: hvor båndene og spalten i Saturns ring ligger, og Uranus' tynne ringer (`thinRingLayout`) (ren matematikk). `src/ring.js`: `createAnnulus`, glassmaterialene med kantlys (`createGlassMaterials`) og glassbåndene (`createGlassBands`), brukt av både modellen og rings.html.
- `src/blur.js`: lysspor, vifter og glatte former for raske deler (se Utseende).
- `panels.html` + `src/panelTest.js`, `plexus.html` + `src/plexusTest.js` og `rings.html` + `src/ringTest.js`: testsidene (se Testsider).
- `scripts/check.mjs`: sjekkene bak `npm run check` (se under).

## Mekanikken
- **Én inngang:** mellomakselen står 40 fra sentrum. Alle hjulpar inn til sentrum når over 40, og hvert par får egen modul (`pairModule`).
- **Planetene:**
  - Jorda: 12→36, så mellomakselen går 3 ganger per år.
  - Merkur 29→21, Venus 19→35 og Mars 11→62 drives direkte fra mellomakselen.
  - Jupiter og Saturn: to kjeder helt nederst i tårnet, så ingen kjedehjul blir store (kjedene beholder dreieretningen):
    - Kjede 1 (`driveChain`): 12 på mellomakselen → 48 på et løst dobbelt kjedehjul på sentralakselen.
    - Kjede 2 (`layChain`, ett plan over): 12 på det løse hjulet → 34 på forlegsakselen, 60° fra mellomakselen.
    - 48·34/144 = 136/12, samme utveksling som det gamle enkeltkjedet 12→136. Derfra 14→44 (Jupiter) og 10→78 (Saturn).
    - Lengst ut når forlegshjulet, 48,7 fra sentrum, innenfor tårnets omriss. Det gamle 136-hjulet nådde 73,1 og tok fokus fra sola.
    - De to kjedehjulene på det løse hjulet holdes sammen av et nav (`idlerHub`, r = sentralaksel + 0,3). Det gir 0,39 klaring til platene i kjede 2, som er den trangeste klaringen i `npm run check`.
  - Alle omløpstidene er innen 0,25 %.
- **Jordas måne:**
  - Fast hjul 60, pinion 12 og kjede 47→19 gir 235/19 (Meton). Det faste hjulet sitter på et eget fast rør med brakett.
  - Parallellkjede 36:36 holder jordaksen (23,44°) og en skrå føringsring (månebane 5,14°) i fast retning.
- **Jupiters måner** (`jupiterMoons` i config, `jupiterTrain`, `jupiterChain`, `jupiterLayout` i `mechanism.js`):
  - Et fast hjul ved sentrum går ikke: Io går ca. 2450 runder per Jupiter-år. I stedet er Jupiters faste rør byttet med et **månerør** (`drive-jupiter`) som dreier.
  - Mellomaksel 27 → månerør 20 i tårnet. Øverst på månerøret sitter et kjedehjul 66, og et kjede (153 ledd) går over Jupiter-armen til et kjedehjul 12 på en **krage** som går løst på Jupiter-stolpen.
  - Kragen 47 → forlegsaksel 10. Forlegsakselen står `layDistance` = 6 innenfor stolpen, inne i kjedesløyfa.
  - Trappen fra forlegsakselen: Io 32→16, Europa 24→24, Ganymedes 16→32 (modul 0,25, sum 48). Sett fra armen går de nøyaktig 4:2:1, og Laplace-vinkelen står stille på 180°. Callisto 10→47 (samme par som kragen baklengs), så Callisto går like fort som kragen.
  - Fire rør rundt stolpen (vegg 0,3), Io innerst. Hjulene står nederst, og armene øverst rett under Jupiter, med `topGap` opp til kula. Månearmene er smale og uten krage (`armParts.jupiterMoon`, `addArm({ collar: false })`).
  - Omløpsfeil: Io +0,66 %, Europa +0,25 %, Ganymedes −0,56 %, Callisto −0,05 %. Prisen for eksakt 4:2:1 er at Io og Ganymedes ikke kan treffe begge.
  - Månene er 6-panels kuler (`quads`, 1), størrelse fra `moonSize` (`moonScale`, `minMoon`).
  - Stabelen over Jupiter-armen har bare kjedeplanet, så armene over sank ca. 0,2 (tårnet ble 0,4 høyere fordi månerøret har et helt hjul).
- **Saturn** (`saturnRing` og `saturnMoons` i config, `saturnTrain`, `saturnAxis`, `saturnBracket` i `mechanism.js`, mekanismetypen `'ringMoons'`):
  - Ringen er tre bånd av frostet glass (C, B, A) som dreier hver for seg rundt Saturns skrå akse (26,7°), og bærer hver sin måne på en arm over ringen: A Enceladus rett ut i ringplanet, B Titan ca. 0,95 over, C Iapetus ca. 2,2 over. Månene står utenfor ringen i riktig rekkefølge (pakket med `moonGap`). Bare det ytterste båndet kan ha armen i ringplanet; armene ligger i lag over ringen, og Iapetus må ligge på C fordi den drives fra Titan-røret ved siden av.
  - **Stolpen står stille i rommet** uten fast rør (Saturn-rørene er ca. 12 i radius ved sentrum): `par-saturn` i tårnet dreier sakte (forlegsakselen 10→90, Saturn-røret 10→78), og kjedet 90→12 gjør at stolpen holder retningen eksakt. Sjekkes med heltall i `mechanism.js`.
  - **Drivet:** månerøret `drive-saturn` (mellomakselen 49→30), kjede 96→10 til en driveaksel midt i stolpen. Stolpen er et rør rundt driveakselen. Øverst en vinkelgir (koniske hjul 24→12, `createBevelGeometry` i `gear.js`) med toppunkt P rett under Saturn; aksene står 26,7° fra hverandre, og begge hjulene ligger under P, så de dreier motsatt vei (ellers ville båndene gått baklengs). Den skrå forlegsakselen går gjennom P, `layDistance` = 7 fra Saturns akse.
  - **Båndrørene** rundt den faste, skrå akselen: C (Iapetus) innerst med hjulet nederst og navet øverst. Enceladus 57→20 (A), Titan 12→49 (B), Iapetus via en løs hylse på forlegsakselen fra et ekstra hjul på Titan-røret: 18→53, 29→49. Omløpsfeil ca. +0,04 % for alle tre.
  - **Paraplyen:** hvert båndrør har et nav med tre stag i mørkt metall opp til midten av undersiden av sitt bånd. Navnivåene regnes ut så stagene går klar av kula og av stagene og båndene over.
  - **Rammen:** en brakett fra toppen av stolperøret (ut til siden i z, opp og inn) til en plate under hjulene, som holder akselen og har et lagerøye rundt forlegsakselen.
  - Kula og ringen monteres så nordpolen heller mot ringens knute − 90° (Meeus kap. 45, Ω ≈ 169,5°). Månene stilles inn i ringplanet (`saturnInPlane`), etter JPL-middelelementer (SAT441, lavpresisjon).
  - Iapetus: `facets` 30 med `split: 'leading'` (ny i `createPanelGeometry`): den ledende halvdelen i mørkt metall (materialgruppe 2).
  - Saturn-armen er 78,3 (Iapetus går 11,3 ut).
- **Mars** (`marsMoons` i config, `marsTrain`, `marsAxis`, `marsBracket` i `mechanism.js`, mekanismetypen `'epicyclic'`): Fobos og Deimos med planetgir, den fjerde måten å lage månemekanikk på.
  - Stolpen står stille i rommet som hos Saturn: `par-mars` (mellomakselen 9→62, Mars-røret 11→62) og kjede 66→12, sjekket eksakt med heltall.
  - Drivet: månerøret `drive-mars` (mellomakselen 39→13), kjede 96→8 til driveakselen midt i stolpen. Den går opp til K på toppen av stolpen, der et dobbelt kryssledd (to ledd à 12,6°, jevn fart) knekker den over i en skrå drivaksel, parallell med Mars' akse og 4,4 fra den (`marsMoons.drive.distance`; den bestemmer også høyden på K).
  - Øverst på drivakselen: et stort hjul (34) → mellomhjul (37) → lite hjul (12) på bærerrøret, rett over planetgiret. Mellomhjulet trengs fordi et hjulpar snur retningen; det står på en tapp på en knast ytterst på ringhjulet.
  - Planetgiret rett under Mars, i ekvatorplanet: ringhjulet står fast, bæreren (tre trinnede planethjul, edderkopp-plater) går med Deimos, og solhjulet med Fobos (sol 23, planet 16/12, ring 51: 1 + 51·16/(23·12) = 3,9565). Planet2 er det lille, så den faste akselen får plass mellom planethjulene. Fobos +0,02 %, Deimos −0,03 %.
  - Den faste, skrå akselen går gjennom Mars og ned i en lukket skål under bæreren. Skåla holder ringhjulet, så aksel, skål, ringhjul og Mars er én stiv enhet. Den knekte braketten (`marsBracket`, `marsMoons.bracket`) går fra toppen av stolperøret vannrett ut, rett opp, og vannrett inn midt på ytterveggen (skål og ringhjul), med myke overganger (kjegler) i begge ender. Ingen gaffel eller ramme rundt Mars lenger.
  - Ekvatorplanet stilles etter Mars' pol (IAU, regnet om til ekliptikken: lengde ca. 352,9°). Månene er bittesmå (`marsMoons.size`: Fobos 0,16, Deimos 0,12) og stilles etter JPL-middelelementer.
  - Planet1 på hvert planethjul er satt på så det griper i solhjulet (fast vinkel mot planet2).
- **Uranus og Neptun** (`counterDrive`, `uranusRing`, `uranusPost` i config; `uranusTrain`, `uranusBracket`, `uranusAxis`, `uranusParallelChain` i `mechanism.js`; mekanismetypen `'parallelPost'`). Uten måner foreløpig.
  - **Drivet, motakselen:** ett hjulpar fra forlegsakselen går ikke (Uranus trenger 1:22, Neptun 1:44, og pinjongen ville blitt tynnere enn akselen).
    - Saturn-røret har et hjul nr. 2 (69, ett plan over det første, `heights.counterGear`). Det driver en motaksel (41) i tårnet, 40 fra sentrum ved −150° (speilet av forlegsakselen).
    - Fra motakselen: Uranus 10→48 (+0,03 %), Neptun 12→113 (+0,05 %), `par-uranus` 11→60.
    - Lengst ut når motakselens hjul 55,6 fra sentrum, innenfor tårnet (Venus 55,6, månerøret til Mars 71,5).
    - Vurdert, men ikke valgt: to kjeder til via et løst hjul på sentralakselen (som Jupiter/Saturn), ca. 1,7 høyere.
  - **Parallellføring:** som Saturn og Mars. `par-uranus` dreier sakte, og kjedet 100→12 langs armen gjør at stolpen står stille i rommet (sjekket eksakt med heltall). Jordas 1:1 med fast hjul gikk ikke: kjedehjulet ved Uranus måtte hatt radius ca. 15.
  - **Holderen (globus på siden):** ringplanet står bare 7,8° fra loddrett, så en stolpe rett opp i kula ville gått 0,03–0,16 fra ringene.
    - Stolpen slutter under ringene. En knekt brakett går vannrett ut langs polretningen, rett opp, og inn som polaksel i polen som peker nedover. Myke overganger ved stolpen og ved polen.
    - Navet er en hylse på polakselen fra overgangen ved polen. Tre stag i mørkt metall går fra navet til den innerste ringen, og tre eiker i ringplanet binder ringene sammen (asimut 60°, 180°, 300°, ingen mot braketten).
    - Ekvatorplanet er fritt, så polakselen kan senere bære månerør.
    - Retningen: IAU-polen (RA 257,311°, dekl. −15,175°) regnet om til ekliptikken (`uranusPoleLongitude`); polen med akselen heller mot lengde ca. 77,7°, 7,77° under vannrett (`uranusRing.tilt` 97,77).
  - **Ringene:** fem tynne ringer av mørkt glass med kantlys (som variant C): 6, α, β, δ, ε med ekte radier (1,650–2,017 R), ε bredest. Lista, tonen, bredder og `scale` står i `uranusRing`. `scale` < 1 drar ringene inn mot kula (0,78 gjør begge armene ca. 1,2 kortere).
  - Neptun er en vanlig planet (stolpe og kule), ytterst.
  - `planets.<navn>.reachGap` (valgfritt) erstatter `spacing.reachGap` for én arm.
  - **Størrelsen:** Uranus-armen 100,5, Neptun-armen 109,4, ytterste radius 112,0 (var 94,2: +17,8, ca. +19 %). Uranus med ringer tar 2 × 5,39.
- `bodies.height` er 55,1 (var 45,5 før Uranus og Neptun). Tårnet fikk fire hjulplan til (Saturns hjul nr. 2, par-uranus, Uranus, Neptun), og to armer kom under Saturn. Kravene: minst 54,3 for sola og ca. 55,05 for vinkelgiren ved Saturn (den strengeste).
  - Scenen har sidens gradient som bakgrunn (`scene.background`), så glasset har noe å se gjennom.
- **Stabling:** nederst ligger de to kjedene over hverandre (`heights.driveChain` og `heights.layChain`). Over dem står alle tannhjulene i et åpent tårn under alle armer. Rørene ligger med kortest arm innerst, og et fast rør inni røret til hver planet med mekanikk. Høydene regnes ut i `heights`.
- **Armlengder:** pakkes automatisk innenfra og ut (`armLength: 'auto'`), med `reachGap` mellom rekkeviddene. Mekanikken ved planeten tas med.
- Alt som var reservert, er nå bygget (`'moons+parallel'` brukes bare av jorda).
- **Størrelser:** r = `sizes.earth` · (R/R_jord)^`exponent` (2 og 0,2). Månene ganges med `moonScale` (0,5), minst `minMoon` (0,3). Sola har radius 6.

## Tid og dato
- **`time` i config:**
  - `startDate`: `'today'` eller en ISO-dato.
  - `slowest`, `fastest` og `start`, i dager per sekund.
- **Glidebryteren:** helt til venstre står modellen stille. Ellers er skalaen logaritmisk fra `slowest` til `fastest`. Tekstene er på engelsk, for eksempel «15 Nov 2026» og «2 days/s».
- **Innstillingen:** hvert hjul på mellomakselen og forlegsakselen står på akselen med en startvinkel (`phases` i `mechanism.js`, `mesh.rotation.y` i `main.js`). Det store månekjedehjulet 47 står med `phases.moon` på pinionakselen, og Jupiters måner med `phases.io` osv. på forlegsakselen ved Jupiter. Ved input 0 står da alt på middellengden for startdatoen. `anglesAt` returnerer også `moonDriveAngle`, og `worldAngleOf(navn, vinkler)` gir vinkelen i verden for planeter og måner.
- **Retninger:** `tilt.equinoxDirection` er retningen mot lengde 0°. Jordaksen heller mot 0° + 90°, og knutelinjen er Ω på startdatoen. Begge regnes ut; `earthAxisDirection` og `moonNodeDirection` er fjernet.
- **`drive.speed` er fjernet.** Animasjonen regner `years` og bruker input = `years · inputPerYear`. Hvert bilde dekker høyst 0,1 s.
- **`npm run check`** har en startsjekk som skriver ut lengdene ved startdatoen.

## Utseende
- **Armene:** `armStyle` styrer avsmalning, overgang, nav som stikker opp og ned, og krage. En tynn rød ring der planetstolpen møter armen.
- **Kulene:** mønster per kule i `panels.*`. Fugebredden kan settes per kule; på sola følger den `sunRadius`.
  - Standard: Merkur `kites`, Venus `rhombi`, jorda `triangles`, Mars `quads`, månen `pentagons`, Jupiter `bands`, Jupiters måner `quads` 1, Saturn `hexagons`, Uranus `triangles`, Neptun `rhombi`, sola `trionda`. Brukeren endrer dem selv i `panels`.
  - Nye mønstre som kan velges:
    - `facets`: uregelmessige trekanter med fuger; `subdivisions` er antall hjørner (30 gir 56 fasetter, 200 gir 396). Passer best med tilbakemeldingen om få, store flater.
    - `boats`, `spiral`, `caps`, `volleyball`, `woven` og `seam`: laget til sammenligning. Flere av dem er sportsballgeometri, som brukeren ikke vil ha på planetene.
  - **Plexus i stedet for paneler:** `pattern: 'plexusA'`, `'plexusB'` eller `'plexusC'`. Tallene står i `plexus` i config og gjelder en kule med radius `plexus.radius` (3); på andre kuler skaleres de med radiusen. Tall i `panels.<kule>` erstatter dem for den ene kula, for eksempel `jupiter: { pattern: 'plexusB', nodes: 50 }`.
    - A (tett, 280 noder) og B (grov, 34 noder): noder i hvit lakk, stenger i mørkt metall, en andel fylte fasetter (`fill`) og en fasettert kjerne (`core`). Nodene driver rundt hvert sitt hvilepunkt (`speed`, `drift`), med fast topologi, så ingenting hopper.
    - C: typisk motion graphics-plexus i hvitt (ikke blått, på grunn av stilguiden): lysende punkter som vandrer, og linjer mellom alle som er nærmere enn `linkDistance`, tonet ut med avstanden.
    - Testet i en scratch-kopi med Jupiter `plexusB`, Mars `plexusC` og Venus `facets` 30: alt tegnes riktig.
- **Kjedene:** eget materiale, `chainColor`, `chainMetalness`, `chainRoughness` og `chainGloss` i `look`. Brukeren har satt dem til mørkt metall.
- **Sola:** `accent.sunStyle` er `'lacquer'` eller `'glass'` (glass har lys innenfra).
- **Mot flimring** (`blur` i config, `src/blur.js`): hver rask del måles hvert bilde (grader dreid siden forrige bilde). Over `threshold` (4°) tones det inn over `fade` (8°):
  - månene: et lysende spor bak månen langs banen (buen siden forrige bilde × `trailLength`), som blir en svak, hel ring over `ringAbove` (90°)
  - stag, månearmer og bærerens edderkopper: en vifte av `fanCopies` gjennomsiktige kopier, aldri bredere enn `fanMaxAngle`
  - tannhjul og kjeder ved månene: en glatt krans eller et glatt bånd i samme materiale over tennene og leddene
  - Listen over raske deler bygges i `main.js` (`fastParts` og kjedene), og `updateBlur()` kalles sist i animasjonen. Ved 2 d/s får Fobos og planethjulene ved Mars fullt spor; Io, Deimos og Enceladus-båndet delvis.

## Testsider
- Åpnes med `npm run dev`:
  - `http://localhost:5173/orrery/panels.html`: én kule per panelmønster.
  - `http://localhost:5173/orrery/plexus.html`: plexus A, B og C.
  - `http://localhost:5173/orrery/rings.html`: Saturns ring i fire varianter (A satin, B instrument, C glass som i modellen, D blanding), hver stor og i samme størrelse som i modellen, med kameraet som går rundt. `?t=15&stop` står stille 15 s ut i runden. Hver rute tegner sin bit av gradienten, så glasset har noe å se gjennom.
- Klikk stopper eller starter bevegelsen, og dra for å se fra andre vinkler.
- Testsidene er ikke med i `npm run build`, så de kommer ikke på GitHub Pages. `vite preview` viser modellen i stedet for dem; bruk dev-serveren.

## Slik har det vært sjekket
- **`npm run check`** (`scripts/check.mjs`, ca. 3,5 min). Kjør den etter hver endring i config. Den sjekker:
  - omløpstidene (innen 1 % og samme retning), også Jupiters måner i dager, og at Io/Europa/Ganymedes går nøyaktig 4:2:1 sett fra armen
  - at rullene ligger i setene på alle kjedene
  - at parallellhjulet står stille i rommet
  - startposisjonene, og at Laplace-vinkelen er 180° og står stille
  - kollisjoner, med reservert plass: A gjelder for alle vinkler; B er en simulering med stikkprøver; C er som A, men regnet fra Jupiter-stolpen, for alt som går rundt ved Jupiter. Forlegsakselen mot kjedet sjekkes i planet (1,94).
  - D: alt ved Saturn i 3D, sett fra stolpen. Hver del er et omdreiningslegeme om sin akse (loddlinjen, Saturns akse eller den skrå forlegsakselen), braketten og platen er staver. Unntak: hjul i inngrep, lager (rør i rør), og glipen mellom glassbåndene (fugen C–B 0,04 og Cassinidelingen B–A 0,24).
  - E: alt ved Mars i 3D, med de samme verktøyene (`run3D`): loddlinjen, den skrå drivakselen, mellomhjulet og Mars' akse; planethjulene som en ring rundt aksen; braketten og knasten som staver/sylindre fra overflaten de sitter på. Unntak som D, og kryssleddet. To deler regnes ikke mot hverandre når en del fra en av dem ligger mellom (`shielded`, for eksempel et hjul på et rør mot akselen inni). Mellomhjulet mot bærerrøret ved siden av det lille hjulet (0,20) skrives ut i stedet for å telle: det er den vanlige klaringen ved foten av et hjul i inngrep.
  - F: alt ved Uranus i 3D (`run3D`): armen og kjedet om loddlinjen; stolpen med braketten og polakselen, navet med stagene, ringene med eikene og kula som egne kropper. Det som er festet sammen hoppes over. Ringene ligger 0,04–0,24 fra hverandre, og stagene (festet til ring 6) 0,22 fra ring α; det skrives ut, ikke telt (som glipen ved Saturn).
  - Uranus: omløpstidene for Uranus og Neptun, driften til Uranus-stolpen, og ringretningen: på kanten ved jevndøgn 07.12.2007 (0,4°) og over 60° ved solverv 01.12.1985 (80,9°).
  - Motakselen og par-uranus er med i A og B.
  - Mars: omløpstidene, planetgirets forhold, driften til stolpen, at K ligger på både loddlinjen og drivakselen, og ekvatorplanet (−3,7° ved vårjevndøgn 12.11.2024, 25,1° ved sommersolverv 12.07.2023).
  - En tabell over raske deler (grader per bilde ved startfarten og 60 bilder/s).
  - Saturns omløpstider (Enceladus, Titan, Iapetus), driften til Saturn-stolpen, og ringens retning: ca. −3,8° åpen mot sola ved ringplanpasseringen 23.03.2025 (middellengder, toleranse 5°) og nordsiden opplyst 24.05.2017.
  - B tegner alt som massive sirkler, så rør må ikke legges inn der (de sjekkes i A). Saturn er ett område der (ring, måner og hjulkasse).

  Lengre kjøring: `node scripts/check.mjs 100000 10000`.
- **Skjermbilder:** hodeløs Chrome (`--use-angle=swiftshader`) mot en scratch-kopi av prosjektet, med `node_modules` lenket inn som junction. Fjern junction med `cmd /c rmdir`, **aldri** `rm -rf`.
  - Det går også an å bygge til scratch med `npx vite build --base=./ --outDir <scratch>/dist` og servere med `npx vite preview --outDir <scratch>/dist`. Adressen er da `/orrery/`.
  - Hodeløs Chrome har en minste vindusbredde på ca. 500 px. Smalere skjermbilder blir klippet og ser feil ut.
  - Skjermbilder ett sted i modellen: kopier `src` til scratch og la en lappefil (`patch.cjs`) få `main.js` til å lese `?cam=x,y,z&target=x,y,z&years=…` fra adressen. Prosjektets egne filer endres ikke.
  - Stopp dev- og preview-servere etterpå. `TaskStop` stopper ikke alltid node-prosessen, så sjekk porten med `Get-NetTCPConnection -LocalPort <port>` og stopp prosessen hvis kommandolinjen inneholder `vite`.

## Kjente feller
- **Git Bash** gjør `--base=/` om til en Windows-sti. Bruk `--base=./`.
- **`node -e` med æøå eller mye anførselstegn** feiler. Skriv skript til fil, eller bruk Edit.
- **Heredoc i Git Bash** gjør `\n` i teksten om til ekte linjeskift. Sjekk resultatet.
- **Alle kildefilene har CRLF-linjeskift.** Ta høyde for `\r\n` i skript; Edit-verktøyet håndterer det.
- **Skript utenfor prosjektet** finner ikke `'three'`. Importer med absolutt filsti, eller legg en midlertidig fil i prosjektet og slett den etterpå.

## Ikke beskyttet av feilmeldinger
- For stor `center.tubeWall`.
- Veldig liten `drive.distance`.
- `moonOrbit` mindre enn jordas radius pluss månens.
- Veldig få tenner.
- Plexus-kuler i modellen: `npm run check` regner kula som glatt med planetens radius, men nodene stikker litt utenfor (ca. 0,14 på Jupiter med B). Det spiser av klaringen på 0,3 mot Io. Overlappen er bare visuell, men sjekken fanger den ikke opp.

## Mulige neste steg
- **Farger på kulene** (stilguiden): mønstrene beholdes, men planetene og månene får farger og blank finish som ligner de ekte, med valg i config. Mekanikken forblir hvit, mørkt metall og rødt.
- **Uranus og Neptun:** se på holderen og ringene fra alle kanter i nettleseren; vurder `uranusRing.scale` og `reachGap` hvis modellen skal bli smalere. Måner kan komme senere (Uranus' måner går i ringplanet, rundt polakselen).
- **Saturn:** se over om Saturn-hjulkassen ser bra ut fra alle kanter, og vurder kortere forlegsaksel (den går ca. 13 fra vinkelgiren opp til hjulene).
- **Mars:** se på planetgiret, braketten og kryssleddet på toppen av stolpen fra alle kanter; drivakselen er ca. 10 lang fra K opp til det store hjulet.
- **Velge nye mønstre for planetene,** med `facets` eller plexus som utgangspunkt (se Utseende).
- **Lysspor:** finjuster tallene i `blur` etter å ha sett det i nettleseren (grensen, sporlengden og vifta).
- Rørstabelen rundt Jupiter-stolpen er ca. 14 høy og 1,7 i radius. Den kan gjøres kortere ved å senke månearmene (lengre månestolper).
- Mer fra stilguiden:
  - Aksler og rør som dreide profiler med skulder og avfaset ende.
  - Armene skal være parallelle: stilguiden ble endret, men koden har fortsatt avsmalning.
  - Myk overgang der eikene møter kransen på tannhjulene.
