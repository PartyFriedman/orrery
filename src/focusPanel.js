// Panelet øverst på midten når en kropp er valgt: navnet, og plass til mer
// (.focus-info) senere. Samme stil som fartspanelet; stilen ligger i style.css.
import { look } from './config.js';

const title = (name) => name.charAt(0).toUpperCase() + name.slice(1);

export function createFocusPanel() {
  const panel = document.createElement('div');
  panel.className = 'focus-panel';
  panel.style.setProperty('--metal', look.seamColor);
  panel.style.setProperty('--white', look.gearColor);
  panel.setAttribute('aria-live', 'polite');
  const head = document.createElement('div');
  head.className = 'focus-head';
  const nameLabel = document.createElement('span');
  nameLabel.className = 'focus-name';
  head.append(nameLabel);
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
  };
}
