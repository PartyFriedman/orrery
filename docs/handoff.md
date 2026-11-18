# Handoff: orrery (mekanisk solsystem i three.js) – 18.11.2026

## Prosjekt og status
- Mappe: `c:\Users\oyvin\Desktop\Projects\Vibekoding\claudecode_VScode\orrery` (Vite + three.js, `npm run dev` / `npm run build`). Repo: PartyFriedman/orrery, publiseres til GitHub Pages fra `main` via `.github/workflows/deploy.yml` (base `/orrery/` i `vite.config.js`).
- Gren: `main`, rent tre. Alt fra økta 17.11 er merget. Merget så langt:
  - PR #6 (`Outer-Planets`): Jupiter og Saturn, med to kjeder via et løst hjul på sentralakselen («Changes large cog»).
  - PR #7 (`Speed-Control`, commit «Add Time Control»): glidebryter for tid, med planetene stilt inn etter ekte dato (se Tid og dato).
  - PR #8 (`Jupiter-moons`): Jupiters fire måner med synlig 4:2:1-resonans (se Jupiters måner), eget materiale på kjedene, og nye panelmønstre, plexus-kuler og to testsider (se Utseende og Testsider). Bygget går gjennom, og `npm run check` sier «Alt i orden».
  - Mars med Fobos og Deimos (grenen `Mars-moons`).
  - PR #11 (`Ice-Giants`): Uranus og Neptun uten måner.
  - PR #12 (`Ice-giant-moons`, commit «Add moons to ice giants»): månene til Uranus og Neptun (alternativ B), farger på kulene, `npm run check` delt i rask og full, festesjekken, og den raskere simuleringen B. `src/cord.js` er slettet og `scripts/lastCheck.json` ligger i `.gitignore`.
  - PR #13 (`earth-rotation`): jorda roterer med ekte hjulverk, har landmasser, og en føringsring med en gaffel med ruller (se Jorda).
- Ryddingen 17.11 (se under) og PR #15–16 (fokus og drivvisning) er merget.
- Testsiden trisolaris.html og flyttingen av kulekoden til `src/sphere.js` er committet («Add trisolaris test page»), og panorering i fokus også («Add right click navigation»).
- **Ikke committet (18.11, på grenen `Microinteractioon`):** mikrointeraksjonen på kulene (se Mikrointeraksjon under). Modellen er bevist uendret når ingenting er løftet: fingeravtrykket (md5) av hele `root` bygget i Node med låst dato (geometri, materialer, matriser og lys) var likt før og etter (`9f720ec1…`), og `npm run check` sier «Alt i orden». Datoen må låses (`config.time.startDate` før model.js importeres), ellers flytter klokkeslettet matrisene.
- `git stash list` har fortsatt `stash@{0}`: den forkastede versjonen med snorer og hjultog for månene. Den trengs ikke; slett den med `git stash drop` når brukeren vil.
- Utseendet til hver kule står i `bodyLooks` i config (én blokk per kule: farge, lakk, mønster, og solas stil og glød), og `accent` er fargen på ringene ved stolpene.

## Ryddingen 17.11 (grenen cleanup)
- Testsidene moons.html og earth.html er slettet, med moonTest.js, earthTest.js, checkMoons.mjs og checkEarth.mjs, alternativene som ikke ble valgt (Uranus A; jorda T, K, G2, G3, F2; overflatene S1 og S3) og config-verdiene bare de brukte. panels, plexus og rings er beholdt.
- Nye felles moduler: `src/materials.js` (alle materialene, `lookOf(navn)` = blokka i bodyLooks med det den mangler fra `defaults`), `src/scene.js` (renderer, miljø, lys, gulv og bakgrunn, for modellen og testsidene), `src/build.js` (byggeklosser: aksel, stang, kule, myk overgang, flat stang, brakett og føringsring), `src/segments.js` (avstand mellom linjestykker).
- main.js: rør i tårnet lages med `addTowerTube`, brakettene med `bracket`, alt som dreier registreres med `turnsWith(gruppe, vinkel)`, og kjedene med `addChain(…, key, smooth)`. Animasjonen går gjennom de listene. Står tiden stille, regnes ingenting om.
- Config: `panels`, `colors`, `earthSurface` og solas `accent.sunStyle`/`glow` er samlet i `bodyLooks`. Solas glass og glød (før tall i koden) står i `bodyLooks.sun`. `accent` har `color`, lakken og `ringWidth`. `earthDay` har bare ruta som brukes (P og V), og `moonGuide` har `ring` og `follower` (før G1 og F1). `iceMoons.uranus.layDistance` er ett tall. `armMaterial` ved Saturn og Mars er fjernet (armene er hvite som alt annet). `panels.mars.amplitude`/`bulge` er fjernet (virket ikke på `quads`).
- Endret med vilje (E): alle stag er hvit lakk (stilguiden har fått regelen), sola bruker den glødende kjernen og glasset kaster ingen skygge, `segDist` er rettet (én funksjon i segments.js, brukt av mechanism.js, iceMoons.js og clearance3d.mjs), og buene på hjul, armer og kjedeplater har færre segmenter (`curveSegments` 24 og 6, før 48 og 12): ca. 23 % færre trekanter per bilde.
- Raskere lasting: landmassene (`fillRegion`) går bare gjennom trekantene som fortsatt er for store (samme trekanter, ca. 0,6 → 0,2 s). Plexus-kuler uten `nodeSize`/`edgeWidth` lager ingen noder eller stenger (før NaN-geometri og feil i konsollen).
- Bevist uendret: skjermbilder fra 9 vinkler og de tre testsidene var like piksel for piksel etter alt unntatt E, og `check:full` skrev det samme.

## Trisolaris (testsiden trisolaris.html, 18.11)
Et fiktivt system: tre like soler går etter hverandre i åttetallsbanen (Chenciner–Montgomery), en tredjedels runde fra hverandre, og én planet går rundt alle tre. Alle tall står i `trisolaris` i config, og planeten har `bodyLooks.trisolaris`. Brukeren valgte: to soler nedenfra og én ovenfra (banen er helt flat), variantene kan byttes, og korreksjonen er en episykel på sveiven.
- **Banen** (`src/figureEight.js`): integreres fra startverdiene ved lasting (ca. 30 ms), og deles i Fourier-ledd. Leddene i 3θ og 6θ er null (tyngdepunktet står stille). Med halv bredde 1 er x = 1,018 sin θ − 0,0235 sin 5θ − 0,0054 sin 7θ … og z = 0,313 sin 2θ + 0,052 sin 4θ − 0,0028 sin 8θ …; halve høyden er 0,331, og minste avstand mellom to soler er 0,639.
- **Variantene** (største feil ved halv bredde 15): A to sleider 0,86 (5,8 %), B + 4θ 0,43 (2,8 %), C + 4θ og 5θ 0,09 (0,6 %). D (7θ og 8θ) bygges ikke: nestede hjul ville fått en senteravstand lik koeffisienten (0,35 og 0,08).
- **Sleidemaskinen** (lik for alle tre):
  - X-tårnet (sveiv θ, armlengde a1) sveiver X-sleiden, en slisset stang langs z som glir i x. Sveivtappen og utgangstappen går i samme sliss.
  - Y-tårnet (2θ, armlengde b2) sveiver Y-sleiden langs x, ett nivå over.
  - Hjultoget nederst (40, mellomhjul 30, 20) gir 1:2 i samme retning.
  - Korreksjonshjulene: et planethjul på enden av armen ruller rundt et fast hjul på tårnet (64:16 gir 5θ, 20:20 gir 4θ). Tappen sitter eksentrisk på en skive over armen.
  - Utgangstappen går gjennom begge slissene.
