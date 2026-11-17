# orrery

A mechanical orrery of the whole solar system, rendered in 3D in the browser with [three.js](https://threejs.org/) and built as a working mechanism: the sun, all eight planets, the earth turning on its axis, and thirteen moons, all driven from a single input through gears and chains. Sizes and distances are compressed; the order, the orbital periods and the tilts are real.

## The mechanism

A single drive shaft, 40 mm from the centre, turns three times per year. Everything else follows from tooth counts and chains, and every planet's orbital period is within 0.25 % of the real one.

- **Planets:** each planet has its own tube around the sun's fixed axle, with a gear at the bottom and an arm at the top. All gears sit in an open tower below the arms; shorter arms sit higher with their tubes further in, and arm lengths are packed automatically, as short as the mechanism allows.
  - The earth (12 → 36), Mercury (29 → 21), Venus (19 → 35) and Mars (11 → 62) are driven straight from the drive shaft.
  - Jupiter and Saturn: two chains at the bottom of the tower, via a loose double sprocket on the central axle (12 → 48, then 12 → 34), drive a lay shaft, which drives Jupiter (14 → 44) and Saturn (10 → 78).
  - Uranus and Neptune: a second gear on Saturn's tube drives a counter shaft, which drives Uranus (10 → 48) and Neptune (12 → 113).
- **The earth and the moon:** a fixed 60-tooth gear drives a pinion on the earth arm, and a 47 → 19 chain turns the moon: 235/19 lunar months per year, the Metonic cycle. A parallel chain (36 : 36) keeps the earth's post pointing the same way in space, so the 23.44° axis holds its direction through the year. A tilted guide ring under the earth lifts the moon 5.14° above and below the ecliptic, followed by a fork with two rollers.
- **The earth's rotation:** a chain from the pinion shaft and a gear pair drive a shaft inside the earth's post, and a bevel gear with its apex at the earth's centre turns the earth once per sidereal day. Greenwich starts at the right sidereal time for the start date.
- **Moons:** each moon system uses its own kind of mechanism. Where the moons orbit too fast for a fixed gear at the centre, a moon tube in the tower drives a chain along the planet's arm.
  - Jupiter: the chain drives a collar on Jupiter's post and a lay shaft on the arm, with one tube per moon. Io, Europa and Ganymede turn exactly 4 : 2 : 1 as seen from the arm, so the Laplace angle stays at 180°.
  - Saturn: the ring is three bands of frosted glass (C, B and A) that turn separately around Saturn's tilted axis, each carrying a moon on an arm: Iapetus, Titan and Enceladus. The post is held fixed in space by a second chain, and a bevel gear at the top drives a tilted lay shaft.
  - Mars: Phobos and Deimos run on a planetary gear below Mars, driven through a double universal joint and a tilted shaft. The ring gear stands still, the carrier is Deimos and the sun gear is Phobos.
  - Uranus lies on its side, held at its pole like a globe, with five thin rings of dark glass. Titania and Oberon are driven through a bevel gear and a lay shaft parallel to Uranus' axis.
  - Neptune: Triton runs backwards through an idler gear (three meshes), on a stalk that rides a tilted guide ring, so its orbit is tilted 130°.
- **Time:** the model is set to a start date like a real orrery. Every gear is fixed to its shaft at the angle that puts its planet or moon at its mean longitude on that date (JPL's approximate positions for the planets, Meeus for the moon and Jupiter's moons, JPL mean elements for the other moons). A slider at the bottom sets how fast time runs, from still to about a year per second, and shows the date. The orbits are circles at constant speed, so a planet can be off its true position by up to about 24° for Mercury, 11° for Mars and 2° for the earth.

## Looks

The mechanism is white satin lacquer with dark metal chains, and a single accent colour on the thin rings where the planet posts meet their arms (see [docs/styleguide_orrery.md](docs/styleguide_orrery.md)). The planets and moons are spheres of panels with thin dark seams, in muted versions of their real colours. The earth has raised continents, and the sun is faceted glass that glows from inside. Fast parts get light trails, fans and smooth shapes instead of flickering.

## Getting started

You need [Node.js](https://nodejs.org/).

```sh
npm install
npm run dev
```

Open the address Vite prints (usually http://localhost:5173/orrery/). Drag with the mouse to orbit the camera and scroll to zoom.

| Command              | What it does                                             |
| -------------------- | -------------------------------------------------------- |
| `npm run dev`        | Starts a dev server with live reload                     |
| `npm run build`      | Builds a production version into `dist/`                 |
| `npm run preview`    | Serves the production build locally                      |
| `npm run check`      | Quick check of periods, chains and collisions (a few seconds) |
| `npm run check:full` | Full check, with the long collision simulation (about 2 minutes) |

Run `npm run check` after changing numbers in the config, and `npm run check:full` before a pull request. They check that every orbital period is within 1 % of its target and turns the right way, that the chain rollers sit in the sprocket seats, that the posts held parallel stand still in space, that the start positions are right, that no parts collide at any angle (in the plane and in 3D around each planet), and that every shaft is held by a fixed part. The output ends with the model's largest radius and the change since the last run.

The main branch is published to GitHub Pages by [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

### Pattern test pages

With `npm run dev` running, three pages show options side by side. They are not part of the build.

- `/orrery/panels.html`: one sphere per panel pattern.
- `/orrery/plexus.html`: the three plexus spheres.
- `/orrery/rings.html`: Saturn's ring in four styles. `?t=15&stop` stops 15 seconds into the camera's orbit.

## Tweaking

Every number you can adjust lives in [src/config.js](src/config.js), with comments in Norwegian:

- **`time`**: the start date (`'today'` or a date like `'2026-11-15'`), and the slowest, fastest and starting speed of the time slider, in days per second.
- **`drive`**, **`outerDrive`**, **`counterDrive`**: the drive shaft, the chains to the lay shaft for Jupiter and Saturn, and the counter shaft for Uranus and Neptune.
- **`planets`**: tooth counts, arm length (`'auto'` or a number), the period each one aims for, its moons and its mechanism.
- **`moonTrain`**, **`earthDay`**, **`moonGuide`**: the moon's gears and chains, the earth's rotation, and the guide ring and follower for the moon's tilt.
- **`jupiterMoons`**, **`saturnMoons`**, **`saturnRing`**, **`marsMoons`**, **`uranusRing`**, **`uranusPost`**, **`iceMoons`**: the moons, rings and mechanisms at the outer planets.
- **`spacing`**, **`sizes`**, **`center`**, **`bodies`**, **`tilt`**: gaps, the compressed size scale, the central axle and tubes, the size and height of the sun and planets, and the tilts.
- **`gear`**, **`bigGear`**, **`smallGear`**, **`arm`**, **`armStyle`**: tooth shape, spokes and chamfer, and the shape of the arms.
- **`bodyLooks`**: one block per sphere (the sun, each planet and each moon): colour, roughness, gloss, panel pattern, and the sun's style and glow. A sphere takes anything it doesn't set from `defaults`.
- **`plexus`**: the plexus spheres, which can replace the panels on any sphere.
- **`look`**, **`accent`**, **`blur`**: background, the white lacquer and dark metal, chains, lighting and shadow; the accent colour; and the light trails and smooth shapes for fast parts.

Arm lengths, shaft positions, tube order, heights, tooth sizes and chain lengths are calculated from these numbers, so the gears always mesh and the arms stay clear of each other. If a combination doesn't fit, an error in the browser console says which setting to change.

## Files

- [src/main.js](src/main.js): the scene, camera and all the parts, and the animation
- [src/mechanism.js](src/mechanism.js): the mechanism as pure math: arm lengths, tube order, heights, shaft positions, chain paths, and every angle from the input
- [src/iceMoons.js](src/iceMoons.js), [src/earthDesign.js](src/earthDesign.js): the mechanisms at Uranus, Neptune and the earth as pure math
- [src/earthBuild.js](src/earthBuild.js), [src/earthSurface.js](src/earthSurface.js), [src/landmasses.js](src/landmasses.js): the earth's post, and the earth with its continents
- [src/ephemeris.js](src/ephemeris.js): mean longitudes of the planets and moons on a date
- [src/scene.js](src/scene.js), [src/materials.js](src/materials.js), [src/build.js](src/build.js): renderer and lighting, materials, and small building blocks shared by the model and the test pages
- [src/gear.js](src/gear.js), [src/arm.js](src/arm.js): gear, sprocket and arm geometry
- [src/panels.js](src/panels.js), [src/plexus.js](src/plexus.js), [src/scatter.js](src/scatter.js): the panel patterns and plexus spheres
- [src/ring.js](src/ring.js), [src/ringLayout.js](src/ringLayout.js): the glass rings of Saturn and Uranus
- [src/blur.js](src/blur.js): light trails, fans and smooth shapes for fast parts
- [src/segments.js](src/segments.js): distances between line segments
- [src/timeControl.js](src/timeControl.js): the time slider
- [src/testStage.js](src/testStage.js), [src/panelTest.js](src/panelTest.js), [src/plexusTest.js](src/plexusTest.js), [src/ringTest.js](src/ringTest.js): the test pages
- [src/config.js](src/config.js): all the settings
- [scripts/check.mjs](scripts/check.mjs), [scripts/clearance3d.mjs](scripts/clearance3d.mjs): the checks behind `npm run check`
