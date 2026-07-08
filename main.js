// Gen X Soft Club portfolio — 3D project wheel.
// No dependencies, no build step. Ported from the design's React logic
// (PortfolioSite.dc.html on claude.ai/design) to vanilla JS.

const projects = [
  { meta: 'PROJ.01 / 2026 / RUST', title: 'Haze CLI', blurb: 'Turns messy CSVs into clean dashboards, straight from the terminal.', url: '#' },
  { meta: 'PROJ.02 / 2025 / TS', title: 'Platform 9', blurb: 'A tiny realtime engine for ambient wall dashboards.', url: '#' },
  { meta: 'PROJ.03 / 2024 / TS', title: 'Last Train', blurb: 'Transit departure boards for cities you have never lived in.', url: '#' },
];

// The wheel is a 12-sided cylinder: faces every 30°, the three projects
// repeating around it so a card is always approaching.
const FACES = 12;
const STEP = 30;
// Design depth is 520px; the wheel is drawn at a uniform --wheel-scale so it
// fits shorter laptops without clipping the enlarged card. RADIUS is the scaled
// depth used per frame, kept in lockstep with the CSS ring translateZ (which is
// `-520px * var(--wheel-scale)`) so the 3D front-card registration stays exact.
const BASE_RADIUS = 520;
let RADIUS = BASE_RADIUS;

const stage = document.querySelector('.js-stage');
const ring = document.querySelector('.js-ring');
const faceTemplate = document.querySelector('.js-face-template');
const activeMetaEl = document.querySelector('.js-active-meta');
const counterEl = document.querySelector('.js-counter');

// The enlarged preview above the wheel: a clone of just the .card (no .face
// anchor, so it never becomes a tab stop), refilled from `projects` on settle.
const previewEl = document.querySelector('.js-preview');
const previewCard = faceTemplate.content.querySelector('.card').cloneNode(true);
previewEl.append(previewCard);

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

// Which project sits at the front of the wheel right now.
function frontActiveIdx() {
  const front = ((Math.round(angle / STEP) % FACES) + FACES) % FACES;
  return front % projects.length;
}

function fillCard(cardEl, p) {
  cardEl.querySelector('.card__meta').textContent = p.meta;
  cardEl.querySelector('.card__title').textContent = p.title;
  cardEl.querySelector('.card__blurb').textContent = p.blurb;
}

// Reveal the enlarged preview on the settled project: swap content (while it's
// still tucked/hidden) then rise it back up. Called only when the wheel settles,
// and every motion tucks the card first, so this is where "show" lives. Removing
// the class can't silently no-op — the card is visible by default (fail-visible),
// the inverse of the reflow-replay trick that broke this in Safari.
function settlePreview() {
  fillCard(previewCard, projects[frontActiveIdx()]);
  previewCard.classList.remove('is-tucked');
}

// Tuck the card away the instant the wheel starts moving; it stays hidden until
// the next settle re-reveals it. The CSS transition does the slide + fade.
function hidePreview() {
  if (reducedMotion) return;               // reduced motion: never hide, just swap on settle
  previewCard.classList.add('is-tucked');  // idempotent: re-adding an existing class is a no-op
}

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

  const activeIdx = frontActiveIdx();
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
  if (Math.abs(d) < 0.01) {
    settlePreview();
    return;
  }
  if (Math.abs(d) > 0.5) hidePreview();  // ‹ ›, side-card, drag-release snap → tuck before spinning
  if (reducedMotion) {
    angle = target;
    render();
    settlePreview();
    return;
  }
  const t0 = performance.now();
  const dur = 460;
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    angle = from + d * e;
    render();
    if (p < 1) {
      raf = requestAnimationFrame(tick);
    } else {
      raf = null;
      settlePreview();
    }
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
    hidePreview();   // it's a real drag now → tuck the card
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
  hidePreview();   // trackpad spin → tuck; the 140ms debounce re-reveals on settle
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

