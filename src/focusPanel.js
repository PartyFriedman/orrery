// Panelet øverst på midten når en kropp er valgt: navnet, bryteren «Drive»
// (bare drivet til kroppen vises, driveView.js), en ×-knapp som går tilbake til
// sola (startbildet), og plass til mer (.focus-info) senere. Samme stil som
// fartspanelet; stilen ligger i style.css.
import { look, accent } from './config.js';

const title = (name) => name.charAt(0).toUpperCase() + name.slice(1);

// onClose: kalles når man trykker på ×. onDrive(på): når bryteren slås av eller på.
export function createFocusPanel({ onClose, onDrive }) {
  const panel = document.createElement('div');
  panel.className = 'focus-panel';
  panel.style.setProperty('--metal', look.seamColor);
  panel.style.setProperty('--white', look.gearColor);
  panel.style.setProperty('--accent', accent.color);
  const head = document.createElement('div');
  head.className = 'focus-head';
  const nameLabel = document.createElement('span');
  nameLabel.className = 'focus-name';
  nameLabel.setAttribute('aria-live', 'polite');

  // Bryteren: en knapp med role="switch", stor nok til en finger.
  const drive = document.createElement('button');
  drive.type = 'button';
  drive.className = 'focus-drive';
  drive.setAttribute('role', 'switch');
  drive.setAttribute('aria-checked', 'false');
  drive.title = 'Show only the drive to this body';
  const track = document.createElement('span');
  track.className = 'focus-drive-track';
  track.append(document.createElement('span'));
  drive.append(track, 'Drive');
  let driveOn = false;
  const setDrive = (on) => {
    driveOn = on;
    drive.setAttribute('aria-checked', String(on));
  };
  drive.addEventListener('click', () => {
    setDrive(!driveOn);
    onDrive(driveOn);
  });

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'focus-close';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Back to overview');
  close.addEventListener('click', () => onClose());
  head.append(nameLabel, drive, close);
  const info = document.createElement('div');
  info.className = 'focus-info';
  panel.append(head, info);
  document.body.appendChild(panel);

  return {
    // name: kroppen som er valgt, eller null (panelet tones ut med navnet stående).
    show(name) {
      if (name) nameLabel.textContent = title(name);
      panel.classList.toggle('shown', Boolean(name));
    },
    // Stiller bryteren uten å kalle onDrive.
    setDrive,
  };
}
