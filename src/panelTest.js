// Testside for panelmønstre: én kule per mønster, side om side, i samme lys og
// materiale som modellen (look og panels i config.js). Åpnes på /orrery/panels.html
// med `npm run dev`. Kulene dreier sakte; klikk for å stoppe eller starte dem.
import * as THREE from 'three';
import { panels } from './config.js';
import { createPanelGeometry } from './panels.js';
import { createStage } from './testStage.js';

// Mønstrene som vises, i rekkefølge. subdivisions: se panels.js.
const samples = [
  { label: 'Bånd', pattern: 'bands', subdivisions: 3 },
  { label: 'Båter (6)', pattern: 'boats', subdivisions: 6 },
  { label: 'Båter (8)', pattern: 'boats', subdivisions: 8 },
  { label: 'Volleyball', pattern: 'volleyball', subdivisions: 3 },
  { label: 'Spiral', pattern: 'spiral', subdivisions: 6 },
  { label: 'Polarhetter', pattern: 'caps', subdivisions: 4 },
  { label: 'Flettet', pattern: 'woven', subdivisions: 3 },
  { label: 'Nesten glatt', pattern: 'seam', subdivisions: 1 },
  { label: 'Fasetter (30)', pattern: 'facets', subdivisions: 30 },
  { label: 'Fasetter (80)', pattern: 'facets', subdivisions: 80 },
  { label: 'Fasetter (200)', pattern: 'facets', subdivisions: 200 },
];
const radius = 3;
const stage = createStage({ count: samples.length, radius, columns: 4, spacing: 8, rowSpacing: 9.5 });

const spins = samples.map((sample) => {
  const { geometry, coreRadius, count } = createPanelGeometry({
    radius, shape: panels.shape, seamWidth: panels.seamWidth, seamDepth: panels.seamDepth,
    pattern: sample.pattern, subdivisions: sample.subdivisions,
  });
  const spin = new THREE.Group();
  spin.rotation.x = 0.35; // litt vippet, så polene synes
  stage.addSlot(sample.label, `${sample.pattern} · ${count} paneler`).add(spin);
  const mesh = new THREE.Mesh(geometry, [stage.materials.white, stage.materials.metal]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  spin.add(mesh);
  const core = new THREE.Mesh(new THREE.SphereGeometry(coreRadius, 48, 24), stage.materials.metal);
  core.receiveShadow = true;
  spin.add(core);
  return spin;
});

stage.run((time, seconds) => {
  for (const spin of spins) spin.rotation.y += seconds * 0.25;
});
