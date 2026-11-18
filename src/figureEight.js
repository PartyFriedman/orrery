// Åttetallsbanen for tre like legemer (ren matematikk, uten three.js). Tre
// like masser går etter hverandre i samme åttetall, en tredjedels runde fra
// hverandre. Brukes av trisolarisDesign.js og testsiden trisolaris.html.
//
// Startverdiene er fra Chenciner og Montgomery (Annals of Mathematics 152,
// 2000), med tallene til Simó: G = m = 1, legeme 3 i origo og de to andre
// symmetrisk om det. Perioden er T = 6,32591398.
// Banen integreres én runde (leapfrog), og bevegelsen til legeme 3 deles opp i
// Fourier-ledd. Tyngdepunktet står stille, så alle ledd med 3·n er null: x har
// bare de odde leddene 1, 5, 7, 11, 13 …, y bare de like 2, 4, 8, 10 ….
// Med θ = 2π·t/T og legeme 3 i origo ved θ = 0 er
//   x(θ) = Σ a_n sin nθ,  y(θ) = Σ b_n sin nθ,
// med lengden langs x og halve bredden (største |x|) lik 1. Banen er speilet
// så a_1 > 0 og b_2 > 0 (et speilbilde av en løsning er også en løsning).
// Sett fra et legeme ligger naboen en tredjedel foran (θ + 120°) aldri rett i
// +y, og naboen en tredjedel bak aldri rett i −y (se trisolarisDesign.js).

const start = {
  p1: [0.97000436, -0.24308753],
  v3: [-0.93240737, -0.86473146],
  period: 6.32591398,
};
const steps = 40000;      // skritt per runde
const highest = 15;       // høyeste ledd som tas med i den «eksakte» banen

function integrate() {
  const p = [[...start.p1], [-start.p1[0], -start.p1[1]], [0, 0]];
  const v3 = start.v3;
  const v = [[-v3[0] / 2, -v3[1] / 2], [-v3[0] / 2, -v3[1] / 2], [v3[0], v3[1]]];
  const h = start.period / steps;
  const accel = () => {
    const a = [[0, 0], [0, 0], [0, 0]];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      if (i === j) continue;
      const dx = p[j][0] - p[i][0], dy = p[j][1] - p[i][1];
      const r3 = (dx * dx + dy * dy) ** 1.5;
      a[i][0] += dx / r3;
      a[i][1] += dy / r3;
    }
    return a;
  };
  const track = [];
  let a = accel();
  for (let k = 0; k < steps; k++) {
    track.push([p[2][0], p[2][1]]);
    for (let i = 0; i < 3; i++) for (let c = 0; c < 2; c++) {
      v[i][c] += (a[i][c] * h) / 2;
      p[i][c] += v[i][c] * h;
    }
    a = accel();
    for (let i = 0; i < 3; i++) for (let c = 0; c < 2; c++) v[i][c] += (a[i][c] * h) / 2;
  }
  return track;
}

// Fourier-leddene (sinus) for x og y, opp til `highest`.
function fourier(track) {
  const x = {}, y = {};
  for (let n = 1; n <= highest; n++) {
    let sx = 0, sy = 0;
    for (let k = 0; k < steps; k++) {
      const s = Math.sin((2 * Math.PI * n * k) / steps);
      sx += track[k][0] * s;
      sy += track[k][1] * s;
    }
    if (n % 3 === 0) continue;                  // null, fordi tyngdepunktet står stille
    if (n % 2 === 1) x[n] = (2 * sx) / steps;   // x: odde ledd
    else y[n] = (2 * sy) / steps;               // y: like ledd
  }
  return { x, y };
}

const raw = fourier(integrate());
const flipX = Math.sign(raw.x[1]), flipY = Math.sign(raw.y[2]);
const sum = (terms, theta) => Object.entries(terms).reduce((s, [n, c]) => s + c * Math.sin(n * theta), 0);
let widest = 0;
for (let k = 0; k < 3600; k++) widest = Math.max(widest, Math.abs(sum(raw.x, (2 * Math.PI * k) / 3600)));
const scaled = (terms, flip) => Object.fromEntries(Object.entries(terms).map(([n, c]) => [n, (c * flip) / widest]));

// Leddene, med halve bredden lik 1: { x: { 1: a1, 5: a5, … }, y: { 2: b2, 4: b4, … } }.
export const coefficients = { x: scaled(raw.x, flipX), y: scaled(raw.y, flipY) };

// Punktet i banen ved θ med bare leddene i `terms` ({ x: [1, 5], y: [2, 4] }),
// eller alle når terms mangler. Halve bredden er 1.
export function pointAt(theta, terms = null) {
  const pick = (all, list) => (list ? Object.fromEntries(list.map((n) => [n, all[n] ?? 0])) : all);
  return { x: sum(pick(coefficients.x, terms?.x), theta), y: sum(pick(coefficients.y, terms?.y), theta) };
}

// Største avstand mellom banen med leddene i `terms` og den eksakte, samme θ.
export function maxError(terms, samples = 3600) {
  let worst = 0;
  for (let k = 0; k < samples; k++) {
    const t = (2 * Math.PI * k) / samples;
    const a = pointAt(t, terms), b = pointAt(t);
    worst = Math.max(worst, Math.hypot(a.x - b.x, a.y - b.y));
  }
  return worst;
}

// Halve høyden (største |y|) og minste avstand mellom to legemer, med halve bredden 1.
let tallest = 0, closest = Infinity;
for (let k = 0; k < 3600; k++) {
  const t = (2 * Math.PI * k) / 3600;
  const a = pointAt(t), b = pointAt(t + (2 * Math.PI) / 3);
  tallest = Math.max(tallest, Math.abs(a.y));
  closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y));
}
export const halfHeight = tallest;
export const minSeparation = closest;
