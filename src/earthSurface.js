// Jorda med landmasser: opphøyde kontinenter, plater som står opp fra havet,
// med fas (bodyLooks.earth i config.js, konturene i landmasses.js).
// Kula ligger med nordpolen langs +y og lengde 0 langs +x, østover mot −z (som
// lonLat i panels.js). createSpinBlur lager den glatte kula mot flimring: fargene
// smurt ut langs hver breddegrad, slik en globus ser ut når den spinner.
import * as THREE from 'three';
import { landmasses } from './landmasses.js';
import { stereographic, inside, insetRegion } from './panels.js';
import { lookOf, lacquer } from './materials.js';

const earth = lookOf('earth');   // fargene på havet, landet og isen, lakken og platene

const rad = Math.PI / 180;
const unitOf = (lon, lat) => new THREE.Vector3(
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
function surfaceKind(v) {
  for (const r of regions) {
    if (v.dot(r.center) < r.cosMax) continue;
    if (inside(r.proj.to(v), r.flat)) return r.kind;
  }
  return 'sea';
}

// Materialene: samme satengmatte lakk som kulene i modellen.
export function createSurfaceMaterials() {
  return {
    sea: lacquer(earth.color, earth),
    land: lacquer(earth.land, earth),
    ice: lacquer(earth.ice, earth),
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
  const tris = THREE.ShapeUtils.triangulateShape(flat, []).map(([a, b, c]) => [a, b, c]);
  // Kantene får et tall som nøkkel, og lengden huskes, så den regnes ut én gang per kant.
  const key = (i, j) => (i < j ? i * 0x200000 + j : j * 0x200000 + i);
  const lengths = new Map();
  const len = (i, j) => {
    const k = key(i, j);
    let l = lengths.get(k);
    if (l === undefined) lengths.set(k, (l = sphere[i].distanceTo(sphere[j]) * radius));
    return l;
  };
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
  // En trekant der ingen kant er for lang, deles aldri mer (bare for lange kanter
  // deles), så bare de andre gås gjennom i hver runde. Hver trekant er en node
  // i et tre, og de to halvdelene erstatter den på samme plass, så rekkefølgen
  // på trekantene blir den samme som om hele lista ble gått gjennom hver gang.
  const isLong = (t) => len(t[0], t[1]) > fillStep || len(t[1], t[2]) > fillStep || len(t[2], t[0]) > fillStep;
  const roots = tris.map((t) => ({ t, kids: null }));
  let active = roots.filter((n) => isLong(n.t));
  for (let pass = 0; pass < 60; pass++) {
    // Den lengste kanten i hver trekant som er for lang.
    const want = new Set();
    for (const { t } of active) {
      let best = null, bl = fillStep;
      for (let e = 0; e < 3; e++) { const l = len(t[e], t[(e + 1) % 3]); if (l > bl) { bl = l; best = key(t[e], t[(e + 1) % 3]); } }
      if (best !== null) want.add(best);
    }
    if (!want.size) break;
    const next = [];
    for (const node of active) {
      // Del trekanten langs den første kanten som skal deles (resten tas i neste runde).
      const t = node.t;
      let done = false;
      for (let e = 0; e < 3 && !done; e++) {
        const a = t[e], b = t[(e + 1) % 3], c = t[(e + 2) % 3];
        if (want.has(key(a, b))) {
          const m = midOf(a, b);
          node.kids = [{ t: [a, m, c], kids: null }, { t: [m, b, c], kids: null }];
          for (const kid of node.kids) if (isLong(kid.t)) next.push(kid);
          done = true;
        }
      }
      if (!done) next.push(node);
    }
    active = next;
  }
  const emit = (node) => {
    if (node.kids) { emit(node.kids[0]); emit(node.kids[1]); return; }
    for (const i of node.t) {
      const u = sphere[i];
      pos.push(u.x * radius, u.y * radius, u.z * radius);
      nor.push(u.x, u.y, u.z);
    }
  };
  for (const node of roots) emit(node);
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

// Kula med landmasser: havet som en glatt kule, og land og is som plater som
// står height opp, med fas: toppen krympet chamfer inn, og en skrå kant ned til havet.
export function createEarthSurface(radius, materials = createSurfaceMaterials()) {
  const group = new THREE.Group();
  const sea = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 48), materials.sea);
  sea.receiveShadow = true;
  sea.castShadow = true;
  group.add(sea);
  const { height, chamfer } = earth;
  for (const kind of ['land', 'ice']) {
    const tops = [], tn = [], sides = [];
    for (const r of regions.filter((x) => x.kind === kind)) {
      const topRegion = insetRegion(r, chamfer / radius);
      fillRegion(topRegion, radius + height, tops, tn);
      ribbon(topRegion.outline, radius + height, insetRegion(r, 0).outline, radius - 0.01, sides);
    }
    group.add(meshOf(outwardWith(tops, tn), tn, materials[kind]));
    const s = outward(sides);
    group.add(meshOf(s, flatNormals(s), materials[kind]));
  }
  return group;
}

// Mot flimring: en glatt kule over jorda med fargene smurt ut langs hver
// breddegrad (andelen hav, land og is rundt hele breddesirkelen). Den er lik
// uansett hvor kula står, så den trenger ikke dreie. Tones inn som de glatte
// formene i blur.js: update(delta, f) med f fra 0 til 1.
export function createSpinBlur(parent, radius) {
  const bands = 90, around = 180;
  const sea = new THREE.Color(earth.color), land = new THREE.Color(earth.land), ice = new THREE.Color(earth.ice);
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
    vertexColors: true, roughness: earth.roughness, metalness: 0, clearcoat: earth.gloss, clearcoatRoughness: earth.glossRoughness,
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
