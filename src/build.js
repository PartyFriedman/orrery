// Små byggeklosser for delene, felles for modellen (main.js) og jordstolpen
// (earthBuild.js). makeBuilder(white) gir funksjoner som lager deler i et
// standardmateriale (hvit lakk) og legger dem i en gruppe. Alle kaster og tar
// imot skygge.
import * as THREE from 'three';

const upAxis = new THREE.Vector3(0, 1, 0);
const vec = (p) => new THREE.Vector3(p.x, p.y, p.z ?? 0);

export function makeBuilder(white) {
  const mesh = (parent, geometry, material = white) => {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  // Loddrett sylinder (aksel, rør) fra y0 til y1, med midten i (x, z).
  const shaft = (parent, r, y0, y1, material = white, x = 0, z = 0) => {
    const m = mesh(parent, new THREE.CylinderGeometry(r, r, Math.max(1e-3, y1 - y0), 32), material);
    m.position.set(x, (y0 + y1) / 2, z);
    return m;
  };
  // Rund stang mellom to punkter.
  const rod = (parent, a, b, r, material = white) => {
    const A = vec(a), B = vec(b);
    const m = mesh(parent, new THREE.CylinderGeometry(r, r, A.distanceTo(B), 16), material);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(upAxis, B.clone().sub(A).normalize());
    return m;
  };
  // Kule i punktet p. detail er antall segmenter rundt og fra pol til pol.
  const ball = (parent, p, r, material = white, detail = [24, 12]) => {
    const m = mesh(parent, new THREE.SphereGeometry(r, ...detail), material);
    m.position.set(p.x, p.y, p.z ?? 0);
    return m;
  };
  // Myk overgang: en kjegle fra radius 2r ved a til r, lengden length mot b.
  const flare = (parent, a, b, r, length, material = white) => {
    const A = vec(a), dir = vec(b).sub(A).normalize();
    const m = mesh(parent, new THREE.CylinderGeometry(r, 2 * r, length, 24), material);
    m.position.copy(A).addScaledVector(dir, length / 2);
    m.quaternion.setFromUnitVectors(upAxis, dir);
    return m;
  };
  // Flat stang langs x fra x0 til x1 (y0 til y1 i høyden), med runde ender.
  // Gir tilbake delene (stanga og de to endene).
  const flatBar = (parent, x0, x1, y0, y1, width, material = white, endSegments = 24) => {
    const bar = mesh(parent, new THREE.BoxGeometry(x1 - x0, y1 - y0, width), material);
    bar.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
    const parts = [bar];
    for (const x of [x0, x1]) {
      const end = mesh(parent, new THREE.CylinderGeometry(width / 2, width / 2, y1 - y0, endSegments), material);
      end.position.set(x, (y0 + y1) / 2, 0);
      parts.push(end);
    }
    return parts;
  };
  // En knekt brakett gjennom punktene: stenger mellom dem, kuler i knekkene, og
  // myke overganger i endene (fillet: lengden, eller 0 for ingen). Gir tilbake delene.
  const bracket = (parent, points, r, { fillet = 0, flareStart = false, flareEnd = false, detail } = {}) => {
    const parts = [];
    for (let i = 0; i < points.length - 1; i++) parts.push(rod(parent, points[i], points[i + 1], r));
    for (const p of points.slice(1, -1)) parts.push(ball(parent, p, r, white, detail));
    if (flareStart) parts.push(flare(parent, points[0], points[1], r, fillet));
    if (flareEnd) parts.push(flare(parent, points.at(-1), points.at(-2), r, fillet));
    return parts;
  };
  const groupAt = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  return { mesh, shaft, rod, ball, flare, flatBar, bracket, groupAt };
}

// En føringsring: et bånd med loddrette sider rundt en stolpe. pointAt(φ, dr, dy)
// gir punktet på midtlinjen i vinkelen φ, flyttet dr utover og dy opp.
export function bandGeometry(pointAt, width, height, N = 192) {
  const pos = [], idx = [];
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];   // (radielt, høyde)
  for (let k = 0; k <= N; k++) {
    const phi = (2 * Math.PI * k) / N;
    for (const [cr, cy] of corners) {
      const p = pointAt(phi, (cr * width) / 2, (cy * height) / 2);
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let k = 0; k < N; k++) for (let c = 0; c < 4; c++) {
    const a = k * 4 + c, b = k * 4 + ((c + 1) % 4);
    idx.push(a, a + 4, b, b, a + 4, b + 4);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setIndex(idx);
  const flat = geometry.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}