- **Hvor maskinene står** (bevist i figureEight.js-regningen og med sjekken):
  - Sett fra en sol er naboen en tredjedel foran aldri rett i +z, og naboen bak aldri rett i −z. Ingen retning er fri for begge, så alle tre kan ikke stå nedenfra i samme plan.
  - B står i +z, med en stav inn til sol B.
  - A står i −z, ett nivå lavere (staven går under stolpe B), og er en tredjedel foran B.
  - C henger opp ned rett over banen, i et stativ med fire stolper og to bjelker.
- **Drivet:** én akselstreng langs gulvet (x = 0) med vinkelgir inn i X-tårnene i A og B. En gren går ut til den loddrette akselen ved stolpe 2, og derfra går bjelkeakselen inn i Y-tårnet i C (1:2). Sidene til vinkelgirene velges i designet så alle X-tårnene går +1.
- **Planeten:** står på en ring med innvendige tenner (120) i høyde med solene. Ringen er drevet av en pinjong (12) på den loddrette akselen og holdt av rullepar på de to fremre stolpene. Planeten går én runde per 10 runder i åttetallet.
- **Filene:**
  - `src/trisolarisDesign.js`: ren matematikk med målene, nivåene, `stateAt(θ, variant)` og én delliste (`partsFor`) med tegning og bevegelse, som både tegningen og sjekken bruker. Lista har også `touching` (deler som skal berøre hverandre) og `mounts` (festene).
  - `src/trisolarisBuild.js`: three.js fra dellista.
  - `src/trisolarisTest.js` + `trisolaris.html`: siden. Panelet har knappene A/B/C og «Bane», med feilen, antall deler og omløpstiden til planeten. Adressen tar `?v=B`, `?t=12`, `&stop`, `&cam=x,y,z&target=x,y,z` og `&trace=0`.
  - `src/sphere.js`: `createBodySphere` og `createSun`, felles med model.js.
- **`npm run check:trisolaris`** (ca. 2 s; `node scripts/checkTrisolaris.mjs 3600` er tettere og tar ca. 12 s) sjekker:
  - banen fra mekanikken mot den eksakte, per variant (stemmer med Fourier-feilen)
  - fartene (5, 4 og 2) og dreieretningene gjennom alle vinkelgirene
  - klaringen 0,3 mellom alle deler i 2,5D (loddrette sylindre og liggende staver), over en runde, og for ringen og planeten over hele omløpstiden til planeten
  - festene, og antall deler per variant

  Den fant og fikk rettet at planeten traff de øvre rullene ved stolpene. Nå er de trangeste klaringene 0,30 (pinjongen mot stolpe 2, planeten mot rullene). Stolpe A har minst 4,9 til noe i maskin B.
- **Størrelsen:**
  - Med halv bredde 15 er baneplanet i høyde 17,5. Maskinene står 13,6 fra midten, og stolpene i x = ±33,3.
  - Planeten står 40,9 fra midten. Alt er innenfor radius 54 og 33 høyt.
  - Delene: A 216, B 228, C 240 (uten kulene).

## Arbeidsregler (fra brukeren)
- Svar på norsk. Forklar kort hva som endret seg.
- **Aldri commit eller push uten at brukeren ber om det.** Sjekk gren først; brukeren lager en ny gren per steg og merger via PR.
- Store steg: planmodus først, så bygging etter godkjenning.
- Brukeren justerer tall i `src/config.js` selv. Behold verdiene deres.
- **Ikke sett i gang med noe før brukeren ber om det.** Når brukeren deler noe eller sier hva de vil, svar kort og vent.
- Nye mekanismer prøves først på en testside (som moons.html og earth.html var) med alternativer og antall deler, og bygges inn i modellen først når brukeren har valgt.
- Brukeren committer selv. Ikke commit, heller ikke når en endring er ferdig.
- Hvert hjul skal sitte på en synlig aksel som er holdt av en fast del (brakett, stolpe eller lager), som ved Jupiter og Saturn. Ingen skjult aksel gjennom en kule.
- Det er ingen fast grense for største radius; `npm run check` skriver den ut med endringen siden sist.
- Stilguide: `docs/styleguide_orrery.md`. Kun hvitt, mørkt metall og rødt på de mekaniske delene. Planetene og månene skal få farger og blank finish som ligner de ekte himmellegemene, med valg i config.
- Planetene: få, store flater fungerer bedre enn mange små. Unngå typisk sportsballgeometri (fotball, volleyball, tennisball, båter som en badeball). Moodboard: `images/inspiration/Planets moonboard.png` (uregelmessig fasettert lavpoly-kule og plexus).

