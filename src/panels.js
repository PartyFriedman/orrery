import * as THREE from 'three';
import { random, spread, triangulate } from './scatter.js';

// Kuler av paneler med fuger imellom. Hver kule kan ha sitt eget mønster:
//
//   'triangles'  geodesiske trekanter (et ikosaeder med delte kanter)
//   'quads'      firkanter (en kube blåst opp til kule)
//   'kites'      drager (deltoid-heksekontaeder: 60 drager rundt ikosaederets hjørner)
//   'rhombi'     ruter (rombisk triakontaeder: 30 ruter, én per ikosaederkant)
//   'pentagons'  femkanter med ringer rundt (dodekaeder)
//   'bands'      breddebånd av firkanter, med en mangekant over hver pol
//   'hexagons'   sekskanter, med de 12 femkantene en kule må ha
//   'trionda'    fire like paneler fra et tetraeder, med S-formede kanter
//                (styres med amplitude og bulge i stedet for subdivisions)
//   'volleyball' tre striper per kubeside, på tvers av stripene på nabosidene
//   'woven'      flettet: hver kubeside i 2 × 2 ruter, hver med subdivisions
//                striper, annenhver rute på tvers
//   'caps'       to store polarhetter og et belte rundt ekvator i subdivisions biter
//   'boats'      subdivisions båtformede paneler fra pol til pol, som båtene i en appelsin
//   'spiral'     subdivisions båter som vrir seg en kvart runde fra ekvator til hver pol
//   'seam'       nesten glatt: to paneler med én bølgende fuge, som en tennisball
//   'facets'     uregelmessige trekanter (ikke geodesisk), som plexus A og B, men
//                som paneler med fuger. subdivisions er antall hjørner: rundt 30
//                gir få, store fasetter, et par hundre gir tette og fine
//
// subdivisions sier hvor mange biter hver grunnflate deles i langs kanten
// (for boats, spiral og caps: hvor mange paneler; for facets: hvor mange hjørner).
//
// Plexus-kulene ('plexusA', 'plexusB', 'plexusC') er ikke paneler, og lages i
// plexus.js. De kan likevel settes som pattern i panels i config.js.
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

  bands(n) {
    // Breddebånd som skybåndene på Jupiter: 2n + 1 bånd, annenhvert bredt og
    // smalt (det midterste er bredt), delt i like mange firkanter rundt, og en
    // mangekant over hver pol. Alle båndene har hjørnene sine på de samme
    // lengdegradene, så kantene møtes nøyaktig.
    const rows = 2 * n + 1;
    const around = 4 * (n + 1);
    const capLatitude = (Math.PI / 2) * (1 - 1 / (n + 2));
    const weights = Array.from({ length: rows }, (_, i) => ((i - n) % 2 === 0 ? 1 : 0.6));
    const total = weights.reduce((s, w) => s + w, 0);
    const latitudes = [-capLatitude];
    for (const w of weights) latitudes.push(latitudes.at(-1) + (2 * capLatitude * w) / total);
    const point = (lat, lon) => new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
    const lon = (j) => (j / around) * Math.PI * 2;
    const out = [];
    for (let r = 0; r < rows; r++) {
      for (let j = 0; j < around; j++) {
        out.push([
          point(latitudes[r], lon(j)), point(latitudes[r], lon(j + 1)),
          point(latitudes[r + 1], lon(j + 1)), point(latitudes[r + 1], lon(j)),
        ]);
      }
    }
    out.push(Array.from({ length: around }, (_, j) => point(capLatitude, lon(j))));   // nordpolen
    out.push(Array.from({ length: around }, (_, j) => point(-capLatitude, lon(j))));  // sørpolen
    return out;
  },

  hexagons(n) {
    // Sekskanter: det motsatte av den geodesiske kula. Hvert hjørne på den
    // geodesiske kula blir et panel, med midtpunktene i trekantene rundt
    // hjørnet som sine hjørner. Der fem trekanter møtes (de tolv hjørnene på
    // ikosaederet) blir det femkanter; en kule kan ikke dekkes av bare sekskanter.
    const key = (v) => `${Math.round(v.x * 1e5)},${Math.round(v.y * 1e5)},${Math.round(v.z * 1e5)}`;
    const corners = new Map();
    for (const t of patterns.triangles(n)) {
      const middle = t[0].clone().add(t[1]).add(t[2]).normalize();
      for (const v of t) {
        const k = key(v);
        if (!corners.has(k)) corners.set(k, { v, around: [] });
        corners.get(k).around.push(middle);
      }
    }
    const out = [];
    for (const { v, around } of corners.values()) {
      const e1 = around[0].clone().sub(v).normalize();
      const e2 = v.clone().cross(e1);
      const angle = (p) => { const d = p.clone().sub(v); return Math.atan2(d.dot(e2), d.dot(e1)); };
      out.push(around.sort((p, q) => angle(p) - angle(q)));
    }
    return out;
  },

  volleyball(n) {
    // Hver kubeside deles i n striper. På siden mot x går stripene langs y, mot
    // y langs z og mot z langs x, så stripene på to nabosider står på tvers.
    const out = [];
    const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
    for (let k = 0; k < 3; k++) for (const sign of [1, -1]) {
      const at = cubeFace(axes, k, sign);
      for (let j = 0; j < n; j++) out.push([at(0, j / n), at(1, j / n), at(1, (j + 1) / n), at(0, (j + 1) / n)]);
    }
    return out;
  },

  woven(n) {
    // Hver kubeside i 2 × 2 ruter, hver med n striper. Annenhver rute har
    // stripene på tvers, som en kurv.
    const out = [];
    const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
    for (let k = 0; k < 3; k++) for (const sign of [1, -1]) {
      const at = cubeFace(axes, k, sign);
      for (let ci = 0; ci < 2; ci++) for (let cj = 0; cj < 2; cj++) {
        const s0 = ci / 2, t0 = cj / 2;
        for (let j = 0; j < n; j++) {
          const a = j / (2 * n), b = (j + 1) / (2 * n);
          out.push((ci + cj) % 2 === 0
            ? [at(s0, t0 + a), at(s0 + 0.5, t0 + a), at(s0 + 0.5, t0 + b), at(s0, t0 + b)]
            : [at(s0 + a, t0), at(s0 + b, t0), at(s0 + b, t0 + 0.5), at(s0 + a, t0 + 0.5)]);
        }
      }
    }
    return out;
  },

  facets(n) {
    // n hjørner spredt uregelmessig, men jevnt, og trekantene mellom dem. Samme
    // antall gir alltid samme mønster.
    const points = spread(Math.max(6, n), random(n));
    return triangulate(points).map((f) => f.map((i) => points[i]));
  },
};

