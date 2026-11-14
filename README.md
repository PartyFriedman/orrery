# orrery

An orrery with the sun, Mercury, Venus, the earth with its moon, and Mars, rendered in 3D in the browser with [three.js](https://threejs.org/) and built as a working mechanism.

A single input turns a drive shaft. Everything else follows from the tooth counts and chains:

- **Planets:** each planet has its own tube around the sun's fixed axle, with a gear at the bottom driven from the drive shaft and an arm at the top. The earth's pair is 12 → 36, which sets one year to three turns of the drive shaft. Mercury (29 → 21), Venus (19 → 35) and Mars (11 → 62) get their orbital periods within 0.25 %. Every pair spans the same distance, so each pair has its own tooth size.
- **Stacking:** shorter arms sit higher and their tubes further in, so the arms pass each other without colliding.
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
- **`center`**: the thickness of the sun's axle and the tubes around it.
- **`gear`**, **`bigGear`**, **`smallGear`**: the earth's year gears and what all the bottom gears share, such as tooth count, spokes and chamfer.
- **`arm`**: length and size of the earth arm.
- **`planets`**: tooth counts, arm length and size for Mercury, Venus and Mars, plus the period each one aims for.
- **`moonTrain`**: the moon gears, the sprockets for both chains, and the chain pitch.
- **`tilt`**: the earth's axial tilt, the moon's orbital tilt, and the directions they point in.
- **`bodies`**: sizes of the sun, earth and moon, the height of the sun and planets, and the moon's distance from the earth.
- **`look`**: background, material (satin white lacquer), lighting and shadow.

Shaft positions, tube order, heights, tooth sizes, chain lengths and sprocket sizes are calculated from these numbers, so the gears always mesh, the chains always fit and the arms stay clear of each other. If a combination doesn't fit, an error in the browser console says which setting to change.

## Files

- [src/main.js](src/main.js): scene, camera, lighting, the parts and animation
- [src/mechanism.js](src/mechanism.js): the mechanism as pure math (tube order, heights, shaft positions, chain paths, and every angle from the input)
- [src/gear.js](src/gear.js): builds gear and sprocket geometry (tooth profiles, hole, spokes and chamfer)
- [src/config.js](src/config.js): all the settings
