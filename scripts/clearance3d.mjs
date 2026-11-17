// 3D-verktøyet for avstandssjekkene (brukt av check.mjs for Saturn, Mars og
// Uranus, og av checkMoons.mjs for månene til Uranus og Neptun).
//
// Sett fra en stolpe som står stille i rommet dreier hver del om sin egen akse,
// så hver del er et omdreiningslegeme: en profil i planet gjennom aksen
// (rektangler og tykke streker). Det dekker alle vinkler. Deler som står
// stille er staver. Avstanden mellom to deler med samme akse regnes i
// profilplanet; ellers fra punkter på overflaten av den ene til den andre.

// Den korteste avstanden mellom to linjestykker i planet (pq og rs).
export function segDist(p, q, r, s) {
  const d1 = { x: q.x - p.x, y: q.y - p.y }, d2 = { x: s.x - r.x, y: s.y - r.y }, w0 = { x: p.x - r.x, y: p.y - r.y };
  const a = d1.x * d1.x + d1.y * d1.y, b = d1.x * d2.x + d1.y * d2.y, c = d2.x * d2.x + d2.y * d2.y;
  const dd = d1.x * w0.x + d1.y * w0.y, e = d2.x * w0.x + d2.y * w0.y;
  const clamp = (x) => Math.max(0, Math.min(1, x));
  let sc = a > 0 ? clamp(-dd / a) : 0, tc = c > 0 ? clamp((b * sc + e) / c) : 0;
  sc = a > 0 ? clamp((b * tc - dd) / a) : 0;
  return Math.hypot(w0.x + sc * d1.x - tc * d2.x, w0.y + sc * d1.y - tc * d2.y);
}
// To deler i inngrep (hjul mot hjul, kjede rundt kjedehjul) regnes ikke mot hverandre.
export const meshes = (a, b) => (a.mesh ?? []).includes(b.id) || (b.mesh ?? []).includes(a.id);