## Filer
- `src/config.js`: alle innstillinger (se under).
- `src/materials.js`, `src/scene.js`, `src/build.js`, `src/segments.js`: se Ryddingen 17.11.
- `src/mechanism.js`: ren matematikk uten three.js. Pakker armlengder automatisk, ordner rørene, regner ut høyder, akselposisjoner og kjeder (`makeChain`), og alle vinkler fra inngangen (`anglesAt`). Har feilmeldinger når noe ikke passer.
- `src/main.js`: renderer, scene, kamera, fokus, panelene og animasjonen.
- `src/sphere.js`: kulene (paneler, plexus, landmasser) og sola, brukt av model.js og trisolaris.
- `src/figureEight.js`, `src/trisolarisDesign.js`, `src/trisolarisBuild.js`, `src/trisolarisTest.js`, `trisolaris.html`, `scripts/checkTrisolaris.mjs`: se Trisolaris.
- `src/model.js`: alle delene, i gruppen `root`, uten DOM (så `npm run check` kan bygge modellen i Node). `addGear`, `addSprocket`, `addChain`, `addArm`, `addPlanetSphere`, `addSun`, `addTowerTube`, `turnsWith`. Gir `root`, `spheres`, `plexusUpdates`, `turning` og `update(years)`.
- `src/drives.js`: merkene for drevene (`drives`, `drivesOf`, `bodyOf`, `moonsOf`, `system`, `ALL`). `src/driveView.js`: drivvisningen (se Fokus).
- `src/ephemeris.js`: middellengder for planetene (JPL, Standish tabell 1, også Uranus og Neptun), polene til Mars og Uranus (IAU), månen og knutelinjen (Meeus), Jupiters måner (Lieske via Meeus kap. 44, B1950 + 0,698° presesjon til J2000), og Saturns, Mars', Uranus' og Neptuns måner (JPL-middelelementer, lavpresisjon; Triton baklengs). `daysPerYear` = 365,256 (én runde for jorda).
- `src/iceMoons.js`: geometrien for månene til Uranus og Neptun som ren matematikk (`uranusDesign`, `neptuneDesign`, `uranusParts`, `neptuneParts` for avstandssjekkene, `partReach`). Den importerer ikke `mechanism.js`; `mechanism.js` bruker den og sender inn `uranusTrain`, `armParts` og høydene ved armen.
- `src/timeControl.js`: glidebryteren nede på siden (DOM), med dato og fart. Stilen ligger i `src/style.css`.
- `src/focus.js`, `src/picking.js`, `src/focusPanel.js`: fokus på en kropp (se Fokus).
- `src/bodyLift.js`: mikrointeraksjonen på kulene (se Mikrointeraksjon).
- `src/gear.js`: evolventtannhjul, kjedehjul og `extrudeFlat`.
- `src/arm.js`: armer som smalner av, med myk overgang inn i navet.
- `src/panels.js`: panelkuler, med mørke fuger. Panelene er buede eller flate.
  - Mangekanter (`const patterns`): `triangles`, `quads`, `kites`, `rhombi`, `pentagons`, `bands`, `hexagons`, `volleyball`, `woven` og `facets`.
  - Store paneler med buede kanter (`regionPatterns`): `boats`, `spiral`, `caps` og `seam`. De krympes med `insetRegion` (stereografisk projeksjon, fugen skalert så den blir like bred overalt) og fylles som `trionda` (sola: 4 S-kantede paneler fra et tetraeder).
  - `delaunayFlip` retter earcut-trekanter.
- `src/scatter.js`: uregelmessige, jevnt spredte punkter på en kule (`spread`, «best candidate»), trekantene mellom dem (`triangulate`, konvekst skall) og et tilfeldighetstall med seed (`random`). Brukes av `facets` og plexus.
- `src/plexus.js`: plexus-kulene `plexusA`, `plexusB` og `plexusC` (`createPlexus`). `addPlanetSphere` i `main.js` bruker den når en kule har et plexus-mønster, og animasjonen kaller `plexusUpdates` med vanlig tid.
- `src/testStage.js`: oppstillingen på panels.html og plexus.html (kamera og navn under hver kule; lys og materialer fra scene.js og materials.js). `addSlot(tittel, undertittel, radius)` tar radiusen per plass, og `run` gir `update(time, seconds, frame)`, der `frame` er den ekte tiden per bilde (også når bevegelsen er stoppet).
- `src/ringLayout.js`: hvor båndene og spalten i Saturns ring ligger, og Uranus' tynne ringer (`thinRingLayout`) (ren matematikk). `src/ring.js`: `createAnnulus`, glassmaterialene med kantlys (`createGlassMaterials`) og glassbåndene (`createGlassBands`), brukt av både modellen og rings.html.
- `src/blur.js`: lysspor, vifter og glatte former for raske deler (se Utseende).
- `panels.html` + `src/panelTest.js`, `plexus.html` + `src/plexusTest.js` og `rings.html` + `src/ringTest.js`: testsidene (se Testsider).
- `src/earthDesign.js`: jordstolpen som ren matematikk (drivet, vinkelgiret, føringsringen, foten, høydene, `earthParts` til 3D-sjekken). Den importerer ikke `mechanism.js`; modellen sender inn høyder, armlengder og retninger som `ctx`. `mechanism.js` lager `earthTrain` med `earthDesign(ctx)`.
- `src/earthBuild.js`: tegner jordstolpen i three.js fra `earthDesign` (`buildEarthEnd`).
- `src/earthSurface.js` og `src/landmasses.js`: jorda med opphøyde landmasser, `surfaceKind` (land, hav eller is i en retning) og den glatte kula mot flimring (`createSpinBlur`). Konturene er tegnet for hånd (lengde, bredde).
- `scripts/check.mjs`: sjekkene bak `npm run check` og `npm run check:full` (se under).
- `scripts/clearance3d.mjs`: 3D-verktøyet (`run3D`, formene, `distance`, `shielded`), `toCheckParts` og festesjekken `checkMounts`. Brukes av `check.mjs`.
- `scripts/lastCheck.json`: største radius fra forrige kjøring av sjekken (i `.gitignore`, per maskin).

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
  - Parallellkjede 36:36 holder stolperøret ved jorda i fast retning i rommet (og dermed jordaksen, 23,44°, og føringsringen for månebanen, 5,14°).