// Punktet (s, t) på en kubeside, der s og t går fra 0 til 1, blåst opp til kula
// med tangens så rutene blir omtrent like store (som i quads).
function cubeFace(axes, k, sign) {
  const normal = axes[k].clone().multiplyScalar(sign);
  const u = axes[(k + 1) % 3];
  const w = axes[(k + 2) % 3].clone().multiplyScalar(sign);
  return (s, t) => normal.clone()
    .addScaledVector(u, Math.tan((Math.PI / 4) * (2 * s - 1)))
    .addScaledVector(w, Math.tan((Math.PI / 4) * (2 * t - 1)))
    .normalize();
}

// --- Store paneler med buede kanter ---
// Disse panelene er for store eller for buede til å være mangekanter. Hvert er
// et tett omriss på kula og et punkt midt i panelet; de fylles som trionda.
const curveSamples = 160; // punkter langs hver kant fra pol til pol
const lonLat = (lon, lat) => new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
function gores(n, twist) {
  // n båter fra pol til pol. twist: hvor mye kanten dreier fra ekvator til polen.
  const edge = (lon0) => Array.from({ length: curveSamples + 1 }, (_, i) => {
    const lat = -Math.PI / 2 + (Math.PI * i) / curveSamples;
    return lonLat(lon0 + twist * (lat / (Math.PI / 2)), lat);
  });
  const width = (Math.PI * 2) / n;
  return Array.from({ length: n }, (_, k) => {
    const left = edge(k * width), right = edge((k + 1) * width);
    // Opp langs den ene kanten og ned langs den andre; polene tas med én gang.
    return {
      center: lonLat((k + 0.5) * width, 0),
      outline: [...left.slice(0, -1), ...right.reverse().slice(0, -1)],
    };
  });
}
const regionPatterns = {
  boats: (n) => gores(Math.max(3, n), 0),
  spiral: (n) => gores(Math.max(3, n), Math.PI / 2),
  caps(n) {
    // To store polarhetter over 45° bredde, og et belte rundt ekvator i n biter.
    const capLatitude = Math.PI / 4;
    const steps = 48; // punkter per bit langs breddesirkelen
    const around = n * steps;
    const lon = (j) => (j / around) * Math.PI * 2;
    const out = [];
    for (let i = 0; i < n; i++) {
      const top = [], bottom = [], up = [], down = [];
      for (let j = i * steps; j <= (i + 1) * steps; j++) {
        top.push(lonLat(lon(j), capLatitude));
        bottom.push(lonLat(lon(j), -capLatitude));
      }
      // Sidekantene langs lengdegradene, fint oppdelt.
      for (let k = 1; k < 16; k++) {
        const lat = -capLatitude + (2 * capLatitude * k) / 16;
        up.push(lonLat(lon((i + 1) * steps), lat));
        down.unshift(lonLat(lon(i * steps), lat));
      }
      out.push({ center: lonLat(lon((i + 0.5) * steps), 0), outline: [...bottom, ...up, ...top.reverse(), ...down] });
    }
    const cap = (lat) => Array.from({ length: around }, (_, j) => lonLat(lon(j), lat));
    out.push({ center: new THREE.Vector3(0, 1, 0), outline: cap(capLatitude) });    // nordpolen
    out.push({ center: new THREE.Vector3(0, -1, 0), outline: cap(-capLatitude) });  // sørpolen
    return out;
  },
  seam() {
    // Tennisballkurven: a + b = 1 holder den på kula, og b sier hvor mye den bølger.
    const a = 0.8, b = 0.2;
    const outline = Array.from({ length: 480 }, (_, i) => {
      const t = (i / 480) * Math.PI * 2;
      return new THREE.Vector3(a * Math.cos(t) + b * Math.cos(3 * t), 2 * Math.sqrt(a * b) * Math.sin(2 * t), -(a * Math.sin(t) - b * Math.sin(3 * t)));
    });
    return [{ center: new THREE.Vector3(0, 1, 0), outline }, { center: new THREE.Vector3(0, -1, 0), outline }];
  },
};
const panelPatterns = [...Object.keys(patterns), ...Object.keys(regionPatterns), 'trionda'];

