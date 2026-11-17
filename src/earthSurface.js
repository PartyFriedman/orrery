// Jorda med landmasser, i tre utgaver (earthSurface i config.js, konturene i
// landmasses.js). Brukes av prøvesiden earth.html.
//   S1: innlagte kontinenter: ett buet panel per kontinent i flukt med havet,
//       med en mørk fuge rundt
//   S2: opphøyde kontinenter: plater som står opp fra havet, med fas
//   S3: fasetter (lavpoly): uregelmessige trekanter farget etter land, hav og is
// Kula ligger med nordpolen langs +y og lengde 0 langs +x, østover mot −z (som
// lonLat i panels.js). createSpinBlur lager den glatte kula mot flimring: fargene
// smurt ut langs hver breddegrad, slik en globus ser ut når den spinner.
import * as THREE from 'three';
import { landmasses } from './landmasses.js';
import { stereographic, inside, insetRegion, createPanelGeometry } from './panels.js';
import { spread, triangulate, random } from './scatter.js';
import { earthSurface as ES, colors, look, panels } from './config.js';

const rad = Math.PI / 180;
export const unitOf = (lon, lat) => new THREE.Vector3(
  Math.cos(lat * rad) * Math.cos(lon * rad), Math.sin(lat * rad), -Math.cos(lat * rad) * Math.sin(lon * rad),
);

// Konturene på enhetskula, fortettet langs storsirkler så hver bit er høyst ca. 1,5°.
const maxStep = 1.5 * rad;
const regions = landmasses.map(({ name, kind, outline }) => {
  const pts = outline.map(([lon, lat]) => unitOf(lon, lat));
  const dense = [];
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    const n = Math.max(1, Math.ceil(p.angleTo(q) / maxStep));
    for (let k = 0; k < n; k++) dense.push(p.clone().lerp(q, k / n).normalize());
  });
  const center = dense.reduce((s, p) => s.add(p), new THREE.Vector3()).normalize();
  const proj = stereographic(center);
  const flat = dense.map(proj.to);
  const cosMax = Math.min(...dense.map((p) => p.dot(center))) - 0.01;
  return { name, kind, center, outline: dense, proj, flat, cosMax };
});

// Hva som ligger i retningen v (enhetsvektor): 'land', 'ice' eller 'sea'.
export function surfaceKind(v) {
  for (const r of regions) {
    if (v.dot(r.center) < r.cosMax) continue;
    if (inside(r.proj.to(v), r.flat)) return r.kind;
  }
  return 'sea';
}

// Materialene: samme satengmatte lakk som kulene i modellen, i fargene fra colors.bodies.
const lacquer = (color) => new THREE.MeshPhysicalMaterial({
  color, roughness: look.roughness, metalness: 0, clearcoat: look.gloss, clearcoatRoughness: look.glossRoughness,
});
export function createSurfaceMaterials() {
  return {
    sea: lacquer(colors.bodies.earth),
    land: lacquer(colors.bodies.earthLand),
    ice: lacquer(colors.bodies.earthIce),
    seam: new THREE.MeshPhysicalMaterial({ color: look.seamColor, metalness: look.seamMetalness, roughness: look.seamRoughness }),
  };
}

