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