- **Jorda** (`earthDay` og `moonGuide` i config, `earthTrain`, `earthDayChain`, `earthRate` i `mechanism.js`, geometrien i `earthDesign.js`):
  - **Rotasjonen:** én omdreining per siderisk døgn (0,997287 d, −0,0017 %; soldøgnet blir 1,000017 d). Jorda dreier om sin skrå akse i forhold til stolperøret, som står stille i rommet, så parallellføringen er som før.
  - **Drivet (P):** pinionakselen (5 runder per år sett fra armen) har et kjedehjul 39, og et finere kjede (deling 0,8) går til en forlegsaksel ved jordstolpen (8). Derfra 53→10 (modul 0,15) til driveakselen inni stolperøret (ca. 128 runder per år). Forlegsakselen står `earthLayDistance` = 4,7 innenfor stolpen. Dagkjedet ligger i et nytt plan (`heights.day`) mellom det faste hjulet og parallellkjedet, så jordstabelen ble 1,5 høyere og månearmen 0,3 høyere (den går nå klar av lenkeplatene på månekjedet).
  - **Vinkelgiret (V):** aksene møtes bare i jordas sentrum, så vinkelgiret har toppunktet der: 40 på driveakselen, 14 på spindelen (modul 0,08), ×2,857. Hjulet på spindelen sitter 3,3 under sørpolen; spindelen går i et lager rett over det, holdt av en knekt brakett fra toppen av stolperøret, og stikker ut over nordpolen.
  - **Føringsringen (`moonGuide.ring`):** et smalt bånd med loddrette sider (0,14 × 0,6), et snitt mellom en sylinder (radius 3) og et skrått plan, som ved Neptun, på tre tynne stag fra et nav i høyde med ringen. Høyden regnes ut: så lavt som mulig over månearmen.
  - **Foten (`moonGuide.follower`):** en gaffel på månestaven med to ruller, én oppå og én under båndet; rullene dreier når foten går rundt. Staven (r 0,11) glir i en kort hylse (r 0,28) ytterst på en smal månearm.
  - **Startvinkelen:** Greenwich-meridianen står stjernetiden (GMST, Meeus 12.4) østover fra vårjevndøgnsretningen på startdatoen (`phases.earthSpin`, `earthSpinTarget`).
  - Ekvatorringen er fjernet (den hadde ingen funksjon, bare viste hellingen). Den gamle stolpen inn i jorda, ringen, foten og den tykke hylsa er også borte. Jordarmen har ingen krage ytterst, fordi tannhjulet på driveakselen står der.
  - Vurdert og slettet: T (dagrør i tårnet: trenger mellomhjul ved jorda, nytt rør i tårnet, +2,9 i høyde), K (kryssledd og tannhjulspar), G2 (rund ring med glidesko, som går rundt stagene med under 0,3), G3 (skrå skive, +1,2 i høyde).
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
  - **Paraplyen:** hvert båndrør har et nav med tre hvite stag opp til midten av undersiden av sitt bånd. Navnivåene regnes ut så stagene går klar av kula og av stagene og båndene over.
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
- **Uranus og Neptun** (`counterDrive`, `uranusRing`, `uranusPost` i config; `uranusTrain`, `uranusBracket`, `uranusAxis`, `uranusParallelChain` i `mechanism.js`). Månene står under (Månene til Uranus og Neptun).
  - **Drivet, motakselen:** ett hjulpar fra forlegsakselen går ikke (Uranus trenger 1:22, Neptun 1:44, og pinjongen ville blitt tynnere enn akselen).
    - Saturn-røret har et hjul nr. 2 (69, ett plan over det første, `heights.counterGear`). Det driver en motaksel (41) i tårnet, 40 fra sentrum ved −150° (speilet av forlegsakselen).
    - Fra motakselen: Uranus 10→48 (+0,03 %), Neptun 12→113 (+0,05 %), `par-uranus` 11→60.
    - Lengst ut når motakselens hjul 55,6 fra sentrum, innenfor tårnet (Venus 55,6, månerøret til Mars 71,5).
    - Vurdert, men ikke valgt: to kjeder til via et løst hjul på sentralakselen (som Jupiter/Saturn), ca. 1,7 høyere.
  - **Parallellføring:** som Saturn og Mars. `par-uranus` dreier sakte, og kjedet 100→12 langs armen gjør at stolpen står stille i rommet (sjekket eksakt med heltall). Jordas 1:1 med fast hjul gikk ikke: kjedehjulet ved Uranus måtte hatt radius ca. 15.
  - **Holderen (globus på siden):** ringplanet står bare 7,8° fra loddrett, så en stolpe rett opp i kula ville gått 0,03–0,16 fra ringene.
    - Stolperøret slutter under vinkelgiren. En knekt brakett går fra siden av stolperøret vannrett ut langs polretningen (under hjulene på forlegsakselen), rett opp, og inn som polaksel i polen som peker nedover. Myke overganger ved stolperøret og ved polen.
    - Navet er en hylse på polakselen fra overgangen ved polen. Tre hvite stag går fra navet til den innerste ringen, og tre eiker i ringplanet binder ringene sammen (asimut 60°, 180°, 300°, ingen mot braketten).
    - Polakselen bærer også månerørene (se under).
    - Retningen: IAU-polen (RA 257,311°, dekl. −15,175°) regnet om til ekliptikken (`uranusPoleLongitude`); polen med akselen heller mot lengde ca. 77,7°, 7,77° under vannrett (`uranusRing.tilt` 97,77).
  - **Ringene:** fem tynne ringer av mørkt glass med kantlys (som variant C): 6, α, β, δ, ε med ekte radier (1,650–2,017 R), ε bredest. Lista, tonen, bredder og `scale` står i `uranusRing`. `scale` < 1 drar ringene inn mot kula (0,78 gjør begge armene ca. 1,2 kortere).
  - Neptun står på en vanlig stolpe, ytterst, med Triton (se under).
  - `planets.<navn>.reachGap` (valgfritt) erstatter `spacing.reachGap` for én arm.
  - **Størrelsen uten måner:** Uranus-armen 100,5, Neptun-armen 109,4, ytterste radius 112,0.
- **Månene til Uranus og Neptun** (tallene i `iceMoons` i config, geometrien i `src/iceMoons.js`, brukt av `mechanism.js` som `uranusMoonTrain` og `neptuneMoonTrain`; mekanismetypene `'parallelMoons'` for Uranus og `'idlerMoon'` for Neptun).
  - **Drivet** er som ved Jupiter og Saturn: et månerør i tårnet fra mellomakselen (`drive-uranus` 19→39, `drive-neptune` 41→47) og ett kjede langs armen (115→12 og 117→10). Kjedehjulene ved sentrum må være større enn rørene de sitter på (radius 16,5 og 17,5). All annen ny mekanikk står ved planeten.
  - **Uranus:** kjedet driver en aksel inni stolperøret. En vinkelgir (30:12) på toppen fører drivet over i en forlegsaksel parallell med Uranus' akse, 7,7 under den, og ett hjulpar per måne (35:29 og 32:41) går opp til et rør på polakselen. Titania er på det innerste røret, Oberon på røret utenpå.
    - Hjulet på driveakselen sitter **over** toppunktet (driveakselen går opp gjennom det). Det er det som gjør at månene går samme vei som Uranus dreier; under toppunktet (som ved Saturn, men med den vinkelen Uranus har) ville de gått feil vei. Derfor ligger vinkelgiren så lavt at Oberon går klar over den (`bevelSide`, `layDistance`).
    - Forlegsakselen går i to lagre i braketten: den er forlenget inn i et lager i den loddrette delen, og en bukk går fra den vannrette delen opp til et lager like ved vinkelgiren.
    - Hvert rør har en krage med et skrått stag ned til et kort bein og månen i ekvatorplanet, utenfor ringene (Titania 5,89, Oberon 6,51 fra aksen). Stagene holder seg innenfor banene, så Uranus ikke blir bredere enn dem. Navet med de tre stagene til ring 6 står fast.
    - Startvinklene stilles i ekvatorplanet med `inPlane` (rettet, se Småting).
  - **Neptun:** kjedet driver en krage på stolpen. Kragen driver et dobbelthjul på tapp A (som står på armen), det øverste hjulet driver et mellomhjul på tapp B (henger i en bøyle fra tapp A, ring i `accent.color`), og mellomhjulet driver Tritons rør: tre inngrep, så Triton går baklengs. Ett høyt mellomhjul mellom to hjul på samme akse ville ikke snudd retningen.
    - Triton sitter på en stav som glir i en hylse ytterst på Triton-armen. En fot på staven hviler på en skrå føringsring (et smalt bånd med loddrette sider) under Neptun, så banen heller 130° (50° baklengs). Knutelinjen står på tvers av armen og følger armen rundt (forenkling: på himmelen dreier den sakte). Banen er en sirkel sett ovenfra (3,12 fra stolpen) og en ellipse 1,56 : 1 i det skrå planet, med Neptun i midten. En vippearm ble vurdert og forkastet: rund bane, men ikke rundt Neptun, og mye bredere.
  - **Hva hver aksel er festet i:** driveakselen i stolperøret; forlegsakselen i lageret i braketten og lagerbukken; Titania-røret på polakselen og Oberon-røret på Titania-røret; ved Neptun kragen og Tritons rør på stolpen, dobbelthjulet på tapp A (på armen) og mellomhjulet på tapp B (i bøylen fra tapp A). `npm run check` sjekker det.
  - **Størrelsen:** Uranus rekker 7,31 fra stolpen og Neptun 3,32. Uranus-armen 102,4, Neptun-armen 113,9, største radius 117,22 (112,02 uten måner).
