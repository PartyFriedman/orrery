// Plexus-kuler. Brukes på testsiden plexus.html og på kuler i modellen som har
// mønsteret 'plexusA', 'plexusB' eller 'plexusC' i panels i config.js.
//   A og B: noder spredt uregelmessig på kula, bundet sammen i trekanter (ikke
//     geodesisk). Nodene er små kuler, kantene stenger, noen fasetter er fylt, og
//     inni ligger en fasettert kjerne. Nodene driver sakte rundt hvert sitt
//     hvilepunkt, og stengene og fasettene følger etter.
//   C: den typiske motion graphics-plexusen: lysende punkter som vandrer, og
//     linjer mellom dem som er nær hverandre.
// Tallene står i plexus i config.js, for en kule med radius plexus.radius. På
// andre kuler skaleres nodene, stengene og avstandene med radiusen.
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { plexus } from './config.js';
import { random, onSphere, spread, triangulate } from './scatter.js';

export const plexusPatterns = { plexusA: 'A', plexusB: 'B', plexusC: 'C' };

// Lager plexus-kula i `parent` og gir tilbake en funksjon som flytter nodene
// til tiden `time` (sekunder). overrides: tall som erstatter dem i config.
// materials: { white, metal } som nodene og fyllet, og stengene og kjernen får.
export function createPlexus(parent, pattern, radius, materials, overrides = {}) {
  const variant = plexusPatterns[pattern];
  if (!variant) throw new Error(`Ukjent plexus-mønster '${pattern}'. Velg mellom: ${Object.keys(plexusPatterns).join(', ')}.`);
  const settings = { ...plexus[variant], ...overrides };
  const scale = radius / plexus.radius;
  return variant === 'C'
    ? addMotionPlexus(parent, settings, radius, scale)
    : addPlexus(parent, settings, radius, scale, materials);
}

const up = new THREE.Vector3(0, 1, 0);
const placer = new THREE.Object3D();

function addPlexus(parent, settings, R, scale, materials) {
  const fillMaterial = materials.white.clone();
  fillMaterial.side = THREE.DoubleSide;
  fillMaterial.flatShading = true;
  const coreMaterial = materials.metal.clone();
  coreMaterial.flatShading = true;

  const rand = random(settings.seed);
  const anchors = spread(settings.nodes, rand);
  const faces = triangulate(anchors);
  const edgeSet = new Map();
  for (const f of faces) for (let k = 0; k < 3; k++) {
    const a = Math.min(f[k], f[(k + 1) % 3]), b = Math.max(f[k], f[(k + 1) % 3]);
    edgeSet.set(`${a}-${b}`, [a, b]);
  }
  const edges = [...edgeSet.values()];
  const filled = faces.filter(() => rand() < settings.fill);

  // Hver node driver rundt hvilepunktet sitt langs kula, i to retninger med
  // hver sin takt, så banene blir myke løkker.
  const reach = settings.drift * Math.sqrt((4 * Math.PI) / settings.nodes);
  const nodes = anchors.map((p) => {
    const u = new THREE.Vector3().crossVectors(p, Math.abs(p.y) < 0.9 ? up : new THREE.Vector3(1, 0, 0)).normalize();
    return {
      p, u, v: new THREE.Vector3().crossVectors(p, u),
      f1: settings.speed * (0.6 + 0.8 * rand()), f2: settings.speed * (0.6 + 0.8 * rand()),
      a1: 2 * Math.PI * rand(), a2: 2 * Math.PI * rand(),
    };
  });
  const positions = anchors.map(() => new THREE.Vector3());

  const nodeSize = settings.nodeSize * scale, edgeWidth = settings.edgeWidth * scale;
  const nodeMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(nodeSize, 16, 12), materials.white, nodes.length);
  const edgeMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(edgeWidth, edgeWidth, 1, 8), materials.metal, edges.length);
  const fillGeometry = new THREE.BufferGeometry();
  fillGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(filled.length * 9), 3));
  const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);
  for (const m of [nodeMesh, edgeMesh, fillMesh]) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    parent.add(m);
  }

  // Kjernen: et skall rundt noen få tilfeldige punkter, så den får store, skjeve fasetter.
  if (settings.core > 0) {
    const corePoints = spread(18, rand).map((p) => p.multiplyScalar(settings.core * R * (0.88 + 0.12 * rand())));
    const core = new THREE.Mesh(new ConvexGeometry(corePoints), coreMaterial);
    core.castShadow = true;
    core.receiveShadow = true;
    parent.add(core);
  }

  const direction = new THREE.Vector3();
  const update = (time) => {
    nodes.forEach((n, i) => {
      positions[i].copy(n.p)
        .addScaledVector(n.u, reach * Math.sin(2 * Math.PI * n.f1 * time + n.a1))
        .addScaledVector(n.v, reach * Math.sin(2 * Math.PI * n.f2 * time + n.a2))
        .setLength(R);
      placer.position.copy(positions[i]);
      placer.quaternion.identity();
      placer.scale.set(1, 1, 1);
      placer.updateMatrix();
      nodeMesh.setMatrixAt(i, placer.matrix);
    });
    edges.forEach(([a, b], i) => {
      direction.subVectors(positions[b], positions[a]);
      placer.position.copy(positions[a]).add(positions[b]).multiplyScalar(0.5);
      placer.scale.set(1, direction.length(), 1);
      placer.quaternion.setFromUnitVectors(up, direction.normalize());
      placer.updateMatrix();
      edgeMesh.setMatrixAt(i, placer.matrix);
    });
    const attr = fillGeometry.attributes.position;
    filled.forEach((f, i) => f.forEach((n, k) => attr.setXYZ(i * 3 + k, positions[n].x, positions[n].y, positions[n].z)));
    attr.needsUpdate = true;
    fillGeometry.computeVertexNormals(); // uten indekser: én normal per fasett
    nodeMesh.instanceMatrix.needsUpdate = true;
    edgeMesh.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return update;
}

