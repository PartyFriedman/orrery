// Mot flimring: raske deler får lysspor, vifter eller glatte former (blur i
// config.js). Hver del som følges, måles hvert bilde: hvor mange grader den
// dreide siden forrige bilde. Over blur.threshold tones det inn:
//   månene: et lysende spor bak månen langs banen, som blir en svak ring over blur.ringAbove
//   stag og armer: en vifte av gjennomsiktige kopier over strekningen siden forrige bilde
//   tannhjul og kjeder: en glatt krans eller et glatt bånd over tennene og leddene
import * as THREE from 'three';
import { blur } from './config.js';
import { createAnnulus } from './ring.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const entries = [];

// Følger en gruppe som dreier om sin egen y-akse (rotation.y). pieces får
// update(vinkel siden forrige bilde i radianer, andel inntoning, andel ring).
export function trackRotation(object, pieces) {
  entries.push({ measure: () => object.rotation.y, pieces });
}
// Følger en verdi som ikke er en vinkel (for eksempel hvor langt et kjede har
// gått), regnet om til en vinkel ved å dele på `scale`.
export function trackValue(get, scale, pieces) {
  entries.push({ measure: () => get() / scale, pieces });
}

// Kalles hvert bilde, etter at alle delene har fått sin nye vinkel.
export function updateBlur() {
  for (const e of entries) {
    const now = e.measure();
    if (e.prev === undefined) { e.prev = now; continue; }
    const delta = now - e.prev;
    e.prev = now;
    const deg = (Math.abs(delta) * 180) / Math.PI;
    const f = clamp01((deg - blur.threshold) / blur.fade);
    const ring = clamp01((deg - blur.ringAbove) / blur.fade);
    for (const p of e.pieces) p.update(delta, f, ring);
  }
}

// Lysspor: en tynn ring i banen (i gruppens koordinater, med månen på +x i
// høyden y). Den lyser bare på buen bak månen, sterkest ved månen, og blir en
// svak, hel ring over blur.ringAbove.
export function createTrail(group, { radius, y = 0, tube = 0.06 }) {
  const geometry = new THREE.TorusGeometry(radius, tube, 6, 256);
  geometry.rotateX(Math.PI / 2); // ligger i planet xz, som banen
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      color: { value: new THREE.Color(blur.trailColor) },
      opacity: { value: 0 },
      arc: { value: 0 },
      ring: { value: 0 },
      dir: { value: 1 },
    },
    vertexShader: `
      uniform float dir;
      varying float vBehind;
      void main() {
        // Hvor langt bak månen punktet ligger (dir = 1: månen dreier fra +x mot −z).
        float phi = dir * atan(-position.z, position.x);
        vBehind = phi > 0.0 ? 6.2831853 - phi : -phi;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 color;
      uniform float opacity;
      uniform float arc;
      uniform float ring;
      varying float vBehind;
      void main() {
        float a = vBehind <= arc ? opacity * (1.0 - vBehind / max(arc, 1e-4)) : 0.0;
        gl_FragColor = vec4(color, max(a, ring));
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = y;
  mesh.visible = false;
  mesh.renderOrder = 2;
  group.add(mesh);
  return {
    update(delta, f, ring) {
      mesh.visible = f > 0 || ring > 0;
      material.uniforms.dir.value = delta < 0 ? -1 : 1;
      material.uniforms.arc.value = Math.min(Math.abs(delta) * blur.trailLength, Math.PI * 2);
      material.uniforms.opacity.value = blur.trailOpacity * f;
      material.uniforms.ring.value = blur.ringOpacity * ring;
    },
  };
}

// Vifte: gjennomsiktige kopier av noen deler i gruppen, fordelt bakover over
// strekningen gruppen dreide siden forrige bilde. Gruppen må bare dreie om y.
export function createFan(group, meshes) {
  group.updateWorldMatrix(true, true);
  const toGroup = group.matrixWorld.clone().invert();
  const copies = blur.fanCopies, ghosts = [];
  for (let k = 1; k <= copies; k++) {
    const holder = new THREE.Group();
    holder.position.copy(group.position);
    holder.visible = false;
    group.parent.add(holder);
    const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, transparent: true, depthWrite: false });
    for (const m of meshes) {
      const ghost = new THREE.Mesh(m.geometry, material);
      ghost.matrixAutoUpdate = false;
      ghost.matrix.copy(toGroup.clone().multiply(m.matrixWorld));
      holder.add(ghost);
    }
    ghosts.push({ holder, material, k });
  }
  return {
    update(delta, f) {
      // Vifta blir aldri bredere enn blur.fanMaxAngle, så den leses som uskarphet bak delen.
      const max = (blur.fanMaxAngle * Math.PI) / 180;
      const spread = Math.sign(delta) * Math.min(Math.abs(delta), max);
      for (const g of ghosts) {
        g.holder.visible = f > 0;
        g.holder.rotation.y = group.rotation.y - (spread * g.k) / copies;
        g.material.opacity = blur.fanOpacity * f * (1 - (g.k - 1) / copies);
      }
    },
  };
}

// Glatt krans over et tannhjul: en ring fra litt innenfor tennene og ut over
// tuppene, i samme materiale, som tones inn til den dekker tennene.
export function createSmoothGear(mesh) {
  mesh.geometry.computeBoundingBox();
  const bb = mesh.geometry.boundingBox;
  const r = Math.max(bb.max.x, -bb.min.x, bb.max.z, -bb.min.z);
  const material = mesh.material.clone();
  material.transparent = true;
  const overlay = new THREE.Mesh(createAnnulus(r * 0.8, r * 1.01, bb.max.y - bb.min.y + 0.02, 0), material);
  overlay.position.copy(mesh.position);
  overlay.position.y += (bb.min.y + bb.max.y) / 2;
  overlay.visible = false;
  mesh.parent.add(overlay);
  return {
    update(delta, f) {
      overlay.visible = f > 0;
      material.opacity = f;
      material.depthWrite = f >= 1;
    },
  };
}

// Glatt bånd over et kjede: et flatt bånd langs hele kjedebanen, like bredt og
// høyt som leddene (i kjedets koordinatsystem, i høyden y0 til y0 + height).
export function createSmoothChain(parent, chain, y0, height, halfWidth, chainMaterial) {
  const L = chain.links * chain.pitch, n = 480;
  const pts = [];
  for (let i = 0; i < n; i++) pts.push(chain.point((L * i) / n));
  const outer = [], inner = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], p = pts[i];
    const tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty);
    const nx = ty / l, ny = -tx / l; // utover (banen går mot klokka)
    outer.push(new THREE.Vector2(p.x + nx * halfWidth, p.y + ny * halfWidth));
    inner.push(new THREE.Vector2(p.x - nx * halfWidth, p.y - ny * halfWidth));
  }
  const shape = new THREE.Shape(outer);
  shape.holes.push(new THREE.Path(inner.reverse()));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 1 });
  geometry.rotateX(-Math.PI / 2);
  const material = chainMaterial.clone();
  material.transparent = true;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = y0;
  mesh.visible = false;
  parent.add(mesh);
  return {
    update(delta, f) {
      mesh.visible = f > 0;
      material.opacity = f;
      material.depthWrite = f >= 1;
    },
  };
}
