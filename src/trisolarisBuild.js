// Tegner Trisolaris (testsiden trisolaris.html) fra delelista i
// trisolarisDesign.js: én three.js-gruppe per del, flyttet og dreid hvert
// bilde med move og spin. Hvit lakk på mekanikken, mørkt metall på tappene,
// spindlene og rullene, accent på ringene ved solstolpene. Ingen DOM, så
// sjekken kan bygge den i Node og telle delene.
import * as THREE from 'three';
import { gear as gearStyle, accent } from './config.js';
import { createMaterials, createBodyMaterials } from './materials.js';
import { makeBuilder } from './build.js';
import { createGearGeometry, createBevelGeometry, createRingGearGeometry, extrudeFlat } from './gear.js';
import { createArmGeometry } from './arm.js';
import { createBodySphere, createSun } from './sphere.js';
import { trisolaris as T } from './config.js';
import { partsFor, stateAt, AXES } from './trisolarisDesign.js';

const upAxis = new THREE.Vector3(0, 1, 0);
const axisVector = (name, sign = 1) => new THREE.Vector3(AXES[name].x, AXES[name].y, AXES[name].z).multiplyScalar(sign);

// Tannhjul i stilen fra modellen, med eiker når hjulet er stort nok.
function gearSettings(teeth, module, thickness, hole) {
  const rim = (module * teeth) / 2 - 2.75 * module;
  const spokeWidth = Math.max(4 * module, 0.5), hubWidth = Math.max(3 * module, 0.5), rimWidth = Math.max(3 * module, 0.5);
  const spokes = rim - rimWidth - (hole + hubWidth) > 3 ? (teeth >= 40 ? 5 : 4) : 0;
  return {
    ...gearStyle, teeth, module, thickness, holeRadius: hole, spokes, spokeWidth, hubWidth, rimWidth,
    backlash: 0.1 * module, chamfer: Math.min(gearStyle.chamfer, 0.25 * module, thickness * 0.3),
  };
}

// Omrisset av en stang mellom a og b (i planet) med runde ender, i
// formkoordinater (x, −z), mot klokka. reverse: motsatt vei (til hull).
function stadium(a, b, half, reverse = false, steps = 12) {
  const A = new THREE.Vector2(a.x, -a.z), B = new THREE.Vector2(b.x, -b.z);
  const angle = Math.atan2(B.y - A.y, B.x - A.x);
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = angle - Math.PI / 2 + (Math.PI * i) / steps;
    pts.push(new THREE.Vector2(B.x + half * Math.cos(t), B.y + half * Math.sin(t)));
  }
  for (let i = 0; i <= steps; i++) {
    const t = angle + Math.PI / 2 + (Math.PI * i) / steps;
    pts.push(new THREE.Vector2(A.x + half * Math.cos(t), A.y + half * Math.sin(t)));
  }
  return reverse ? pts.reverse() : pts;
}

