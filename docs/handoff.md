# Handoff: orrery (mekanisk solsystem i three.js) – 15.11.2026

## Prosjekt og status
- Mappe: `c:\Users\oyvin\Desktop\Projects\Vibekoding\claudecode_VScode\orrery` (Vite + three.js, `npm run dev` / `npm run build`). Repo: PartyFriedman/orrery, publiseres til GitHub Pages fra `main` via `.github/workflows/deploy.yml` (base `/orrery/` i `vite.config.js`).
- Gren: `Speed-Control`, laget fra `Outer-Planets`. Der er de to kjedene via et løst hjul på sentralakselen committet («Changes large cog»).
- Siste steg (ferdig, ikke committet): glidebryter for tid, med planetene stilt inn etter ekte dato (se Tid og dato). Bygget går gjennom, og `npm run check` sier «Alt i orden».

## Arbeidsregler (fra brukeren)
- Svar på norsk. Forklar kort hva som endret seg.
- **Aldri commit eller push uten at brukeren ber om det.** Sjekk gren først; brukeren lager en ny gren per steg og merger via PR.
- Store steg: planmodus først, så bygging etter godkjenning.
- Brukeren justerer tall i `src/config.js` selv. Behold verdiene deres.
- Stilguide: `docs/styleguide_orrery.md`. Kun hvitt, mørkt metall og rødt.

## Filer
- `src/config.js`: alle innstillinger (se under).
- `src/mechanism.js`: ren matematikk uten three.js. Pakker armlengder automatisk, ordner rørene, regner ut høyder, akselposisjoner og kjeder (`makeChain`), og alle vinkler fra inngangen (`anglesAt`). Har feilmeldinger når noe ikke passer.
- `src/main.js`: scene, lys, kamera og alle deler. `addGear`, `addSprocket`, `addChain`, `addArm`, `addPlanetSphere`, `addSun`.
- `src/ephemeris.js`: middellengder for planetene (JPL, Standish tabell 1) og månen og knutelinjen (Meeus). `daysPerYear` = 365,256 (én runde for jorda).
- `src/timeControl.js`: glidebryteren nede på siden (DOM), med dato og fart. Stilen ligger i `src/style.css`.
- `src/gear.js`: evolventtannhjul, kjedehjul og `extrudeFlat`.
- `src/arm.js`: armer som smalner av, med myk overgang inn i navet.
- `src/panels.js`: panelkuler med mønstrene `triangles`, `quads`, `kites`, `rhombi`, `pentagons`, `bands`, `hexagons` og `trionda` (sola: 4 S-kantede paneler fra et tetraeder). Panelene er buede eller flate, med mørke fuger. `delaunayFlip` retter earcut-trekanter.
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
- **Stabling:** nederst ligger de to kjedene over hverandre (`heights.driveChain` og `heights.layChain`). Over dem står alle tannhjulene i et åpent tårn under alle armer. Rørene ligger med kortest arm innerst, og et fast rør inni røret til hver planet med mekanikk. Høydene regnes ut i `heights`.
- **Armlengder:** pakkes automatisk innenfra og ut (`armLength: 'auto'`), med `reachGap` mellom rekkeviddene. Mekanikken ved planeten tas med.
- **Reservert, ikke bygget:**
  - Faste rør og stabler over armen for Mars (`moons+parallel`), Jupiter (`moons`) og Saturn (`moons+parallel`).
  - Plass til måner: Fobos/Deimos, Io/Europa/Ganymedes/Callisto og Titan, pakket med `moonGap`.
  - Saturns ring: 1,2–2,27 ganger radiusen, helling 26,7°.
- **Størrelser:** r = `sizes.earth` · (R/R_jord)^`exponent` (2 og 0,2). Månene ganges med `moonScale` (0,5), minst `minMoon` (0,3). Sola har radius 6.

## Tid og dato
- **`time` i config:**
  - `startDate`: `'today'` eller en ISO-dato.
  - `slowest`, `fastest` og `start`, i dager per sekund.