- `bodies.height` er 61,75 (61,0 før jordrotasjonen, 55,1 før månene til Uranus og Neptun, 45,5 før Uranus og Neptun). Dagkjedet løfter armene innenfor jorda (og dermed sola) med 1,5; vinkelgiret under jorda krever omtrent det samme (minst 61,52). De to nye månerørene og kjedene løfter armene innenfor Uranus med ca. 5,9. Vinkelgiren ved Saturn er fortsatt den strengeste (minst ca. 60,95).
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
- Titania og Oberon stilles i Uranus' ekvatorplan med `inPlane` (som Saturns og Mars' måner), Triton med fasen på Tritons hjul (`phases.triton`), etter middellengdene i `ephemeris.js`.
- **`npm run check`** har en startsjekk som skriver ut lengdene ved startdatoen.

## Fokus og drivvisning (grenene camera-focus og Isolate-view)
- Klikk eller trykk på en kule, så glir kameraet over til den (`focus.glide` s) og følger den. Klikk på sola gir tilbake til startbildet. Tallene står i `focus` i config.
- `addPlanetSphere` legger hver kule i `spheres` (navn → gruppe, radius og `plexus`, funksjonen som flytter nodene, ellers null). Det er registeret for valget og mikrointeraksjonen.
- `picking.js`: et klikk er én peker, flyttet under `clickMove` px og sluppet innen `clickTime` ms (`e.timeStamp`). Treffet regnes på skjermen: kula, eller innenfor `hitRadius` px fra sentrum. Treffer pekeren selve kula, vinner den nærmeste.
- `focus.js`: `update(seconds)` kalles etter at delene har fått vinklene og før `controls.update()`. Den flytter målet og kameraet like langt som kroppen har flyttet seg siden forrige bilde (ingen etterslep, ingen risting). Avstanden er `r·size / sin(atan(fill·tan(fov/2)))`. Med en kropp i fokus virker panorering (høyre knapp): målet blir liggende der man drar det og følger kroppen derfra, så man kan gå langs drivverket. `minDistance` er 1,3 r, og `camera.near` følger avstanden.
- Panelet øverst på midten viser navnet og en ×-knapp som gjør det samme som et klikk på sola (sola er ofte utenfor bildet når man er tett på). `.focus-info` er tom og klar til mer.
- **Drivvisning** (bryteren «Drive» i panelet, `driveView` i config): bare drivet fra tårnet til kroppen som er valgt, vises som vanlig. Resten av mekanikken fades til `mechanism`, og de andre kulene dempes til `bodies` (fortsatt klikkbare). Bryteren huskes når man bytter kropp.
  - Hver del er merket med kroppene den driver, der den lages: `drives(del, ...navn)` i model.js og earthBuild.js. En del arver merket fra nærmeste forelder. Regelen: kroppens posisjon eller retning avhenger av delen, eller delen bærer en slik del. `'all'` = sentralakselen og mellomakselen.
  - En planet viser bare sitt eget drev (røret, armen, stolpen, par-røret og parallellkjedet). Månene har hvert sitt (med det som flytter planeten). Saturn-røret driver også motakselen, og hører derfor også til Uranus og Neptun.
  - `driveView.js` samler delene i lag (ett per ulikt merke, ett per kule). Hvert lag glir mot målet over `fade` s. Under full opasitet får laget gjennomsiktige kopier av materialene. Kulene skriver dybde og tegnes skallet først, ellers skinner den mørke kjernen gjennom. Skyggen slås av under 0,5.
  - blur.js: delene den lager er merket `userData.blur`, og hver bit har en `source`. `setBlurLevel(driveView.levelOf)` demper spor, vifter og glatte former med delen. Lyssporet til en måne følger kula.
  - `flatBar` og `bracket` i build.js gir tilbake delene, og `drives` tar også en liste.
- Skjermbilder med låst dato og plexus-tid, og `?focus=navn`, `?drive=1`, `?show=navn` (drivvisning uten å flytte kameraet) og `?cam=x,y,z&target=x,y,z`: lappefil i scratch som i Skjermbilder. Flyttingen til model.js ga like bilder (md5) i fire vinkler. Det første bildet etter at Chrome-profilen er ny, kan avvike; ta det på nytt.
- Test i hodeløs Chrome: input kommer bare én gang per bilde, og et bilde tar flere sekunder i swiftshader. Sett `clickTime` høyt og `glide` kort i scratch-kopien, og stopp tiden før du klikker på raske måner.

