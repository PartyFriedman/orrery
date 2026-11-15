// Mønsterprøve: plexus-kuler. Åpnes på /orrery/plexus.html med `npm run dev`.
// A og B er plexus i modellens materialer, C er den typiske motion
// graphics-plexusen, til sammenligning (se plexus.js; tallene står i plexus i
// config.js). Klikk stopper og starter bevegelsen.
import * as THREE from 'three';
import { plexus } from './config.js';
import { createPlexus } from './plexus.js';
import { createStage } from './testStage.js';

const R = plexus.radius;
const stage = createStage({ count: 3, radius: R, spacing: R * 3 });

const slots = [
  { title: 'A: tett og fin', pattern: 'plexusA', note: `plexusA · ${plexus.A.nodes} noder` },
  { title: 'B: grov', pattern: 'plexusB', note: `plexusB · ${plexus.B.nodes} noder` },
  { title: 'C: typisk plexus', pattern: 'plexusC', note: 'plexusC · motion graphics, til sammenligning' },
];
const spins = slots.map(({ title, pattern, note }) => {
  const spin = new THREE.Group();
  spin.rotation.x = 0.35;
  stage.addSlot(title, note).add(spin);
  return { spin, update: createPlexus(spin, pattern, R, stage.materials) };
});

stage.run((time, seconds) => {
  for (const { spin, update } of spins) {
    spin.rotation.y += seconds * 0.12;
    update(time);
  }
});