export const v = (x, y, z) => ({ x, y, z });
export const sub = (a, b) => v(a.x - b.x, a.y - b.y, a.z - b.z);
export const plus = (a, b) => v(a.x + b.x, a.y + b.y, a.z + b.z);
export const mul = (a, k) => v(a.x * k, a.y * k, a.z * k);
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a, b) => v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const len = (a) => Math.sqrt(dot(a, a));
export const unit = (a) => mul(a, 1 / len(a));
export const makeAxis = (o, d) => {
  const c = cross(d, v(0, 0, 1)), e1 = unit(len(c) > 1e-6 ? c : cross(d, v(1, 0, 0)));
  return { o, d, e1, e2: cross(d, e1) };
};
export const rect = (s0, s1, r0, r1) => ({ kind: 'rect', s0, s1, r0: Math.max(0, r0), r1 });
export const line = (s0, r0, s1, r1, w) => ({ kind: 'seg', a: { s: s0, r: r0 }, b: { s: s1, r: r1 }, w });
export const toMer = (ax, p) => { const q = sub(p, ax.o), s = dot(q, ax.d); return { s, r: len(sub(q, mul(ax.d, s))) }; };
export const merDist = (sh, m) => {
  if (sh.kind === 'rect') return Math.hypot(Math.max(sh.s0 - m.s, 0, m.s - sh.s1), Math.max(sh.r0 - m.r, 0, m.r - sh.r1));
  return segDist({ x: m.s, y: m.r }, { x: m.s, y: m.r }, { x: sh.a.s, y: sh.a.r }, { x: sh.b.s, y: sh.b.r }) - sh.w;
};
export const capDist = (c, p) => {
  const ab = sub(c.b, c.a), k = Math.max(0, Math.min(1, dot(sub(p, c.a), ab) / dot(ab, ab)));
  return len(sub(p, plus(c.a, mul(ab, k)))) - c.w;
};
export const pointDist = (part, p) => (part.shape.kind === 'cap' ? capDist(part.shape, p) : merDist(part.shape, toMer(part.ax, p)));
// Punkter i profilplanet langs kanten av en form.
export const outline = (sh) => {
  const pts = [];
  if (sh.kind === 'rect') {
    const c = [[sh.s0, sh.r0], [sh.s1, sh.r0], [sh.s1, sh.r1], [sh.s0, sh.r1]];
    for (let i = 0; i < 4; i++) for (let k = 0; k < 12; k++) {
      const f = k / 12, [s0, r0] = c[i], [s1, r1] = c[(i + 1) % 4];
      pts.push({ s: s0 + (s1 - s0) * f, r: Math.min(r0 + (r1 - r0) * f, 60) });
    }
  } else {
    const ds = sh.b.s - sh.a.s, dr = sh.b.r - sh.a.r, l = Math.hypot(ds, dr);
    const n = l > 0 ? { s: -dr / l, r: ds / l } : { s: 1, r: 0 };
    for (let k = 0; k <= 12; k++) {
      const f = k / 12, s = sh.a.s + ds * f, r = sh.a.r + dr * f;
      for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
        // rundt streken: en sirkel med radius w i profilplanet
        pts.push({ s: s + sh.w * (n.s * Math.cos(a) + (l > 0 ? ds / l : 0) * Math.sin(a)), r: Math.max(0, r + sh.w * (n.r * Math.cos(a) + (l > 0 ? dr / l : 1) * Math.sin(a))) });
      }
    }
  }
  return pts;
};
export const surface = (part) => {
  if (part.pts) return part.pts;
  const pts = [];
  if (part.shape.kind === 'cap') {
    const { a, b, w } = part.shape, d = unit(sub(b, a));
    const e1 = unit(Math.abs(d.y) < 0.9 ? cross(d, v(0, 1, 0)) : cross(d, v(1, 0, 0))), e2 = cross(d, e1);
    for (let k = 0; k <= 16; k++) for (let j = 0; j < 16; j++) {
      const c = plus(a, mul(sub(b, a), k / 16)), f = (j / 16) * Math.PI * 2;
      pts.push(plus(c, plus(mul(e1, w * Math.cos(f)), mul(e2, w * Math.sin(f)))));
    }
  } else {
    const ax = part.ax;
    for (const m of outline(part.shape)) for (let j = 0; j < 64; j++) {
      const f = (j / 64) * Math.PI * 2;
      pts.push(plus(plus(ax.o, mul(ax.d, m.s)), plus(mul(ax.e1, m.r * Math.cos(f)), mul(ax.e2, m.r * Math.sin(f)))));
    }
  }
  return (part.pts = pts);
};
export const distance = (a, b) => {
  if (a.ax && b.ax && a.ax === b.ax && a.shape.kind === 'rect' && b.shape.kind === 'rect') {
    const ds = Math.max(a.shape.s0 - b.shape.s1, b.shape.s0 - a.shape.s1);
    const dr = Math.max(a.shape.r0 - b.shape.r1, b.shape.r0 - a.shape.r1);
    return ds > 0 && dr > 0 ? Math.hypot(ds, dr) : Math.max(ds, dr);
  }
  if (a.ax && b.ax && a.ax === b.ax) {
    let best = Infinity;
    for (const m of outline(a.shape)) best = Math.min(best, merDist(b.shape, m));
    for (const m of outline(b.shape)) best = Math.min(best, merDist(a.shape, m));
    return best;
  }
  let best = Infinity;
  for (const p of surface(a)) best = Math.min(best, pointDist(b, p));
  for (const p of surface(b)) best = Math.min(best, pointDist(a, p));
  return best;
};
// Sjekker alle par av deler i forskjellige kropper. Rør i rør om samme akse er
// lager (kan ligge inntil hverandre); hjul i inngrep (id/mesh) hoppes over, og
// skip(a, b) kan hoppe over flere. Skriver minste klaring per par av kropper.
// Når to deler har samme akse og en annen del fra en av de to kroppene ligger
// mellom dem i radius (og dekker hele høyden der de ligger side om side), er
// det den delen som ligger inntil, ikke de to. Et hjul på et rør skal for
// eksempel ikke måles mot akselen inni røret.
export const shielded = (parts, a, b) => {
  if (!(a.ax && a.ax === b.ax && a.shape.kind === 'rect' && b.shape.kind === 'rect')) return false;
  const [inner, outer] = a.shape.r1 <= b.shape.r0 ? [a, b] : b.shape.r1 <= a.shape.r0 ? [b, a] : [null, null];
  if (!inner) return false;
  const s0 = Math.max(a.shape.s0, b.shape.s0), s1 = Math.min(a.shape.s1, b.shape.s1);
  if (s0 >= s1) return false;
  return parts.some((x) => x !== a && x !== b && (x.body === a.body || x.body === b.body) && x.ax === a.ax
    && x.shape.kind === 'rect' && x.shape.r0 <= inner.shape.r1 + 1e-9 && x.shape.r1 >= outer.shape.r0 - 1e-9
    && x.shape.s0 <= s0 + 1e-9 && x.shape.s1 >= s1 - 1e-9);
};
// Den minste klaringen per par av kropper fra siste kjøring av run3D.
export let lastMinimum = {};
export function run3D(letter, title, parts, skip = () => false) {
  const min = {};
  let fail = 0;
  for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
    const a = parts[i], b = parts[j];
    if (a.body === b.body || meshes(a, b) || skip(a, b) || shielded(parts, a, b)) continue;
    const gap = distance(a, b);
    const bearing = a.tube && b.tube && a.ax && a.ax === b.ax;
    const allowed = bearing ? -1e-9 : 0.3 - 1e-6;
    const rec = { gap, a: `${a.body} ${a.name}`, b: `${b.body} ${b.name}` };
    if (gap < allowed) { fail++; if (fail <= 20) console.log(`FOR TETT (${letter}):`, rec.a, '↔', rec.b, gap.toFixed(3)); }
    const key = [a.body, b.body].sort().join('–');
    if (!bearing && (!min[key] || gap < min[key].gap)) min[key] = rec;
  }
  lastMinimum = min;
  console.log(`\n${letter}: ${title}, ${parts.length} deler, ${fail} par for tette. Minste klaring per par (lager ikke tatt med):`);
  for (const [k, r] of Object.entries(min).sort()) console.log(`  ${k.padEnd(20)} ${r.gap.toFixed(2).padStart(6)}  ${r.a} ↔ ${r.b}`);
  return fail;
}