## Mikrointeraksjon (grenen Microinteractioon, 18.11)
Kulene svarer når man peker på dem (PC) eller trykker på dem (mobil). Kula og kameraet flytter seg ikke. Tallene står i `bodyLift` i config, med løftet som andel av radiusen:
- **Paneler** (`panels`, 0,04): hvert panel flyttes rett ut langs sin egen retning (midten av panelet). Naboene peker litt ulikt, så fugene åpner seg og kjernen så vidt synes; få, store paneler åpner seg mest.
- **Jorda** (`land`, 0,03): toppene på land og is heves, og den øvre kanten av sidene følger med, mens den nedre står fast i havet. Sidene strekkes og får nye flatenormaler mens de beveger seg. Den glatte kula mot flimring (`createSpinBlur`, synlig ved startfarten) heves like mye, så landet ikke stikker gjennom; den ligger utenfor kula og er registrert som `spheres.earth.also`.
- **Plexus** (`plexus`, 0,05, sola i dag): nodene skyves ut fra sentrum (`open` på funksjonen fra `createPlexus`). Ved A og B følger stengene og fasettene etter, og kjernen står. Ved C ganges punktene ut, og `linkDistance` er uendret, så noen linjer slipper.
- **Tiden:** `timeIn` (0,15 s) og `timeOut` (0,3 s). Framdriften går lineært, og det som vises er smoothstep av den, så det rykker ikke om pekeren går bort midt i. `tapHold` (0,1 s): hvor lenge kula står åpen etter et trykk.
- **PC:** kula står åpen så lenge musepekeren er over den. `picking.update()` regner ut kula under pekeren hvert bilde, fordi planetene flytter seg under en stille peker; mens en knapp er nede, står det som det står. Håndpekeren settes samme sted.
- **Mobil:** `onPick(navn, pointerType)`. Når det ikke var mus, åpner og lukker `bodyLift.pulse` kula i tillegg til valget.
- **Retningene:** `geometry.userData.liftDirs` (Float32Array i samme rekkefølge som `position`) og `liftKind` (`'panels'` eller `'land'`) lages i `createPanelGeometry` og `createEarthSurface`. `liftNormals: true` på sidene ved jorda.
- **`src/bodyLift.js`** (uten DOM): `createBodyLift(spheres)` med `hover(navn)`, `pulse(navn)` og `update(sekunder)`. Posisjonene skrives om på CPU bare mens en kule beveger seg, så skyggene følger med. Når kula er lukket, settes utgangsposisjonene (og normalene) eksakt tilbake; det er prøvd i Node for Mars, Fobos, Iapetus, jorda og Jupiter. `boundingSphere` er gjort større med løftet, så kula ikke klippes i kanten av bildet.
- `main.js` kaller `picking.update()` og `bodyLift.update(seconds)` etter `model.update` og før plexus-oppdateringene (som leser `open`).

## Utseende
- **Armene:** `armStyle` styrer avsmalning, overgang, nav som stikker opp og ned, og krage. En tynn rød ring der planetstolpen møter armen.
- **Kulene:** farge, lakk og mønster per kule i `bodyLooks` (med `defaults` for det en kule ikke setter selv). Fugebredden kan settes per kule; på sola følger den `sunRadius`.
  - Standard: Merkur `kites`, Venus `rhombi`, jorda landmasser (`continents`, se under), Mars `quads`, månen `pentagons`, Jupiter `bands`, Jupiters måner `quads` 1, Saturn `hexagons`, Uranus `triangles`, Neptun `rhombi`, sola `plexusA` (uten noder og stenger, siden `nodeSize` og `edgeWidth` er kommentert ut). Brukeren endrer dem selv i `bodyLooks`.
  - Nye mønstre som kan velges:
    - `facets`: uregelmessige trekanter med fuger; `subdivisions` er antall hjørner (30 gir 56 fasetter, 200 gir 396). Passer best med tilbakemeldingen om få, store flater.
    - `boats`, `spiral`, `caps`, `volleyball`, `woven` og `seam`: laget til sammenligning. Flere av dem er sportsballgeometri, som brukeren ikke vil ha på planetene.
  - **Plexus i stedet for paneler:** `pattern: 'plexusA'`, `'plexusB'` eller `'plexusC'`. Tallene står i `plexus` i config og gjelder en kule med radius `plexus.radius` (3); på andre kuler skaleres de med radiusen. Tall i `bodyLooks.<kule>` erstatter dem for den ene kula.
    - A (tett, 280 noder) og B (grov, 34 noder): noder i hvit lakk, stenger i mørkt metall, en andel fylte fasetter (`fill`) og en fasettert kjerne (`core`). Nodene driver rundt hvert sitt hvilepunkt (`speed`, `drift`), med fast topologi, så ingenting hopper.
    - C: typisk motion graphics-plexus i hvitt (ikke blått, på grunn av stilguiden): lysende punkter som vandrer, og linjer mellom alle som er nærmere enn `linkDistance`, tonet ut med avstanden.
    - Testet i en scratch-kopi med Jupiter `plexusB`, Mars `plexusC` og Venus `facets` 30: alt tegnes riktig.
- **Kjedene:** eget materiale, `chainColor`, `chainMetalness`, `chainRoughness` og `chainGloss` i `look`. Brukeren har satt dem til mørkt metall.
- **Farger:**
  - `accent.color` er fargen som skiller seg ut i mekanikken (i dag `#f3f595`): ringene ved stolpene og mellomhjulet ved Neptun.
  - `bodyLooks.<kule>.color` er fargen på hver kule, sola inkludert, i dempede, ekte toner. Jorda har `color` (havet), `land` og `ice`. Fugene er mørkt metall. Kuler uten blokk blir hvite.
  - `createBodyMaterials` i materials.js lager ett materiale per navn. panels.html viser kulene i fargene sine; plexus.html og rings.html er hvite.
  - Alt i mekanikken er hvit lakk, også alle stag (stilguiden). Mørkt metall: fugene og kjernene i kulene, kjedene, kula i kryssleddet ved Mars, og rullene og rulleakslene på foten ved jorda.
- **Sola:** `bodyLooks.sun.style` er `'lacquer'` eller `'glass'`. Glass har en glødende kjerne og et lys innenfra (`glow` og `glowParts`), og glasset kaster ingen skygge.
- **Mot flimring** (`blur` i config, `src/blur.js`): hver rask del måles hvert bilde (grader dreid siden forrige bilde). Over `threshold` (4°) tones det inn over `fade` (8°):
  - månene: et lysende spor bak månen langs banen (buen siden forrige bilde × `trailLength`), som blir en svak, hel ring over `ringAbove` (90°)
  - stag, månearmer og bærerens edderkopper: en vifte av `fanCopies` gjennomsiktige kopier, aldri bredere enn `fanMaxAngle`
  - tannhjul og kjeder ved månene: en glatt krans eller et glatt bånd i samme materiale over tennene og leddene
  - Listen over raske deler bygges i `main.js` (`fastParts` og kjedene), og `updateBlur()` kalles sist i animasjonen. Ved 2 d/s får Fobos og planethjulene ved Mars fullt spor; Io, Deimos og Enceladus-båndet delvis.
  - Titania, Oberon og Triton har lysspor, hjulene ved Uranus og Neptun glatte kranser, og kjedene til Uranus' måner og Triton glatte bånd.
  - Jorda: over grensen tones en glatt kule inn med fargene smurt ut langs hver breddegrad (`createSpinBlur`). Ved startfarten (2 d/s) dreier jorda 12° per bilde, så da synes den glatte kula; kontinentene synes under ca. 0,6 d/s. Vinkelgiret, hjulene ved foten og dagkjedet har glatte former.
- **Jorda med landmasser** (`bodyLooks.earth`, `pattern: 'continents'`): opphøyde kontinenter (`height` 0,06 opp, med fas `chamfer`) i `land`, isen (Antarktis, Grønland) i `ice`, havet i `color`. Store paneler fylles ved å halvere den lengste kanten til alle er korte, så ingen flate trekanter ligger under havkula.

