// Design sandbox — only runs when index.html is opened with ?sandbox.
// Layers "arrange mode" (drag + uniform-scale the three major blocks) and a
// golden-ratio / Fibonacci reference overlay onto the REAL live page, then
// exports the resulting composition as translatable numbers. No dependencies.
//
// The three real blocks are never cloned: the sandbox only reads their
// getBoundingClientRect() and writes their inline style (to pin/scale them).
// One guarded line in main.js (applyWheelScale) freezes the wheel while we
// arrange it; see the plan for why.
'use strict';

(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const html = document.documentElement;
  const PHI = 1.6180339887498949;

  // The movable blocks. Order matters only for the export column summary.
  const DEFS = [
    { key: 'copy', sel: '.hero__copy', label: 'Hero copy', accent: '#39d0ff' },
    { key: 'wheel', sel: '#work', label: 'Wheel', accent: '#ff6ad5' },
    { key: 'controls', sel: '.controls', label: 'Toggles', accent: '#7cff6b' },
  ];

  let root, toolbar, fibSvg, fibGroup, fibHit, toast;
  let arranging = false;
  let heroRef = null; // .hero rect snapshotted at arrange-entry (it collapses once children are pinned)
  const blocks = [];  // { def, el, overlay, handle, label, base:{w,h}, pin:{left,top,scale} }
  const fib = { on: false, move: false, tx: 0, ty: 0, f: 1, deg: 0, flipH: false, flipV: false, opacity: 0.55 };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const r0 = (n) => Math.round(n);
  const r2 = (n) => Math.round(n * 100) / 100;
  const r3 = (n) => Math.round(n * 1000) / 1000;
  const r4 = (n) => Math.round(n * 10000) / 10000;
  const pct = (part, whole) => whole ? r2(part / whole * 100) : 0;

  function init() {
    root = document.createElement('div');
    root.id = 'sandbox-root';
    buildFib();
    buildToolbar();
    buildOverlays();
    document.body.append(root);
    addEventListener('resize', () => { updateReadout(); });
    updateToolbar();
    updateReadout();
  }

  // ---- Toolbar ---------------------------------------------------------

  let els = {};

  function buildToolbar() {
    toolbar = document.createElement('div');
    toolbar.className = 'sbx-toolbar';
    toolbar.innerHTML = `
      <h2>Design sandbox</h2>
      <div class="sbx-row">
        <button class="sbx-btn" data-act="arrange">Arrange: off</button>
      </div>
      <div class="sbx-row">
        <button class="sbx-btn" data-act="fib">Spiral: off</button>
        <button class="sbx-btn" data-act="copy">Copy layout</button>
      </div>
      <div class="sbx-fib-controls">
        <div class="sbx-field"><span>Scale</span><input type="range" data-fib="f" min="0.2" max="3" step="0.01" value="1"><output>1.00</output></div>
        <div class="sbx-field"><span>Rotate</span><input type="range" data-fib="deg" min="0" max="360" step="1" value="0"><output>0&deg;</output></div>
        <div class="sbx-field"><span>Fade</span><input type="range" data-fib="opacity" min="0.05" max="1" step="0.05" value="0.55"><output>0.55</output></div>
        <div class="sbx-row sbx-row--wrap">
          <label class="sbx-check"><input type="checkbox" data-fib="flipH"> Flip H</label>
          <label class="sbx-check"><input type="checkbox" data-fib="flipV"> Flip V</label>
          <label class="sbx-check"><input type="checkbox" data-fib="move"> Move</label>
          <button class="sbx-btn" data-act="rot90" style="flex:0 0 auto;padding:3px 8px">+90&deg;</button>
        </div>
      </div>
      <div class="sbx-readout"><span data-el="vp">0 &times; 0</span><span data-el="mode">idle</span></div>
      <div class="sbx-hint">Arrange: drag a block to move, drag its corner to scale (uniform). Spiral: a golden-ratio reference — tick Move to drag it.</div>
    `;
    root.append(toolbar);

    els.arrange = toolbar.querySelector('[data-act="arrange"]');
    els.fib = toolbar.querySelector('[data-act="fib"]');
    els.fibControls = toolbar.querySelector('.sbx-fib-controls');
    els.vp = toolbar.querySelector('[data-el="vp"]');
    els.mode = toolbar.querySelector('[data-el="mode"]');

    els.arrange.addEventListener('click', () => (arranging ? exitArrange() : enterArrange()));
    els.fib.addEventListener('click', () => { fib.on = !fib.on; applyFib(); updateToolbar(); });
    toolbar.querySelector('[data-act="copy"]').addEventListener('click', exportLayout);
    toolbar.querySelector('[data-act="rot90"]').addEventListener('click', () => {
      fib.deg = (fib.deg + 90) % 360;
      const rng = toolbar.querySelector('[data-fib="deg"]');
      rng.value = fib.deg;
      rng.nextElementSibling.textContent = fib.deg + '°';
      applyFib();
    });

    // Drag the panel by its header so it never blocks the block you're arranging.
    const grip = toolbar.querySelector('h2');
    grip.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const rect = toolbar.getBoundingClientRect();
      const ox = e.clientX - rect.left, oy = e.clientY - rect.top;
      onDrag((ev) => {
        toolbar.style.left = (ev.clientX - ox) + 'px';
        toolbar.style.top = (ev.clientY - oy) + 'px';
        toolbar.style.right = 'auto';
      });
    });

    toolbar.querySelectorAll('input[data-fib]').forEach((input) => {
      const key = input.dataset.fib;
      input.addEventListener('input', () => {
        if (input.type === 'checkbox') {
          fib[key] = input.checked;
          if (key === 'move') fibSvg.classList.toggle('is-move', fib.move);
        } else {
          fib[key] = parseFloat(input.value);
          const out = input.nextElementSibling;
          if (out && out.tagName === 'OUTPUT') {
            out.textContent = key === 'deg' ? fib.deg + '°' : fib[key].toFixed(2);
          }
        }
        applyFib();
      });
    });
  }

  function updateToolbar() {
    els.arrange.textContent = 'Arrange: ' + (arranging ? 'on' : 'off');
    els.arrange.classList.toggle('is-on', arranging);
    els.fib.textContent = 'Spiral: ' + (fib.on ? 'on' : 'off');
    els.fib.classList.toggle('is-on', fib.on);
    els.fibControls.classList.toggle('is-open', fib.on);
    els.mode.textContent = arranging ? 'arranging' : (fib.on ? 'spiral' : 'idle');
  }

  function updateReadout() {
    if (els.vp) els.vp.textContent = `${innerWidth} × ${innerHeight}`;
    if (arranging) blocks.forEach(syncOverlay);
  }

  // ---- Overlays + arrange mode ----------------------------------------

  function buildOverlays() {
    DEFS.forEach((def) => {
      const el = document.querySelector(def.sel);
      if (!el) return;
      const overlay = document.createElement('div');
      overlay.className = 'sbx-overlay';
      overlay.style.setProperty('--sbx-accent', def.accent);
      const label = document.createElement('div');
      label.className = 'sbx-label';
      const handle = document.createElement('div');
      handle.className = 'sbx-handle';
      overlay.append(label, handle);
      root.append(overlay);
      const b = { def, el, overlay, handle, label, base: { w: 0, h: 0 }, pin: { left: 0, top: 0, scale: 1 } };
      blocks.push(b);
      overlay.addEventListener('pointerdown', (e) => startMove(e, b));
      handle.addEventListener('pointerdown', (e) => startScale(e, b));
    });
  }

  function enterArrange() {
    if (arranging || !blocks.length) return;
    arranging = true;
    // Freeze the wheel: the guard in applyWheelScale() keys off this attribute,
    // and --wheel-scale is already inline, so it stops re-fitting.
    html.setAttribute('data-arrange', '');
    const ws = getComputedStyle(html).getPropertyValue('--wheel-scale').trim();
    if (ws) html.style.setProperty('--wheel-scale', ws);

    const hero = document.querySelector('.hero');
    heroRef = hero ? hero.getBoundingClientRect() : null;

    // Measure ALL rects before mutating ANY: pinning one block removes it from
    // the grid and would otherwise reflow the next before we measure it.
    const rects = blocks.map((b) => b.el.getBoundingClientRect());
    blocks.forEach((b, i) => pinBlock(b, rects[i]));

    document.body.style.overflow = 'hidden';
    root.classList.add('is-arranging');
    updateToolbar();
    updateReadout();
  }

  function pinBlock(b, r) {
    b.base = { w: r.width, h: r.height };
    b.pin = { left: r.left, top: r.top, scale: 1 };
    const s = b.el.style;
    s.position = 'fixed';
    s.margin = '0';
    s.boxSizing = 'border-box';
    s.left = r.left + 'px';
    s.top = r.top + 'px';
    s.right = 'auto';    // .controls uses right:20px; kill it so left wins
    s.bottom = 'auto';
    s.width = r.width + 'px';
    s.height = r.height + 'px';
    s.transformOrigin = '0 0';
    s.transform = 'scale(1)';
    syncOverlay(b);
  }

  function applyPin(b) {
    b.el.style.left = b.pin.left + 'px';
    b.el.style.top = b.pin.top + 'px';
    b.el.style.transform = 'scale(' + b.pin.scale + ')';
  }

  function syncOverlay(b) {
    const w = b.base.w * b.pin.scale;
    const h = b.base.h * b.pin.scale;
    const o = b.overlay.style;
    o.left = b.pin.left + 'px';
    o.top = b.pin.top + 'px';
    o.width = w + 'px';
    o.height = h + 'px';
    b.label.textContent = `${b.def.label} · ${r0(w)}×${r0(h)} · ${b.pin.scale.toFixed(2)}×`;
  }

  // Run onMove for each pointermove until release. Listeners live on window so
  // the pointer can roam off a small handle without losing events (more robust
  // than setPointerCapture, which is flaky under synthetic input).
  function onDrag(onMove) {
    const move = (ev) => onMove(ev);
    const up = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
  }

  // Drag-to-move, using main.js's capture-after-5px-threshold idea so a click on
  // a block link isn't hijacked (here the scrim just distinguishes tap vs drag).
  function startMove(e, b) {
    if (e.button !== 0 || e.target.classList.contains('sbx-handle')) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY, left = b.pin.left, top = b.pin.top;
    let moved = 0, captured = false;
    onDrag((ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
      if (!captured && moved > 5) captured = true;
      if (!captured) return;
      b.pin.left = left + dx;
      b.pin.top = top + dy;
      applyPin(b);
      syncOverlay(b);
    });
  }

  // Uniform scale from a bottom-right handle, anchored at the top-left corner.
  // s = pointer offset from anchor projected onto the block's TL->BR diagonal.
  function startScale(e, b) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const ax = b.pin.left, ay = b.pin.top, W0 = b.base.w, H0 = b.base.h;
    const denom = W0 * W0 + H0 * H0 || 1;
    onDrag((ev) => {
      b.pin.scale = clamp(((ev.clientX - ax) * W0 + (ev.clientY - ay) * H0) / denom, 0.2, 3);
      applyPin(b);
      syncOverlay(b);
    });
  }

  function exitArrange() {
    if (!arranging) return;
    arranging = false;
    blocks.forEach((b) => {
      // Sandbox added everything inline and the blocks had no prior inline
      // styles, so clearing them restores the authored CSS layout exactly.
      const s = b.el.style;
      ['position', 'margin', 'boxSizing', 'left', 'top', 'right', 'bottom',
        'width', 'height', 'transformOrigin', 'transform'].forEach((p) => s.removeProperty(p.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())));
    });
    document.body.style.overflow = '';
    root.classList.remove('is-arranging');
    // Order: drop the guard + unpin BEFORE the re-fit, or the guard swallows it.
    html.removeAttribute('data-arrange');
    html.style.removeProperty('--wheel-scale');
    dispatchEvent(new Event('resize'));
    updateToolbar();
  }

  // ---- Fibonacci overlay ----------------------------------------------

  const VB = 1000;

  function buildFib() {
    fibSvg = document.createElementNS(NS, 'svg');
    fibSvg.setAttribute('class', 'sbx-fib');
    fibSvg.setAttribute('viewBox', `0 0 ${VB} ${VB}`);
    fibSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    fibGroup = document.createElementNS(NS, 'g');
    fibSvg.append(fibGroup);

    // Base golden rectangle, centred in the viewBox.
    const A = 760;                 // base width in viewBox units
    const H = A / PHI;             // base height
    const x0 = (VB - A) / 2;
    const y0 = (VB - H) / 2;
    const { squares, arcs } = goldenSpiral(x0, y0, A, H);

    const grid = document.createElementNS(NS, 'g');
    grid.setAttribute('class', 'sbx-fib-grid');
    squares.forEach((sq) => {
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', r2(sq.x));
      rect.setAttribute('y', r2(sq.y));
      rect.setAttribute('width', r2(sq.s));
      rect.setAttribute('height', r2(sq.s));
      grid.append(rect);
    });
    fibGroup.append(grid);

    const path = document.createElementNS(NS, 'path');
    path.setAttribute('class', 'sbx-fib-spiral');
    let d = `M ${r2(arcs[0].sx)} ${r2(arcs[0].sy)}`;
    arcs.forEach((a) => { d += ` A ${r2(a.r)} ${r2(a.r)} 0 0 1 ${r2(a.ex)} ${r2(a.ey)}`; });
    path.setAttribute('d', d);
    fibGroup.append(path);

    // Bounded, normally-inert grab area for "move spiral" mode. pointer-events
    // is flipped to `all` (via .is-move) only while moving, so it never
    // blackholes the block scrims. Descendant of a pointer-events:none svg,
    // which per spec can still be a target when it sets its own value.
    fibHit = document.createElementNS(NS, 'rect');
    fibHit.setAttribute('class', 'sbx-fib-hit');
    fibHit.setAttribute('x', r2(x0));
    fibHit.setAttribute('y', r2(y0));
    fibHit.setAttribute('width', r2(A));
    fibHit.setAttribute('height', r2(H));
    fibGroup.append(fibHit);
    fibHit.addEventListener('pointerdown', startFibMove);

    root.append(fibSvg);
    applyFib();
  }

  // Whirling-squares golden spiral: cut a square off the current golden rect
  // (sides in order left/top/right/bottom), draw the inscribed quarter-arc,
  // recurse into the remaining rect. Uses true phi so squares stay exact.
  function goldenSpiral(x, y, w, h) {
    const squares = [];
    const arcs = [];
    for (let i = 0; i < 9; i++) {
      const s = Math.min(w, h);
      const side = i % 4;
      let sq, sx, sy, ex, ey;
      if (side === 0) {                 // square on LEFT, arc pivot bottom-right
        sq = { x, y, s };
        sx = x; sy = y + s; ex = x + s; ey = y;
        x += s; w -= s;
      } else if (side === 1) {          // square on TOP, pivot top-right
        sq = { x, y, s };
        sx = x; sy = y; ex = x + s; ey = y + s;
        y += s; h -= s;
      } else if (side === 2) {          // square on RIGHT, pivot top-left
        sq = { x: x + w - s, y, s };
        sx = x + w; sy = y; ex = x + w - s; ey = y + s;
        w -= s;
      } else {                          // square on BOTTOM, pivot bottom-left
        sq = { x, y: y + h - s, s };
        sx = x + s; sy = y + h; ex = x; ey = y + h - s;
        h -= s;
      }
      squares.push(sq);
      arcs.push({ sx, sy, ex, ey, r: s });
    }
    return { squares, arcs };
  }

  function applyFib() {
    const fx = fib.flipH ? -fib.f : fib.f;
    const fy = fib.flipV ? -fib.f : fib.f;
    const c = VB / 2;
    fibGroup.setAttribute('transform',
      `translate(${r2(fib.tx)} ${r2(fib.ty)}) translate(${c} ${c}) rotate(${fib.deg}) scale(${r4(fx)} ${r4(fy)}) translate(${-c} ${-c})`);
    fibGroup.style.opacity = fib.opacity;
    fibSvg.classList.toggle('is-on', fib.on);
  }

  // Drag the spiral. innerW/H map to the VB square via `meet`, so 1px = VB/min.
  function startFibMove(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    const perPx = VB / Math.min(innerWidth, innerHeight);
    const sx = e.clientX, sy = e.clientY, tx0 = fib.tx, ty0 = fib.ty;
    onDrag((ev) => {
      fib.tx = tx0 + (ev.clientX - sx) * perPx;
      fib.ty = ty0 + (ev.clientY - sy) * perPx;
      applyFib();
    });
  }

  // ---- Export ----------------------------------------------------------

  function exportLayout() {
    const iw = innerWidth, ih = innerHeight;
    const heroEl = document.querySelector('.hero');
    const hero = (arranging && heroRef) ? heroRef : (heroEl ? heroEl.getBoundingClientRect() : { left: 0, top: 0, width: iw, height: ih });
    const wheelScale = parseFloat(getComputedStyle(html).getPropertyValue('--wheel-scale')) || 1;

    const rectByKey = {};
    const outBlocks = {};
    blocks.forEach((b) => {
      const r = b.el.getBoundingClientRect(); // already reflects transform:scale
      rectByKey[b.def.key] = r;
      const scale = arranging ? b.pin.scale : 1;
      const entry = {
        label: b.def.label,
        viewportPct: { x: pct(r.left, iw), y: pct(r.top, ih), w: pct(r.width, iw), h: pct(r.height, ih) },
        heroRelPct: { x: pct(r.left - hero.left, hero.width), y: pct(r.top - hero.top, hero.height), w: pct(r.width, hero.width), h: pct(r.height, hero.height) },
        scale: r2(scale),
      };
      if (b.def.key === 'wheel') {
        entry.wheelSettledScale = r4(wheelScale);
        entry.totalVisualScale = r4(scale * wheelScale);
      }
      outBlocks[b.def.key] = entry;
    });

    const data = {
      composedViewport: { w: iw, h: ih },
      hero: { w: r0(hero.width), h: r0(hero.height) },
      blocks: outBlocks,
    };

    const c = rectByKey.copy, wh = rectByKey.wheel;
    if (c && wh) {
      const gap = wh.left - c.right;
      data.heroColumns = {
        gapPx: r0(gap),
        gapPctOfHero: pct(gap, hero.width),
        splitRatio: `1 : ${r3(wh.width / c.width)}`,
        copyFraction: r3(c.width / (c.width + wh.width)),
        authoredColumns: 'minmax(0,1fr) minmax(0,1.1fr)',
      };
    }
    data.spiral = fib.on
      ? { tx: r0(fib.tx), ty: r0(fib.ty), scale: r2(fib.f), deg: fib.deg, flipH: fib.flipH, flipV: fib.flipV, opacity: r2(fib.opacity) }
      : null;

    const lines = [
      `// Composed at ${iw}×${ih}. Positions are % of that viewport (and of .hero).`,
      `// This is design INTENT for translating into the real grid/flex CSS — not drop-in CSS.`,
    ];
    if (data.heroColumns) {
      lines.push(`// Columns: copy/wheel split ${data.heroColumns.splitRatio} (authored ${data.heroColumns.authoredColumns}), gap ${data.heroColumns.gapPx}px.`);
    }
    Object.values(outBlocks).forEach((e) => {
      lines.push(`// ${e.label}: viewport ${e.viewportPct.x}%,${e.viewportPct.y}% · size ${e.viewportPct.w}%×${e.viewportPct.h}% · scale ${e.scale}×`);
    });

    const text = lines.join('\n') + '\n\n' + JSON.stringify(data, null, 2);
    copyText(text);
  }

  function copyText(text) {
    const done = (ok) => showToast(ok ? 'Layout copied to clipboard' : 'Copy failed — see console');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => done(true)).catch(() => {
        console.log('[sandbox] layout export:\n' + text);
        done(false);
      });
    } else {
      console.log('[sandbox] layout export:\n' + text);
      try { window.prompt('Copy the layout:', text); } catch (_) {}
      done(false);
    }
  }

  function showToast(msg) {
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'sbx-toast';
      root.append(toast);
    }
    toast.textContent = msg;
    toast.classList.add('is-show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('is-show'), 1600);
  }

  // Kick off at the end so every module-level const/let above is initialized
  // before init()'s call chain touches it. Dynamically-injected scripts aren't
  // deferred, so gate on readyState; this resolves after main.js (deferred) has
  // already laid out the wheel.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