// --- Trionda: fire like paneler fra et tetraeder, med S-formede kanter ---
// Tetraederets fire hjørner på kula. Hver kant byttes ut med en S-kurve.
const tetraVertices = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]]
  .map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());
const tetraFaces = [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]].map((f) => {
  // Hjørnene mot klokka sett utenfra.
  const [a, b, c] = f.map((i) => tetraVertices[i]);
  const outward = b.clone().sub(a).cross(c.clone().sub(a)).dot(a.clone().add(b).add(c)) > 0;
  return outward ? f : [f[0], f[2], f[1]];
});
const edgeSamples = 240; // punkter langs hver S-kurve

// S-kurven fra a til b på enhetskula. Den går langs storsirkelen fra a til b og
// svinger ut til siden: først til den ene siden, så like langt til den andre.
// Kurven er punktsymmetrisk om midten av kanten (en halv omdreining der bytter
// om a og b og gir den samme kurven), så den blir lik fra begge naboene. Den
// regnes bare ut fra a og b, så alle seks kantene og alle fire panelene blir like.
//   amplitude: hvor langt ut den svinger, som andel av kantlengden
//   bulge: 0 gir en rolig bølge; høyere gjør hver bue bredere ytterst enn ved
//          roten, så den blir en arm
function sCurve(a, b, amplitude, bulge, samples = edgeSamples) {
  const angle = a.angleTo(b);
  const side = a.clone().cross(b).normalize();   // vinkelrett på kanten, langs kula
  const toward = side.clone().cross(a);          // fra a mot b
  const alongEdge = (x) => a.clone().multiplyScalar(Math.cos(x * angle)).addScaledVector(toward, Math.sin(x * angle));
  // Første halvdel av S-en (fra a til midten), som vinkel phi fra 0 til pi.
  const half = (phi) => ({
    x: 0.25 * (1 - Math.cos(phi)) - bulge * 0.15 * Math.sin(2 * phi) * Math.sin(phi),
    y: Math.sin(phi),
  });
  const point = (s) => {
    let x, y;
    if (s <= 0.5) ({ x, y } = half(2 * Math.PI * s));
    else { const h = half(2 * Math.PI * (1 - s)); x = 1 - h.x; y = -h.y; } // speilet om midten
    const offset = amplitude * angle * y;
    return alongEdge(x).multiplyScalar(Math.cos(offset)).addScaledVector(side, Math.sin(offset));
  };
  return Array.from({ length: samples + 1 }, (_, i) => point(i / samples));
}

