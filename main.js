// Gen X Soft Club portfolio — 3D project wheel.
// No dependencies, no build step. Ported from the design's React logic
// (PortfolioSite.dc.html on claude.ai/design) to vanilla JS.

const projects = [
  { meta: 'PROJ.01 / 2026 / RUST', title: 'Haze CLI', blurb: 'Turns messy CSVs into clean dashboards, straight from the terminal.', url: '#' },
  { meta: 'PROJ.02 / 2025 / TS', title: 'Platform 9', blurb: 'A tiny realtime engine for ambient wall dashboards.', url: '#' },
  { meta: 'PROJ.03 / 2024 / TS', title: 'Last Train', blurb: 'Transit departure boards for cities you have never lived in.', url: '#' },
];

// The wheel is a 12-sided cylinder: faces every 30°, radius 520px, the
// three projects repeating around it so a card is always approaching.
const FACES = 12;
const STEP = 30;
const RADIUS = 520;

const stage = document.querySelector('.js-stage');
const ring = document.querySelector('.js-ring');
const faceTemplate = document.querySelector('.js-face-template');
const activeMetaEl = document.querySelector('.js-active-meta');
const counterEl = document.querySelector('.js-counter');

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const faces = Array.from({ length: FACES }, (_, i) => {
  const project = projects[i % projects.length];
  const el = faceTemplate.content.firstElementChild.cloneNode(true);
  el.href = project.url;
  el.querySelector('.card__meta').textContent = project.meta;
  el.querySelector('.card__title').textContent = project.title;
  el.querySelector('.card__blurb').textContent = project.blurb;
  el.addEventListener('click', (e) => onFaceClick(e, i));
  ring.append(el);
  return el;
});

let angle = 0;
let raf = null;
let drag = null;
let moved = 0;
let suppressClick = false;
let wheelTimer = null;

// Map an angle to [-180, 180) so faces on the far side stay hidden.
const normalize = (a) => ((a % 360) + 540) % 360 - 180;

function render() {
  faces.forEach((el, i) => {
    const rel = normalize(i * STEP - angle);
    const c = Math.cos(rel * Math.PI / 180);
    // The spec hid faces past 88°, but everything past ±45° is already
    // fully clipped by the stage mask — treating those as hidden too
    // keeps invisible cards out of the keyboard tab order.
    const hidden = Math.abs(rel) > 45;
    el.style.transform = `translate(-50%, -50%) rotateY(${rel}deg) translateZ(${RADIUS}px)`;
    el.style.opacity = hidden ? 0 : 0.25 + 0.75 * Math.max(c, 0);
    el.style.zIndex = 100 + Math.round(c * 100);
    el.style.pointerEvents = hidden ? 'none' : 'auto';
    // Beyond the design: fully hide back faces so keyboards and screen
    // readers never land on an invisible card.
    el.style.visibility = hidden ? 'hidden' : 'visible';
  });

  const front = ((Math.round(angle / STEP) % FACES) + FACES) % FACES;
  const activeIdx = front % projects.length;
  activeMetaEl.textContent = projects[activeIdx].meta;
  counterEl.textContent = `0${activeIdx + 1} / 0${projects.length}`;
}

function cancelAnim() {
  if (raf) {
    cancelAnimationFrame(raf);
    raf = null;
  }
}

function animateTo(target) {
  cancelAnim();
  const from = angle;
  const d = target - from;
  if (Math.abs(d) < 0.01) return;
  if (reducedMotion) {
    angle = target;
    render();
    return;
  }
  const t0 = performance.now();
  const dur = 460;
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    angle = from + d * e;
    render();
    raf = p < 1 ? requestAnimationFrame(tick) : null;
  };
  raf = requestAnimationFrame(tick);
}

// Settle on the nearest face; `extra` carries drag momentum into the snap.
function snap(extra = 0) {
  animateTo(Math.round((angle + extra) / STEP) * STEP);
}

function onFaceClick(e, i) {
  if (suppressClick) {
    e.preventDefault();
    suppressClick = false;
    return;
  }
  const rel = normalize(i * STEP - angle);
  if (Math.abs(rel) > 10) {
    // Side card: rotate it to the front instead of following the link.
    e.preventDefault();
    animateTo(Math.round((angle + rel) / STEP) * STEP);
  }
}

stage.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  cancelAnim();
  stage.classList.add('is-dragging');
  drag = { pointerId: e.pointerId, lastX: e.clientX, v: 0, captured: false };
  moved = 0;
});

stage.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.lastX;
  drag.lastX = e.clientX;
  moved += Math.abs(dx);
  // Capture only once this is clearly a drag. Capturing on pointerdown
  // would make the browser retarget the eventual click to the stage,
  // dead-clicking every card link.
  if (!drag.captured && moved > 5) {
    stage.setPointerCapture(drag.pointerId);
    drag.captured = true;
  }
  const dAngle = -dx * 0.28;
  drag.v = 0.7 * dAngle + 0.3 * drag.v;
  angle += dAngle;
  render();
});

function endDrag() {
  if (!drag) return;
  const v = drag.v;
  drag = null;
  stage.classList.remove('is-dragging');
  // Pointer capture already retargets the post-drag click away from the
  // card in Chrome/Firefox; this flag covers engines that don't.
  if (moved > 5) suppressClick = true;
  snap(v * 7);
}

stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);

// Browsers scroll even overflow:hidden boxes to reveal a focused element,
// which would shear the 3D stage sideways. Pin it.
stage.addEventListener('scroll', () => {
  stage.scrollLeft = 0;
  stage.scrollTop = 0;
});

// Horizontal trackpad swipes spin the wheel; preventDefault stops the
// browser treating them as history-swipe gestures. Vertical scrolling
// passes through untouched.
stage.addEventListener('wheel', (e) => {
  if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
  e.preventDefault();
  cancelAnim();
  angle += e.deltaX * 0.35;
  render();
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(() => snap(), 140);
}, { passive: false });

document.querySelector('.js-prev').addEventListener('click', () => {
  animateTo(Math.round(angle / STEP) * STEP - STEP);
});
document.querySelector('.js-next').addEventListener('click', () => {
  animateTo(Math.round(angle / STEP) * STEP + STEP);
});

render();
