import * as THREE from 'three';

// Kuler av paneler med fuger imellom. Hver kule kan ha sitt eget mønster:
//
//   'triangles'  geodesiske trekanter (et ikosaeder med delte kanter)
//   'quads'      firkanter (en kube blåst opp til kule)
//   'kites'      drager (deltoid-heksekontaeder: 60 drager rundt ikosaederets hjørner)
//   'rhombi'     ruter (rombisk triakontaeder: 30 ruter, én per ikosaederkant)
//   'pentagons'  femkanter med ringer rundt (dodekaeder)
//
// subdivisions sier hvor mange biter hver grunnflate deles i langs kanten.
//
// Hvert panel er en mangekant krympet like mye inn fra alle kantene, så fugene
// blir like brede overalt. Panelene er enten buet etter kula eller flate plater
// med hjørnene på kula. Panelene har litt tykkelse
// innover, og under dem ligger en mørk kjerne som synes i fugene.

// --- Grunnformene, alle bygget fra ikosaederet (unntatt kuben) ---
const phi = (1 + Math.sqrt(5)) / 2;
const icosahedron = (() => {
  const v = [
    [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
    [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
    [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());
  const f = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  return { vertices: v, faces: f };
})();
const unit = (v) => v.clone().normalize();
const mid = (a, b) => a.clone().add(b).normalize();
const faceCenter = (f) => icosahedron.vertices[f[0]].clone()
  .add(icosahedron.vertices[f[1]]).add(icosahedron.vertices[f[2]]).normalize();

// Et rutenett på en firkant (hjørnene i rekkefølge rundt), skjøvet ut på kula.
function quadGrid(a, b, c, d, n) {
  const at = (s, t) => a.clone().multiplyScalar((1 - s) * (1 - t))
    .addScaledVector(b, s * (1 - t)).addScaledVector(c, s * t).addScaledVector(d, (1 - s) * t).normalize();
  const out = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    out.push([at(i / n, j / n), at((i + 1) / n, j / n), at((i + 1) / n, (j + 1) / n), at(i / n, (j + 1) / n)]);
  }
  return out;
}

const patterns = {
  triangles(n) {
    const out = [];
    for (const [ia, ib, ic] of icosahedron.faces) {
      const [a, b, c] = [ia, ib, ic].map((i) => icosahedron.vertices[i]);
      const at = (i, j) => a.clone().addScaledVector(b.clone().sub(a), i / n).addScaledVector(c.clone().sub(a), j / n).normalize();
      for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) {
        out.push([at(i, j), at(i + 1, j), at(i, j + 1)]);
        if (i + j < n - 1) out.push([at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]);
      }
    }
    return out;
  },

  quads(n) {
    // Hver kubeside deles med tangens, så rutene blir omtrent like store på kula.
    const out = [];
    const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
    for (let k = 0; k < 3; k++) for (const sign of [1, -1]) {
      const normal = axes[k].clone().multiplyScalar(sign);
      const u = axes[(k + 1) % 3];
      const w = axes[(k + 2) % 3].clone().multiplyScalar(sign);
      const at = (i, j) => {
        const s = Math.tan((Math.PI / 4) * (2 * i / n - 1));
        const t = Math.tan((Math.PI / 4) * (2 * j / n - 1));
        return normal.clone().addScaledVector(u, s).addScaledVector(w, t).normalize();
      };
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        out.push([at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]);
      }
    }
    return out;
  },

  kites(n) {
    // Én drage per hjørne i hver ikosaedertrekant: hjørnet, midten av den ene
    // kanten, midten av trekanten og midten av den andre kanten.
    const out = [];
    for (const f of icosahedron.faces) {
      const c = faceCenter(f);
      for (let k = 0; k < 3; k++) {
        const v = icosahedron.vertices[f[k]];
        const next = icosahedron.vertices[f[(k + 1) % 3]];
        const prev = icosahedron.vertices[f[(k + 2) % 3]];
        out.push(...quadGrid(v, mid(v, next), c, mid(v, prev), n));
      }
    }
    return out;
  },

  rhombi(n) {
    // Én rute per ikosaederkant: de to hjørnene og midten av de to trekantene ved kanten.
    const out = [];
    const edges = new Map();
    icosahedron.faces.forEach((f, fi) => {
      for (let k = 0; k < 3; k++) {
        const a = f[k], b = f[(k + 1) % 3];
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (!edges.has(key)) edges.set(key, { a, b, faces: [] });
        edges.get(key).faces.push(fi);
      }
    });
    for (const { a, b, faces } of edges.values()) {
      const [c1, c2] = faces.map((fi) => faceCenter(icosahedron.faces[fi]));
      out.push(...quadGrid(icosahedron.vertices[a], c1, icosahedron.vertices[b], c2, n));
    }
    return out;
  },

  pentagons(n) {
    // Ett dodekaeder: én femkant rundt hvert ikosaederhjørne. Hver femkant får en
    // mindre femkant i midten og n ringer av trapeser rundt.
    const out = [];
    icosahedron.vertices.forEach((v, vi) => {
      const around = icosahedron.faces.filter((f) => f.includes(vi)).map(faceCenter);
      // Sorter hjørnene rundt v.
      const e1 = around[0].clone().sub(v).normalize();
      const e2 = v.clone().cross(e1);
      around.sort((p, q) => Math.atan2(p.clone().sub(v).dot(e2), p.clone().sub(v).dot(e1)) -
        Math.atan2(q.clone().sub(v).dot(e2), q.clone().sub(v).dot(e1)));
      const ring = (f) => around.map((p) => v.clone().lerp(p, f));
      out.push(ring(1 / (n + 1)).map(unit));
      for (let k = 1; k <= n; k++) {
        const inner = ring(k / (n + 1));
        const outer = ring((k + 1) / (n + 1));
        for (let i = 0; i < 5; i++) {
          const i2 = (i + 1) % 5;
          for (let j = 0; j < k; j++) {
            const s0 = j / k, s1 = (j + 1) / k;
            out.push([
              inner[i].clone().lerp(inner[i2], s0), inner[i].clone().lerp(inner[i2], s1),
              outer[i].clone().lerp(outer[i2], s1), outer[i].clone().lerp(outer[i2], s0),
            ].map(unit));
          }
        }
      }
    });
    return out;
  },
};
export const panelPatterns = Object.keys(patterns);

