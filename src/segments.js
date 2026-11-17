// Avstander i planet ({ x, y }), ren matematikk. Brukes av mechanism.js,
// iceMoons.js og avstandssjekkene (scripts/clearance3d.mjs).

// Avstanden fra punktet p til linjestykket ab.
export const pointToSegment = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  const k = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - a.x - k * dx, p.y - a.y - k * dy);
};

// Den korteste avstanden mellom linjestykkene pq og rs: 0 hvis de krysser,
// ellers den minste avstanden fra et av de fire endepunktene til det andre stykket.
export function segmentDistance(p, q, r, s) {
  const side = (a, b, c) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  if (side(p, q, r) * side(p, q, s) < 0 && side(r, s, p) * side(r, s, q) < 0) return 0;
  return Math.min(pointToSegment(p, r, s), pointToSegment(q, r, s), pointToSegment(r, p, q), pointToSegment(s, p, q));
}
