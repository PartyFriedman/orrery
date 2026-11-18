// Mønsterprøve: plexus-kuler. Åpnes på /orrery/plexus.html med `npm run dev`.
// A og B er plexus i modellens materialer, C er den typiske motion
// graphics-plexusen, til sammenligning (se plexus.js; tallene står i plexus i
// config.js). Pek på en kule med musa, eller trykk på den på mobil, så skyves
// nodene ut (bodyLift i config). Klikk stopper og starter bevegelsen.
import * as THREE from 'three';
import { plexus } from './config.js';
import { createPlexus } from './plexus.js';
import { createBodyLift } from './bodyLift.js';
import { createPicking } from './picking.js';
import { createStage } from './testStage.js';

const R = plexus.radius;
const stage = createStage({ count: 3, radius: R, spacing: R * 3 });

const slots = [
  { title: 'A: tett og fin', pattern: 'plexusA', note: `plexusA · ${plexus.A.nodes} noder` },
  { title: 'B: grov', pattern: 'plexusB', note: `plexusB · ${plexus.B.nodes} noder` },
  { title: 'C: typisk plexus', pattern: 'plexusC', note: 'plexusC · motion graphics, til sammenligning' },
];
const registry = {}; // for bodyLift og picking, som spheres i model.js
const spins = slots.map(({ title, pattern, note }, i) => {
  const spin = new THREE.Group();
  spin.rotation.x = 0.35;
  stage.addSlot(title, note).add(spin);
  const update = createPlexus(spin, pattern, R, stage.materials);
  registry[i] = { object: spin, radius: R, plexus: update };
  return { spin, update };
});

const bodyLift = createBodyLift(registry);
const picking = createPicking(stage.camera, stage.renderer.domElement, registry, (name, pointerType) => {
  if (pointerType !== 'mouse') bodyLift.pulse(name);
}, { onHover: bodyLift.hover });

stage.run((time, seconds, frame) => {
  picking.update();
  bodyLift.update(frame);
  for (const { spin, update } of spins) {
    spin.rotation.y += seconds * 0.12;
    update(time);
  }
});
