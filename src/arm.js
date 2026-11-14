import * as THREE from 'three';
import { extrudeFlat } from './gear.js';

// Punktet der en linje fra p tangerer sirkelen (sentrum c, radius r).
// side = -1 eller +1 velger hvilken av de to tangentene.
function tangentPoint(p, c, r, side) {
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const angle = Math.atan2(dy, dx) + side * Math.acos(Math.min(1, r / Math.hypot(dx, dy)));
  return new THREE.Vector2(c.x + r * Math.cos(angle), c.y + r * Math.sin(angle));
}

// Det flate omrisset av en arm langs +x, fra et nav i origo ut til `length`.
// Armen er rootHalf bred (halvbredde) ved navet og smalner av til en rund ende
// med radius endRadius. Kantene er rette linjer som tangerer den runde enden.
// Inn mot navet bøyer kantene seg ut og møter navsirkelen på skrå, så
// overgangen blir myk. Kurven tangerer både armkanten og navsirkelen.
export function createArmShape({ length, hubRadius, rootHalf, endRadius, fillet }) {
  const tip = new THREE.Vector2(length, 0);
  const root = new THREE.Vector2(hubRadius, rootHalf);
  const flankEnd = tangentPoint(root, tip, endRadius, -1);
  const flank = flankEnd.clone().sub(root);
  const along = flank.clone().normalize();
  const reach = Math.min(fillet, flank.length() * 0.45 / 2); // overgangen kan ikke ta hele armen
  const control = root.clone().addScaledVector(along, reach);
  const flankStart = root.clone().addScaledVector(along, 2 * reach);
  const onHub = tangentPoint(control, new THREE.Vector2(0, 0), hubRadius, 1);
  const endAngle = Math.atan2(flankEnd.y, flankEnd.x - length);

  const mirror = (v) => new THREE.Vector2(v.x, -v.y);
  const shape = new THREE.Shape();
  shape.moveTo(onHub.x, -onHub.y);
  shape.quadraticCurveTo(control.x, -control.y, flankStart.x, -flankStart.y);
  shape.lineTo(mirror(flankEnd).x, mirror(flankEnd).y);
  shape.absarc(length, 0, endRadius, -endAngle, endAngle, false);
  shape.lineTo(flankStart.x, flankStart.y);
  shape.quadraticCurveTo(control.x, control.y, onHub.x, onHub.y);
  shape.closePath(); // tvers over innsiden av navet, som dekker det
  return shape;
}

// Armen som 3D-geometri: ligger flatt med undersiden på y = 0.
export function createArmGeometry(settings) {
  return extrudeFlat(createArmShape(settings), settings.thickness, settings.chamfer);
}