// Sjekker at S-kurvene ikke krysser hverandre eller seg selv.
function checkTrionda(amplitude, bulge) {
  const edges = [];
  for (const f of tetraFaces) for (let k = 0; k < 3; k++) {
    const i = f[k], j = f[(k + 1) % 3];
    if (i < j) edges.push({ i, j, pts: sCurve(tetraVertices[i], tetraVertices[j], amplitude, bulge, 300) });
  }
  const near = 0.12; // se bort fra punkter like ved et felles hjørne, der kurvene møtes
  let closest = Infinity;
  for (let e = 0; e < edges.length; e++) for (let f = e; f < edges.length; f++) {
    const A = edges[e], B = edges[f];
    const shared = [A.i, A.j].filter((v) => v === B.i || v === B.j).map((v) => tetraVertices[v]);
    for (let p = 0; p < A.pts.length; p++) for (let q = e === f ? p + 30 : 0; q < B.pts.length; q++) {
      const pa = A.pts[p], pb = B.pts[q];
      if (shared.some((v) => pa.angleTo(v) < near && pb.angleTo(v) < near)) continue;
      closest = Math.min(closest, pa.distanceTo(pb));
    }
  }
  if (closest < 0.02) {
    throw new Error('Solmønsteret (trionda) krysser seg selv: gjør amplitude eller bulge mindre i bodyLooks.sun.');
  }
}

// Stereografisk projeksjon rundt et punkt c på kula, og tilbake. Den tåler store
// paneler (opp mot en halvkule) uten å strekke dem ut.
export function stereographic(c) {
  const e1 = new THREE.Vector3(1, 0, 0).cross(c);
  if (e1.lengthSq() < 0.1) e1.set(0, 1, 0).cross(c);
  e1.normalize();
  const e2 = c.clone().cross(e1);
  return {
    to: (p) => new THREE.Vector2(p.dot(e1), p.dot(e2)).divideScalar(1 + p.dot(c)),
    from: (q) => {
      const r2 = q.x * q.x + q.y * q.y;
      return e1.clone().multiplyScalar(2 * q.x).addScaledVector(e2, 2 * q.y).addScaledVector(c, 1 - r2).divideScalar(1 + r2);
    },
  };
}

