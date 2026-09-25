// =====================================================================
// VoidTab — Clock engine
//   Styles: digital · stacked · analog · flip · words · ring
//   Everything is stored in state.clockCfg (see CLOCK_DEFAULTS).
//   Legacy toggles (showClock, clock24, showSeconds, showDate, showGreeting,
//   userName, showSearch, clockPos) keep living on `state` and are wired in newtab.js.
// =====================================================================

const CLOCK_DEFAULTS = {
  // style
  style: 'digital',       // digital | stacked | analog | flip | word | ring
  size: 104,              // px, base size of the whole clock
  align: 'center',        // left | center | right
  blinkColon: false,
  secStyle: 'small',      // small | same
  showAmPm: true,
  leadingZero: false,     // 12h only; 24h is always zero-padded
  // analog
  aFace: 'ticks',         // ticks | numerals | roman | dots | minimal | none
  aHands: 'thin',         // thin | bold | rounded | arrow
  aBorder: 3,
  aBg: 0,
  aSmooth: true,
  // flip / ring
  flipCard: 'glass',      // glass | dark | light | accent
  ringMode: 'seconds',    // seconds | minutes | day
  ringWidth: 5,
  // text
  font: 'default',
  fontCustom: '',
  weight: 300,
  spacing: -4,            // hundredths of an em
  uppercase: false,
  greetingSize: 16,
  dateSize: 15,
  greetingMode: 'auto',   // auto | custom
  greetingText: 'Hello, {name}',
  // color & fx
  colorMode: 'default',   // default | accent | solid | gradient — "default" tracks light/dark theme text, never the accent swatch
  color: '#f5f6fa',
  color2: '#22c55e',
  gradAngle: 135,
  tintText: false,
  opacity: 100,
  glow: 0,
  glowMode: 'text',       // accent | text | custom — defaults to matching the clock's own color, not the app accent
  glowColor: '#22c55e',
  outline: false,
  outlineW: 2,
  panel: false,
  panelPad: 24,
  panelRadius: 24,
  // time & date
  dateFormat: 'long',     // long | short | full | numeric | iso | custom
  dateCustom: 'dddd, D MMMM YYYY',
  tz: '',
  showTz: false,
  worldClocks: '',
};

// Keys a preset is allowed to reset/overwrite (the "look" — not your time zone, name, date format…)
const CLOCK_LOOK_KEYS = ['style','size','blinkColon','secStyle','showAmPm','leadingZero','aFace','aHands','aBorder','aBg','aSmooth',
  'flipCard','ringMode','ringWidth','font','fontCustom','weight','spacing','uppercase','greetingSize','dateSize',
  'colorMode','color','color2','gradAngle','tintText','opacity','glow','glowMode','glowColor','outline','outlineW','panel','panelPad','panelRadius'];

