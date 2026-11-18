// Klikk eller trykk på en kule. Et klikk er én peker som nesten ikke flyttet
// seg (focus.clickMove) og ble sluppet raskt (focus.clickTime), så et dra
// (dreie) eller to fingre (zoome) blir aldri et valg.
// Treffet regnes på skjermen: hver kule har et treffområde som er minst
// focus.hitRadius piksler, så små måner kan treffes med en finger på alle
// avstander. Treffer pekeren selve kula, vinner den som er nærmest kameraet;
// ellers den som er nærmest pekeren.
import * as THREE from 'three';
import { focus } from './config.js';

const world = new THREE.Vector3();
const ndc = new THREE.Vector3();

// bodies: { navn: { object, radius } }. onPick(navn) kalles ved klikk på en kule.
export function createPicking(camera, dom, bodies, onPick) {
  // Navnet på kula under punktet (x, y) i piksler i lerretet, eller undefined.
  function bodyAt(x, y) {
    const rect = dom.getBoundingClientRect();
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    let inside = null, near = null;
    for (const [name, b] of Object.entries(bodies)) {
      b.object.getWorldPosition(world);
      const distance = world.distanceTo(camera.position);
      const r = b.radius * (focus.size?.[name] ?? 1);
      if (distance <= r) continue;
      ndc.copy(world).project(camera);
      if (ndc.z < -1 || ndc.z > 1) continue; // bak kameraet
      const sx = ((ndc.x + 1) / 2) * rect.width;
      const sy = ((1 - ndc.y) / 2) * rect.height;
      const px = (Math.tan(Math.asin(r / distance)) / tanHalf) * (rect.height / 2); // radiusen på skjermen
      const d = Math.hypot(x - sx, y - sy);
      if (d <= px) {
        if (!inside || distance < inside.distance) inside = { name, distance };
      } else if (d <= focus.hitRadius && (!near || d < near.d)) {
        near = { name, d };
      }
    }
    return (inside ?? near)?.name;
  }
  const at = (e) => {
    const rect = dom.getBoundingClientRect();
    return bodyAt(e.clientX - rect.left, e.clientY - rect.top);
  };

  // Pekerne som er nede nå, og gesten som startet med den første.
  const down = new Set();
  let gesture = null;
  dom.addEventListener('pointerdown', (e) => {
    down.add(e.pointerId);
    if (down.size === 1) {
      gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, click: e.button === 0 };
    } else if (gesture) {
      gesture.click = false; // to fingre: zoom, ikke klikk
    }
  });
  dom.addEventListener('pointermove', (e) => {
    if (gesture?.id === e.pointerId && Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) > focus.clickMove) {
      gesture.click = false;
    }
    // Med mus: en hånd over kulene, så man ser at de kan klikkes.
    if (e.pointerType === 'mouse' && down.size === 0) dom.style.cursor = at(e) ? 'pointer' : '';
  });
  const end = (e, cancelled) => {
    down.delete(e.pointerId);
    if (gesture?.id !== e.pointerId) return;
    const g = gesture;
    gesture = null;
    if (cancelled || !g.click || down.size > 0 || e.timeStamp - g.t > focus.clickTime) return;
    const name = at(e);
    if (name) onPick(name);
  };
  dom.addEventListener('pointerup', (e) => end(e, false));
  dom.addEventListener('pointercancel', (e) => end(e, true));
}
