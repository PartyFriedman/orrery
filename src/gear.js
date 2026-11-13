import * as THREE from 'three';

// Lager formen til ett tannhjul og returnerer en 3D-geometri som ligger flatt.
export function createGearGeometry({ teeth, module, thickness, holeRadius }) {
  const pitchRadius = (module * teeth) / 2;   // der tennene "møtes" med et annet hjul
  const tipRadius = pitchRadius + module;     // ytterkant av tennene
  const rootRadius = pitchRadius - 1.25 * module; // bunnen mellom tennene
  const step = (Math.PI * 2) / teeth;         // vinkel per tann

  const point = (radius, angle) =>
    new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);

  // Omriss: hver tann er en trapes med litt avrundet bunn mellom tennene.
  const outline = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    outline.push(point(rootRadius, a - 0.28 * step));
    outline.push(point(pitchRadius, a - 0.22 * step));
    outline.push(point(tipRadius, a - 0.13 * step));
    outline.push(point(tipRadius, a + 0.13 * step));
    outline.push(point(pitchRadius, a + 0.22 * step));
    outline.push(point(rootRadius, a + 0.28 * step));
    outline.push(point(rootRadius, a + 0.5 * step));
  }
  const shape = new THREE.Shape(outline);

  // Hullet i midten.
  const hole = new THREE.Path();
  hole.absarc(0, 0, holeRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const bevel = Math.min(0.3, thickness * 0.1);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 48,
  });

  // Legg hjulet flatt, med undersiden på y = 0.
  geometry.rotateX(-Math.PI / 2);
  geometry.computeBoundingBox();
  geometry.translate(0, -geometry.boundingBox.min.y, 0);

  return geometry;
}
