// Fokus på en kropp: kameraet glir over til den og følger den, og man kan
// fortsatt dreie og zoome rundt den med OrbitControls. Tallene står i focus i
// config.js.
//
// Følge: hvert bilde, etter at delene har fått sine vinkler og før
// controls.update(), flyttes målet og kameraet like langt som kroppen har
// flyttet seg siden forrige bilde. Kroppen står da helt rolig i bildet, uansett
// fart, og ingenting henger etter. Panorering (høyre knapp) virker også med en
// kropp i fokus: målet blir liggende der man drar det, og følger kroppen
// derfra, så man kan gå langs drivverket. Velg kroppen igjen for å sentrere.
// Overgangen: målet glir dit kroppen er nå (den kan bevege seg underveis), og
// avstanden glir logaritmisk til den som gjør at kula fyller focus.fill av den
// korteste skjermsiden. Retningen beholdes, så man kan dreie underveis. Zoomer
// man under overgangen, slutter avstanden å gli.
// Uten valg (null) glir målet, retningen og avstanden tilbake til home.
import * as THREE from 'three';
import { focus as F } from './config.js';

const ease = (t) => t * t * (3 - 2 * t); // myk start og slutt

// bodies: { navn: { object, radius } }. home: { target, position } (startbildet).
export function createFocus({ camera, controls, bodies, home }) {
  let selected = null;
  let glide = null; // overgangen som pågår
  const goal = new THREE.Vector3();
  const followed = new THREE.Vector3(); // der kroppen var forrige bilde
  const offset = new THREE.Vector3();
  const turn = new THREE.Quaternion();
  const noTurn = new THREE.Quaternion();

  // Avstanden der kula fyller F.fill av den korteste skjermsiden.
  const distanceFor = (name) => {
    const r = bodies[name].radius * (F.size?.[name] ?? 1);
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const tanMin = Math.min(tanV, tanV * camera.aspect);
    return r / Math.sin(Math.atan(F.fill * tanMin));
  };

  // Zoomer man under overgangen (hjulet eller to fingre), slutter avstanden å gli.
  const dom = controls.domElement;
  const stopZoom = () => { if (glide) glide.zoom = false; };
  const touches = new Set();
  dom.addEventListener('wheel', stopZoom, { passive: true });
  dom.addEventListener('pointerdown', (e) => { touches.add(e.pointerId); if (touches.size > 1) stopZoom(); });
  dom.addEventListener('pointerup', (e) => touches.delete(e.pointerId));
  dom.addEventListener('pointercancel', (e) => touches.delete(e.pointerId));

  function select(name) {
    if (!bodies[name] || name === 'sun') name = null;
    selected = name;
    const from = offset.subVectors(camera.position, controls.target);
    glide = {
      t: 0,
      zoom: true,
      fromTarget: controls.target.clone(),
      fromDistance: from.length(),
      toDistance: name ? distanceFor(name) : home.position.distanceTo(home.target),
      fromDir: from.clone().normalize(),
      toDir: name ? null : home.position.clone().sub(home.target).normalize(), // tilbake: retningen glir også
    };
    // Med en kropp i fokus: ikke inn i kula.
    controls.minDistance = name ? bodies[name].radius * 1.3 : 0;
  }

  // seconds: vanlig tid siden forrige bilde.
  function update(seconds) {
    const target = controls.target;
    if (selected) bodies[selected].object.getWorldPosition(goal);
    else goal.copy(home.target);

    if (glide) {
      glide.t = Math.min(1, glide.t + seconds / F.glide);
      const e = ease(glide.t);
      offset.subVectors(camera.position, target);
      const current = offset.length();
      const dir = offset.normalize();
      if (glide.toDir) {
        turn.setFromUnitVectors(glide.fromDir, glide.toDir);
        dir.copy(glide.fromDir).applyQuaternion(noTurn.identity().slerp(turn, e));
      }
      const distance = glide.zoom ? glide.fromDistance * Math.pow(glide.toDistance / glide.fromDistance, e) : current;
      target.lerpVectors(glide.fromTarget, goal, e);
      camera.position.copy(target).addScaledVector(dir, distance);
      if (glide.t >= 1) glide = null;
    } else if (selected) {
      // Følg kroppen: målet og kameraet like langt som den har flyttet seg
      // (målet kan være panorert bort fra den).
      offset.subVectors(goal, followed);
      target.add(offset);
      camera.position.add(offset);
    }
    followed.copy(goal);

    // Nærplanet etter avstanden, så man kan komme tett inntil små måner.
    const near = THREE.MathUtils.clamp(camera.position.distanceTo(target) * 0.05, 0.02, 1);
    if (near !== camera.near) {
      camera.near = near;
      camera.updateProjectionMatrix();
    }
  }

  return { select, update, get selected() { return selected; } };
}