// Er punktet q innenfor mangekanten (2D)?
export function inside(q, poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > q.y) !== (b.y > q.y) && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

// Gjør en triangulering penere (2D): så lenge et par nabotrekanter blir
// bedre av å bytte diagonal (Delaunay), byttes den. Kantene av omrisset har
// bare én trekant og blir aldri byttet, så omrisset holder seg. Earcut lager
// lange, smale trekanter; etter dette blir de omtrent like store som avstanden
// mellom punktene, og da følger de kula når de legges ut på den.
function delaunayFlip(points, faces) {
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const tris = faces.map(([a, b, c]) => (cross(points[a], points[b], points[c]) > 0 ? [a, b, c] : [a, c, b]));
  const inCircle = (a, b, c, d) => {
    const [ax, ay, bx, by, cx, cy] = [a.x - d.x, a.y - d.y, b.x - d.x, b.y - d.y, c.x - d.x, c.y - d.y];
    return (ax * ax + ay * ay) * (bx * cy - cx * by) - (bx * bx + by * by) * (ax * cy - cx * ay) + (cx * cx + cy * cy) * (ax * by - bx * ay) > 1e-12;
  };
  for (let pass = 0; pass < 100; pass++) {
    const edges = new Map();
    tris.forEach((t, ti) => {
      for (let k = 0; k < 3; k++) {
        const u = t[k], v = t[(k + 1) % 3];
        const key = u < v ? `${u}-${v}` : `${v}-${u}`;
        if (!edges.has(key)) edges.set(key, []);
        edges.get(key).push(ti);
      }
    });
    let flips = 0;
    const touched = new Set();
    for (const [key, list] of edges) {
      if (list.length !== 2 || touched.has(list[0]) || touched.has(list[1])) continue;
      const [u, v] = key.split('-').map(Number);
      const [t1, t2] = list.map((i) => tris[i]);
      const p = t1.find((x) => x !== u && x !== v);
      const q = t2.find((x) => x !== u && x !== v);
      // Ordne så t1 = (a, b, p) mot klokka, med q på den andre siden av a–b.
      const i1 = t1.indexOf(p);
      const a = t1[(i1 + 1) % 3], b = t1[(i1 + 2) % 3];
      if (!inCircle(points[a], points[b], points[p], points[q])) continue;
      // Bare bytt når firkanten a, q, b, p er konveks.
      if (cross(points[p], points[a], points[q]) <= 0 || cross(points[q], points[b], points[p]) <= 0) continue;
      tris[list[0]] = [p, a, q];
      tris[list[1]] = [q, b, p];
      touched.add(list[0]);
      touched.add(list[1]);
      flips++;
    }
    if (flips === 0) break;
  }
  return tris;
}

// De fire panelene som omriss på enhetskula, krympet inn så det blir fuger.
// Kanten flyttes like langt inn overalt, vinkelrett på seg selv, langs kula.
function triondaOutlines(amplitude, bulge, inset) {
  checkTrionda(amplitude, bulge);
  return tetraFaces.map((f) => {
    const outline = [];
    for (let k = 0; k < 3; k++) {
      outline.push(...sCurve(tetraVertices[f[k]], tetraVertices[f[(k + 1) % 3]], amplitude, bulge).slice(0, -1));
    }
    const center = f.reduce((s, i) => s.add(tetraVertices[i]), new THREE.Vector3()).normalize();
    const n = outline.length;
    const shrunk = outline.map((p, i) => {
      const tangent = outline[(i + 1) % n].clone().sub(outline[(i - 1 + n) % n]);
      const inward = p.clone().cross(tangent).normalize(); // til venstre for kanten, sett utenfra
      return p.clone().addScaledVector(inward, inset).normalize();
    });
    return { center, outline: shrunk };
  });
}

