# orrery

A compact orrery with the sun, Mercury, Venus, the earth with its moon, Mars, Jupiter and Saturn, rendered in 3D in the browser with [three.js](https://threejs.org/) and built as a working mechanism. Sizes and distances are not to scale; the order and the orbital periods are.

A single input turns a drive shaft. Everything else follows from the tooth counts and chains:

- **Planets:** each planet has its own tube around the sun's fixed axle, with a gear at the bottom and an arm at the top. The earth's pair is 12 → 36, which sets one year to three turns of the drive shaft. Mercury (29 → 21), Venus (19 → 35) and Mars (11 → 62) are driven straight from the drive shaft. Every pair spans the same distance, so each pair has its own tooth size.
- **Jupiter and Saturn:** their periods are too long for one pair. A chain (12 → 136) at the very bottom drives a lay shaft, and a pair from it drives each tube: Jupiter 14 → 44, Saturn 10 → 78. All periods are within 0.25 %.
- **Stacking:** all gears sit in an open tower below all the arms. Shorter arms sit higher and their tubes further in, so the arms pass each other without colliding. Arm lengths are packed automatically, as short as the mechanism allows.
- **Room for later:** Mars, Jupiter and Saturn each have a fixed tube and space above their arm reserved for a moon mechanism like the earth's, and space around the planet for their moons and Saturn's ring.
- **Moon:** a fixed 60-tooth wheel on its own fixed tube drives a 12-tooth pinion on the earth arm, and a chain from a 47-tooth to a 19-tooth sprocket turns the moon around the earth. That gives 235/19 = 12.368 lunar months per year, the Metonic cycle (about one day off every 220 years).
- **Parallel motion:** a second chain between two equal sprockets keeps the earth's 23.44° axis and the moon's 5.14° orbit pointing the same way in space as the arm goes around. A tilted ring lifts the moon above and below the line between the earth and the sun.

## Getting started

You need [Node.js](https://nodejs.org/).

```sh
npm install
npm run dev
```

Open the address Vite prints (usually http://localhost:5173). Drag with the mouse to orbit the camera and scroll to zoom.

| Command           | What it does                                 |
| ----------------- | -------------------------------------------- |
| `npm run dev`     | Starts a dev server with live reload         |
| `npm run build`   | Builds a production version into `dist/`     |
| `npm run preview` | Serves the production build locally          |

## Tweaking

Every number you can adjust lives in [src/config.js](src/config.js):

- **`drive`**: speed of the input in turns per minute, and the distance from the drive shaft to the center.
- **`outerDrive`**: the chain to the lay shaft that drives Jupiter and Saturn, and where the lay shaft stands.
- **`spacing`**: gaps in height, between chains, between neighbouring arms' reach, and between moon orbits. Smaller numbers give a more compact model.
- **`sizes`**: the compressed size scale for planets and moons (earth size, exponent, moon scale and real radii).
- **`center`**: the thickness of the sun's axle and the tubes around it.
- **`gear`**, **`bigGear`**, **`smallGear`**: the earth's year gears and what all the bottom gears share, such as thickness, spokes and chamfer.
- **`arm`**: length (`'auto'` or a number), width and thickness of the arms.
- **`armStyle`**: how the arms taper, the soft transition into the hub, the edge chamfer, and the collar around each post.
- **`planets`**: tooth counts, arm length (`'auto'` or a number), the period each one aims for, the moons and ring to reserve room for, and what moon mechanism to reserve room for.
- **`moonTrain`**: the moon gears, the sprockets for both chains, and the chain pitch.
- **`tilt`**: the earth's axial tilt, the moon's orbital tilt, and the directions they point in.
- **`bodies`**: the size of the sun, the height of the sun and planets, and the moon's distance from the earth.
- **`panels`**: the panel pattern on each planet, the moon and the sun (triangles, quads, kites, rhombi, pentagons, latitude bands, hexagons, or for the sun four identical panels with S-shaped edges, like a Trionda ball, whose swing and bulge you can set), how finely each is divided, whether the panels are curved to the sphere or flat plates, and how wide and deep the seams are.
- **`accent`**: the red colour, whether the sun is glossy red lacquer or red glass lit from inside, and the thin red ring where each planet post meets its arm.
- **`look`**: background, material (satin white lacquer), seam colour, lighting and shadow.

Arm lengths, shaft positions, tube order, heights, tooth sizes, chain lengths and sprocket sizes are calculated from these numbers, so the gears always mesh, the chains always fit and the arms stay clear of each other. If a combination doesn't fit, an error in the browser console says which setting to change.

## Files

- [src/main.js](src/main.js): scene, camera, lighting, the parts and animation
- [src/mechanism.js](src/mechanism.js): the mechanism as pure math (arm lengths, tube order, heights, shaft positions, chain paths, and every angle from the input)
- [src/gear.js](src/gear.js): builds gear and sprocket geometry (tooth profiles, hole, spokes and chamfer)
- [src/arm.js](src/arm.js): builds the tapered arms with rounded ends and a soft transition into the hub
- [src/panels.js](src/panels.js): builds the planet spheres from panels with dark seams, in a different pattern for each body
- [src/config.js](src/config.js): all the settings