## Testsider
- Åpnes med `npm run dev`:
  - `http://localhost:5173/orrery/panels.html`: ekte kuler i modellstørrelse (radius, farge og mønster fra config): Merkur, Venus, jorda, Mars, Jupiter, Saturn, Uranus, trisolaris-planeten, månen, Io, Iapetus og Fobos, med mikrointeraksjonen (pek med musa, eller trykk). De gamle mønsterprøvene (bånd, båter, volleyball, spiral, polarhetter, flettet, nesten glatt, fasetter 30/80/200) er byttet ut; mønstrene finnes fortsatt i panels.js.
  - `http://localhost:5173/orrery/plexus.html`: plexus A, B og C, også med mikrointeraksjonen.
  - `http://localhost:5173/orrery/trisolaris.html`: tre soler i åttetallsbane (se Trisolaris).
  - `http://localhost:5173/orrery/rings.html`: Saturns ring i fire varianter (A satin, B instrument, C glass som i modellen, D blanding), hver stor og i samme størrelse som i modellen, med kameraet som går rundt. `?t=15&stop` står stille 15 s ut i runden. Hver rute tegner sin bit av gradienten, så glasset har noe å se gjennom.
- Klikk stopper eller starter bevegelsen, og dra for å se fra andre vinkler.
- Testsidene er ikke med i `npm run build`, så de kommer ikke på GitHub Pages. `vite preview` viser modellen i stedet for dem; bruk dev-serveren.

## Slik har det vært sjekket
- **To sjekker**, begge i `scripts/check.mjs`, og begge skriver tiden de brukte til slutt:
  - **`npm run check`** (rask, ca. 3 s): alt under, men simuleringen B kjøres bare med 200 tilfeldige tidspunkt og passeringer innen 20 omdreininger. Kjør den etter hver endring i config.
  - **`npm run check:full`** (ca. 2 min): alt, med hele simuleringen B (20 000 tidspunkt og passeringer innen 2 000 omdreininger). Kjør den før PR.
  - Det er B som tar mest tid. 3D-klaringen (D–G) tar et par sekunder og er med i begge.
  - B var 32 min. Den ble ca. 11 ganger raskere uten å sjekke mindre: svaret fra `allowedPair` huskes per navnepar (det lagde tekst og regulære uttrykk for hvert par), avstanden regnes før den spørres, og formene i hver kropp samles i grupper med samme høydebånd og en ramme, så hele grupper i et annet bånd eller lenger unna enn den minste avstanden som er funnet, hoppes over. Den minste klaringen per par ble lik som før.
  - De tilfeldige tidspunktene i B kommer fra en fast startverdi (mulberry32), så to kjøringer gir samme tabell. (Startdatoen er «i dag», så tallene flytter seg likevel litt fra dag til dag.)
  - Begge skriver ut største radius og endringen siden forrige kjøring. Forrige verdi ligger i `scripts/lastCheck.json`. Det er ingen grense, så radiusen gir aldri feil.
  - 3D-verktøyet (`run3D` og formene) ligger i `scripts/clearance3d.mjs`.
- Begge sjekkene sjekker:
  - omløpstidene (innen 1 % og samme retning), også Jupiters måner i dager, og at Io/Europa/Ganymedes går nøyaktig 4:2:1 sett fra armen
  - at rullene ligger i setene på alle kjedene
  - at parallellhjulet står stille i rommet
  - startposisjonene, og at Laplace-vinkelen er 180° og står stille
  - kollisjoner, med reservert plass: A gjelder for alle vinkler; B er en simulering med stikkprøver; C er som A, men regnet fra Jupiter-stolpen, for alt som går rundt ved Jupiter. Forlegsakselen mot kjedet sjekkes i planet (1,94).
  - D: alt ved Saturn i 3D, sett fra stolpen. Hver del er et omdreiningslegeme om sin akse (loddlinjen, Saturns akse eller den skrå forlegsakselen), braketten og platen er staver. Unntak: hjul i inngrep, lager (rør i rør), og glipen mellom glassbåndene (fugen C–B 0,04 og Cassinidelingen B–A 0,24).
  - E: alt ved Mars i 3D, med de samme verktøyene (`run3D`): loddlinjen, den skrå drivakselen, mellomhjulet og Mars' akse; planethjulene som en ring rundt aksen; braketten og knasten som staver/sylindre fra overflaten de sitter på. Unntak som D, og kryssleddet. To deler regnes ikke mot hverandre når en del fra en av dem ligger mellom (`shielded`, for eksempel et hjul på et rør mot akselen inni). Mellomhjulet mot bærerrøret ved siden av det lille hjulet (0,20) skrives ut i stedet for å telle: det er den vanlige klaringen ved foten av et hjul i inngrep.
  - F: alt ved Uranus i 3D, med formene fra `iceMoons.js` (`uranusParts`): armen, kjedene og driveakselen om loddlinjen, forlegsakselen om sin akse, og rørene til Titania og Oberon om Uranus' akse; braketten, lagrene, polakselen, navet, ringene og kula står stille. Ringene ligger tettere enn 0,3, men står stille sammen.
  - G: alt ved Neptun i 3D (`neptuneParts`): kragen og Tritons rør om stolpen, dobbelthjulet og mellomhjulet om tappene, og staven, foten og Triton i 36 stillinger rundt (de går opp og ned).
  - Festet (`checkMounts` i `clearance3d.mjs`): ved Uranus og Neptun skal hver aksel sitte i en fast del som henger sammen med stolpen eller armen, eller i en annen festet aksel. Feil hvis ikke. Den skriver ut hva hver aksel er festet i.
  - Titania, Oberon og Triton: omløpstidene (Triton skal gå baklengs), kjedene, og startposisjonene.
  - Uranus: omløpstidene for Uranus og Neptun, driften til Uranus-stolpen, og ringretningen: på kanten ved jevndøgn 07.12.2007 (0,4°) og over 60° ved solverv 01.12.1985 (80,9°).
  - Motakselen og par-uranus er med i A og B.
  - Mars: omløpstidene, planetgirets forhold, driften til stolpen, at K ligger på både loddlinjen og drivakselen, og ekvatorplanet (−3,7° ved vårjevndøgn 12.11.2024, 25,1° ved sommersolverv 12.07.2023).
  - En tabell over raske deler (grader per bilde ved startfarten og 60 bilder/s).
  - Saturns omløpstider (Enceladus, Titan, Iapetus), driften til Saturn-stolpen, og ringens retning: ca. −3,8° åpen mot sola ved ringplanpasseringen 23.03.2025 (middellengder, toleranse 5°) og nordsiden opplyst 24.05.2017.
  - Jorda: døgnet (innen 0,01 %, prograd, og soldøgnet), og Greenwich-meridianen etter stjernetiden på startdatoen. I A og B er alt ved jordstolpen over månearmen ett område; dagkjedet og tannhjulet ved foten har egne. H: alt ved jordstolpen i 3D (`earthParts`), med festesjekken.
  - B tegner alt som massive sirkler, så rør må ikke legges inn der (de sjekkes i A). Saturn er ett område der (ring, måner og hjulkasse).
  - Drev: modellen bygges i Node (ca. 1 s). Feil hvis en mesh (utenom kulene og blur-delene) ikke arver noe drev, hvis et navn ikke er en kropp, hvis en gruppe som dreier over en kule mangler kula i drevet, eller hvis en kropp ikke har noe mekanikk. Skriver ut antall deler per kropp. Fordi merkene arves, fanger den bare et glemt merke når delen ikke har noen merket forelder.

  Lengre kjøring: `node scripts/check.mjs 100000 10000`. Rask kjøring direkte: `node scripts/check.mjs quick`.
