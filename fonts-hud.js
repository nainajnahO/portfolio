// Dev-only font tryout HUD — loaded by main.js when the URL has ?fonts.
// Each row is a native <input list> + <datalist> combobox: pick a curated
// suggestion or type any Google Fonts family name, press Enter, and the
// matching CSS variable (--serif / --mono / --sans) updates live. Leave a
// field empty to restore that role's self-hosted default. Nothing here runs
// for normal visitors and nothing is persisted.

const roles = [
  {
    key: 'serif',
    label: 'serif',
    current: 'Young Serif',
    fallback: "Georgia, 'Times New Roman', serif",
    suggestions: [
      'Playfair Display', 'Fraunces', 'DM Serif Display', 'EB Garamond',
      'Cormorant Garamond', 'Libre Caslon Display', 'Bodoni Moda',
      'Young Serif', 'Spectral', 'Lora', 'Newsreader', 'Crimson Pro',
      'Prata', 'Libre Baskerville',
    ],
  },
  {
    key: 'mono',
    label: 'mono',
    current: 'JetBrains Mono',
    fallback: 'ui-monospace, Menlo, Consolas, monospace',
    suggestions: [
      'JetBrains Mono', 'Space Mono', 'Fira Code', 'Source Code Pro',
      'DM Mono', 'Roboto Mono', 'Courier Prime', 'Fragment Mono',
      'Martian Mono', 'Red Hat Mono', 'Overpass Mono', 'Anonymous Pro',
    ],
  },
  {
    key: 'sans',
    label: 'sans',
    current: 'Inter',
    fallback: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    suggestions: [
      'Inter', 'DM Sans', 'Space Grotesk', 'Work Sans', 'Manrope',
      'Archivo', 'Public Sans', 'Instrument Sans', 'Sora', 'Outfit',
    ],
  },
];

// One <link> per family, keyed by id so re-trying a font never duplicates it.
// The v1 CSS API serves whichever of the requested weights exist instead of
// failing the whole request (the v2 css2 endpoint 400s on missing weights).
function loadFamily(family, onFail) {
  const id = 'hud-font-' + family.toLowerCase().replace(/\s+/g, '-');
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css?family=' +
    encodeURIComponent(family).replace(/%20/g, '+') +
    ':400,500,600,700&display=swap';
  link.onerror = () => { link.remove(); onFail(); };
  document.head.append(link);
}

const hud = document.createElement('form');
hud.className = 'fonts-hud';
hud.innerHTML = `
  <style>
    .fonts-hud {
      position: fixed; right: 12px; bottom: 12px; z-index: 999;
      display: grid; gap: 6px; width: 240px; padding: 12px 14px;
      background: #fff; border: 1px solid rgba(0, 0, 0, .15);
      border-radius: 8px; box-shadow: 0 8px 28px rgba(0, 0, 0, .18);
      font: 400 11px/1.5 ui-monospace, Menlo, Consolas, monospace;
      color: #2b2822;
    }
    .fonts-hud__head { display: flex; justify-content: space-between; align-items: baseline; }
    .fonts-hud__row { display: grid; grid-template-columns: 42px 1fr; gap: 8px; align-items: center; }
    .fonts-hud input {
      min-width: 0; padding: 4px 6px; font: inherit; color: inherit;
      border: 1px solid rgba(0, 0, 0, .25); border-radius: 4px; background: #f8f7f4;
    }
    .fonts-hud button {
      padding: 0; font: inherit; color: #797569; background: none;
      border: none; cursor: pointer; text-decoration: underline;
    }
    .fonts-hud__status { min-height: 1.5em; color: #797569; }
  </style>
  <div class="fonts-hud__head">
    <strong>font tryout</strong>
    <button type="button" class="js-hud-reset">reset</button>
  </div>
  ${roles.map((role) => `
    <label class="fonts-hud__row">
      <span>${role.label}</span>
      <input list="hud-list-${role.key}" data-role="${role.key}"
        placeholder="${role.current}" autocomplete="off" spellcheck="false">
      <datalist id="hud-list-${role.key}">
        ${role.suggestions.map((f) => `<option value="${f}"></option>`).join('')}
      </datalist>
    </label>
  `).join('')}
  <div class="fonts-hud__status js-hud-status">type any Google Font, Enter applies</div>
`;

const status = hud.querySelector('.js-hud-status');
const inputs = Array.from(hud.querySelectorAll('input'));

function apply(role, input) {
  const family = input.value.trim();
  if (!family) {
    document.documentElement.style.removeProperty('--' + role.key);
    status.textContent = `${role.label}: back to ${role.current}`;
    return;
  }
  loadFamily(family, () => {
    status.textContent = `"${family}" not on Google Fonts?`;
  });
  document.documentElement.style.setProperty('--' + role.key, `'${family}', ${role.fallback}`);
  status.textContent = `${role.label}: ${family}`;
}

inputs.forEach((input) => {
  const role = roles.find((r) => r.key === input.dataset.role);
  // 'change' fires on Enter, on blur, and when picking a datalist suggestion.
  input.addEventListener('change', () => apply(role, input));
});

hud.querySelector('.js-hud-reset').addEventListener('click', () => {
  inputs.forEach((input) => { input.value = ''; });
  roles.forEach((role) => document.documentElement.style.removeProperty('--' + role.key));
  status.textContent = 'back to the shipped fonts';
});

// Enter in a field should apply (change event), never submit/reload.
hud.addEventListener('submit', (e) => e.preventDefault());

document.body.append(hud);
