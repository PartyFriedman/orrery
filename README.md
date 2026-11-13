# orrery

Two meshing gears rendered in 3D in the browser with [three.js](https://threejs.org/).

The gears have true involute teeth, spokes and chamfered edges. The big gear drives the small one, which turns faster and in the opposite direction according to the gear ratio.

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

- **`gear`**: shared dimensions for both gears, such as tooth size (module), pressure angle, thickness, chamfer, backlash and speed.
- **`bigGear` / `smallGear`**: tooth count, center hole, spokes, and hub and rim width for each gear.
- **`look`**: background, material (satin white lacquer), lighting and shadow.

The distance between the gears is calculated from the tooth counts, so they always mesh correctly when you change them.

## Files

- [src/main.js](src/main.js): scene, camera, lighting and animation
- [src/gear.js](src/gear.js): builds a gear's geometry (involute profile, hole, spokes and chamfer)
- [src/config.js](src/config.js): all the settings