// Krymper en flat, konveks mangekant (2D, mot klokka) så hver kant flytter seg
// `inset` innover. Hvert nytt hjørne er der to forskjøvne kanter krysser.
function insetPolygon(points, inset) {
  const n = points.length;
  const lines = points.map((p, i) => {
    const q = points[(i + 1) % n];
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len, ny = dx / len; // innover for en mangekant mot klokka
    return { px: p.x + nx * inset, py: p.y + ny * inset, dx, dy };
  });
  return points.map((_, i) => {
    const l1 = lines[(i - 1 + n) % n], l2 = lines[i];
    const den = l1.dx * l2.dy - l1.dy * l2.dx;
    const t = ((l2.px - l1.px) * l2.dy - (l2.py - l1.py) * l2.dx) / den;
    return new THREE.Vector2(l1.px + l1.dx * t, l1.py + l1.dy * t);
  });
}

// Hvor fint de buede panelene deles opp (omtrent i radianer langs kula): ca. 4,6°
// per bit, så silhuetten blir rund.
const curveStep = 0.08;

// shape: 'curved' følger kula, 'flat' gir flate plater.
// Gir tilbake geometrien til panelene og radiusen kjernen skal ha. Geometrien
// har to materialgrupper: toppene (0) og sidene med undersiden (1), så sidene
// kan få samme mørke farge som kjernen og fugene blir mørke hele veien.
export function createPanelGeometry({ radius, pattern, subdivisions, seamWidth, seamDepth, shape = 'curved' }) {
  if (shape !== 'curved' && shape !== 'flat') throw new Error(`Ukjent panelform '${shape}'. Velg 'curved' eller 'flat'.`);
  const build = patterns[pattern];
  if (!build) throw new Error(`Ukjent panelmønster '${pattern}'. Velg mellom: ${panelPatterns.join(', ')}.`);
  const polygons = build(Math.max(1, Math.round(subdivisions)));

  const tops = [];      // toppen av panelene
  const topNormals = [];
  const sides = [];     // sidene og undersiden, som ses ned i fugene
  let lowest = radius;  // det laveste punktet på noen panelflate
  const push = (list, ...vs) => { for (const v of vs) list.push(v.x, v.y, v.z); };
  const planeDistance = (a, b, c) => Math.abs(b.clone().sub(a).cross(c.clone().sub(a)).normalize().dot(a));

  for (const poly of polygons) {
    // Panelets retning (midt i panelet) og et flatt koordinatsystem på tvers av den.
    const normal = poly.reduce((s, p) => s.add(p), new THREE.Vector3()).normalize();
    const e1 = poly[0].clone().sub(normal.clone().multiplyScalar(poly[0].dot(normal))).normalize();
    const e2 = normal.clone().cross(e1);
    // Hjørnene skjøvet langs strålen fra sentrum ned i et plan, i 2D, så
    // kantene kan flyttes like langt inn overalt.
    let flat = poly.map((p) => {
      const q = p.clone().divideScalar(p.dot(normal));
      return new THREE.Vector2(q.dot(e1), q.dot(e2));
    });
    let area = 0;
    flat.forEach((p, i) => { const q = flat[(i + 1) % flat.length]; area += p.x * q.y - q.x * p.y; });
    if (area < 0) flat = flat.reverse(); // mot klokka sett utenfra

    // Krymp mangekanten. Punktene løftes så ut på kula langs strålen fra
    // sentrum, så naboene møtes i nøyaktig samme høyde (firkanter og større
    // mangekanter på en kule ligger sjelden i ett plan).
    const inset = insetPolygon(flat, seamWidth / 2 / radius);
    const toSphere = (p) => normal.clone().addScaledVector(e1, p.x).addScaledVector(e2, p.y).setLength(radius);
    const down = 1 - (seamDepth * 2) / radius; // undersiden av panelet
    const k = inset.length;
    const topTri = (a, b, c, n) => {
      push(tops, a, b, c);
      push(topNormals, ...(n ? [n, n, n] : [a, b, c].map((v) => v.clone().normalize())));
      lowest = Math.min(lowest, planeDistance(a, b, c));
    };
    const wall = (s0, s1) => {
      // En bit av siden mellom to punkter langs kanten, ned til undersiden.
      push(sides, s0, s1.clone().multiplyScalar(down), s0.clone().multiplyScalar(down));
      push(sides, s0, s1, s1.clone().multiplyScalar(down));
    };

    if (shape === 'flat') {
      // Flatt panel: hjørnene på kula, flatene imellom rette, lyses som én plate.
      const outer = inset.map(toSphere);
      const inner = outer.map((v) => v.clone().multiplyScalar(down));
      for (let i = 1; i < k - 1; i++) {
        topTri(outer[0], outer[i], outer[i + 1], normal);
        push(sides, inner[0], inner[i + 1], inner[i]); // undersiden, vendt innover
      }
      for (let i = 0; i < k; i++) wall(outer[i], outer[(i + 1) % k]);
      continue;
    }

    // Buet panel: mangekanten deles i trekanter fra midten, og hver av dem i et
    // fint rutenett der alle punktene ligger på kula. Normalene peker rett ut
    // fra sentrum, så både lyset og silhuetten blir runde. Hele panelet bruker
    // samme oppdeling, så nabotrekantene møtes uten sprekker.
    const mid2 = inset.reduce((s, p) => s.add(p), new THREE.Vector2()).divideScalar(k);
    const longest = Math.max(...inset.map((p, i) => Math.max(p.distanceTo(mid2), p.distanceTo(inset[(i + 1) % k]))));
    const m = Math.max(1, Math.ceil(longest / curveStep));
    const midInner = toSphere(mid2).multiplyScalar(down);
    for (let i = 0; i < k; i++) {
      const a = inset[i];
      const b = inset[(i + 1) % k];
      const at = (s, t) => toSphere(new THREE.Vector2(
        mid2.x + ((a.x - mid2.x) * s + (b.x - mid2.x) * t) / m,
        mid2.y + ((a.y - mid2.y) * s + (b.y - mid2.y) * t) / m,
      ));
      for (let s = 0; s < m; s++) for (let t = 0; t < m - s; t++) {
        topTri(at(s, t), at(s + 1, t), at(s, t + 1));
        if (s + t < m - 1) topTri(at(s + 1, t), at(s + 1, t + 1), at(s, t + 1));
      }
      // Langs kanten fra a til b: siden ned i fugen, og undersiden.
      for (let j = 0; j < m; j++) {
        const s0 = at(m - j, j);
        const s1 = at(m - j - 1, j + 1);
        wall(s0, s1);
        push(sides, midInner, s1.clone().multiplyScalar(down), s0.clone().multiplyScalar(down));
      }
    }
  }

  // Normaler: toppene har sine fra før (rett ut, eller panelets retning når de er
  // flate). Sidene og undersiden får sin egen flate.
  const sideNormals = [];
  for (let i = 0; i < sides.length; i += 9) {
    const [a, b, c] = [0, 3, 6].map((o) => new THREE.Vector3(sides[i + o], sides[i + o + 1], sides[i + o + 2]));
    push(sideNormals, ...Array(3).fill(b.clone().sub(a).cross(c.clone().sub(a)).normalize()));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([...tops, ...sides], 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([...topNormals, ...sideNormals], 3));
  geometry.addGroup(0, tops.length / 3, 0);
  geometry.addGroup(tops.length / 3, sides.length / 3, 1);

  // Kjernen ligger seamDepth under det laveste punktet på panelene, så fugene
  // går ned til den overalt.
  return { geometry, coreRadius: lowest - seamDepth, count: polygons.length };
}

