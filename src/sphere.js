// Kulene, felles for modellen (model.js) og testsiden trisolaris.html: en kule
// med mønsteret fra bodyLooks i config (paneler, plexus eller jorda med
// landmasser), og sola i glass eller lakk. Ingen DOM, så npm run check kan
// bygge modellen i Node.
import * as THREE from 'three';
import { bodyLooks } from './config.js';
import { lookOf, lacquer } from './materials.js';
import { createPanelGeometry } from './panels.js';
import { createPlexus, plexusPatterns } from './plexus.js';
import { createEarthSurface, createSurfaceMaterials } from './earthSurface.js';

// En kule av paneler: toppene i fargen til kula (top), mørke sider (metal) og
// en mørk kjerne under (core), som synes i fugene. Med mønsteret 'plexusA',
// 'plexusB' eller 'plexusC' blir kula en plexus-kule (plexus.js) i stedet;
// andre tall i blokka erstatter dem i plexus i config. Gir tilbake gruppen og
// funksjonen som flytter nodene i en plexus-kule (ellers null).
let earthSurfaceMaterials = null;
export function createBodySphere(radius, name, { top, metal, core = metal }) {
  const group = new THREE.Group();
  group.userData.body = name; // en kule, ikke mekanikk (drives.js)
  const { pattern, ...overrides } = bodyLooks[name] ?? {};
  if (pattern === 'continents') {
    // Jorda med landmasser (earthSurface.js), i fargene til havet, landet og isen.
    group.add(createEarthSurface(radius, earthSurfaceMaterials ??= createSurfaceMaterials()));
    return { group, plexus: null };
  }
  if (plexusPatterns[pattern]) {
    return { group, plexus: createPlexus(group, pattern, radius, { white: top, metal, core }, overrides) };
  }
  const { geometry, coreRadius } = createPanelGeometry({ radius, ...lookOf(name) });
  const panelMesh = new THREE.Mesh(geometry, [top, metal, metal]); // topper, mørke sider, mørke topper (split)
  panelMesh.castShadow = true;
  panelMesh.receiveShadow = true;
  group.add(panelMesh);
  const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(coreRadius, 48, 24), core);
  coreMesh.receiveShadow = true;
  group.add(coreMesh);
  return { group, plexus: null };
}

// En sol: kula over, i fargen og stilen fra bodyLooks.sun. 'lacquer' er blank
// lakk med mørke fuger. 'glass' er glass med en glødende kjerne, og et lys i
// midten (light, i solas sentrum; legges i scenen av den som kaller), så den
// lyser innenfra og fugene gløder.
export function createSun(radius, metal) {
  const sun = lookOf('sun');
  if (sun.style !== 'lacquer' && sun.style !== 'glass') {
    throw new Error(`Ukjent solstil '${sun.style}' i bodyLooks.sun. Velg 'lacquer' eller 'glass'.`);
  }
  if (sun.style === 'lacquer') {
    return { ...createBodySphere(radius, 'sun', { top: lacquer(sun.color, sun.lacquer), metal }), light: null };
  }
  const glass = new THREE.MeshPhysicalMaterial({
    color: sun.color,
    roughness: sun.glass.roughness,
    metalness: 0,
    transmission: sun.glass.transmission,   // slipper lyset fra kjernen gjennom
    thickness: sun.glass.thickness,
    ior: sun.glass.ior,
    attenuationColor: sun.color,
    attenuationDistance: sun.glass.attenuationDistance,
    emissive: sun.color,
    emissiveIntensity: sun.glowParts.surface * sun.glow,
  });
  const glowCore = new THREE.MeshStandardMaterial({
    color: sun.color,
    emissive: sun.color,
    emissiveIntensity: sun.glowParts.core * sun.glow,
  });
  const made = createBodySphere(radius, 'sun', { top: glass, metal, core: glowCore });
  // Glasset kaster ingen skygge, så lyset fra kjernen slipper ut (som glasset i ringene).
  made.group.traverse((o) => {
    if (o.isMesh && [o.material].flat()[0].transmission > 0) o.castShadow = false;
  });
  const light = new THREE.PointLight(sun.color, sun.glowParts.light * sun.glow, 0, 1); // svakt lys innenfra i solas farge
  return { ...made, light };
}
