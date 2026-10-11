// Golden-spiral reference overlay — a visitor-facing easter egg, always loaded
// from index.html. Hidden by default; a small hint in the golden rectangle's
// bottom-left corner tells keyboard users to press S to reveal it.
//
// Unlike the old draggable sandbox spiral, this one is LOCKED to the page: it is
// drawn from the SAME contain-fit golden rectangle main.js composes the layout
// against, so the spiral's R4 "eye" lands on the wheel's front face. Mirroring
// reflects it about the page centre — H+V lands the eye on the hero copy.
// Palette matches the original sandbox overlay: pink squares, gold spiral line.
//
// Keyboard-only (the corner hint lists the keys, and only on hover-capable devices):
//   S        — toggle the overlay on/off
//   H / V    — mirror the arrangement horizontally / vertically (replace)
//   ⇧H / ⇧V  — OVERLAY a mirrored copy on top (stack up to the 4 quadrant eyes)
//   (reload the page to reset the stack to a single spiral)
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const PHI = 1.6180339887498949;   // golden ratio (mirrors styles.css --phi / main.js PHI)

  // ---- geometry: identical to main.js so the overlay tracks the real layout ----

  // Contain-fit a φ:1 rectangle to the viewport (touches top/bottom or the sides,
  // whichever first), centred. Same as placeWheel()'s W/H/ox/oy. The rect centre
  // is always the viewport centre, so the mirrors reflect about (innerW/2, innerH/2).
  function containRect() {
    const W = Math.min(innerWidth, innerHeight * PHI);
    const H = W / PHI;
    return { ox: (innerWidth - W) / 2, oy: (innerHeight - H) / 2, W, H };
  }

  // Whirling-squares golden spiral over rect (x,y,w,h): cut a square off the
  // LEFT, TOP, RIGHT, then BOTTOM in turn, recording each square and its
  // inscribed quarter-arc. Same cut order as main.js residualRect(), so the arc
  // after 4 cuts converges on the wheel's eye. (Ported from the old sandbox.)
  function goldenSpiral(x, y, w, h, n) {
    const squares = [], arcs = [];
    for (let i = 0; i < n; i++) {
      const s = Math.min(w, h);
      let sq, sx, sy, ex, ey;
      switch (i % 4) {
        case 0: sq = { x, y, s }; sx = x;     sy = y + s; ex = x + s;     ey = y;         x += s; w -= s; break; // LEFT
        case 1: sq = { x, y, s }; sx = x;     sy = y;     ex = x + s;     ey = y + s;     y += s; h -= s; break; // TOP
        case 2: sq = { x: x + w - s, y, s }; sx = x + w; sy = y; ex = x + w - s; ey = y + s;     w -= s; break; // RIGHT
        default: sq = { x, y: y + h - s, s }; sx = x + s; sy = y + h; ex = x; ey = y + h - s;    h -= s; break; // BOTTOM
      }
      squares.push(sq);
      arcs.push({ sx, sy, ex, ey, r: s });
    }
    return { squares, arcs };
  }

  // ---- SVG scaffold ----
  const svgEl = (name, attrs) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };

  const overlay = svgEl('svg', { class: 'sp-overlay' });
  const gRoot = svgEl('g', { class: 'sp-root' });
  overlay.append(gRoot);

  // ---- state (session-only, no persistence) ----
  // `orientations` is the set of mirror states currently shown, each {sx, sy}
  // with sx/sy ∈ {1,-1}. One spiral is drawn per orientation. There are only 4
  // possible, so the stack tops out at the full four-fold golden rosette.
  let on = false;
  let orientations = [{ sx: 1, sy: 1 }];

  const keyOf = (o) => `${o.sx},${o.sy}`;
  const dedupe = (list) => {
    const seen = new Map();
    for (const o of list) seen.set(keyOf(o), o);
    return [...seen.values()];
  };
  // Reflect every current orientation across the H or V axis.
  const reflected = (axis) =>
    orientations.map((o) => axis === 'h' ? { sx: -o.sx, sy: o.sy } : { sx: o.sx, sy: -o.sy });

  // Build one spiral (whirling squares + arc) in viewport coords — same for every
  // orientation; the per-orientation <g> supplies the flip transform.
  function buildSpiral() {
    const frag = document.createDocumentFragment();
    const { ox, oy, W, H } = containRect();
    const { squares, arcs } = goldenSpiral(ox, oy, W, H, 9);
    const grid = svgEl('g', { class: 'sp-grid' });
    for (const sq of squares) grid.append(svgEl('rect', { x: sq.x, y: sq.y, width: sq.s, height: sq.s }));
    frag.append(grid);
    let d = `M ${arcs[0].sx} ${arcs[0].sy}`;
    for (const a of arcs) d += ` A ${a.r} ${a.r} 0 0 1 ${a.ex} ${a.ey}`;
    frag.append(svgEl('path', { class: 'sp-spiral', d }));
    return frag;
  }

  const flipStr = (o) => {
    const cx = innerWidth / 2, cy = innerHeight / 2;
    return `translate(${cx} ${cy}) scale(${o.sx} ${o.sy}) translate(${-cx} ${-cy})`;
  };

  // Redraw the whole overlay: one flipped spiral group per active orientation.
  // Rebuilt on every change/resize (the layout is fully dynamic, so must this be).
  function draw() {
    overlay.setAttribute('width', innerWidth);
    overlay.setAttribute('height', innerHeight);
    overlay.setAttribute('viewBox', `0 0 ${innerWidth} ${innerHeight}`);
    gRoot.textContent = '';
    for (const o of orientations) {
      const g = svgEl('g', { transform: flipStr(o) });
      g.append(buildSpiral());
      gRoot.append(g);
    }
  }

  // Corner hint: when the overlay is off it only teases the S key; once it's on
  // it lists the mirror keys too (they do nothing while it's hidden).
  const hint = document.createElement('div');
  hint.className = 'sp-hint';
  hint.setAttribute('aria-hidden', 'true');

  function apply() {
    overlay.style.display = on ? '' : 'none';
    hint.textContent = on ? 'S hide · H/V mirror · ⇧H/⇧V stack' : 'Press S · golden spiral';
  }

  // ---- keyboard control ----
  //   H / V   → reflect all, REPLACE (flip the arrangement)
  //   ⇧H / ⇧V → reflect all, UNION (overlay a mirrored copy)
  addEventListener('keydown', (e) => {
    if (/^(input|textarea|select)$/i.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === 's') { on = !on; apply(); return; }
    if (k !== 'h' && k !== 'v') return;
    const axis = k;
    orientations = dedupe(e.shiftKey ? orientations.concat(reflected(axis)) : reflected(axis));
    draw();
  });
  addEventListener('resize', draw);

  // ---- injected styles (self-contained: no extra CSS file) ----
  // Palette mirrors the original sandbox overlay: pink whirling squares, gold
  // spiral line, both non-scaling so stroke weight stays constant. Always full
  // opacity (no fade). z 900 keeps it above the CRT layers as a crisp reference.
  // The hint mirrors the top-right .controls: same golden-rect inset (main.js
  // --controls-x/-y), label type and z 50, so the CRT layers texture it too.
  const style = document.createElement('style');
  style.textContent = `
    .sp-overlay { position: fixed; inset: 0; z-index: 900; pointer-events: none; overflow: visible; }
    .sp-grid rect { fill: none; stroke: #ff5db1; stroke-width: 1; vector-effect: non-scaling-stroke; }
    .sp-spiral {
      fill: none; stroke: #ffd23f; stroke-width: 2; stroke-linecap: round;
      vector-effect: non-scaling-stroke;
    }
    .sp-hint {
      position: fixed;
      left: calc(var(--controls-x, 20px) + 14px);
      bottom: calc(var(--controls-y, 20px) + 14px);
      z-index: 50;
      transform: scale(var(--wheel-scale));
      transform-origin: bottom left;
      pointer-events: none;
      font-family: var(--font-mono);
      font-size: var(--text-micro);
      letter-spacing: var(--track-label);
      text-transform: uppercase;
      color: var(--text-label);
      opacity: 0.6;
    }
    :root[data-theme="dark"] .sp-hint { color: rgba(244, 248, 251, 0.9); }
    @media (hover: none) { .sp-hint { display: none; } }
  `;

  function init() {
    document.head.append(style);
    document.body.append(overlay, hint);
    draw();
    apply();
    console.log('%c[spiral]%c  S toggle · H/V mirror · ⇧H/⇧V overlay a mirrored copy',
      'color:#ffd23f;font-weight:700', 'color:inherit');
  }
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', init);
  else init();
})();
