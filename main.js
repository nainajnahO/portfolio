// Portfolio — big-type wash list with quick-look panel.
// No dependencies, no build step. The project content lives in index.html;
// this file only wires up the selection behaviour.

const wash = document.querySelector('.js-wash');
const rows = Array.from(document.querySelectorAll('.js-row'));

const panel = {
  shotBox: document.querySelector('.js-shot-box'),
  shotImg: document.querySelector('.js-shot-img'),
  shotLabel: document.querySelector('.js-shot'),
  name: document.querySelector('.js-name'),
  meta: document.querySelector('.js-meta'),
  desc: document.querySelector('.js-desc'),
  cta:  document.querySelector('.js-cta'),
  ctaText: document.querySelector('.js-cta-text'),
};

// Turn a project colour into a ~12% wash tint (the design appends alpha "1e").
const tint = (hex) => hex + '1e';

function select(row) {
  const d = row.dataset;

  // Tint the whole card and expose the accent for the active row's name/arrow.
  wash.style.setProperty('--wash', tint(d.color));
  wash.style.setProperty('--accent', d.color);

  rows.forEach((r) => {
    const active = r === row;
    r.classList.toggle('is-active', active);
    if (active) r.setAttribute('aria-current', 'true');
    else r.removeAttribute('aria-current');
  });

  // Screenshot: show the project's image if it has one, else the striped box.
  panel.shotLabel.textContent = `[ ${d.name} — screenshot ]`;
  if (d.img) {
    panel.shotImg.src = d.img;
    panel.shotImg.alt = `${d.name} — screenshot`;
    panel.shotBox.style.setProperty('--shot-img', `url("${d.img}")`);
    panel.shotBox.classList.add('has-img');
  } else {
    panel.shotBox.classList.remove('has-img');
    panel.shotImg.removeAttribute('src');
    panel.shotImg.alt = '';
    panel.shotBox.style.removeProperty('--shot-img');
  }

  panel.name.textContent = d.name;
  panel.meta.textContent = `${d.type} · ${d.tech}`;
  panel.desc.textContent = d.desc;
  panel.ctaText.textContent = d.cta;
  panel.cta.href = d.url || '#';
}

rows.forEach((row) => {
  // Hover (desktop), focus (keyboard) and click/tap (touch) all select.
  // Deliberately no mouseleave reset — the last-viewed project persists.
  row.addEventListener('mouseenter', () => select(row));
  row.addEventListener('focus', () => select(row));
  row.addEventListener('click', () => select(row));
});

// Start on the first project (matches the design's default index).
if (rows.length) select(rows[0]);

// Dev-only: visiting index.html?fonts loads a small HUD (fonts-hud.js) for
// trying different Google Fonts live. Normal visitors never fetch it.
if (new URLSearchParams(location.search).has('fonts')) {
  const hud = document.createElement('script');
  hud.src = 'fonts-hud.js';
  document.head.append(hud);
}