// Fyller et stort panel (omriss på enhetskula) med trekanter som ligger på kula
// med radius `radius`. Omrisset legges flatt med stereografisk projeksjon og
// trianguleres. Så halveres den lengste kanten i trekantene til alle kantene er
// korte (målt på kula), og en kant halveres i begge trekantene den hører til, så
// det aldri blir sprekker. Ellers ville lange, flate trekanter ligget under kula.
const fillStep = 0.06;
function fillRegion({ center, outline }, radius, pos, nor) {
  const proj = stereographic(center);
  const flat = outline.map(proj.to);
  const sphere = outline.map((p) => p.clone());
  let tris = THREE.ShapeUtils.triangulateShape(flat, []).map(([a, b, c]) => [a, b, c]);
  const key = (i, j) => (i < j ? `${i},${j}` : `${j},${i}`);
  const len = (i, j) => sphere[i].distanceTo(sphere[j]) * radius;
  const mids = new Map();
  const midOf = (i, j) => {
    const k = key(i, j);
    if (!mids.has(k)) {
      const q = flat[i].clone().add(flat[j]).multiplyScalar(0.5);
      flat.push(q);
      sphere.push(proj.from(q));
      mids.set(k, flat.length - 1);
    }
    return mids.get(k);
  };
  for (let pass = 0; pass < 60; pass++) {
    // Den lengste kanten i hver trekant som er for lang.
    const want = new Map();
    for (const t of tris) {
      let best = null, bl = fillStep;
      for (let e = 0; e < 3; e++) { const l = len(t[e], t[(e + 1) % 3]); if (l > bl) { bl = l; best = key(t[e], t[(e + 1) % 3]); } }
      if (best) want.set(best, true);
    }
    if (!want.size) break;
    const next = [];
    for (const t of tris) {
      // Del trekanten langs den første kanten som skal deles (resten tas i neste runde).
      let done = false;
      for (let e = 0; e < 3 && !done; e++) {
        const a = t[e], b = t[(e + 1) % 3], c = t[(e + 2) % 3];
        if (want.has(key(a, b))) { const m = midOf(a, b); next.push([a, m, c], [m, b, c]); done = true; }
      }
      if (!done) next.push(t);
    }
    tris = next;
  }
  for (const t of tris) for (const i of t) {
    const u = sphere[i];
    pos.push(u.x * radius, u.y * radius, u.z * radius);
    nor.push(u.x, u.y, u.z);
  }
}
// Et bånd mellom to like lange, lukkede kurver (enhetsvektorer) i hver sin radius.
function ribbon(inner, rIn, outer, rOut, pos) {
  const n = inner.length;
  for (let i = 0; i < n; i++) {
    const a = inner[i].clone().multiplyScalar(rIn), b = inner[(i + 1) % n].clone().multiplyScalar(rIn);
    const c = outer[i].clone().multiplyScalar(rOut), d = outer[(i + 1) % n].clone().multiplyScalar(rOut);
    pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z);
  }
}
const meshOf = (pos, nor, material) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (nor) g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  else g.computeVertexNormals();
  const m = new THREE.Mesh(g, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
// Flatenormaler (for båndene, som skal se skarpe ut).
const flatNormals = (pos) => {
  const out = [];
  for (let i = 0; i < pos.length; i += 9) {
    const a = new THREE.Vector3(pos[i], pos[i + 1], pos[i + 2]), b = new THREE.Vector3(pos[i + 3], pos[i + 4], pos[i + 5]), c = new THREE.Vector3(pos[i + 6], pos[i + 7], pos[i + 8]);
    let nrm = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    if (nrm.dot(a) < 0) nrm.negate();
    for (let k = 0; k < 3; k++) out.push(nrm.x, nrm.y, nrm.z);
  }
  return out;
};
// Trekantene vendes utover (begge sider tegnes ikke, så rekkefølgen må stemme).
// outwardWith bytter også normalene, så de følger hjørnene.
const outwardWith = (pos, nor) => {
  for (let i = 0; i < pos.length; i += 9) {
    const a = new THREE.Vector3(pos[i], pos[i + 1], pos[i + 2]), b = new THREE.Vector3(pos[i + 3], pos[i + 4], pos[i + 5]), c = new THREE.Vector3(pos[i + 6], pos[i + 7], pos[i + 8]);
    if (b.clone().sub(a).cross(c.clone().sub(a)).dot(a.clone().add(b).add(c)) < 0) {
      for (const arr of [pos, nor]) for (let k = 0; k < 3; k++) { const t = arr[i + 3 + k]; arr[i + 3 + k] = arr[i + 6 + k]; arr[i + 6 + k] = t; }
    }
  }
  return pos;
};
const outward = (pos) => {
  for (let i = 0; i < pos.length; i += 9) {
    const a = new THREE.Vector3(pos[i], pos[i + 1], pos[i + 2]), b = new THREE.Vector3(pos[i + 3], pos[i + 4], pos[i + 5]), c = new THREE.Vector3(pos[i + 6], pos[i + 7], pos[i + 8]);
    const mid = a.clone().add(b).add(c);
    if (b.clone().sub(a).cross(c.clone().sub(a)).dot(mid) < 0) {
      for (let k = 0; k < 3; k++) { const t = pos[i + 3 + k]; pos[i + 3 + k] = pos[i + 6 + k]; pos[i + 6 + k] = t; }
    }
  }
  return pos;
};

// Kula med landmasser. style: 'S1', 'S2' eller 'S3'.
export function createEarthSurface(style, radius, materials = createSurfaceMaterials()) {
  const group = new THREE.Group();
  const seam = ES.seamWidth;
  if (style === 'S1' || style === 'S2') {
    const sea = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 48), materials.sea);
    sea.receiveShadow = true;
    sea.castShadow = true;
    group.add(sea);
    for (const kind of ['land', 'ice']) {
      const tops = [], tn = [], sides = [];
      for (const r of regions.filter((x) => x.kind === kind)) {
        if (style === 'S1') {
          // Panelet krympet en halv fuge inn, og en mørk fuge rundt, i flukt med havet.
          const land = insetRegion(r, seam / 2 / radius);
          const wide = insetRegion(r, -seam / 2 / radius);
          fillRegion(land, radius + 0.008, tops, tn);
          ribbon(land.outline, radius + 0.004, wide.outline, radius + 0.004, sides);
        } else {
          // Platen står height opp, med fas: toppen krympet chamfer inn, og en skrå kant ned til havet.
          const { height, chamfer } = ES.S2;
          const topRegion = insetRegion(r, chamfer / radius);
          fillRegion(topRegion, radius + height, tops, tn);
          ribbon(topRegion.outline, radius + height, insetRegion(r, 0).outline, radius - 0.01, sides);
        }
      }
      group.add(meshOf(outwardWith(tops, tn), tn, materials[kind]));
      const s = outward(sides);
      group.add(meshOf(s, flatNormals(s), style === 'S1' ? materials.seam : materials[kind]));
    }
    return group;
  }
  if (style === 'S3') {
    // Fasettene fra panels.js, med toppene sortert etter hva som ligger midt i fasetten.
    const n = Math.max(6, Math.round(ES.S3.subdivisions));
    const { geometry, coreRadius } = createPanelGeometry({
      radius, pattern: 'facets', subdivisions: n, seamWidth: ES.S3.seamWidth, seamDepth: ES.S3.seamDepth, shape: panels.shape,
    });
    const points = spread(n, random(n));
    const facets = triangulate(points).map((f) => {
      let [a, b, c] = f.map((i) => points[i]);
      if (b.clone().sub(a).cross(c.clone().sub(a)).dot(a) < 0) [b, c] = [c, b];
      const center = a.clone().add(b).add(c).normalize();
      return { a, b, c, ab: a.clone().cross(b), bc: b.clone().cross(c), ca: c.clone().cross(a), center, cos: Math.min(a.dot(center), b.dot(center), c.dot(center)) - 1e-3, kind: surfaceKind(center) };
    });
    const pos = geometry.attributes.position.array, nor = geometry.attributes.normal.array;
    const topGroup = geometry.groups.find((x) => x.materialIndex === 0);
    const buckets = { sea: [], land: [], ice: [] }, bucketN = { sea: [], land: [], ice: [] };
    const v = new THREE.Vector3();
    for (let t = topGroup.start; t < topGroup.start + topGroup.count; t += 3) {
      v.set(0, 0, 0);
      for (let k = 0; k < 3; k++) v.x += pos[(t + k) * 3], v.y += pos[(t + k) * 3 + 1], v.z += pos[(t + k) * 3 + 2];
      v.normalize();
      let kind = 'sea';
      for (const f of facets) {
        if (v.dot(f.center) < f.cos) continue;
        if (v.dot(f.ab) >= -1e-6 && v.dot(f.bc) >= -1e-6 && v.dot(f.ca) >= -1e-6) { kind = f.kind; break; }
      }
      for (let k = 0; k < 9; k++) { buckets[kind].push(pos[t * 3 + k]); bucketN[kind].push(nor[t * 3 + k]); }
    }
    const sideGroup = geometry.groups.find((x) => x.materialIndex === 1);
    const sidePos = Array.from(pos.slice(sideGroup.start * 3, (sideGroup.start + sideGroup.count) * 3));
    const sideNor = Array.from(nor.slice(sideGroup.start * 3, (sideGroup.start + sideGroup.count) * 3));
    const all = [...buckets.sea, ...buckets.land, ...buckets.ice, ...sidePos];
    const allN = [...bucketN.sea, ...bucketN.land, ...bucketN.ice, ...sideNor];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(all, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(allN, 3));
    let start = 0;
    [['sea', 0], ['land', 2], ['ice', 3]].forEach(([k, mi]) => { const c = buckets[k].length / 3; g.addGroup(start, c, mi); start += c; });
    g.addGroup(start, sidePos.length / 3, 1);
    const mesh = new THREE.Mesh(g, [materials.sea, materials.seam, materials.land, materials.ice]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    const core = new THREE.Mesh(new THREE.SphereGeometry(coreRadius, 48, 24), materials.seam);
    core.receiveShadow = true;
    group.add(core);
    return group;
  }
  throw new Error(`earthSurface: ukjent overflate '${style}'. Velg 'S1', 'S2' eller 'S3'.`);
}