// Bygger alt for varianten. Gir tilbake gruppen, update(θ, tid) (tid i
// sekunder, til plexus-kulene) og antall deler per type (uten kulene).
export function buildTrisolaris(variant) {
  const mat = createMaterials();
  const bodyMaterial = createBodyMaterials(mat.white);
  const { mesh, rod, shaft } = makeBuilder(mat.white);
  const root = new THREE.Group();
  const parts = partsFor(variant);
  const counts = {};
  const moving = [], spinning = [], plexus = [];
  const darkKinds = new Set(['aksel']);

  for (const part of parts) {
    const d = part.draw;
    const group = new THREE.Group();
    root.add(group);
    if (part.kind !== 'kule') counts[part.kind] = (counts[part.kind] ?? 0) + 1;
    // Tappene og spindlene i mørkt metall, så de synes i slissene.
    const pinLike = darkKinds.has(part.kind) && /tapp|spindel/.test(part.name);
    const material = pinLike ? mat.metal : mat.white;
    switch (d.type) {
      case 'cyl': {
        const m = mesh(group, new THREE.CylinderGeometry(d.r, d.r, Math.max(1e-3, d.y1 - d.y0), 32), material);
        m.position.set(d.at.x, (d.y0 + d.y1) / 2, d.at.z);
        break;
      }
      case 'collar': {
        const m = mesh(group, new THREE.CylinderGeometry(d.r1, d.r0, d.y1 - d.y0, 32));
        m.position.set(d.at.x, (d.y0 + d.y1) / 2, d.at.z);
        break;
      }
      case 'gear': {
        const m = mesh(group, createGearGeometry(gearSettings(d.teeth, d.module, d.thickness, d.hole)));
        m.position.set(d.at?.x ?? 0, d.y0, d.at?.z ?? 0);
        break;
      }
      case 'arm': {
        const c = T.crank;
        const m = mesh(group, createArmGeometry({
          length: d.length, hubRadius: d.hub, rootHalf: c.rootHalf, endRadius: c.endRadius,
          fillet: c.fillet, thickness: d.thickness, chamfer: c.chamfer,
        }));
        m.position.y = d.y0;
        break;
      }
      case 'bar': {
        const shape = new THREE.Shape(stadium(d.a, d.b, d.width / 2));
        if (d.slot) shape.holes.push(new THREE.Path(stadium(d.slot.a, d.slot.b, d.slot.width / 2, true)));
        const m = mesh(group, extrudeFlat(shape, d.thickness, T.slide.chamfer));
        m.position.y = d.y0;
        break;
      }
      case 'rod':
        rod(group, d.a, d.b, d.r, material);
        break;
      case 'bevel': {
        const m = mesh(group, createBevelGeometry(gearSettings(d.teeth, d.module, T.gearThickness, T.line.radius), Math.abs(d.apex)));
        m.position.set(d.c.x, d.c.y, d.c.z);
        const align = new THREE.Quaternion().setFromUnitVectors(upAxis, axisVector(d.axis, Math.sign(d.apex)));
        m.quaternion.copy(align);
        if (part.spin) spinning.push({ object: m, align, sign: Math.sign(d.apex), spin: part.spin });
        break;
      }
      case 'ringGear': {
        const m = mesh(group, createRingGearGeometry({ teeth: d.teeth, module: d.module, outerRadius: d.outer, thickness: d.thickness, chamfer: 0.1 }));
        m.position.y = d.y0;
        break;
      }
      case 'sphere': {
        if (d.look === 'sun') {
          const { group: sun, plexus: update, light } = createSun(d.r, mat.metal);
          sun.position.set(d.c.x, d.c.y, d.c.z);
          group.add(sun);
          if (light) { light.position.set(d.c.x, d.c.y, d.c.z); group.add(light); }
          if (update) plexus.push(update);
        } else {
          const { group: ball, plexus: update } = createBodySphere(d.r, 'trisolaris', { top: bodyMaterial('trisolaris'), metal: mat.metal });
          ball.position.set(d.c.x, d.c.y, d.c.z);
          group.add(ball);
          if (update) plexus.push(update);
        }
        break;
      }
      case 'torus': {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(d.r + accent.ringWidth / 2, accent.ringWidth / 2, 12, 48), mat.accent);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(d.at.x, d.y, d.at.z);
        ring.castShadow = true;
        group.add(ring);
        break;
      }
      case 'pillow': {
        // En liten stolpe fra gulvet og en ring rundt akselen.
        shaft(group, d.r * 0.9, 0, d.y - d.r - 0.05, mat.white, d.at.x, d.at.z);
        const ring = mesh(group, new THREE.TorusGeometry(d.r + 0.12, 0.14, 10, 32));
        ring.position.set(d.at.x, d.y, d.at.z);
        ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axisVector(d.axis));
        break;
      }
      case 'bearing': {
        rod(group, d.a, d.b, d.r);
        const ring = mesh(group, new THREE.TorusGeometry(d.shaft + 0.12, 0.14, 10, 32));
        ring.position.set(d.b.x, d.b.y, d.b.z);
        ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axisVector(d.axis));
        break;
      }
      case 'roller': {
        const m = mesh(group, new THREE.CylinderGeometry(d.r, d.r, d.width, 24), mat.metal);
        m.position.set(d.c.x, d.c.y, d.c.z);
        m.quaternion.setFromUnitVectors(upAxis, new THREE.Vector3(Math.cos(d.angle), 0, -Math.sin(d.angle)));
        break;
      }
      default:
        throw new Error(`Ukjent deltype '${d.type}' (${part.name}).`);
    }
    if (part.move) moving.push({ group, move: part.move });
  }

  const spinAbout = new THREE.Quaternion();
  function update(theta, time = 0) {
    const state = stateAt(theta, variant);
    for (const { group, move } of moving) {
      const p = move(state);
      group.position.set(p.x, 0, p.z);
      group.rotation.y = p.angle;
    }
    for (const { object, align, sign, spin } of spinning) {
      spinAbout.setFromAxisAngle(upAxis, sign * spin(state));
      object.quaternion.copy(align).multiply(spinAbout);
    }
    for (const p of plexus) p(time);
    return state;
  }
  update(0);
  return { root, update, counts, parts };
}