// Krymper et stort panel med buede kanter, så det blir fuger. Omrisset legges
// flatt med stereografisk projeksjon rundt midten, og hvert punkt flyttes
// innover langs halveringslinjen mellom de to kantbitene ved punktet. Projeksjonen
// forstørrer med 1 / (1 + p · c), så flyttet skaleres med det og fugen blir like
// bred på kula overalt. Spisse hjørner (som båtene ved polene) blir riktige.
export function insetRegion({ center, outline }, inset) {
  const proj = stereographic(center);
  let points = outline.map(proj.to);
  let source = outline;
  let area = 0;
  points.forEach((p, i) => { const q = points[(i + 1) % points.length]; area += p.x * q.y - q.x * p.y; });
  if (area < 0) { points = [...points].reverse(); source = [...outline].reverse(); }
  const n = points.length;
  const moved = points.map((p, i) => {
    const d1 = p.clone().sub(points[(i - 1 + n) % n]).normalize();
    const d2 = points[(i + 1) % n].clone().sub(p).normalize();
    const n1 = new THREE.Vector2(-d1.y, d1.x), n2 = new THREE.Vector2(-d2.y, d2.x); // innover (til venstre)
    const bisector = n1.clone().add(n2);
    if (bisector.lengthSq() < 1e-12) bisector.copy(n1);
    bisector.normalize();
    const shift = inset / (1 + source[i].dot(center)) / Math.max(0.2, bisector.dot(n1));
    return p.clone().addScaledVector(bisector, shift);
  });
  return { center, outline: moved.map(proj.from) };
}

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
// split deler toppene i to: panelene med midten på den ene siden av et plan
// får materialgruppe 2 (for eksempel mørkt metall). 'leading' = siden som
// vender i fartsretningen for en måne på en arm langs +x som dreier om +y
// (mot −z), eller en retning [x, y, z].
export function createPanelGeometry({
  radius, pattern, subdivisions, seamWidth, seamDepth, shape = 'curved', amplitude = 0, bulge = 0, split = null,
}) {
  if (shape !== 'curved' && shape !== 'flat') throw new Error(`Ukjent panelform '${shape}'. Velg 'curved' eller 'flat'.`);
  if (pattern.startsWith('plexus')) throw new Error(`'${pattern}' er en plexus-kule og lages med createPlexus i plexus.js, ikke som paneler.`);
  if (!panelPatterns.includes(pattern)) throw new Error(`Ukjent panelmønster '${pattern}'. Velg mellom: ${panelPatterns.join(', ')}.`);
  const count = Math.max(1, Math.round(subdivisions));
  const polygons = patterns[pattern] ? patterns[pattern](count) : [];
  const regions = regionPatterns[pattern] ? regionPatterns[pattern](count) : [];

  const lightTops = [], lightNormals = [];  // toppen av panelene
  const darkTops = [], darkNormals = [];    // toppene på den andre siden av split
  let tops = lightTops, topNormals = lightNormals;
  const splitDirection = split === 'leading' ? new THREE.Vector3(0, 0, -1)
    : Array.isArray(split) ? new THREE.Vector3(...split).normalize() : null;
  if (split && !splitDirection) throw new Error(`Ukjent split '${split}'. Bruk 'leading' eller en retning [x, y, z].`);
  const chooseSide = (center) => {
    const dark = splitDirection && center.dot(splitDirection) > 0;
    tops = dark ? darkTops : lightTops;
    topNormals = dark ? darkNormals : lightNormals;
  };
  const sides = [];     // sidene og undersiden, som ses ned i fugene
  let lowest = radius;  // det laveste punktet på noen panelflate
  const push = (list, ...vs) => { for (const v of vs) list.push(v.x, v.y, v.z); };
  const planeDistance = (a, b, c) => Math.abs(b.clone().sub(a).cross(c.clone().sub(a)).normalize().dot(a));

  for (const poly of polygons) {
    // Panelets retning (midt i panelet) og et flatt koordinatsystem på tvers av den.
    const normal = poly.reduce((s, p) => s.add(p), new THREE.Vector3()).normalize();
    chooseSide(normal);
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

  // Store paneler (trionda, og båter, spiral og tennisball): hvert panel fylles
  // med punkter på kula (kanten og et rutenett innenfor), som deles i trekanter.
  // Alle punktene ligger på kula, så panelene er alltid buet, også når shape er 'flat'.
  const large = pattern === 'trionda'
    ? triondaOutlines(amplitude, bulge, seamWidth / 2 / radius)
    : regions.map((r) => insetRegion(r, seamWidth / 2 / radius));
  if (large.length) {
    const down = 1 - (seamDepth * 2) / radius;
    const spacing = curveStep / 2; // i projeksjonen er avstandene omtrent halvparten av vinkelen
    for (const { center, outline } of large) {
      chooseSide(center);
      const proj = stereographic(center);
      const edge2 = outline.map(proj.to);
      // Rutenett innenfor kanten, med litt avstand til den.
      const min = new THREE.Vector2(Infinity, Infinity);
      const max = new THREE.Vector2(-Infinity, -Infinity);
      edge2.forEach((p) => { min.min(p); max.max(p); });
      // Hvert punkt flyttes bittelitt (alltid likt), så ingen ligger på rett linje.
      // Ellers hopper trianguleringen over punkter og lager lange, smale
      // trekanter som ikke følger kula.
      const interior = [];
      let n = 0;
      for (let x = min.x; x <= max.x; x += spacing) for (let y = min.y; y <= max.y; y += spacing) {
        n++;
        const jitter = spacing * 0.02;
        const q = new THREE.Vector2(x + jitter * Math.sin(n * 12.9898), y + jitter * Math.sin(n * 78.233));
        if (inside(q, edge2) && edge2.every((p) => p.distanceTo(q) > spacing * 0.6)) interior.push(q);
      }
      const flatPoints = [...edge2, ...interior];
      const faces = delaunayFlip(flatPoints, THREE.ShapeUtils.triangulateShape([...edge2], interior.map((q) => [q])));
      const points = flatPoints.map((q) => proj.from(q).multiplyScalar(radius));
      for (const [i, j, k] of faces) {
        const a = points[i];
        let b = points[j], c = points[k];
        const cross = b.clone().sub(a).cross(c.clone().sub(a));
        if (cross.lengthSq() < 1e-12) continue;                // hopp over trekanter uten areal
        if (cross.dot(a) < 0) [b, c] = [c, b];                 // vendt utover
        push(tops, a, b, c);
        push(topNormals, a.clone().normalize(), b.clone().normalize(), c.clone().normalize());
        lowest = Math.min(lowest, planeDistance(a, b, c));
        push(sides, a.clone().multiplyScalar(down), c.clone().multiplyScalar(down), b.clone().multiplyScalar(down)); // undersiden
      }
      // Sidene langs kanten, ned i fugen.
      const rim = outline.map((p) => p.clone().multiplyScalar(radius));
      for (let i = 0; i < rim.length; i++) {
        const s0 = rim[i], s1 = rim[(i + 1) % rim.length];
        push(sides, s0, s1.clone().multiplyScalar(down), s0.clone().multiplyScalar(down));
        push(sides, s0, s1, s1.clone().multiplyScalar(down));
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
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([...lightTops, ...darkTops, ...sides], 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([...lightNormals, ...darkNormals, ...sideNormals], 3));
  const nLight = lightTops.length / 3, nDark = darkTops.length / 3;
  geometry.addGroup(0, nLight, 0);
  if (nDark) geometry.addGroup(nLight, nDark, 2);
  geometry.addGroup(nLight + nDark, sides.length / 3, 1);

  // Kjernen ligger seamDepth under det laveste punktet på panelene, så fugene
  // går ned til den overalt.
  return { geometry, coreRadius: lowest - seamDepth, count: polygons.length + large.length };
}

