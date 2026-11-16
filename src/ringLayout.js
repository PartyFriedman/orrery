// Hvor båndene og spalten i Saturns ring ligger, som ren matematikk (uten
// three.js), så både mekanismen, tegningen og sjekkene kan bruke det.
// Tallene står i saturnRing i config.js.

// Båndene og spalten i mm, for en planet med radius `radius`. Spalten deler
// ringen i to: innenfor deles den i bands − 1 like brede bånd, utenfor ligger
// ett bånd (A-ringen). Fugen mellom båndene trekkes like mye fra hvert bånd.
// Svarer med inner, outer, gap { inner, outer }, parts (de to delene på hver
// side av spalten) og bands, innenfra og ut, med index 0, 1, ...
export function ringLayout(radius, s) {
  const inner = s.inner * radius, outer = s.outer * radius;
  const gap = {
    inner: (s.gapCenter - s.gapWidth / 2) * radius,
    outer: (s.gapCenter + s.gapWidth / 2) * radius,
  };
  if (!(inner < gap.inner && gap.outer < outer)) {
    throw new Error('saturnRing: spalten må ligge mellom inner og outer.');
  }
  const parts = [{ inner, outer: gap.inner }, { inner: gap.outer, outer }];
  const insideCount = Math.max(1, Math.round(s.bands) - 1);
  const bands = [];
  const seam = s.bands > 1 ? s.bandSeam / 2 : 0;
  const step = (gap.inner - inner) / insideCount;
  for (let i = 0; i < insideCount; i++) {
    bands.push({
      index: i,
      inner: inner + i * step + (i > 0 ? seam : 0),
      outer: inner + (i + 1) * step - (i < insideCount - 1 ? seam : 0),
    });
  }
  bands.push({ index: s.bands > 1 ? insideCount : 0, inner: gap.outer, outer });
  for (const b of bands) {
    if (b.outer - b.inner < 0.05) throw new Error('saturnRing: for mange bånd eller for bred fuge.');
  }
  return { inner, outer, gap, parts, bands };
}

// Uranus' ringer i mm, innenfra og ut (uranusRing i config.js). Radiene dras inn
// mot kula med scale: radius = 1 + (r − 1) × scale, i ganger planetens radius.
// Svarer med inner, outer og rings [{ name, index, middle, inner, outer }].
export function thinRingLayout(radius, s) {
  const rings = [...s.rings]
    .sort((a, b) => a.radius - b.radius)
    .map((r, index) => {
      const middle = (1 + (r.radius - 1) * (s.scale ?? 1)) * radius;
      return { name: r.name, index, middle, inner: middle - r.width / 2, outer: middle + r.width / 2 };
    });
  if (!rings.length) throw new Error('uranusRing.rings: minst én ring.');
  for (let i = 1; i < rings.length; i++) {
    if (rings[i].inner < rings[i - 1].outer + 0.02) {
      throw new Error(`uranusRing: ringene ${rings[i - 1].name} og ${rings[i].name} går over hverandre: gjør dem smalere eller fjern en.`);
    }
  }
  if (rings[0].inner < radius + 0.3) throw new Error('uranusRing: den innerste ringen går for nær kula (øk scale).');
  return { inner: rings[0].inner, outer: rings.at(-1).outer, rings };
}
