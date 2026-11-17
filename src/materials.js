// Materialene, samlet ett sted: hvit lakk og mørkt metall (look i config.js),
// kjedene, fargen som skiller seg ut i mekanikken (accent), og utseendet til
// hver kule (bodyLooks). Brukes av modellen og testsidene.
import * as THREE from 'three';
import { look, accent, bodyLooks } from './config.js';

// Utseendet til en kule: blokka i bodyLooks, med det den mangler fra defaults.
export const lookOf = (name) => ({ ...bodyLooks.defaults, ...bodyLooks[name] });

// Satengmatt lakk: halvmatt grunnfarge med et klarlakklag oppå.
export const lacquer = (color, { roughness, gloss, glossRoughness }) => new THREE.MeshPhysicalMaterial({
  color, roughness, metalness: 0, clearcoat: gloss, clearcoatRoughness: glossRoughness,
});

// white: hjul, aksler, armer og stag. metal: fugene mellom panelene og kjernen
// under dem. chain: rullene og lenkeplatene. accent: de blanke ringene.
export function createMaterials() {
  return {
    white: lacquer(look.gearColor, look),
    metal: new THREE.MeshPhysicalMaterial({ color: look.seamColor, metalness: look.seamMetalness, roughness: look.seamRoughness }),
    chain: new THREE.MeshPhysicalMaterial({
      color: look.chainColor, metalness: look.chainMetalness, roughness: look.chainRoughness,
      clearcoat: look.chainGloss, clearcoatRoughness: look.glossRoughness,
    }),
    accent: lacquer(accent.color, accent),
  };
}

// Lakken på en kule, i fargen fra bodyLooks. Ett materiale per navn; kuler uten
// blokk i bodyLooks får `fallback`.
export function createBodyMaterials(fallback) {
  const cache = {};
  return (name) => {
    if (!bodyLooks[name]?.color) return fallback;
    const l = lookOf(name);
    return (cache[name] ??= lacquer(l.color, l));
  };
}