// Et mykt, lysende punkt.
function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d');
  const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.15)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gradient;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function addMotionPlexus(parent, settings, R, scale) {
  const rand = random(settings.seed);
  const n = settings.nodes;
  // Hvert punkt vandrer i en sirkel rundt sin egen akse, i sin egen fart.
  const points = Array.from({ length: n }, () => ({
    p: onSphere(rand).multiplyScalar(R * (1 + settings.depth * (2 * rand() - 1))),
    axis: onSphere(rand),
    speed: settings.speed * (0.5 + rand()) * (rand() < 0.5 ? -1 : 1),
  }));
  const now = points.map(() => new THREE.Vector3());
  const linkDistance = settings.linkDistance * R;

  const glow = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false };
  const pointGeometry = new THREE.BufferGeometry();
  pointGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  const dots = new THREE.Points(pointGeometry, new THREE.PointsMaterial({ size: settings.nodeSize * scale, map: glowTexture(), color: '#ffffff', ...glow }));
  dots.frustumCulled = false;
  parent.add(dots);

  const maxLinks = (n * (n - 1)) / 2;
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(maxLinks * 6), 3));
  lineGeometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(maxLinks * 6), 3));
  const lines = new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({ vertexColors: true, ...glow }));
  lines.frustumCulled = false;
  parent.add(lines);

  const q = new THREE.Quaternion();
  const update = (time) => {
    const pos = pointGeometry.attributes.position;
    points.forEach((pt, i) => {
      now[i].copy(pt.p).applyQuaternion(q.setFromAxisAngle(pt.axis, pt.speed * time));
      pos.setXYZ(i, now[i].x, now[i].y, now[i].z);
    });
    pos.needsUpdate = true;
    // Linjer mellom alle som er nær hverandre, svakere jo lenger fra hverandre.
    const lp = lineGeometry.attributes.position, lc = lineGeometry.attributes.color;
    let count = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const d = now[i].distanceTo(now[j]);
      if (d >= linkDistance) continue;
      const s = (1 - d / linkDistance) ** 1.5 * 0.9;
      lp.setXYZ(count * 2, now[i].x, now[i].y, now[i].z);
      lp.setXYZ(count * 2 + 1, now[j].x, now[j].y, now[j].z);
      lc.setXYZ(count * 2, s, s, s);
      lc.setXYZ(count * 2 + 1, s, s, s);
      count++;
    }
    lineGeometry.setDrawRange(0, count * 2);
    lp.needsUpdate = true;
    lc.needsUpdate = true;
  };
  update(0);
  return update;
}
