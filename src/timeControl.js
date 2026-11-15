// Glidebryteren for tid nede på siden: datoen til venstre, farten til høyre.
// Helt til venstre står tiden stille; ellers går skalaen logaritmisk fra
// time.slowest til time.fastest (dager per sekund), så både sakte og fort
// lar seg styre fint. Fargene kommer fra look i config.

import { time, look } from './config.js';

const STEPS = 1000;

export function createTimeControl() {
  const { slowest, fastest, start } = time;
  if (!(slowest > 0 && fastest > slowest)) {
    throw new Error('time.slowest må være over 0, og time.fastest større enn time.slowest.');
  }
  if (!(start === 0 || (start >= slowest && start <= fastest))) {
    throw new Error('time.start må være 0, eller mellom time.slowest og time.fastest.');
  }

  const span = Math.log(fastest / slowest);
  const speedAt = (step) => (step <= 0 ? 0 : slowest * Math.exp((span * (step - 1)) / (STEPS - 1)));
  const stepFor = (speed) => (speed <= 0 ? 0 : Math.round(1 + ((STEPS - 1) * Math.log(speed / slowest)) / span));

  const panel = document.createElement('div');
  panel.className = 'time-control';
  panel.style.setProperty('--metal', look.seamColor);
  panel.style.setProperty('--white', look.gearColor);

  const dateLabel = document.createElement('output');
  dateLabel.className = 'time-date';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = String(STEPS);
  slider.step = '1';
  slider.value = String(stepFor(start));
  slider.setAttribute('aria-label', 'Speed of time');
  const speedLabel = document.createElement('output');
  speedLabel.className = 'time-speed';
  panel.append(dateLabel, slider, speedLabel);
  document.body.appendChild(panel);

  // Startfarten gjelder nøyaktig til glidebryteren flyttes.
  let speed = start;
  const showSpeed = () => {
    let text = 'paused';
    if (speed >= 365) text = `${(speed / 365.25).toFixed(1)} yr/s`;
    else if (speed >= 10) text = `${Math.round(speed)} days/s`;
    else if (speed > 0) text = `${Number(speed.toPrecision(2))} days/s`;
    speedLabel.textContent = text;
    slider.setAttribute('aria-valuetext', text);
  };
  slider.addEventListener('input', () => {
    speed = speedAt(Number(slider.value));
    showSpeed();
  });
  showSpeed();

  const format = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  let shown = '';
  return {
    daysPerSecond: () => speed,
    show(date) {
      const text = format.format(date);
      if (text !== shown) dateLabel.textContent = shown = text;
    },
  };
}
