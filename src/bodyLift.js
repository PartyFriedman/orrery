// Mikrointeraksjonen på kulene (bodyLift i config.js): kula åpner seg litt når
// man peker på den eller trykker på den. Panelene løftes ut langs retningen til
// hvert panel, land og is på jorda heves (sidene strekkes ned til havet), og
// nodene i en plexus-kule skyves ut fra kjernen. Retningene står i
// geometry.userData.liftDirs (panels.js og earthSurface.js). Posisjonene skrives
// om bare mens en kule beveger seg, og settes eksakt tilbake når den er lukket.
// Ingen DOM.
import { bodyLift as settings } from './config.js';

const smooth = (p) => p * p * (3 - 2 * p);

// bodies: { navn: { object, radius, plexus, also } } (spheres i model.js). also
// (valgfri): deler utenfor kula som skal følge med (den glatte kula over jorda).
export function createBodyLift(bodies) {
  const states = {}; // navn → tilstand, lages første gang kula beveger seg
  let hovered;

  function stateOf(name) {
    if (states[name]) return states[name];
    const body = bodies[name];
    if (!body) return null;
    const parts = [];
    for (const object of [body.object, ...(body.also ?? [])]) object.traverse((o) => {
      const g = o.geometry;
      if (!o.isMesh || !g?.userData.liftDirs) return;
      const amount = (settings[g.userData.liftKind] ?? 0) * body.radius;
      // Litt større omsluttende kule, så den løftede kula ikke klippes bort i kanten av bildet.
      if (!g.boundingSphere) g.computeBoundingSphere();
      g.boundingSphere.radius += amount;
      parts.push({ g, amount, base: null, baseNormals: null });
    });
    return (states[name] = { body, parts, p: 0, target: 0, pulse: false, hold: 0, shown: 0 });
  }

  // Flater som strekkes (sidene på landmassene) får nye flatenormaler, vendt
  // utover som i earthSurface.js.
  function flatNormals(pos, nor) {
    for (let i = 0; i < pos.length; i += 9) {
      const ax = pos[i], ay = pos[i + 1], az = pos[i + 2];
      const ux = pos[i + 3] - ax, uy = pos[i + 4] - ay, uz = pos[i + 5] - az;
      const vx = pos[i + 6] - ax, vy = pos[i + 7] - ay, vz = pos[i + 8] - az;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz) * (nx * ax + ny * ay + nz * az < 0 ? -1 : 1) || 1;
      nx /= len; ny /= len; nz /= len;
      for (let k = 0; k < 9; k += 3) { nor[i + k] = nx; nor[i + k + 1] = ny; nor[i + k + 2] = nz; }
    }
  }

  function apply(state, k) {
    for (const part of state.parts) {
      const { g, amount } = part;
      const position = g.attributes.position, normal = g.attributes.normal;
      part.base ??= position.array.slice();
      if (g.userData.liftNormals) part.baseNormals ??= normal.array.slice();
      const pos = position.array;
      if (k === 0) {
        pos.set(part.base);
        if (part.baseNormals) normal.array.set(part.baseNormals);
      } else {
        const dirs = g.userData.liftDirs, base = part.base, s = amount * k;
        for (let i = 0; i < pos.length; i++) pos[i] = base[i] + dirs[i] * s;
        if (part.baseNormals) flatNormals(pos, normal.array);
      }
      position.needsUpdate = true;
      if (part.baseNormals) normal.needsUpdate = true;
    }
    if (state.body.plexus) state.body.plexus.open = settings.plexus * k;
  }

  const rate = (seconds, time) => (time > 0 ? seconds / time : 1);

  return {
    // Kula under musepekeren (undefined når den ikke er over noen): den åpner
    // seg, og den forrige lukker seg.
    hover(name) {
      if (name === hovered) return;
      const before = hovered && stateOf(hovered);
      if (before && !before.pulse) before.target = 0;
      hovered = name;
      const now = name && stateOf(name);
      if (now) now.target = 1;
    },
    // Et trykk (mobil): åpne, stå åpen tapHold sekunder, og lukke igjen.
    pulse(name) {
      const state = stateOf(name);
      if (!state) return;
      Object.assign(state, { target: 1, pulse: true, hold: settings.tapHold });
    },
    update(seconds) {
      for (const [name, state] of Object.entries(states)) {
        if (state.pulse && state.p >= 1) {
          state.hold -= seconds;
          if (state.hold <= 0) {
            state.pulse = false;
            state.target = name === hovered ? 1 : 0;
          }
        }
        if (state.p < state.target) state.p = Math.min(state.target, state.p + rate(seconds, settings.timeIn));
        else if (state.p > state.target) state.p = Math.max(state.target, state.p - rate(seconds, settings.timeOut));
        const k = smooth(state.p);
        if (k !== state.shown) {
          state.shown = k;
          apply(state, k);
        }
      }
    },
  };
}
