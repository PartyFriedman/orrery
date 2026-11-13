import * as THREE from 'three';

// Evolventfunksjonen: hvor langt en evolventkurve har "svingt" ved en gitt vinkel.
const involute = (angle) => Math.tan(angle) - angle;

// Lager det flate omrisset av ett tannhjul (tenner, hull og eiker).
export function createGearShape({
  teeth,
  module,
  pressureAngle,
  backlash = 0,
  holeRadius,
  spokes,
  spokeWidth,
  hubWidth,
  rimWidth,
}) {
  const alpha = (pressureAngle * Math.PI) / 180;
  const pitchRadius = (module * teeth) / 2;          // der tennene møter et annet hjul
  const baseRadius = pitchRadius * Math.cos(alpha);  // sirkelen evolventen "rulles av" fra
  const tipRadius = pitchRadius + module;            // ytterkant av tennene
  const rootRadius = pitchRadius - 1.25 * module;    // bunnen mellom tennene
  const step = (Math.PI * 2) / teeth;                // vinkel per tann

  // Tennene gjøres litt tynnere (halve klaringen på hvert hjul), så to hjul
  // ikke gnisser mot hverandre.
  const thinning = backlash / 2 / baseRadius;

  const point = (radius, angle) =>
    new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);

  // Halv tannbredde (som vinkel) ved en gitt radius, langs evolventen.
  // Ved delesirkelen er tanna nøyaktig en halv deling bred.
  const halfToothAngle = (radius) => {
    const r = Math.max(radius, baseRadius);
    const phi = Math.acos(baseRadius / r);
    return Math.max(0, step / 4 + involute(alpha) - involute(phi) - thinning);
  };

  // Radier vi sampler flanken på: rett radielt stykke under grunnsirkelen,
  // deretter evolventkurven ut til tuppen.
  const flankRadii = [];
  const flankStart = Math.max(rootRadius, baseRadius);
  if (rootRadius < baseRadius) flankRadii.push(rootRadius);
  const flankSteps = 10;
  for (let i = 0; i <= flankSteps; i++) {
    flankRadii.push(flankStart + ((tipRadius - flankStart) * i) / flankSteps);
  }

  const outline = [];
  const arcSteps = 3;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;

    // Venstre flanke, innenfra og ut.
    for (const r of flankRadii) outline.push(point(r, a - halfToothAngle(r)));

    // Tuppen (bue).
    const tipHalf = halfToothAngle(tipRadius);
    for (let k = 1; k < arcSteps; k++) {
      outline.push(point(tipRadius, a - tipHalf + (2 * tipHalf * k) / arcSteps));
    }

    // Høyre flanke, utenfra og inn.
    for (let k = flankRadii.length - 1; k >= 0; k--) {
      const r = flankRadii[k];
      outline.push(point(r, a + halfToothAngle(r)));
    }

    // Bunnen mellom denne og neste tann (bue).
    const rootStart = a + halfToothAngle(rootRadius);
    const rootEnd = a + step - halfToothAngle(rootRadius);
    for (let k = 1; k < arcSteps; k++) {
      outline.push(point(rootRadius, rootStart + ((rootEnd - rootStart) * k) / arcSteps));
    }
  }
  const shape = new THREE.Shape(outline);

  // Hullet i midten.
  const hole = new THREE.Path();
  hole.absarc(0, 0, holeRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  // Eiker: vi skjærer ut "vinduer" mellom navet og tannkransen,
  // og lar det stå igjen rette eiker med fast bredde.
  const hubRadius = holeRadius + hubWidth;
  const rimRadius = rootRadius - rimWidth;
  const half = spokeWidth / 2;
  if (spokes > 0 && hubRadius < rimRadius && half < hubRadius) {
    const spokeStep = (Math.PI * 2) / spokes;
    // Hvor mye vinkel eika "spiser" av sirkelen ved en gitt radius.
    const innerGap = Math.asin(half / hubRadius);
    const outerGap = Math.asin(half / rimRadius);

    for (let i = 0; i < spokes; i++) {
      const a1 = i * spokeStep;
      const a2 = a1 + spokeStep;
      if (a2 - a1 <= 2 * innerGap) continue; // eikene er så brede at de fyller alt

      const win = new THREE.Path();
      win.absarc(0, 0, hubRadius, a1 + innerGap, a2 - innerGap, false);
      win.absarc(0, 0, rimRadius, a2 - outerGap, a1 + outerGap, true);
      win.closePath();
      shape.holes.push(win);
    }
  }

  return shape;
}

// Gjør omrisset om til en 3D-geometri som ligger flatt, med avfasede kanter.
export function createGearGeometry(settings) {
  const shape = createGearShape(settings);

  // Avfasingen kan ikke være mer enn knapt halve tykkelsen.
  const chamfer = Math.min(settings.chamfer ?? 0, settings.thickness * 0.4);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: settings.thickness - chamfer * 2,
    bevelEnabled: chamfer > 0,
    bevelThickness: chamfer,
    bevelSize: chamfer,
    // Skjær avfasingen innover fra omrisset, så hjulet aldri blir bredere
    // enn tannprofilen (og tennene dermed ikke kan overlappe).
    bevelOffset: -chamfer,
    bevelSegments: 1, // ett trinn = en ren, skrå flate (ikke avrundet)
    curveSegments: 48,
  });

  // Legg hjulet flatt, med undersiden på y = 0.
  geometry.rotateX(-Math.PI / 2);
  geometry.computeBoundingBox();
  geometry.translate(0, -geometry.boundingBox.min.y, 0);

  return geometry;
}