// Delene fra iceMoons.js (med axis: { o, d, key }) med aksene som akser for
// avstandene her (samme objekt per akse, så rør på samme akse regnes som lager).
export function toCheckParts(list) {
  const axes = {};
  return list.map((p) => {
    let ax = null;
    if (p.axis) ax = axes[p.axis.key] ??= makeAxis(v(p.axis.o.x, p.axis.o.y, p.axis.o.z), v(p.axis.d.x, p.axis.d.y, p.axis.d.z));
    return { ...p, ax };
  });
}
const named = (x) => `${x.body} ${x.name}`;

// ------------------------------------------------------------- Festet ---
// Hver aksel (rør, tapp, aksel) skal sitte i en fast del som henger sammen med
// resten av det som står fast, som ved Jupiter og Saturn. Utgangspunktet er
// delene merket ground: stolperøret eller stolpen, og armen. Faste deler som
// ligger an mot hverandre (avstand under 0,05) henger sammen. En aksel er
// festet når den ligger an mot en slik del, eller mot en annen aksel som er
// festet (rør utenpå rør). Hver kropp som dreier, må ha en festet aksel.
// list er deler fra iceMoons.js (med axis); staticBodies er kroppene som står stille.
export function checkMounts(label, list, staticBodies) {
  const parts = toCheckParts(list);
  const touch = 0.05;
  const isStatic = (p) => staticBodies.includes(p.body) || p.ground;
  const parent = new Map();                    // del → det den er festet i
  for (const p of parts.filter((x) => x.ground)) parent.set(p, null);
  // De faste delene, fra det som står fast og utover.
  const statics = parts.filter(isStatic);
  const queue = [...parent.keys()];
  while (queue.length) {
    const p = queue.shift();
    for (const q of statics) {
      if (parent.has(q)) continue;
      if (distance(p, q) <= touch) { parent.set(q, p); queue.push(q); }
    }
  }
  // Akslene, så lenge noen blir festet.
  const shafts = parts.filter((p) => p.shaft);
  for (let changed = true; changed;) {
    changed = false;
    for (const s of shafts) {
      if (parent.has(s)) continue;
      // Helst et lager rundt den samme aksen (rør i rør, lager, tapp).
      const near = [...parent.keys()].filter((x) => x !== s && distance(s, x) <= touch);
      const q = near.find((x) => x.ax && x.ax === s.ax) ?? near[0];
      if (q) { parent.set(s, q); changed = true; }
    }
  }
  const path = (p) => {
    const out = [];
    for (let q = parent.get(p); q; q = parent.get(q)) out.push(named(q));
    return out.join(' ← ') || 'står fast';
  };
  let fail = 0;
  console.log(`\n${label}: hva hver aksel er festet i (← betyr «som er festet i»):`);
  for (const s of shafts) {
    const carries = [...new Set(parts.filter((p) => p.body === s.body && p !== s && !p.shaft).map((p) => p.name))];
    if (parent.has(s)) console.log(`  ${named(s).padEnd(24)} i ${path(s)}${carries.length ? `
  ${''.padEnd(24)} bærer: ${carries.join(', ')}` : ''}`);
    else { fail++; console.log(`  FEIL: ${named(s)} er ikke festet til noe.`); }
  }
  const pins = [...new Map(statics.filter((p) => !p.ground && /tapp|bøyle|lager|bukk|polaksel|nav/.test(p.name)).map((p) => [named(p), p])).values()];
  for (const p of pins) {
    if (parent.has(p)) console.log(`  ${named(p).padEnd(24)} i ${path(p)}`);
    else { fail++; console.log(`  FEIL: ${named(p)} henger ikke sammen med stolpen.`); }
  }
  // Kropper som dreier, men ikke har noen festet aksel.
  const moving = [...new Set(parts.filter((p) => !isStatic(p) && p.body !== 'kjede').map((p) => p.body))];
  for (const body of moving) {
    if (!shafts.some((s) => s.body === body && parent.has(s))) { fail++; console.log(`  FEIL: ${body} dreier, men sitter ikke på noen festet aksel.`); }
  }
  if (!fail) console.log('  Alt er festet.');
  return fail;
}