- **Skjermbilder:** hodeløs Chrome (`--use-angle=swiftshader`) mot en scratch-kopi av prosjektet, med `node_modules` lenket inn som junction. Fjern junction med `cmd /c rmdir`, **aldri** `rm -rf`.
  - Det går også an å bygge til scratch med `npx vite build --base=./ --outDir <scratch>/dist` og servere med `npx vite preview --outDir <scratch>/dist`. Adressen er da `/orrery/`.
  - Hodeløs Chrome har en minste vindusbredde på ca. 500 px. Smalere skjermbilder blir klippet og ser feil ut.
  - Skjermbilder ett sted i modellen: kopier `src` til scratch og la en lappefil (`patch.cjs`) få `main.js` til å lese `?cam=x,y,z&target=x,y,z&years=…` fra adressen. Prosjektets egne filer endres ikke.
  - Stopp dev- og preview-servere etterpå. `TaskStop` stopper ikke alltid node-prosessen, så sjekk porten med `Get-NetTCPConnection -LocalPort <port>` og stopp prosessen hvis kommandolinjen inneholder `vite`.

## Kjente feller
- **Avstand mellom linjestykker:** bruk `segmentDistance` i `src/segments.js` (0 hvis stykkene krysser, ellers den minste avstanden fra de fire endepunktene til det andre stykket). Den gamle `segDist` gjorde bare én runde med å klemme parameterne og ga ofte for stor avstand (rettet 17.11).
- **Skjermbilder som skal sammenlignes:** startdatoen er «i dag» og plexus-kulene beveger seg med klokka, så lås datoen og tiden i scratch-kopien (som i Skjermbilder) før du sammenligner piksel for piksel.
- **Retning gjennom en vinkelgir:** to koniske hjul med toppunktet mellom seg dreier motsatt vei; ligger det ene hjulet på den andre siden av toppunktet, dreier de samme vei. Ved Uranus (aksene står 82° fra hverandre) måtte hjulet på driveakselen over toppunktet for at månene skulle gå riktig vei. `npm run check` sjekker retningen på alle månene.
- **Ett mellomhjul mellom to hjul på samme akse snur ikke retningen** (to inngrep). Ved Neptun trengs tre inngrep: krage, dobbelthjul, mellomhjul, Tritons rør.
- **Rekkevidden til noe som dreier om Uranus' akse** (som ligger nesten vannrett) er omtrent avstanden fra Uranus' sentrum, ikke fra aksen. En arm langt ute på polakselen gjør derfor Uranus bred; stagene til månene går skrått ned mot ringplanet.
- **Kjedehjul på et rør i tårnet** må være større enn røret (de ytterste rørene er 16–18 i radius).
- **Python i Git Bash:** `"\u0000"` i en Python-streng som skrives til JS kan bli et ekte NUL-tegn, og `sed` gjør `\u` i erstatningen om til «stor bokstav». Sjekk filen etterpå (`file`, `cat -A`).
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
- **Mikrointeraksjonen:**
  - Prøv tallene i `bodyLift` i nettleseren og på mobil (`npm run dev -- --host`).
  - På plexusA (sola) henger fasettene sammen i nodene, så kula bare sveller litt og kjernen synes ikke. Vil man se kjernen, må fasettene krympe mot midten sin eller skilles i tillegg.
  - Klikk på en kule på testsidene stopper eller starter også dreiningen.
- **Trisolaris:**
  - Se over siden i nettleseren.
  - Maskinene er store fordi X-sveiven er like lang som halve bredden (15). Det faste hjulet til 5θ har radius 12.
  - Rammen i C henger i bjelkene bare langs kantene; vurder stag.
  - Banen er satt i gang med θ jevnt i tid, som er riktig for den ekte banen (Fourier i tid).
- **Farger på kulene** (stilguiden): fargene står i `bodyLooks` (dempede, ekte toner). Se over dem i nettleseren og juster; testsidene panels, plexus og rings er fortsatt hvite.
- **favicon.svg** er fortsatt Vite-logoen (brukeren tar den senere).
- **Uranus og Neptun:** se på månene, vinkelgiren, lagrene og føringsringen fra alle kanter i nettleseren. Hjulparene under Uranus er store fordi forlegsakselen ligger 7,7 under aksen; `uranusRing.scale` og `reachGap` kan gjøre modellen smalere.
- Vurdert, men ikke valgt for månene til Uranus og Neptun (17.11, koden er slettet): snorer og et tannhjultog langs Neptun-armen (for rotete, ligger i stashet), A (ringene δ og ε bærer månene: ringene ligger bare 0,2 fra hverandre, og største radius ble 118,0), B med månene inne i ringhullet (114,6, men brukeren ville ha dem utenfor), og en vippearm for Triton (rund bane, men ikke rundt Neptun, og mye bredere).
- **Saturn:** se over om Saturn-hjulkassen ser bra ut fra alle kanter, og vurder kortere forlegsaksel (den går ca. 13 fra vinkelgiren opp til hjulene).
- **Mars:** se på planetgiret, braketten og kryssleddet på toppen av stolpen fra alle kanter; drivakselen er ca. 10 lang fra K opp til det store hjulet.
- **Velge nye mønstre for planetene,** med `facets` eller plexus som utgangspunkt (se Utseende).
- **Lysspor:** finjuster tallene i `blur` etter å ha sett det i nettleseren (grensen, sporlengden og vifta).
- Rørstabelen rundt Jupiter-stolpen er ca. 14 høy og 1,7 i radius. Den kan gjøres kortere ved å senke månearmene (lengre månestolper).
- Mer fra stilguiden:
  - Aksler og rør som dreide profiler med skulder og avfaset ende.
  - Armene skal være parallelle: stilguiden ble endret, men koden har fortsatt avsmalning.
  - Myk overgang der eikene møter kransen på tannhjulene.

## Småting
- `inPlane` (mechanism.js) er rettet til `atan2(sin φ, cos φ / cos t)`, så den stemmer også over 90° (Uranus). For Saturn og Mars gir den det samme som før.
