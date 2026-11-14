# orrery

A sun, earth and moon tellurium rendered in 3D in the browser with [three.js](https://threejs.org/), built as a working mechanism.

A single input turns a drive shaft. Everything else follows from the tooth counts and chains:

- **Year:** a 12-tooth gear on the drive shaft turns a 36-tooth gear on a tube around the sun's fixed axle, which carries the earth arm.
- **Moon:** a fixed 60-tooth wheel drives a 12-tooth pinion on the arm, and a chain from a 47-tooth to a 19-tooth sprocket turns the moon around the earth. That gives 235/19 = 12.368 lunar months per year, the Metonic cycle (about one day off every 220 years).
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

- **`drive`**: speed of the input, in turns per minute.
- **`gear`**, **`bigGear`**, **`smallGear`**: the year gears, such as module, tooth count, spokes and chamfer.
- **`arm`**: length and size of the earth arm.
- **`moonTrain`**: the moon gears, the sprockets for both chains, and the chain pitch.
- **`tilt`**: the earth's axial tilt, the moon's orbital tilt, and the directions they point in.
- **`bodies`**: sizes of the sun, earth and moon, their height, and the moon's distance from the earth.
- **`look`**: background, material (satin white lacquer), lighting and shadow.

Shaft positions, chain lengths and sprocket sizes are calculated from these numbers, so the gears always mesh and the chains always fit. If a combination doesn't fit, an error in the browser console says which setting to change.

## Files

- [src/main.js](src/main.js): scene, camera, lighting, the parts and animation
- [src/mechanism.js](src/mechanism.js): the mechanism as pure math (shaft positions, chain paths, and every angle from the input)
- [src/gear.js](src/gear.js): builds gear and sprocket geometry (tooth profiles, hole, spokes and chamfer)
- [src/config.js](src/config.js): all the settings