// Mot flimring: en glatt kule over jorda med fargene smurt ut langs hver
// breddegrad (andelen hav, land og is rundt hele breddesirkelen). Den er lik
// uansett hvor kula står, så den trenger ikke dreie. Tones inn som de glatte
// formene i blur.js: update(delta, f) med f fra 0 til 1.
export function createSpinBlur(parent, radius) {
  const bands = 90, around = 180;
  const sea = new THREE.Color(colors.bodies.earth), land = new THREE.Color(colors.bodies.earthLand), ice = new THREE.Color(colors.bodies.earthIce);
  const rowColor = [];
  for (let i = 0; i <= bands; i++) {
    const lat = -90 + (180 * i) / bands;
    const count = { sea: 0, land: 0, ice: 0 };
    for (let j = 0; j < around; j++) count[surfaceKind(unitOf((360 * j) / around, lat))]++;
    const c = new THREE.Color(0, 0, 0)
      .add(sea.clone().multiplyScalar(count.sea / around))
      .add(land.clone().multiplyScalar(count.land / around))
      .add(ice.clone().multiplyScalar(count.ice / around));
    rowColor.push(c);
  }
  const geometry = new THREE.SphereGeometry(radius, 64, bands);
  const p = geometry.attributes.position, colorsArr = [];
  for (let i = 0; i < p.count; i++) {
    const lat = Math.asin(THREE.MathUtils.clamp(p.getY(i) / radius, -1, 1)) / rad;
    const c = rowColor[Math.round(((lat + 90) / 180) * bands)];
    colorsArr.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colorsArr, 3));
  const material = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: look.roughness, metalness: 0, clearcoat: look.gloss, clearcoatRoughness: look.glossRoughness,
    transparent: true, opacity: 0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;
  parent.add(mesh);
  return {
    mesh,
    update(delta, f) {
      mesh.visible = f > 0;
      material.opacity = f;
      material.depthWrite = f >= 1;
    },
  };
}