// Size the wheel so its landscape golden (φ:1) front face fills the inner golden
// rectangle of the design's golden-ratio reference, and tracks the window on resize.
// The scale drives both the CSS geometry (--wheel-scale → stage/perspective/ring/
// face sizes) and the JS depth (RADIUS), so the 3D registration stays exact.
//   goldenScale = FACE_FRACTION * (contain-fit golden rect width) / face base width
// That golden target is then CAPPED by the room the kept enlarged preview card needs
// (previewFit), so the preview never clips / the page never scrolls. Floored so the
// wheel never shrinks to a token; ceilinged so the face can grow past its base on
// large monitors instead of freezing (the old Math.min(1, …) did the latter).
const WHEEL_STAGE_BASE = 320;
const WHEEL_MIN_SCALE = 0.62;
const WHEEL_MAX_SCALE = 1.6;      // let the front face grow past its base on big screens
const PHI = 1.6180339887498949;   // golden ratio (mirrors styles.css --phi)
const WHEEL_FACE_BASE = 250;      // mirrors the .face width base in styles.css (like BASE_RADIUS ↔ 520)
const FACE_FRACTION = 0.174;      // size knob: front-face width ÷ contain-fit golden-rect width
// Fixed vertical costs outside the stage and the measured card: hero v-padding (80)
// + the --block-top shared-top offset (90) + preview padding (8) + controls (~48).
const WHEEL_CHROME = 226;

function applyWheelScale() {
  // The design sandbox (index.html?sandbox) freezes the wheel while you drag/scale
  // it; re-fitting then would fight the sandbox's transform. hasAttribute (not
  // dataset.arrange, which is falsy when empty) guards it. No-op in production.
  if (document.documentElement.hasAttribute('data-arrange')) return;
  // Contain-fit a φ:1 golden rectangle to the viewport (touches top/bottom or the
  // sides, whichever first), then set the front face to a fixed fraction of its width.
  const rectW = Math.min(window.innerWidth, window.innerHeight * PHI);
  const goldenScale = (FACE_FRACTION * rectW) / WHEEL_FACE_BASE;
  // Cap by the room the kept enlarged preview card needs, so it never clips / scrolls.
  const cardH = previewCard.getBoundingClientRect().height;
  const previewFit = (window.innerHeight - WHEEL_CHROME - cardH) / WHEEL_STAGE_BASE;
  const scale = Math.max(WHEEL_MIN_SCALE, Math.min(WHEEL_MAX_SCALE, Math.min(goldenScale, previewFit)));
  document.documentElement.style.setProperty('--wheel-scale', scale.toFixed(4));
  RADIUS = BASE_RADIUS * scale;
}

// Fill the enlarged card first so applyWheelScale() measures its real height, then
// size the wheel to it and lay out the faces at the resulting depth.
settlePreview();
applyWheelScale();
render();

// Re-fit on resize / rotate; render() re-lays the faces at the new depth.
addEventListener('resize', () => { applyWheelScale(); render(); });

// The card's height shifts once the web fonts load (title/blurb reflow); re-measure
// then so the wheel is sized against the real card, not the fallback-font one.
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { applyWheelScale(); render(); });
}

// Theme control: two native radios select light/dark. Applying = set data-theme on
// <html> and persist. The initial theme is set pre-paint by the head script; here we
// just check the matching radio and react to changes. localStorage key 'theme' is
// shared with the head script.
const themeRadios = document.querySelectorAll('.js-theme-radio');

function syncThemeControl() {
  const theme = document.documentElement.dataset.theme;
  themeRadios.forEach((radio) => { radio.checked = radio.value === theme; });
}

themeRadios.forEach((radio) => {
  radio.addEventListener('change', () => {
    if (!radio.checked) return;
    document.documentElement.dataset.theme = radio.value;
    localStorage.setItem('theme', radio.value);
  });
});

syncThemeControl();

// CRT power: a native checkbox toggles the phosphor overlay. Same shape as the
// theme control — the initial state is applied pre-paint by the head script
// (data-crt on <html>, localStorage key 'crt', default on); here we sync the
// checkbox to it and persist changes.
const crtToggle = document.querySelector('.js-crt-toggle');

function syncCrtControl() {
  crtToggle.checked = document.documentElement.dataset.crt !== 'off';
}

crtToggle.addEventListener('change', () => {
  const state = crtToggle.checked ? 'on' : 'off';
  document.documentElement.dataset.crt = state;
  localStorage.setItem('crt', state);
});

syncCrtControl();
