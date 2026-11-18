// Drivvisning: bare drivet fra tårnet til kroppen som er valgt, vises som
// vanlig. Resten av mekanikken fades ut til driveView.mechanism, og de andre
// kulene dempes til driveView.bodies. Hver del vet hvilke kropper den driver
// (drives.js).
//
// Delene samles i lag: ett per ulikt merke, og ett per kule. Hvert lag glir mot
// sitt mål over driveView.fade sekunder, og et nytt valg midt i en overgang
// fortsetter jevnt fra der laget står. Ved full opasitet bruker delene sine
// vanlige, felles materialer; under den får laget sin egen gjennomsiktige kopi
// av hvert materiale, og skyggen slås av under halv opasitet.
import { driveView as V } from './config.js';
import { ALL, drivesOf, bodyOf } from './drives.js';

const ease = (t) => t * t * (3 - 2 * t);
const isBlur = (o) => { for (let x = o; x; x = x.parent) if (x.userData.blur) return true; return false; };

export function createDriveView(root) {
  const layers = new Map();
  const keyCache = new WeakMap();
  // Laget en del hører til: kula den er en del av, eller merket den arver.
  const keyOf = (o) => {
    if (keyCache.has(o)) return keyCache.get(o);
    const body = bodyOf(o);
    const drives = body ? null : drivesOf(o);
    const key = body ? `body:${body}` : drives ? [...new Set(drives)].sort().join(',') : null;
    keyCache.set(o, key);
    return key;
  };

  root.traverse((o) => {
    if (!(o.isMesh || o.isPoints) || isBlur(o)) return;
    const key = keyOf(o);
    if (!key) return;
    let layer = layers.get(key);
    if (!layer) {
      const body = bodyOf(o);
      const bodies = body ? null : new Set(drivesOf(o));
      layer = {
        body, bodies, all: bodies?.has(ALL) ?? false, low: body ? V.bodies : V.mechanism,
        p: 1, target: 1, level: 1, parts: [], copies: new Map(),
      };
      layers.set(key, layer);
    }
    layer.parts.push({ object: o, material: o.material, castShadow: o.castShadow, renderOrder: o.renderOrder });
  });
  // En dempet kule tegnes utenfra og inn (skallet før kjernen), før den
  // gjennomsiktige mekanikken, og skriver dybde, så den mørke kjernen og fugene
  // ikke skinner gjennom panelene.
  for (const layer of layers.values()) {
    if (!layer.body) continue;
    const size = (o) => { o.geometry.computeBoundingSphere(); return o.geometry.boundingSphere.radius; };
    [...layer.parts].sort((a, b) => size(b.object) - size(a.object)).forEach((part, i) => { part.dimOrder = i - 100; });
  }

  // Den gjennomsiktige kopien av et materiale i et lag.
  const copyOf = (layer, material) => {
    let copy = layer.copies.get(material);
    if (!copy) {
      copy = material.clone();
      copy.transparent = true;
      copy.depthWrite = Boolean(layer.body);
      copy.userData.opacity = material.opacity;
      layer.copies.set(material, copy);
    }
    return copy;
  };
  const apply = (layer) => {
    layer.level = layer.low + (1 - layer.low) * ease(layer.p);
    const full = layer.level >= 1;
    for (const part of layer.parts) {
      const m = part.material;
      part.object.material = full ? m : Array.isArray(m) ? m.map((x) => copyOf(layer, x)) : copyOf(layer, m);
      part.object.castShadow = part.castShadow && layer.level > 0.5;
      part.object.renderOrder = full || part.dimOrder === undefined ? part.renderOrder : part.dimOrder;
    }
    for (const copy of layer.copies.values()) copy.opacity = copy.userData.opacity * layer.level;
  };

  return {
    // on: bryteren. selected: kroppen som er valgt, eller null.
    set(on, selected) {
      for (const layer of layers.values()) {
        const shown = !on || !selected || layer.all || (layer.body ? layer.body === selected : layer.bodies.has(selected));
        layer.target = shown ? 1 : 0;
      }
    },
    // seconds: vanlig tid siden forrige bilde.
    update(seconds) {
      const step = V.fade > 0 ? seconds / V.fade : 1;
      for (const layer of layers.values()) {
        if (layer.p === layer.target) continue;
        layer.p = layer.target > layer.p ? Math.min(layer.target, layer.p + step) : Math.max(layer.target, layer.p - step);
        apply(layer);
      }
    },
    // Opasiteten til laget en del hører til (til blur.js), 1 for alt annet.
    levelOf(o) {
      if (!o) return 1;
      return layers.get(keyOf(o))?.level ?? 1;
    },
  };
}