- **Glidebryteren:** helt til venstre står modellen stille. Ellers er skalaen logaritmisk fra `slowest` til `fastest`. Tekstene er på engelsk, for eksempel «15 Nov 2026» og «2 days/s».
- **Innstillingen:** hvert hjul på mellomakselen og forlegsakselen står på akselen med en startvinkel (`phases` i `mechanism.js`, `mesh.rotation.y` i `main.js`). Det store månekjedehjulet 47 står med `phases.moon` på pinionakselen. Ved input 0 står da alt på middellengden for startdatoen. `anglesAt` returnerer også `moonDriveAngle`.
- **Retninger:** `tilt.equinoxDirection` er retningen mot lengde 0°. Jordaksen heller mot 0° + 90°, og knutelinjen er Ω på startdatoen. Begge regnes ut; `earthAxisDirection` og `moonNodeDirection` er fjernet.
- **`drive.speed` er fjernet.** Animasjonen regner `years` og bruker input = `years · inputPerYear`. Hvert bilde dekker høyst 0,1 s.
- **`npm run check`** har en startsjekk som skriver ut lengdene ved startdatoen.

## Utseende
- **Armene:** `armStyle` styrer avsmalning, overgang, nav som stikker opp og ned, og krage. En tynn rød ring der planetstolpen møter armen.
- **Kulene:** paneler per kule i `panels.*`. Fugebredden kan settes per kule; på sola følger den `sunRadius`.
- **Sola:** `accent.sunStyle` er `'lacquer'` eller `'glass'` (glass har lys innenfra).

## Slik har det vært sjekket
- **`npm run check`** (`scripts/check.mjs`, ca. 1,5 min). Kjør den etter hver endring i config. Den sjekker:
  - omløpstidene (innen 1 % og samme retning)
  - at rullene ligger i setene på alle kjedene
  - at parallellhjulet står stille i rommet
  - kollisjoner, med reservert plass: A gjelder for alle vinkler; B er en simulering med stikkprøver

  Lengre kjøring: `node scripts/check.mjs 100000 10000`.
- **Skjermbilder:** hodeløs Chrome (`--use-angle=swiftshader`) mot en scratch-kopi av prosjektet, med `node_modules` lenket inn som junction. Fjern junction med `cmd /c rmdir`, **aldri** `rm -rf`.
  - Det går også an å bygge til scratch med `npx vite build --base=./ --outDir <scratch>/dist` og servere med `npx vite preview --outDir <scratch>/dist`. Adressen er da `/orrery/`.
  - Hodeløs Chrome har en minste vindusbredde på ca. 500 px. Smalere skjermbilder blir klippet og ser feil ut.

## Kjente feller
- **Git Bash** gjør `--base=/` om til en Windows-sti. Bruk `--base=./`.
- **`node -e` med æøå eller mye anførselstegn** feiler. Skriv skript til fil, eller bruk Edit.
- **Heredoc i Git Bash** gjør `\n` i teksten om til ekte linjeskift. Sjekk resultatet.
- **main.js får av og til CRLF-linjeskift** fra git. Ta høyde for `\r\n` i skript.
- **Skript utenfor prosjektet** finner ikke `'three'`. Importer med absolutt filsti, eller legg en midlertidig fil i prosjektet og slett den etterpå.

## Ikke beskyttet av feilmeldinger
- For stor `center.tubeWall`.
- Veldig liten `drive.distance`.
- `moonOrbit` mindre enn jordas radius pluss månens.
- Veldig få tenner.

## Mulige neste steg
- Månemekanikk for Mars, Jupiter og Saturn, og den parallellførte Saturn-ringen. Plassen er reservert.
- Mer fra stilguiden:
  - Aksler og rør som dreide profiler med skulder og avfaset ende.
  - Armene skal være parallelle: stilguiden ble endret, men koden har fortsatt avsmalning.
  - Myk overgang der eikene møter kransen på tannhjulene.