// google = family spec loaded lazily from Google Fonts only when chosen (nothing is fetched otherwise)
const CLOCK_FONTS = {
  default:   { label: 'Theme font' },
  system:    { label: 'System UI',        stack: "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
  inter:     { label: 'Inter',            stack: "'Inter', sans-serif",              google: 'Inter:wght@100..900' },
  grotesk:   { label: 'Space Grotesk',    stack: "'Space Grotesk', sans-serif",      google: 'Space+Grotesk:wght@300..700' },
  poppins:   { label: 'Poppins',          stack: "'Poppins', sans-serif",            google: 'Poppins:wght@100;200;300;400;500;600;700;800;900' },
  unbounded: { label: 'Unbounded',        stack: "'Unbounded', sans-serif",          google: 'Unbounded:wght@200..900' },
  righteous: { label: 'Righteous',        stack: "'Righteous', sans-serif",          google: 'Righteous' },
  bebas:     { label: 'Bebas Neue',       stack: "'Bebas Neue', Impact, sans-serif", google: 'Bebas+Neue' },
  oswald:    { label: 'Oswald',           stack: "'Oswald', Impact, sans-serif",     google: 'Oswald:wght@200..700' },
  orbitron:  { label: 'Orbitron',         stack: "'Orbitron', sans-serif",           google: 'Orbitron:wght@400..900' },
  playfair:  { label: 'Playfair Display', stack: "'Playfair Display', Georgia, serif", google: 'Playfair+Display:wght@400..900' },
  cormorant: { label: 'Cormorant Garamond', stack: "'Cormorant Garamond', Georgia, serif", google: 'Cormorant+Garamond:wght@300..700' },
  serif:     { label: 'Serif (Georgia)',  stack: "Georgia, 'Times New Roman', serif" },
  jetbrains: { label: 'JetBrains Mono',   stack: "'JetBrains Mono', ui-monospace, monospace", google: 'JetBrains+Mono:wght@100..800' },
  spacemono: { label: 'Space Mono',       stack: "'Space Mono', ui-monospace, monospace", google: 'Space+Mono:wght@400;700' },
  sharetech: { label: 'Share Tech Mono (LCD)', stack: "'Share Tech Mono', ui-monospace, monospace", google: 'Share+Tech+Mono' },
  vt323:     { label: 'VT323 (terminal)', stack: "'VT323', ui-monospace, monospace", google: 'VT323' },
  mono:      { label: 'Monospace',        stack: "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace" },
  rounded:   { label: 'Rounded',          stack: "ui-rounded, 'SF Pro Rounded', 'Segoe UI', sans-serif" },
};

const CLOCK_PRESETS = {
  'Minimal':   {},
  'Neon':      { font: 'orbitron', weight: 600, size: 92, spacing: 2, colorMode: 'accent', glow: 80, glowMode: 'accent', blinkColon: true, uppercase: true },
  'Retro LCD': { font: 'sharetech', weight: 400, size: 118, spacing: 4, colorMode: 'solid', color: '#6dff9a', glow: 55, glowMode: 'custom', glowColor: '#22ff66', secStyle: 'same', blinkColon: true },
  'Editorial': { font: 'playfair', weight: 400, size: 122, spacing: -2, colorMode: 'default' },
  'Sunset':    { font: 'unbounded', weight: 700, size: 92, spacing: -3, colorMode: 'gradient', color: '#ffb86b', color2: '#ff3d81', gradAngle: 135, glow: 25, glowMode: 'custom', glowColor: '#ff5d8f' },
  'Outline':   { font: 'bebas', weight: 400, size: 160, spacing: 6, outline: true, outlineW: 2, colorMode: 'accent' },
  'Glass':     { font: 'inter', weight: 200, size: 92, spacing: -3, panel: true, panelPad: 30, panelRadius: 32 },
  'Stacked':   { style: 'stacked', font: 'oswald', weight: 600, size: 124, spacing: 0, colorMode: 'gradient', color: '#ffffff', color2: '#22c55e', gradAngle: 180 },
  'Zen Analog':{ style: 'analog', aFace: 'minimal', aHands: 'thin', aBorder: 2, aBg: 0, size: 96 },
  'Classic Analog': { style: 'analog', aFace: 'roman', aHands: 'arrow', aBorder: 4, aBg: 15, font: 'cormorant', weight: 600, size: 100 },
  'Flip':      { style: 'flip', flipCard: 'glass', size: 84, weight: 600, font: 'inter' },
  'Words':     { style: 'word', font: 'cormorant', weight: 400, size: 100, spacing: 0 },
  'Ring':      { style: 'ring', ringMode: 'seconds', ringWidth: 5, colorMode: 'accent', size: 96, weight: 300 },
};

// ---------- config helpers ----------
function C() {
  if (!state.clockCfg || typeof state.clockCfg !== 'object') {
    state.clockCfg = Object.assign({}, CLOCK_DEFAULTS);
    state.clockCfg.size = { s: 68, m: 104, l: 148 }[state.clockSize] || 104; // migrate the old S/M/L setting
  }
  const c = state.clockCfg;
  for (const k in CLOCK_DEFAULTS) if (!(k in c)) c[k] = CLOCK_DEFAULTS[k];
  return c;
}
function ckVal(key) { const c = C(); return key in c ? c[key] : state[key]; }

// ---------- time zone helpers ----------
const _dtf = {};
function tzValid(tz) {
  if (!tz) return true;
  if (tz in _dtf) return !!_dtf[tz];
  try {
    _dtf[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
  } catch (e) { _dtf[tz] = null; }
  return !!_dtf[tz];
}
// Returns a Date whose *local* getters read the wall-clock time in `tz`.
function zonedNow(tz, base) {
  const d = base || new Date();
  tz = (tz || '').trim();
  if (!tz || !tzValid(tz)) return d;
  const p = {};
  _dtf[tz].formatToParts(d).forEach(x => { p[x.type] = x.value; });
  return new Date(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second, d.getMilliseconds());
}
function tzCity(tz) { return String(tz || '').split('/').pop().replace(/_/g, ' '); }

// ---------- formatting ----------
const _pad = (n) => String(n).padStart(2, '0');
function ordinal(n) { const v = n % 100; return n + (['th', 'st', 'nd', 'rd'][(v - 20) % 10] || ['th', 'st', 'nd', 'rd'][v] || 'th'); }
function fmtTokens(d, f) {
  const H = d.getHours(), h12 = H % 12 || 12;
  return String(f).replace(/\[([^\]]*)\]|YYYY|YY|MMMM|MMM|MM|M|dddd|ddd|Do|DD|D|HH|H|hh|h|mm|ss|A|a/g, (t, esc) => {
    if (esc !== undefined) return esc;
    switch (t) {
      case 'YYYY': return d.getFullYear();
      case 'YY': return String(d.getFullYear()).slice(-2);
      case 'MMMM': return d.toLocaleDateString(undefined, { month: 'long' });
      case 'MMM': return d.toLocaleDateString(undefined, { month: 'short' });
      case 'MM': return _pad(d.getMonth() + 1);
      case 'M': return d.getMonth() + 1;
      case 'dddd': return d.toLocaleDateString(undefined, { weekday: 'long' });
      case 'ddd': return d.toLocaleDateString(undefined, { weekday: 'short' });
      case 'Do': return ordinal(d.getDate());
      case 'DD': return _pad(d.getDate());
      case 'D': return d.getDate();
      case 'HH': return _pad(H);
      case 'H': return H;
      case 'hh': return _pad(h12);
      case 'h': return h12;
      case 'mm': return _pad(d.getMinutes());
      case 'ss': return _pad(d.getSeconds());
      case 'A': return H >= 12 ? 'PM' : 'AM';
      case 'a': return H >= 12 ? 'pm' : 'am';
    }
    return t;
  });
}
function fmtDate(d, c) {
  const L = undefined;
  switch (c.dateFormat) {
    case 'short':   return d.toLocaleDateString(L, { weekday: 'short', month: 'short', day: 'numeric' });
    case 'full':    return d.toLocaleDateString(L, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    case 'numeric': return d.toLocaleDateString(L, { year: 'numeric', month: '2-digit', day: '2-digit' });
    case 'iso':     return fmtTokens(d, 'YYYY-MM-DD');
    case 'custom':  return fmtTokens(d, c.dateCustom || '');
    default:        return d.toLocaleDateString(L, { weekday: 'long', day: 'numeric', month: 'long' });
  }
}
function greetingText(d) {
  d = d || new Date();
  const c = C(), h = d.getHours();
  const g = h >= 5 && h < 12 ? 'Good morning' : h >= 12 && h < 17 ? 'Good afternoon' : h >= 17 && h < 22 ? 'Good evening' : 'Good night';
  const n = (state.userName || '').trim();
  if (c.greetingMode === 'custom' && (c.greetingText || '').trim()) {
    return c.greetingText.replace(/\{greeting\}/gi, g).replace(/\{name\}/gi, n).replace(/\s+([,!.?])/g, '$1').replace(/[,\s]+$/, '').trim();
  }
  return n ? `${g}, ${n}` : g;
}
const _WORDS = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'];
const _WMIN = { 5: 'five', 10: 'ten', 15: 'quarter', 20: 'twenty', 25: 'twenty-five', 30: 'half' };
function wordTime(d) {
  let h = d.getHours(), r = Math.round(d.getMinutes() / 5) * 5;
  if (r === 60) { r = 0; h = (h + 1) % 24; }
  if (r === 0) return h === 0 ? "It's midnight" : h === 12 ? "It's noon" : `It's ${_WORDS[h % 12]} o'clock`;
  if (r <= 30) return `It's ${_WMIN[r]} past ${_WORDS[h % 12]}`;
  return `It's ${_WMIN[60 - r]} to ${_WORDS[(h + 1) % 12]}`;
}
function timeParts(d, c) {
  let h = d.getHours(), ampm = '';
  if (!state.clock24) { ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; }
  const pad = state.clock24 || c.leadingZero;
  return { h: pad ? _pad(h) : String(h), h2: _pad(h), m: _pad(d.getMinutes()), s: _pad(d.getSeconds()), ampm: (!state.clock24 && c.showAmPm) ? ampm : '' };
}

// ---------- fonts ----------
const _fontsLoaded = {};
function ensureFont(key) {
  const f = CLOCK_FONTS[key];
  if (!f || !f.google || _fontsLoaded[key]) return;
  _fontsLoaded[key] = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${f.google}&display=swap`;
  link.onload = () => { if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitClock); };
  document.head.appendChild(link);
}
function fontStack(c) {
  if ((c.fontCustom || '').trim()) return `'${c.fontCustom.trim().replace(/['"\\;{}]/g, '')}', ${(CLOCK_FONTS[c.font] || {}).stack || 'sans-serif'}`;
  return (CLOCK_FONTS[c.font] || {}).stack || null;
}

// ---------- face builders ----------
const _ck = { els: {}, flip: {}, ringPrev: 0, worldKey: null, world: [] };

function digitalHTML() {
  return '<span class="ck-hm"><span data-k="h"></span><span class="ck-colon">:</span><span data-k="m"></span></span>' +
         '<span class="ck-sec" data-k="secwrap"><span class="ck-colon">:</span><span data-k="s"></span></span>' +
         '<span class="ck-ampm" data-k="ampm"></span>';
}
function flipDigitHTML() {
  return '<div class="fd-t"><i></i></div><div class="fd-b"><i></i></div><div class="fd-ft"><i></i></div><div class="fd-fb"><i></i></div>';
}
function analogSVG(c) {
  const t = c.aBorder;
  let s = `<svg viewBox="-100 -100 200 200" class="ck-an-svg" aria-hidden="true">`;
  s += `<circle r="${96 - t / 2}" fill="currentColor" fill-opacity="${(c.aBg / 100 * 0.3).toFixed(3)}" stroke="currentColor" stroke-width="${t}" stroke-opacity="${t ? 0.9 : 0}"/>`;
  const f = c.aFace;
  if (f === 'ticks') {
    for (let i = 0; i < 60; i++) {
      const major = i % 5 === 0, len = major ? 10 : 4.5;
      s += `<line x1="0" y1="-88" x2="0" y2="${-88 + len}" transform="rotate(${i * 6})" stroke="currentColor" stroke-width="${major ? 2.6 : 1}" stroke-opacity="${major ? 1 : 0.55}" stroke-linecap="round"/>`;
    }
  } else if (f === 'dots') {
    for (let i = 0; i < 12; i++) s += `<circle cx="0" cy="-80" r="${i % 3 === 0 ? 4 : 2.4}" transform="rotate(${i * 30})" fill="currentColor" fill-opacity="${i % 3 === 0 ? 1 : 0.6}"/>`;
  } else if (f === 'minimal') {
    for (let i = 0; i < 4; i++) s += `<line x1="0" y1="-86" x2="0" y2="-70" transform="rotate(${i * 90})" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>`;
  } else if (f === 'numerals' || f === 'roman') {
    const R = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6, x = Math.sin(a) * 73, y = -Math.cos(a) * 73;
      s += `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="middle" dominant-baseline="central" font-size="${f === 'roman' ? 15 : 20}" fill="currentColor" style="font-family:inherit;font-weight:inherit;letter-spacing:0">${f === 'roman' ? R[i] : (i || 12)}</text>`;
    }
  }
  const hands = {
    thin:    { h: [2.6, 50, 'round'], m: [1.8, 72, 'round'], s: 0.9 },
    bold:    { h: [7, 50, 'butt'],    m: [4.5, 72, 'butt'],  s: 1.6 },
    rounded: { h: [6, 48, 'round'],   m: [4, 70, 'round'],   s: 1.6 },
  }[c.aHands];
  const line = (id, w, len, cap) => `<g data-k="${id}"><line x1="0" y1="${id === 'ah' ? 8 : 12}" x2="0" y2="${-len}" stroke="currentColor" stroke-width="${w}" stroke-linecap="${cap}"/></g>`;
  if (c.aHands === 'arrow') {
    s += `<g data-k="ah"><polygon points="-4,9 0,-52 4,9" fill="currentColor"/></g><g data-k="am"><polygon points="-3,11 0,-76 3,11" fill="currentColor"/></g>`;
  } else {
    s += line('ah', hands.h[0], hands.h[1], hands.h[2]) + line('am', hands.m[0], hands.m[1], hands.m[2]);
  }
  if (state.showSeconds) {
    const sw = c.aHands === 'thin' ? 0.9 : 1.5;
    s += `<g data-k="as"><line x1="0" y1="18" x2="0" y2="-84" stroke="var(--ck-seccolor)" stroke-width="${sw}" stroke-linecap="round"/><circle r="3" cx="0" cy="0" fill="var(--ck-seccolor)"/></g>`;
  }
  s += `<circle r="${c.aHands === 'thin' ? 3 : 4.5}" fill="currentColor"/></svg>`;
  return s;
}

function buildFace() {
  const c = C(), face = $('hero-face');
  face.className = 'ck-' + c.style;
  _ck.els = {}; _ck.flip = {}; _ck.ringPrev = 0;
  let h = '';
  switch (c.style) {
    case 'stacked':
      h = '<div class="ck-line" data-k="h"></div><div class="ck-line" data-k="m"></div><div class="ck-sub"><span data-k="s"></span><span data-k="ampm"></span></div>';
      break;
    case 'analog':
      h = analogSVG(c);
      break;
    case 'flip': {
      const grp = (k) => `<div class="fl-grp"><div class="fd" data-f="${k}1">${flipDigitHTML()}</div><div class="fd" data-f="${k}2">${flipDigitHTML()}</div></div>`;
      const dots = '<div class="fl-colon"><span></span><span></span></div>';
      h = grp('h') + dots + grp('m') + (state.showSeconds ? dots + grp('s') : '') + '<div class="ck-ampm" data-k="ampm"></div>';
      break;
    }
    case 'word':
      h = '<div class="ck-wtxt" data-k="w"></div>';
      break;
    case 'ring':
      h = `<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="rg-track" cx="50" cy="50" r="43" fill="none" stroke="currentColor" stroke-width="${c.ringWidth}" stroke-opacity=".16"/><circle class="rg-prog" data-k="rp" cx="50" cy="50" r="43" fill="none" stroke="var(--ck-ring, var(--ck-color))" stroke-width="${c.ringWidth}" stroke-linecap="round" stroke-dasharray="270.18" stroke-dashoffset="270.18" transform="rotate(-90 50 50)"/></svg>` +
          `<div class="ck-ring-in"><div class="ck-digital">${digitalHTML()}</div></div>`;
      break;
    default:
      h = digitalHTML();
  }
  face.innerHTML = h;
  face.querySelectorAll('[data-k]').forEach(el => { _ck.els[el.dataset.k] = el; });
  face.querySelectorAll('[data-f]').forEach(el => { _ck.flip[el.dataset.f] = { el, val: null }; });
}

function setT(el, v) { if (el && el.textContent !== v) el.textContent = v; }
function setFlip(k, v) {
  const f = _ck.flip[k]; if (!f || f.val === v) return;
  const el = f.el, q = (s) => el.querySelector(s);
  const first = f.val === null, old = f.val;
  f.val = v;
  el.style.display = v === '' ? 'none' : '';
  if (first) { el.querySelectorAll('i').forEach(i => { i.textContent = v; }); return; }
  q('.fd-t i').textContent = v; q('.fd-fb i').textContent = v;
  q('.fd-ft i').textContent = old; q('.fd-b i').textContent = old;
  el.classList.remove('flip'); void el.offsetWidth; el.classList.add('flip');
  clearTimeout(f.t);
  f.t = setTimeout(() => { el.querySelectorAll('i').forEach(i => { i.textContent = v; }); el.classList.remove('flip'); }, 620);
}
function setHands(d, smooth) {
  const c = C(), E = _ck.els;
  if (!E.ah) return;
  const sec = d.getSeconds() + (smooth ? d.getMilliseconds() / 1000 : 0);
  const min = d.getMinutes() + sec / 60;
  const hr = (d.getHours() % 12) + min / 60;
  E.ah.setAttribute('transform', `rotate(${(hr * 30).toFixed(2)})`);
  E.am.setAttribute('transform', `rotate(${(min * 6).toFixed(2)})`);
  if (E.as) E.as.setAttribute('transform', `rotate(${(sec * 6).toFixed(2)})`);
}

// ---------- world clocks ----------
function parseWorld(str) {
  return String(str || '').split('\n').map(l => l.trim()).filter(Boolean).slice(0, 6).map(l => {
    const [a, b] = l.includes('|') ? l.split('|').map(x => x.trim()) : [tzCity(l), l];
    return { label: a || tzCity(b), tz: b };
  }).filter(w => w.tz && tzValid(w.tz));
}
function buildWorld() {
  const c = C(), wrap = $('hero-world');
  _ck.world = parseWorld(c.worldClocks);
  wrap.innerHTML = '';
  wrap.classList.toggle('hidden', !_ck.world.length);
  _ck.world.forEach(w => {
    const e = document.createElement('div'); e.className = 'ck-wc';
    const l = document.createElement('span'); l.className = 'ck-wc-l'; l.textContent = w.label;
    const t = document.createElement('span'); t.className = 'ck-wc-t';
    e.append(l, t); wrap.appendChild(e); w.el = t;
  });
}

// ---------- tick ----------
function tickClock() {
  if (!state.showClock) return;
  const c = C(), real = new Date(), d = zonedNow(c.tz, real), E = _ck.els;
  if (state.showGreeting) setT($('hero-greeting'), greetingText(d));
  if (state.showDate) {
    let ds = fmtDate(d, c);
    if (c.showTz && c.tz && tzValid(c.tz)) ds += ' · ' + tzCity(c.tz);
    setT($('hero-date'), ds);
  }
  const p = timeParts(d, c);
  switch (c.style) {
    case 'stacked':
      setT(E.h, p.h); setT(E.m, p.m); setT(E.s, state.showSeconds ? p.s : ''); setT(E.ampm, p.ampm);
      break;
    case 'analog':
      setHands(d, c.aSmooth && state.showSeconds);
      break;
    case 'flip': {
      const hh = p.h.length === 1 ? ' ' + p.h : p.h;
      setFlip('h1', hh[0].trim()); setFlip('h2', hh[1]); setFlip('m1', p.m[0]); setFlip('m2', p.m[1]);
      if (_ck.flip.s1) { setFlip('s1', p.s[0]); setFlip('s2', p.s[1]); }
      setT(E.ampm, p.ampm);
      break;
    }
    case 'word':
      setT(E.w, wordTime(d));
      break;
    case 'ring': {
      setT(E.h, p.h); setT(E.m, p.m); setT(E.s, p.s); setT(E.ampm, p.ampm);
      E.secwrap.style.display = state.showSeconds ? '' : 'none';
      const frac = c.ringMode === 'day' ? (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400
        : c.ringMode === 'minutes' ? (d.getMinutes() * 60 + d.getSeconds()) / 3600
        : (d.getSeconds() + 1) / 60;
      const rp = E.rp;
      rp.classList.toggle('no-anim', frac < _ck.ringPrev);
      _ck.ringPrev = frac;
      rp.style.strokeDashoffset = (270.18 * (1 - frac)).toFixed(2);
      break;
    }
    default:
      setT(E.h, p.h); setT(E.m, p.m); setT(E.s, p.s); setT(E.ampm, p.ampm);
      E.secwrap.style.display = state.showSeconds ? '' : 'none';
  }
  _ck.world.forEach(w => {
    const wd = zonedNow(w.tz, real), wp = timeParts(wd, { leadingZero: true, showAmPm: true });
    setT(w.el, `${wp.h}:${wp.m}${wp.ampm ? ' ' + wp.ampm : ''}`);
  });
}

let _ckTimer = null, _ckRaf = null;
function scheduleClock() {
  clearTimeout(_ckTimer); cancelAnimationFrame(_ckRaf);
  const c = C();
  const loop = () => { tickClock(); _ckTimer = setTimeout(loop, 1000 - (Date.now() % 1000) + 8); };
  loop();
  if (state.showClock && c.style === 'analog' && c.aSmooth && state.showSeconds) {
    const frame = () => { setHands(zonedNow(c.tz), true); _ckRaf = requestAnimationFrame(frame); };
    _ckRaf = requestAnimationFrame(frame);
  }
}

// ---------- shrink-to-fit so huge sizes never overflow the screen ----------
function fitClock() {
  const c = C(), face = $('hero-face');
  if (!face || !state.showClock) return;
  face.style.fontSize = c.size + 'px';
  const avail = window.innerWidth * 0.92 - (c.panel ? c.panelPad * 2 : 0);
  const w = face.offsetWidth;
  if (w > avail && w > 0) face.style.fontSize = Math.max(16, c.size * avail / w).toFixed(1) + 'px';
}
window.addEventListener('resize', fitClock);

// ---------- render ----------
function renderHero() {
  const c = C(), hero = $('hero'), st = hero.style;
  hero.dataset.align = c.align;
  hero.classList.toggle('no-clock', !state.showClock);
  hero.classList.toggle('no-search', !state.showSearch);
  hero.classList.toggle('hidden', !state.showClock && !state.showSearch);
  $('hero-greeting').classList.toggle('hidden', !state.showGreeting);
  $('hero-date').classList.toggle('hidden', !state.showDate);
  const p = state.clockPos || DEFAULT_CLOCKPOS;
  st.left = p.x + '%'; st.top = p.y + '%';

  // colours — independent of the app's accent swatch by default; "Accent"/"Theme" modes opt back in
  const solid = c.colorMode === 'accent' ? 'var(--accent)' : (c.colorMode === 'default') ? 'var(--text-primary)' : c.color;
  const gradOK = c.colorMode === 'gradient' && ['digital', 'stacked', 'word'].includes(c.style) && !c.outline;
  const outlineOK = c.outline && ['digital', 'stacked', 'word'].includes(c.style);
  st.setProperty('--ck-color', solid);
  st.setProperty('--ck-seccolor', solid); // analog second hand now follows the clock's own color, not the app accent
  st.setProperty('--ck-grad', `linear-gradient(${c.gradAngle}deg, ${c.color}, ${c.color2})`);
  st.setProperty('--ck-op', c.opacity / 100);
  st.setProperty('--ck-weight', c.weight);
  st.setProperty('--ck-ls', (c.spacing / 100) + 'em');
  st.setProperty('--ck-gs', c.greetingSize + 'px');
  st.setProperty('--ck-ds', c.dateSize + 'px');
  st.setProperty('--ck-ow', c.outlineW + 'px');
  st.setProperty('--ck-pp', c.panelPad + 'px');
  st.setProperty('--ck-pr', c.panelRadius + 'px');
  const ai = { left: 'flex-start', center: 'center', right: 'flex-end' }[c.align] || 'center';
  st.setProperty('--ck-ai', ai);
  const stack = fontStack(c);
  if (stack) { st.setProperty('--ck-font', stack); ensureFont(c.font); } else st.removeProperty('--ck-font');
  // glow (drop-shadow so it follows gradient / hollow text too)
  if (c.glow > 0) {
    const gc = c.glowMode === 'custom' ? c.glowColor : c.glowMode === 'text' ? solid : 'var(--accent)';
    st.setProperty('--ck-glow', `drop-shadow(0 0 ${(c.glow * 0.12).toFixed(1)}px ${gc}) drop-shadow(0 0 ${(c.glow * 0.34).toFixed(1)}px color-mix(in srgb, ${gc} 65%, transparent))`);
  } else st.removeProperty('--ck-glow');
  // flip card colours
  const cards = { glass: ['rgba(38,40,54,.62)', 'var(--ck-color)'], dark: ['#15161d', '#f4f4f5'], light: ['#f1f1f4', '#15161d'], accent: ['var(--accent)', 'var(--on-accent, #0b0d14)'] }[c.flipCard] || [];
  st.setProperty('--ck-card-bg', cards[0]); st.setProperty('--ck-card-fg', cards[1]);

  hero.classList.toggle('ck-grad', gradOK);
  hero.classList.toggle('ck-outline', outlineOK);
  hero.classList.toggle('ck-upper', !!c.uppercase);
  hero.classList.toggle('ck-blink', !!c.blinkColon);
  hero.classList.toggle('ck-sec-same', c.secStyle === 'same');
  hero.classList.toggle('ck-tint', !!c.tintText);
  $('hero-clock').classList.toggle('ck-panel', !!c.panel);

  buildFace();
  buildWorld();
  scheduleClock();
  fitClock();
}

// ---------- settings UI ----------
function ckEls() { return document.querySelectorAll('#s-clock [data-ck]'); }
function ckCond(expr) {
  return String(expr).split(';').every(part => {
    const ne = part.includes('!=');
    const [k, v] = part.split(ne ? '!=' : '=');
    const has = v.split(',').includes(String(ckVal(k)));
    return ne ? !has : has;
  });
}
function syncClockVisibility() {
  document.querySelectorAll('#s-clock [data-if]').forEach(el => { el.style.display = ckCond(el.dataset.if) ? '' : 'none'; });
}
function syncClockUI() {
  const c = C();
  ckEls().forEach(el => {
    const v = c[el.dataset.ck];
    if (el.classList.contains('seg')) el.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.val === String(v)));
    else if (el.type === 'checkbox') el.checked = !!v;
    else if (document.activeElement !== el) el.value = v;
  });
  document.querySelectorAll('#s-clock [data-ckv]').forEach(em => { const k = em.dataset.ckv; em.textContent = (k === 'spacing' ? (c[k] / 100).toFixed(2) + 'em' : c[k] + em.dataset.unit); });
  const tz = document.querySelector('#s-clock [data-ck="tz"]');
  if (tz) tz.classList.toggle('bad', !tzValid(c.tz));
  syncClockVisibility();
}
function setCk(key, val) {
  C()[key] = val;
  saveSoon();
  renderHero();
  syncClockUI();
}
function buildClockSettings() {
  // font list
  const sel = $('ck-font-select');
  sel.innerHTML = Object.entries(CLOCK_FONTS).map(([k, f]) => `<option value="${k}">${f.label}</option>`).join('');
  // time zones
  const dl = $('ck-tz-list');
  let zones = [];
  try { zones = Intl.supportedValuesOf('timeZone'); } catch (e) {}
  if (!zones.length) zones = ['UTC', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow', 'Africa/Cairo', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland'];
  dl.innerHTML = zones.map(z => `<option value="${z}"></option>`).join('');
  // presets
  const pr = $('ck-presets');
  Object.keys(CLOCK_PRESETS).forEach(name => {
    const b = document.createElement('button');
    b.className = 'chip'; b.textContent = name; b.type = 'button';
    b.addEventListener('click', () => {
      const c = C();
      CLOCK_LOOK_KEYS.forEach(k => { c[k] = CLOCK_DEFAULTS[k]; });
      Object.assign(c, CLOCK_PRESETS[name]);
      save(); renderHero(); syncClockUI();
    });
    pr.appendChild(b);
  });
  // generic bindings: <seg data-ck>, <input data-ck>, <select data-ck>, <textarea data-ck>
  ckEls().forEach(el => {
    const key = el.dataset.ck;
    if (el.classList.contains('seg')) {
      el.addEventListener('click', (e) => { const b = e.target.closest('button[data-val]'); if (b) setCk(key, b.dataset.val); });
    } else {
      el.addEventListener('input', () => {
        const v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
        setCk(key, v);
      });
    }
  });
  // sub tabs
  $('ck-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-val]'); if (!b) return;
    $('ck-tabs').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
    document.querySelectorAll('#s-clock .ck-sec').forEach(s => s.classList.toggle('active', s.dataset.sec === b.dataset.val));
  });
  $('ck-reset').addEventListener('click', () => {
    const c = C();
    CLOCK_LOOK_KEYS.forEach(k => { c[k] = CLOCK_DEFAULTS[k]; });
    save(); renderHero(); syncClockUI();
  });
  // legacy switches also affect which options are visible / which face parts exist
  ['set-clock', 'set-seconds', 'set-date', 'set-24h'].forEach(id => $(id).addEventListener('change', syncClockVisibility));
  // dock the settings window to the side while editing the clock so the preview stays visible
  document.querySelectorAll('#settings-modal .m-tab').forEach(t => t.addEventListener('click', () => {
    $('settings-modal').classList.toggle('ck-live', t.dataset.tab === 's-clock');
  }));
  // (values are synced when the settings window opens — see syncSettingsUI in newtab.js)
}

buildClockSettings();
