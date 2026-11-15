// Saturns ring: flate ringer med avfasede kanter dreid rundt y-aksen
// (createAnnulus), og glassbåndene med kantlys (createGlassBands). Brukes av
// modellen og testsiden rings.html; tallene står i saturnRing i config.js.
// Hvor båndene og spalten ligger, regnes ut i ringLayout.js.
import * as THREE from 'three';
import { ringLayout } from './ringLayout.js';

export { ringLayout };

// Frostet glass med én tone per bånd (glass.tones, innenfra og ut), og kantlys:
// glasset lyser svakt opp der man ser det på skrå (rim i config).
export function createGlassMaterials(s) {
  return s.glass.tones.map((t) => {
    const material = new THREE.MeshPhysicalMaterial({
      color: t.color, metalness: 0, roughness: t.roughness, transmission: t.transmission,
      ior: s.glass.ior, thickness: s.glass.depth,
    });
    if (s.rim && s.rim.strength > 0) {
      const rimColor = new THREE.Color(s.rim.color);
      material.onBeforeCompile = (shader) => {
        shader.uniforms.rimColor = { value: rimColor };
        shader.uniforms.rimStrength = { value: s.rim.strength };
        shader.uniforms.rimSharpness = { value: s.rim.sharpness };
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;\nuniform float rimStrength;\nuniform float rimSharpness;')
          .replace('#include <emissivemap_fragment>', [
            '#include <emissivemap_fragment>',
            'float rimFacing = abs(dot(normal, normalize(vViewPosition)));',
            'totalEmissiveRadiance += rimColor * rimStrength * pow(1.0 - rimFacing, rimSharpness);',
          ].join('\n'));
      };
      material.customProgramCacheKey = () => `rim-${s.rim.strength}-${s.rim.sharpness}-${s.rim.color}`;
    }
    return material;
  });
}

// Glassbåndene som hver sin geometri, innenfra og ut: [{ band, geometry, material }].
export function createGlassBands(radius, s, materials = createGlassMaterials(s)) {
  const layout = ringLayout(radius, s);
  return layout.bands.map((band) => ({
    band,
    geometry: createAnnulus(band.inner, band.outer, s.thickness, s.chamfer),
    material: materials[Math.min(band.index, materials.length - 1)],
  }));
}

// En flat ring fra radius `inner` til `outer`, `thickness` tykk, sentrert på
// y = 0, med avfasing langs alle fire kantene.
export function createAnnulus(inner, outer, thickness, chamfer = 0, segments = 256) {
  const h = thickness / 2;
  const c = Math.min(chamfer, thickness * 0.4, (outer - inner) * 0.4);
  // Tverrsnittet (radius, høyde), mot klokka: underside, ytterkant, overside, innerkant.
  const profile = [
    [inner + c, -h], [outer - c, -h], [outer, -h + c], [outer, h - c],
    [outer - c, h], [inner + c, h], [inner, h - c], [inner, -h + c],
  ];
  return revolve(profile, segments);
}

// Dreier et lukket tverrsnitt rundt y-aksen. Hver kant i tverrsnittet får sin
// egen stripe med egne normaler, så flatene er flate og kantene skarpe (ulikt
// LatheGeometry, som glatter normalene over hjørnene).
function revolve(profile, segments) {
  const positions = [], normals = [], indices = [];
  for (let i = 0; i < profile.length; i++) {
    const [ra, ya] = profile[i];
    const [rb, yb] = profile[(i + 1) % profile.length];
    const dr = rb - ra, dy = yb - ya;
    const length = Math.hypot(dr, dy);
    if (length < 1e-9) continue;
    const nr = dy / length, ny = -dr / length; // ut av tverrsnittet
    const first = positions.length / 3;
    for (let j = 0; j <= segments; j++) {
      const angle = (j / segments) * Math.PI * 2;
      const sin = Math.sin(angle), cos = Math.cos(angle);
      positions.push(ra * sin, ya, ra * cos, rb * sin, yb, rb * cos);
      normals.push(nr * sin, ny, nr * cos, nr * sin, ny, nr * cos);
    }
    for (let j = 0; j < segments; j++) {
      const a = first + j * 2, b = a + 1, a1 = a + 2, b1 = a + 3;
      indices.push(a, a1, b, b, a1, b1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return geometry;
}
