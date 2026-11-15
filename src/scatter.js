// Uregelmessige punkter på en kule og trekantene mellom dem. Brukes av
// panelmønsteret 'facets' (panels.js) og av plexus-kulene (plexus.js).
import * as THREE from 'three';
import { ConvexHull } from 'three/addons/math/ConvexHull.js';

// Tilfeldige tall som blir de samme hver gang for samme seed.
export function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Et tilfeldig punkt på enhetskula.
export const onSphere = (rand) => {
  const z = 2 * rand() - 1, a = 2 * Math.PI * rand(), s = Math.sqrt(1 - z * z);
  return new THREE.Vector3(s * Math.cos(a), z, s * Math.sin(a));
};

// Uregelmessige, men jevnt spredte punkter på enhetskula: for hvert nytt punkt
// prøves noen tilfeldige, og det som ligger lengst fra alle de andre velges.
export function spread(count, rand, tries = 12) {
  const points = [];
  for (let i = 0; i < count; i++) {
    let best = null, bestDistance = -1;
    for (let k = 0; k < tries; k++) {
      const p = onSphere(rand);
      const d = points.reduce((m, q) => Math.min(m, p.distanceToSquared(q)), Infinity);
      if (d > bestDistance) { best = p; bestDistance = d; }
    }
    points.push(best);
  }
  return points;
}

// Trekantene mellom punktene på kula (det konvekse skallet), som indekser.
export function triangulate(points) {
  const hull = new ConvexHull().setFromPoints(points);
  const index = new Map(points.map((p, i) => [p, i]));
  const faces = [];
  for (const face of hull.faces) {
    const loop = [];
    let edge = face.edge;
    do { loop.push(index.get(edge.head().point)); edge = edge.next; } while (edge !== face.edge);
    for (let i = 1; i < loop.length - 1; i++) faces.push([loop[0], loop[i], loop[i + 1]]);
  }
  return faces;
}
