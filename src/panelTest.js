// Testside for kulene i modellstørrelse: ekte kuler fra modellen, hver med sin
// radius, farge og sitt mønster fra bodyLooks i config.js (så siden følger
// config), og mikrointeraksjonen fra bodyLift: pek på en kule med musa, eller
// trykk på den på mobil, så åpner den seg. Åpnes på /orrery/panels.html med
// `npm run dev`. Kulene dreier sakte; klikk for å stoppe eller starte dem.
import * as THREE from 'three';
import { bodies, bodyLooks, planetSize, moonSize, trisolaris } from './config.js';
import { createBodyMaterials } from './materials.js';
import { createBodySphere } from './sphere.js';
import { createBodyLift } from './bodyLift.js';
import { createPicking } from './picking.js';
import { createStage } from './testStage.js';

// Kulene som vises, i rekkefølge, med radiusen de har i modellen.
const samples = [
  { label: 'Merkur', name: 'mercury', radius: planetSize('mercury') },
  { label: 'Venus', name: 'venus', radius: planetSize('venus') },
  { label: 'Jorda', name: 'earth', radius: bodies.earthRadius },
  { label: 'Mars', name: 'mars', radius: planetSize('mars') },
  { label: 'Jupiter', name: 'jupiter', radius: planetSize('jupiter') },
  { label: 'Saturn', name: 'saturn', radius: planetSize('saturn') },
  { label: 'Uranus', name: 'uranus', radius: planetSize('uranus') },
  { label: 'Trisolaris-planeten', name: 'trisolaris', radius: trisolaris.planet.radius },
  { label: 'Månen', name: 'moon', radius: bodies.moonRadius },
  { label: 'Io', name: 'io', radius: moonSize('io') },
  { label: 'Iapetus', name: 'iapetus', radius: moonSize('iapetus') },
  { label: 'Fobos', name: 'phobos', radius: moonSize('phobos') },
];
const largest = Math.max(...samples.map((s) => s.radius));
const stage = createStage({ count: samples.length, radius: largest, columns: 4, spacing: 8, rowSpacing: 9.5 });
const bodyMaterial = createBodyMaterials(stage.materials.white);
const number = (x) => x.toFixed(2).replace('.', ',');

// Registeret for bodyLift og picking, som spheres i model.js. Nøkkelen er
// plassen, ikke navnet, så focus.size i config (ringene ved Saturn og Uranus)
// ikke gjør treffområdet større her.
const registry = {};
const spins = samples.map((sample, i) => {
  const { pattern, subdivisions } = bodyLooks[sample.name];
  const spin = new THREE.Group();
  spin.rotation.x = 0.35; // litt vippet, så polene synes
  const subtitle = `${pattern}${subdivisions ? ` ${subdivisions}` : ''} · r ${number(sample.radius)}`;
  stage.addSlot(sample.label, subtitle, sample.radius).add(spin);
  const { group, plexus } = createBodySphere(sample.radius, sample.name, { top: bodyMaterial(sample.name), metal: stage.materials.metal });
  spin.add(group);
  registry[i] = { object: group, radius: sample.radius, plexus };
  return { spin, plexus };
});

const bodyLift = createBodyLift(registry);
const picking = createPicking(stage.camera, stage.renderer.domElement, registry, (name, pointerType) => {
  if (pointerType !== 'mouse') bodyLift.pulse(name);
}, { onHover: bodyLift.hover });

stage.run((time, seconds, frame) => {
  for (const { spin } of spins) spin.rotation.y += seconds * 0.25;
  picking.update();
  bodyLift.update(frame);
  for (const { plexus } of spins) plexus?.(time);
});
