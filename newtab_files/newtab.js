// ============================================================
//  VoidTab — newtab.js
//  Handles: boards, groups, bookmarks, backgrounds (scenes +
//           wallpaper), cursor effects, clock, dialogs, import /
//           export, sidebar actions, multi-select, trash, search
// ============================================================

// ---------- UTILS ----------
const $ = (id) => document.getElementById(id);
const ic = (name, size = 16) => `<svg class="ic" width="${size}" height="${size}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
function bkId() { return Math.random().toString(36).slice(2, 9); }
function groupId() { return 'g_' + Math.random().toString(36).slice(2, 7); }
function boardId() { return 'b_' + Math.random().toString(36).slice(2, 7); }

function hexToRgb(h) {
  h = String(h || '#000000').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(rgb) {
  return '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A.map((v, i) => v + (B[i] - v) * t));
}
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// ---------- STATE ----------
let state = {
  v: 2,
  boards: [
    {
      id: 'home',
      name: 'Home',
      groups: [
        {
          id: 'ai',
          name: 'AI',
          bookmarks: [
            { id: bkId(), title: 'Claude', url: 'https://claude.ai' },
            { id: bkId(), title: 'ChatGPT', url: 'https://chat.openai.com' },
            { id: bkId(), title: 'Gemini', url: 'https://gemini.google.com' }
          ]
        },
        {
          id: 'tools',
          name: 'Tools',
          bookmarks: [
            { id: bkId(), title: 'GitHub', url: 'https://github.com' },
            { id: bkId(), title: 'Tinkercad', url: 'https://tinkercad.com' }
          ]
        }
      ]
    },
    { id: 'extra', name: 'Extra', groups: [] }
  ],
  currentBoardId: 'home',
  wallpaper: '',
  theme: 'dark',
  apiKey: '',
  trash: [],
  privacyBlur: false,
  editMode: false,
  groupPositions: {}, // { [boardId]: { [groupId]: { x, y } } }
  multiSelectMode: false,
  selectedBookmarks: [], // [{groupId, bookmarkId}]
  cardEffect: 'transparent',

  // background
  scene: 'daylight',
  sceneCustom: { base: '#0b0d14', c1: '#22c55e', c2: '#6366f1' },
  sceneAnimated: true,
  scenePattern: 'none',
  sceneGrain: true,
  accent: '#22c55e',
  wpBlur: 0,
  wpDim: 0,
  cursorFx: 'off',
  cursorFxIntensity: 100,

  // clock / search
  showClock: true,
  clock24: false,
  showSeconds: false,
  showDate: true,
  showGreeting: true,
  userName: '',
  clockSize: 'm',
  clockPos: { x: 50, y: 40 },
  showSearch: true,
  clockFont: 'body',
  clockWeight: '300',
  clockColor: 'theme',
  clockColorCustom: '#ffffff',
};
const DEFAULT_CUSTOM = { ...state.sceneCustom };
const DEFAULT_CLOCKPOS = { ...state.clockPos };

let contextTarget = null; // { group, bookmark }
let dragState = null;

const GROUP_STACK_GAP_PX = 15;
const GROUP_TOP_MARGIN_PX = 20;
const GROUP_LEFT_MARGIN_PX = 20;
const GROUP_SNAP_TOLERANCE_PX = 22;
const GROUP_CARD_WIDTH_PX = 240;
const GROUP_CARD_MIN_HEIGHT_PX = 190;

function getFavicon(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch { return ''; }
}

function currentBoard() {
  return state.boards.find(b => b.id === state.currentBoardId) || state.boards[0];
}

function getBoardPositions() {
  if (!state.groupPositions) state.groupPositions = {};
  if (!state.groupPositions[state.currentBoardId]) state.groupPositions[state.currentBoardId] = {};
  return state.groupPositions[state.currentBoardId];
}

function getSnappedGroupPosition(grid, draggingGroupId, proposedX, proposedY, draggedCard) {
  let snappedX = proposedX;
  let snappedY = proposedY;
  const cards = Array.from(grid.querySelectorAll('.group-card'));
  const draggedHeight = draggedCard ? draggedCard.offsetHeight : 0;

  for (const otherCard of cards) {
    const otherGroupId = otherCard.dataset.groupId;
    if (!otherGroupId || otherGroupId === draggingGroupId) continue;
    const otherX = parseInt(otherCard.style.left || '0', 10) || 0;
    const otherY = parseInt(otherCard.style.top || '0', 10) || 0;
    const otherHeight = otherCard.offsetHeight;

    if (Math.abs(proposedX - otherX) <= GROUP_SNAP_TOLERANCE_PX) snappedX = otherX;

    const belowY = otherY + otherHeight + GROUP_STACK_GAP_PX;
    if (Math.abs(proposedX - otherX) <= GROUP_SNAP_TOLERANCE_PX && Math.abs(proposedY - belowY) <= GROUP_SNAP_TOLERANCE_PX) {
      snappedX = otherX; snappedY = belowY;
    }
    const aboveY = otherY - draggedHeight - GROUP_STACK_GAP_PX;
    if (Math.abs(proposedX - otherX) <= GROUP_SNAP_TOLERANCE_PX && Math.abs(proposedY - aboveY) <= GROUP_SNAP_TOLERANCE_PX) {
      snappedX = otherX; snappedY = aboveY;
    }
  }
  return { x: Math.max(GROUP_LEFT_MARGIN_PX, snappedX), y: Math.max(GROUP_TOP_MARGIN_PX, snappedY) };
}

// ---------- INDEXED DB for wallpaper ----------
const DB_NAME = 'VoidTabDB';
const DB_STORE = 'assets';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => { e.target.result.createObjectStore(DB_STORE); };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function dbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---------- STORAGE ----------
// State lives in chrome.storage.local. chrome.storage.sync caps a single item at
// ~8 KB, which large bookmark imports exceed. Old data is migrated from sync once.
let _saveTimer = null;
function save() {
  clearTimeout(_saveTimer);
  chrome.storage.local.set({ voidtab_state: JSON.stringify(state) });
}
function saveSoon() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(save, 250);
}

function mergeSaved(saved) {
  const custom = Object.assign({}, DEFAULT_CUSTOM, saved.sceneCustom || {});
  const pos = Object.assign({}, DEFAULT_CLOCKPOS, saved.clockPos || {});
  state = Object.assign(state, saved);
  state.sceneCustom = custom;
  state.clockPos = pos;
  if (!saved.v) { state.theme = 'dark'; } // the old theme setting had no visible effect
  state.v = 2;
}

function load(cb) {
  chrome.storage.local.get(['voidtab_state'], (result) => {
    if (result && result.voidtab_state) {
      try { mergeSaved(JSON.parse(result.voidtab_state)); } catch (e) {}
      cb();
      return;
    }
    chrome.storage.sync.get(['voidtab_state'], (legacy) => {
      if (legacy && legacy.voidtab_state) {
        try { mergeSaved(JSON.parse(legacy.voidtab_state)); save(); } catch (e) {}
      }
      cb();
    });
  });
}

// ---------- TOAST ----------
let _toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ---------- URL HELPERS ----------
function isUrlish(s) {
  s = String(s || '').trim();
  if (!s || /\s/.test(s)) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\/\S+$/i.test(s)) return true;
  if (/^localhost(:\d+)?([\/?#]\S*)?$/i.test(s)) return true;
  return /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(:\d+)?([\/?#]\S*)?$/i.test(s);
}
function normalizeUrl(input) {
  let s = String(input || '').trim();
  if (!isUrlish(s)) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s;
  try { new URL(s); } catch { return null; }
  return s;
}
function suggestTitle(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const parts = host.split('.');
    let label = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    if (parts.length >= 3 && label.length <= 3 && ['co', 'com', 'org', 'net', 'ac', 'gov', 'edu'].includes(label)) label = parts[parts.length - 3];
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch { return url; }
}
function urlKey(u) { return String(u).toLowerCase().replace(/\/+$/, ''); }

// ---------- THEME / ACCENT / SCENE ----------
const SCENES = {
  daylight: { name: 'Daylight', bg: ['#f7faf8', '#eef3ef'], lbg: ['#f7faf8', '#eef3ef'], c: ['#22c55e', '#a855f7', '#4ade80', '#8b5cf6'], forceTone: 'light' },
  void:   { name: 'Void',   bg: ['#05070a', '#0c1117'], lbg: ['#eef4f0', '#dbe8e0'], c: ['#22c55e', '#0d9488', '#2563eb', '#15803d'] },
  aurora: { name: 'Aurora', bg: ['#050813', '#0b1330'], lbg: ['#eef0fb', '#e0e4f7'], c: ['#2dd4bf', '#6366f1', '#a855f7', '#22d3ee'] },
  sunset: { name: 'Sunset', bg: ['#12080f', '#22101c'], lbg: ['#fbf0ee', '#f6e1e6'], c: ['#f97316', '#ec4899', '#8b5cf6', '#f43f5e'] },
  ocean:  { name: 'Ocean',  bg: ['#040d17', '#07203a'], lbg: ['#ecf5fb', '#d9ebf7'], c: ['#0ea5e9', '#22d3ee', '#3b82f6', '#14b8a6'] },
  ember:  { name: 'Ember',  bg: ['#100705', '#1f0e09'], lbg: ['#fbf1ec', '#f5e0d6'], c: ['#ef4444', '#f97316', '#f59e0b', '#b91c1c'] },
  forest: { name: 'Forest', bg: ['#040b06', '#0a1a10'], lbg: ['#eff6ee', '#dcebd9'], c: ['#22c55e', '#16a34a', '#84cc16', '#0f766e'] },
  dusk:   { name: 'Dusk',   bg: ['#0d0913', '#1a1027'], lbg: ['#f6eff9', '#eadcf3'], c: ['#f472b6', '#c084fc', '#818cf8', '#fb7185'] },
  mono:   { name: 'Mono',   bg: ['#08080a', '#151518'], lbg: ['#f3f3f4', '#e4e4e7'], c: ['#e5e7eb', '#6b7280', '#9ca3af', '#374151'] },
};
const ACCENTS = ['#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#eab308', '#ef4444'];

function resolvedTheme() {
  if (state.theme === 'light' || state.theme === 'dark') return state.theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function hasWallpaper() { return !!state.wallpaper; }
function effectiveTone() {
  if (hasWallpaper()) return 'dark';
  if (state.scene === 'custom') return luminance(state.sceneCustom.base) > 0.4 ? 'light' : 'dark';
  const preset = SCENES[state.scene];
  if (preset && preset.forceTone) return preset.forceTone;
  return resolvedTheme() === 'light' ? 'light' : 'dark';
}

function applyAccent() {
  const a = /^#[0-9a-f]{6}$/i.test(state.accent) ? state.accent : '#22c55e';
  const s = document.documentElement.style;
  s.setProperty('--accent', a);
  s.setProperty('--accent-rgb', hexToRgb(a).join(','));
  s.setProperty('--on-accent', luminance(a) > 0.45 ? '#0b0d12' : '#ffffff');
}

function applyScene() {
  const root = document.documentElement;
  const tone = effectiveTone();
  root.setAttribute('data-theme', resolvedTheme());
  root.setAttribute('data-tone', tone);
  root.setAttribute('data-anim', state.sceneAnimated ? 'on' : 'off');
  root.setAttribute('data-pattern', state.scenePattern || 'none');
  root.setAttribute('data-grain', state.sceneGrain ? 'on' : 'off');
  document.body.classList.toggle('has-wp', hasWallpaper());

  let bg, c;
  if (state.scene === 'custom') {
    const cu = state.sceneCustom;
    bg = [cu.base, mixHex(cu.base, tone === 'light' ? '#ffffff' : '#000000', tone === 'light' ? 0.25 : 0.35)];
    c = [cu.c1, cu.c2, cu.c1, cu.c2];
  } else {
    const s = SCENES[state.scene] || SCENES.void;
    bg = tone === 'light' ? s.lbg : s.bg;
    c = s.c;
  }
  const st = $('scene').style;
  st.setProperty('--sc-bg1', bg[0]); st.setProperty('--sc-bg2', bg[1]);
  c.forEach((col, i) => st.setProperty(`--sc-c${i + 1}`, col));
  root.style.setProperty('--sc-bg1', bg[0]);
  root.style.setProperty('--blob-o', tone === 'light' ? '0.34' : '0.5');
}

function applyCardEffect() {
  document.documentElement.setAttribute('data-card-effect', state.cardEffect || 'transparent');
}

async function applyWallpaper() {
  const bg = $('wallpaper-bg');
  const root = document.documentElement.style;
  root.setProperty('--wp-blur', (state.wpBlur || 0) + 'px');
  root.setProperty('--wp-dim', String((state.wpDim || 0) / 100));
  if (state.wallpaper === '__local__') {
    try {
      const local = await dbGet('voidtab_wallpaper_local');
      if (local) bg.style.backgroundImage = `url('${local}')`;
      else { bg.style.backgroundImage = ''; state.wallpaper = ''; }
    } catch {
      bg.style.backgroundImage = ''; state.wallpaper = '';
    }
  } else if (state.wallpaper) {
    bg.style.backgroundImage = `url('${state.wallpaper}')`;
  } else {
    bg.style.backgroundImage = '';
  }
  applyScene();
  FX.refreshColors();
}

function applyAppearance() {
  applyAccent();
  applyCardEffect();
  applyScene();
  FX.set(state.cursorFx, state.cursorFxIntensity / 100);
  FX.refreshColors();
}

// ---------- CURSOR EFFECTS ----------
const FX = {
  mode: 'off', intensity: 1, raf: 0, canvas: null, ctx: null, spot: null,
  W: 0, H: 0, dpr: 1, mouse: { x: -1000, y: -1000, on: false },
  lastRipple: { x: -999, y: -999 }, parts: [], ripples: [], trail: [], nodes: [],
  acc: '34,197,94', base: '255,255,255', light: false,

  init() {
    this.canvas = $('fx-canvas'); this.ctx = this.canvas.getContext('2d'); this.spot = $('fx-spot');
    this.resize();
    window.addEventListener('resize', () => {
      this.resize();
      if (this.mode === 'particles') this.seed();
      else if (this.mode === 'constellation') this.seedConstellation();
    });
    window.addEventListener('mousemove', (e) => this.onMove(e), { passive: true });
    window.addEventListener('mousedown', (e) => this.onDown(e), { passive: true });
    document.documentElement.addEventListener('mouseleave', () => { this.mouse.on = false; this.spot.style.opacity = 0; });
    document.documentElement.addEventListener('mouseenter', () => { if (this.mode === 'spotlight') this.spot.style.opacity = 1; });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.stop(); else this.kick(); });
  },
  refreshColors() {
    this.acc = hexToRgb(state.accent).join(',');
    this.light = document.documentElement.getAttribute('data-tone') === 'light';
    this.base = this.light ? '30,34,48' : '255,255,255';
  },
  resize() {
    if (!this.canvas) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.canvas.width = this.W * this.dpr; this.canvas.height = this.H * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  },
  set(mode, intensity) {
    if (!this.canvas) return;
    intensity = Math.max(0.4, Math.min(2, intensity || 1));
    if (mode === this.mode && intensity === this.intensity) return;
    const modeChanged = mode !== this.mode;
    this.mode = mode; this.intensity = intensity;
    if (modeChanged) { this.ripples = []; this.trail = []; this.stop(); this.ctx.clearRect(0, 0, this.W, this.H); }
    this.spot.style.opacity = (mode === 'spotlight' && this.mouse.on) ? 1 : 0;
    if (mode === 'particles') this.seed();
    else if (mode === 'constellation') this.seedConstellation();
    this.kick();
  },
  seed() {
    const n = Math.round(Math.min(160, (this.W * this.H) / 16000) * this.intensity);
    this.parts = Array.from({ length: n }, () => ({
      x: Math.random() * this.W, y: Math.random() * this.H,
      vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35, r: 0.8 + Math.random() * 1.5,
    }));
  },
  seedConstellation() {
    const n = Math.round(Math.min(90, (this.W * this.H) / 22000) * this.intensity);
    this.nodes = Array.from({ length: n }, () => ({
      x: Math.random() * this.W, y: Math.random() * this.H,
      vx: (Math.random() - 0.5) * 0.08, vy: (Math.random() - 0.5) * 0.08,
    }));
  },
  onMove(e) {
    this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.on = true;
    if (this.mode === 'spotlight') {
      this.spot.style.setProperty('--mx', e.clientX + 'px');
      this.spot.style.setProperty('--my', e.clientY + 'px');
      this.spot.style.opacity = 1;
    } else if (this.mode === 'ripples') {
      const dx = e.clientX - this.lastRipple.x, dy = e.clientY - this.lastRipple.y;
      if (dx * dx + dy * dy > 2500) {
        this.lastRipple = { x: e.clientX, y: e.clientY };
        this.ripples.push({ x: e.clientX, y: e.clientY, r: 2, a: 0.45 * Math.min(1.4, this.intensity), big: false });
        this.kick();
      }
    } else if (this.mode === 'trail') {
      const last = this.trail[this.trail.length - 1];
      if (!last || Math.hypot(e.clientX - last.x, e.clientY - last.y) > 3) {
        this.trail.push({ x: e.clientX, y: e.clientY, l: 1 });
        if (this.trail.length > 60) this.trail.shift();
      }
      this.kick();
    } else if (this.mode === 'particles') { this.kick(); }
    else if (this.mode === 'constellation') { this.kick(); }
  },
  onDown(e) {
    if (this.mode === 'ripples') {
      this.ripples.push({ x: e.clientX, y: e.clientY, r: 2, a: 0.75 * Math.min(1.4, this.intensity), big: true });
      this.kick();
    }
  },
  kick() {
    if (this.raf || this.mode === 'off' || this.mode === 'spotlight' || document.hidden) return;
    this.raf = requestAnimationFrame(() => this.loop());
  },
  stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; },
  loop() {
    this.raf = 0;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    let more = false;
    if (this.mode === 'particles') { this.drawParticles(); more = true; }
    else if (this.mode === 'constellation') { this.drawConstellation(); more = true; }
    else if (this.mode === 'ripples') more = this.drawRipples();
    else if (this.mode === 'trail') more = this.drawTrail();
    if (more) this.raf = requestAnimationFrame(() => this.loop());
  },
  drawParticles() {
    const ctx = this.ctx, m = this.mouse, P = this.parts, k = this.intensity;
    const LINK = 95, GRAB = 170, PUSH = 60;
    for (const p of P) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > this.W) p.vx *= -1;
      if (p.y < 0 || p.y > this.H) p.vy *= -1;
      if (m.on) {
        const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy);
        if (d < PUSH && d > 0.5) { const f = (1 - d / PUSH) * 2.4; p.x += dx / d * f; p.y += dy / d * f; }
      }
    }
    ctx.lineWidth = 1;
    for (let i = 0; i < P.length; i++) {
      const a = P[i];
      ctx.fillStyle = `rgba(${this.base},${Math.min(0.75, 0.42 * k)})`;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.283); ctx.fill();
      for (let j = i + 1; j < P.length; j++) {
        const b = P[j], dx = a.x - b.x, dy = a.y - b.y;
        if (Math.abs(dx) > LINK || Math.abs(dy) > LINK) continue;
        const d = Math.hypot(dx, dy);
        if (d < LINK) {
          ctx.strokeStyle = `rgba(${this.base},${(1 - d / LINK) * 0.16 * k})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      if (m.on) {
        const d = Math.hypot(a.x - m.x, a.y - m.y);
        if (d < GRAB) {
          ctx.strokeStyle = `rgba(${this.acc},${Math.min(0.9, (1 - d / GRAB) * 0.6 * k)})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(m.x, m.y); ctx.stroke();
        }
      }
    }
  },
  drawConstellation() {
    const ctx = this.ctx, m = this.mouse, P = this.nodes, k = this.intensity;
    const LINK = 130, GLOW = 230;
    for (const p of P) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > this.W) p.vx *= -1;
      if (p.y < 0 || p.y > this.H) p.vy *= -1;
    }
    if (m.on) {
      const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 260 * k);
      g.addColorStop(0, `rgba(${this.acc},${0.14 * k})`); g.addColorStop(1, `rgba(${this.acc},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x, m.y, 260 * k, 0, 6.283); ctx.fill();
    }
    ctx.lineWidth = 1;
    for (let i = 0; i < P.length; i++) {
      const a = P[i];
      const distM = m.on ? Math.hypot(a.x - m.x, a.y - m.y) : 9999;
      const near = Math.max(0, 1 - distM / GLOW);
      for (let j = i + 1; j < P.length; j++) {
        const b = P[j], dx = a.x - b.x, dy = a.y - b.y;
        if (Math.abs(dx) > LINK || Math.abs(dy) > LINK) continue;
        const d = Math.hypot(dx, dy);
        if (d >= LINK) continue;
        const midNear = m.on ? Math.max(0, 1 - Math.hypot((a.x + b.x) / 2 - m.x, (a.y + b.y) / 2 - m.y) / GLOW) : 0;
        if (midNear > 0.06) {
          ctx.strokeStyle = `rgba(${this.acc},${Math.min(0.9, 0.1 * k + midNear * 0.75)})`;
        } else {
          ctx.strokeStyle = `rgba(${this.base},${(1 - d / LINK) * 0.1 * k})`;
        }
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      const r = 1.2 + near * 1.8;
      ctx.beginPath(); ctx.arc(a.x, a.y, r, 0, 6.283);
      if (near > 0.12) {
        ctx.shadowColor = `rgba(${this.acc},${Math.min(1, near)})`; ctx.shadowBlur = 9 * near;
        ctx.fillStyle = `rgba(${this.acc},${Math.min(1, 0.4 + near * 0.6)})`;
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(${this.base},${0.3 * k})`;
      }
      ctx.fill(); ctx.shadowBlur = 0;
    }
  },
  drawRipples() {
    const ctx = this.ctx;
    ctx.lineWidth = 1.5;
    this.ripples = this.ripples.filter(r => r.a > 0.02);
    for (const r of this.ripples) {
      r.r += r.big ? 3.4 : 2.1; r.a *= 0.955;
      ctx.strokeStyle = `rgba(${this.acc},${r.a})`;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 6.283); ctx.stroke();
      ctx.strokeStyle = `rgba(${this.base},${r.a * 0.45})`;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r * 0.62, 0, 6.283); ctx.stroke();
    }
    return this.ripples.length > 0;
  },
  drawTrail() {
    const ctx = this.ctx, T = this.trail, k = this.intensity;
    for (const p of T) p.l -= 0.03;
    while (T.length && T[0].l <= 0) T.shift();
    if (!T.length) return false;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = this.light ? 'source-over' : 'lighter';
    for (let i = 1; i < T.length; i++) {
      const a = T[i - 1], b = T[i];
      ctx.strokeStyle = `rgba(${this.acc},${Math.min(1, b.l * 0.7 * k)})`;
      ctx.lineWidth = Math.max(0.5, b.l * 9 * k);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    const h = T[T.length - 1];
    const g = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, 26 * k);
    g.addColorStop(0, `rgba(${this.acc},${0.5 * h.l})`); g.addColorStop(1, `rgba(${this.acc},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(h.x, h.y, 26 * k, 0, 6.283); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    return true;
  },
};

// ---------- CLOCK / HERO ----------
function greetingText() {
  const h = new Date().getHours();
  const g = h >= 5 && h < 12 ? 'Good morning' : h >= 12 && h < 17 ? 'Good afternoon' : h >= 17 && h < 22 ? 'Good evening' : 'Good night';
  const n = (state.userName || '').trim();
  return n ? `${g}, ${n}` : g;
}
function tickClock() {
  if (!state.showClock) return;
  const d = new Date();
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  let ampm = '';
  if (state.clock24) h = String(h).padStart(2, '0');
  else { ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; }
  $('hero-hm').textContent = `${h}:${m}`;
  $('hero-sec').textContent = state.showSeconds ? `:${s}` : '';
  $('hero-ampm').textContent = ampm;
  $('hero-date').textContent = d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  $('hero-greeting').textContent = greetingText();
}
const CLOCK_FONTS = {
  body: 'var(--font-body)',
  display: 'var(--font-display)',
  mono: "ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace",
  serif: "Georgia, 'Times New Roman', serif",
};
function applyClockStyle() {
  const root = document.documentElement.style;
  root.setProperty('--clock-font', CLOCK_FONTS[state.clockFont] || CLOCK_FONTS.body);
  root.setProperty('--clock-weight', state.clockWeight || '300');
  const color = state.clockColor === 'accent' ? 'var(--accent)'
    : state.clockColor === 'custom' ? (state.clockColorCustom || '#ffffff')
    : 'var(--text-primary)';
  root.setProperty('--clock-color', color);
}
function renderHero() {
  const hero = $('hero');
  hero.dataset.size = state.clockSize || 'm';
  applyClockStyle();
  hero.classList.toggle('no-clock', !state.showClock);
  hero.classList.toggle('no-search', !state.showSearch);
  hero.classList.toggle('hidden', !state.showClock && !state.showSearch);
  $('hero-greeting').classList.toggle('hidden', !state.showGreeting);
  $('hero-date').classList.toggle('hidden', !state.showDate);
  const p = state.clockPos || DEFAULT_CLOCKPOS;
  hero.style.left = p.x + '%';
  hero.style.top = p.y + '%';
  tickClock();
}
setInterval(tickClock, 1000);

function looksLikeUrl(q) { return isUrlish(q); }
function runSearch(q) {
  q = q.trim();
  if (!q) return;
  if (looksLikeUrl(q)) { location.href = normalizeUrl(q); return; }
  if (chrome.search && chrome.search.query) chrome.search.query({ text: q, disposition: 'CURRENT_TAB' });
  else location.href = 'https://www.google.com/search?q=' + encodeURIComponent(q);
}
$('hero-search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') runSearch(e.target.value);
  if (e.key === 'Escape') e.target.blur();
});

// Drag the clock in edit mode
$('hero').addEventListener('mousedown', (e) => {
  if (!state.editMode) return;
  e.preventDefault();
  const start = { x: e.clientX, y: e.clientY, px: state.clockPos.x, py: state.clockPos.y };
  const onMove = (ev) => {
    const x = Math.max(8, Math.min(92, start.px + (ev.clientX - start.x) / window.innerWidth * 100));
    const y = Math.max(14, Math.min(90, start.py + (ev.clientY - start.y) / window.innerHeight * 100));
    state.clockPos = { x: +x.toFixed(2), y: +y.toFixed(2) };
    $('hero').style.left = state.clockPos.x + '%';
    $('hero').style.top = state.clockPos.y + '%';
  };
  const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); save(); };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
});

// ---------- RENDER BOARDS ----------
function renderBoardTabs() {
  const list = $('board-tabs-list');
  list.innerHTML = '';
  state.boards.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'board-tab' + (b.id === state.currentBoardId ? ' active' : '');
    btn.textContent = b.name;
    btn.title = 'Double-click to rename, right-click to delete';
    btn.addEventListener('click', () => { state.currentBoardId = b.id; save(); render(); });
    btn.addEventListener('dblclick', async () => {
      const r = await askForm({ title: 'Rename board', fields: [{ name: 'name', label: 'Board name', value: b.name, required: true }], submit: 'Rename' });
      if (r && r.name.trim()) { b.name = r.name.trim(); save(); renderBoardTabs(); }
    });
    btn.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      if (state.boards.length < 2) { toast('You need at least one board'); return; }
      const ok = await askConfirm({ title: 'Delete board', message: `Delete "${b.name}" and everything in it?`, confirmText: 'Delete', danger: true });
      if (!ok) return;
      state.boards = state.boards.filter(x => x.id !== b.id);
      if (state.currentBoardId === b.id) state.currentBoardId = state.boards[0].id;
      save(); render();
    });
    list.appendChild(btn);
  });
}

function makeFaviconPlaceholder(title) {
  const el = document.createElement('div');
  el.className = 'bookmark-favicon-placeholder';
  const t = title || '?';
  el.textContent = t[0].toUpperCase();
  let h = 0; for (const ch of t) h = (h * 31 + ch.charCodeAt(0)) % 360;
  el.style.setProperty('--h', h);
  return el;
}

// ---------- RENDER GROUPS ----------
function renderGroups() {
  const grid = $('main-grid');
  grid.innerHTML = '';
  const board = currentBoard();
  if (!board) return;
  const boardPositions = getBoardPositions();
  const placedCards = [];

  const cardWidth = GROUP_CARD_WIDTH_PX;
  const gap = 14;
  const columns = Math.max(1, Math.floor((grid.clientWidth - 20) / (cardWidth + gap)));

  board.groups.forEach((group, index) => {
    const card = document.createElement('div');
    card.className = 'group-card';
    card.dataset.groupId = group.id;
    card.style.setProperty('--i', index);
    if (state.editMode) card.classList.add('edit-enabled');
    card.draggable = false;

    const header = document.createElement('div');
    header.className = 'group-header';
    const title = document.createElement('span');
    title.className = 'group-title';
    title.textContent = group.name;
    title.title = 'Double-click to rename';
    title.addEventListener('dblclick', async () => {
      const r = await askForm({ title: 'Rename group', fields: [{ name: 'name', label: 'Group name', value: group.name, required: true }], submit: 'Rename' });
      if (r && r.name.trim()) { group.name = r.name.trim(); save(); renderGroups(); }
    });
    const addBtn = document.createElement('button');
    addBtn.className = 'group-add-btn';
    addBtn.title = 'Add bookmark';
    addBtn.innerHTML = ic('plus', 12);
    addBtn.addEventListener('click', () => openBookmarkModal(group));
    const delBtn = document.createElement('button');
    delBtn.className = 'group-delete-btn';
    delBtn.innerHTML = ic('x', 12);
    delBtn.title = 'Delete group';
    delBtn.addEventListener('click', async () => {
      const ok = await askConfirm({ title: 'Delete group', message: `Delete "${group.name}" and its ${group.bookmarks.length} bookmark(s)?`, confirmText: 'Delete', danger: true });
      if (!ok) return;
      const b = currentBoard();
      b.groups = b.groups.filter(g => g.id !== group.id);
      save(); renderGroups();
    });
    const dragHandle = document.createElement('span');
    dragHandle.className = 'drag-handle';
    dragHandle.innerHTML = ic('grip', 14);
    dragHandle.title = 'Drag group';
    dragHandle.classList.toggle('hidden', !state.editMode);

    header.append(title, dragHandle, addBtn, delBtn);
    card.appendChild(header);

    const bookmarkList = document.createElement('div');
    bookmarkList.className = 'bookmark-list';
    bookmarkList.dataset.groupId = group.id;

    group.bookmarks.forEach(bk => {
      const item = document.createElement('div');
      item.className = 'bookmark-item';
      if (state.editMode) item.classList.add('edit-enabled');
      item.draggable = !!state.editMode;
      if (state.selectedBookmarks.some(s => s.bookmarkId === bk.id)) item.classList.add('selected');
      item.dataset.bookmarkId = bk.id;

      const favicon = document.createElement('img');
      favicon.className = 'bookmark-favicon';
      favicon.src = getFavicon(bk.url);
      favicon.onerror = () => { favicon.replaceWith(makeFaviconPlaceholder(bk.title)); };

      const titleEl = document.createElement('span');
      titleEl.className = 'bookmark-title';
      titleEl.textContent = bk.title;

      const actionsEl = document.createElement('div');
      actionsEl.className = 'bookmark-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'bk-action-btn bk-edit-btn';
      editBtn.title = 'Edit';
      editBtn.innerHTML = ic('edit', 11);
      editBtn.addEventListener('click', (e) => { e.stopPropagation(); openBookmarkModal(group, bk); });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'bk-action-btn bk-delete-btn';
      deleteBtn.title = 'Delete';
      deleteBtn.innerHTML = ic('trash', 11);
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        group.bookmarks = group.bookmarks.filter(b => b.id !== bk.id);
        state.trash.push({ ...bk, deletedAt: Date.now(), fromGroup: group.name });
        save(); renderGroups();
      });

      actionsEl.append(editBtn, deleteBtn);
      item.append(favicon, titleEl, actionsEl);

      item.addEventListener('click', () => {
        if (state.editMode) return;
        if (state.multiSelectMode) toggleSelect(group.id, bk.id, item);
        else window.open(bk.url, '_blank');
      });
      item.addEventListener('contextmenu', (e) => {
        if (state.editMode) return;
        e.preventDefault();
        contextTarget = { group, bookmark: bk };
        showContextMenu(e.clientX, e.clientY);
      });

      bookmarkList.appendChild(item);
    });
    card.appendChild(bookmarkList);

    if (!boardPositions[group.id]) {
      boardPositions[group.id] = {
        x: GROUP_LEFT_MARGIN_PX + (index % columns) * (cardWidth + gap),
        y: GROUP_TOP_MARGIN_PX + Math.floor(index / columns) * 220,
      };
    }
    const pos = boardPositions[group.id];
    card.style.position = 'absolute';
    card.style.left = `${Math.max(GROUP_LEFT_MARGIN_PX, pos.x || 0)}px`;
    card.style.top = `${Math.max(GROUP_TOP_MARGIN_PX, pos.y || 0)}px`;
    card.style.width = `${GROUP_CARD_WIDTH_PX}px`;
    card.style.minHeight = `${GROUP_CARD_MIN_HEIGHT_PX}px`;
    placedCards.push(card);
    grid.appendChild(card);
  });

  // Add-group card: follows the hovered column (or sits in the first slot on an empty board)
  const addCard = document.createElement('div');
  addCard.className = 'add-group-card';
  addCard.id = 'add-group-card';
  const empty = board.groups.length === 0;
  addCard.innerHTML = `${ic('plus', 14)}<span>${empty ? 'Create your first group' : 'New Group'}</span>`;
  addCard.addEventListener('click', () => { $('new-group-name').value = ''; openModal('add-group-modal'); setTimeout(() => $('new-group-name').focus(), 50); });
  addCard.classList.toggle('hidden', !!state.editMode);
  addCard.style.position = 'absolute';
  addCard.style.width = `${GROUP_CARD_WIDTH_PX}px`;
  addCard.style.left = `${GROUP_LEFT_MARGIN_PX}px`;
  addCard.style.top = `${GROUP_TOP_MARGIN_PX}px`;
  addCard.style.transition = 'opacity 0.15s ease, left 0.15s ease, top 0.15s ease';
  addCard.style.opacity = empty ? '1' : '0';
  addCard.classList.toggle('visible', empty);
  grid.appendChild(addCard);

  requestAnimationFrame(() => {
    let maxBottom = 0;
    placedCards.forEach((card) => {
      const top = parseInt(card.style.top || '0', 10) || 0;
      maxBottom = Math.max(maxBottom, top + card.offsetHeight);
    });
    grid.style.minHeight = `${Math.max(520, maxBottom + 120)}px`;
  });

  initDragAndDrop();
}

// One global listener: reposition the "New Group" card under the hovered column
let _addGroupRaf = false;
document.addEventListener('mousemove', (e) => {
  if (state.editMode || _addGroupRaf) return;
  const grid = $('main-grid');
  const addCard = $('add-group-card');
  if (!addCard || !currentBoard() || !currentBoard().groups.length) return;
  _addGroupRaf = true;
  requestAnimationFrame(() => {
    _addGroupRaf = false;
    const rect = grid.getBoundingClientRect();
    const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!inside || document.querySelector('.modal:not(.hidden)')) { addCard.style.opacity = '0'; addCard.classList.remove('visible'); return; }
    const mouseX = e.clientX - rect.left + grid.scrollLeft;
    const cards = Array.from(grid.querySelectorAll('.group-card'));
    if (!cards.length) return;
    const cols = {};
    cards.forEach(c => {
      const x = parseInt(c.style.left || '0', 10);
      const key = Math.round(x / 10) * 10;
      (cols[key] = cols[key] || { x, cards: [] }).cards.push(c);
    });
    let best = null, bestDist = Infinity;
    Object.values(cols).forEach(col => {
      const d = Math.abs(mouseX - (col.x + GROUP_CARD_WIDTH_PX / 2));
      if (d < bestDist) { bestDist = d; best = col; }
    });
    if (!best) return;
    let colBottom = GROUP_TOP_MARGIN_PX;
    best.cards.forEach(c => { colBottom = Math.max(colBottom, (parseInt(c.style.top || '0', 10) || 0) + c.offsetHeight); });
    addCard.style.opacity = '1';
    addCard.classList.add('visible');
    addCard.style.left = `${best.x}px`;
    addCard.style.top = `${colBottom + GROUP_STACK_GAP_PX}px`;
  });
});
document.addEventListener('mouseleave', () => { const a = $('add-group-card'); if (a && currentBoard().groups.length) { a.style.opacity = '0'; a.classList.remove('visible'); } });

// Forward wheel scrolling to the grid when the cursor is over empty space
document.addEventListener('wheel', (e) => {
  if (e.target.closest && e.target.closest('#main-grid, .modal, #ai-panel, #search-results')) return;
  $('main-grid').scrollTop += e.deltaY;
}, { passive: true });

// ---------- FULL RENDER ----------
async function render() {
  applyAppearance();
  renderBoardTabs();
  renderGroups();
  renderHero();
  updatePrivacyBtn();
  updateEditModeBtn();
  updateMultiselectBtn();
  await applyWallpaper();
}

function moveBookmark(bookmarkId, fromGroupId, toGroupId, toIndex) {
  const board = currentBoard();
  const fromGroup = board.groups.find((g) => g.id === fromGroupId);
  const toGroup = board.groups.find((g) => g.id === toGroupId);
  if (!fromGroup || !toGroup) return;
  const oldIndex = fromGroup.bookmarks.findIndex((b) => b.id === bookmarkId);
  if (oldIndex < 0) return;
  const [moved] = fromGroup.bookmarks.splice(oldIndex, 1);
  toGroup.bookmarks.splice(toIndex, 0, moved);
}

function getInsertIndexFromPointer(evt, targetEl, baseIndex) {
  const rect = targetEl.getBoundingClientRect();
  return baseIndex + (evt.clientY > rect.top + rect.height / 2 ? 1 : 0);
}

function clearGroupDropIndicators() {
  document.querySelectorAll('.group-card.drop-before, .group-card.drop-after').forEach((el) => el.classList.remove('drop-before', 'drop-after'));
}
function clearDropTargets() {
  document.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));
}

function initDragAndDrop() {
  if (!state.editMode) return;

  const grid = $('main-grid');
  const cards = document.querySelectorAll('.group-card');
  const bookmarkLists = document.querySelectorAll('.bookmark-list');
  const bookmarkItems = document.querySelectorAll('.bookmark-item');

  cards.forEach((card) => {
    const groupId = card.dataset.groupId;
    const handle = card.querySelector('.drag-handle');
    if (!handle) return;

    handle.addEventListener('mousedown', (evt) => {
      evt.preventDefault();
      const boardPositions = getBoardPositions();
      const startPos = boardPositions[groupId] || { x: 0, y: 0 };
      const startX = evt.clientX, startY = evt.clientY;
      card.classList.add('drag-chosen', 'drag-active');

      const onMove = (moveEvt) => {
        const snapped = getSnappedGroupPosition(grid, groupId, startPos.x + moveEvt.clientX - startX, startPos.y + moveEvt.clientY - startY, card);
        boardPositions[groupId] = { x: snapped.x, y: snapped.y };
        card.style.left = `${snapped.x}px`;
        card.style.top = `${snapped.y}px`;
      };
      const onUp = () => {
        card.classList.remove('drag-chosen', 'drag-active');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        save();
        requestAnimationFrame(() => {
          let maxBottom = 0;
          document.querySelectorAll('.group-card').forEach((c) => {
            maxBottom = Math.max(maxBottom, (parseInt(c.style.top || '0', 10) || 0) + c.offsetHeight);
          });
          grid.style.minHeight = `${Math.max(520, maxBottom + 40)}px`;
        });
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });

  let dropLine = $('vt-drop-line');
  if (!dropLine) {
    dropLine = document.createElement('div');
    dropLine.id = 'vt-drop-line';
    document.body.appendChild(dropLine);
  }
  function showDropLine(targetItem, before) {
    const rect = targetItem.getBoundingClientRect();
    dropLine.style.display = 'block';
    dropLine.style.left = rect.left + 'px';
    dropLine.style.width = rect.width + 'px';
    dropLine.style.top = ((before ? rect.top : rect.bottom) - 1) + 'px';
  }
  function hideDropLine() { dropLine.style.display = 'none'; }

  bookmarkItems.forEach((item) => {
    item.addEventListener('dragstart', (evt) => {
      const list = item.closest('.bookmark-list');
      if (!list) return;
      dragState = { type: 'bookmark', bookmarkId: item.dataset.bookmarkId, fromGroupId: list.dataset.groupId };
      item.classList.add('drag-chosen', 'drag-active');
      evt.dataTransfer.effectAllowed = 'move';
      evt.dataTransfer.setData('text/plain', `bookmark:${item.dataset.bookmarkId}`);
    });
    item.addEventListener('dragend', () => {
      dragState = null;
      item.classList.remove('drag-chosen', 'drag-active');
      clearDropTargets(); clearGroupDropIndicators(); hideDropLine();
    });
    item.addEventListener('dragover', (evt) => {
      if (!dragState || dragState.type !== 'bookmark') return;
      evt.preventDefault();
      evt.dataTransfer.dropEffect = 'move';
      const rect = item.getBoundingClientRect();
      showDropLine(item, evt.clientY < rect.top + rect.height / 2);
    });
    item.addEventListener('dragleave', (evt) => { if (!item.contains(evt.relatedTarget)) hideDropLine(); });
    item.addEventListener('drop', (evt) => {
      if (!dragState || dragState.type !== 'bookmark') return;
      evt.preventDefault();
      hideDropLine();
      const { bookmarkId, fromGroupId } = dragState;
      const toList = item.closest('.bookmark-list');
      if (!toList) return;
      const toGroupId = toList.dataset.groupId;
      if (!bookmarkId || !fromGroupId || !toGroupId) return;
      const board = currentBoard();
      const toGroup = board.groups.find((g) => g.id === toGroupId);
      if (!toGroup) return;
      const baseIndex = toGroup.bookmarks.findIndex((b) => b.id === item.dataset.bookmarkId);
      if (baseIndex < 0) return;
      const oldIndex = (board.groups.find((g) => g.id === fromGroupId) || { bookmarks: [] }).bookmarks.findIndex((b) => b.id === bookmarkId);
      let newIndex = getInsertIndexFromPointer(evt, item, baseIndex);
      if (fromGroupId === toGroupId && oldIndex > -1 && oldIndex < newIndex) newIndex -= 1;
      moveBookmark(bookmarkId, fromGroupId, toGroupId, newIndex);
      save(); renderGroups();
    });
  });

  bookmarkLists.forEach((list) => {
    list.addEventListener('dragover', (evt) => {
      if (!dragState || dragState.type !== 'bookmark') return;
      evt.preventDefault();
      evt.dataTransfer.dropEffect = 'move';
      const items = list.querySelectorAll('.bookmark-item');
      if (items.length > 0) {
        const lastItem = items[items.length - 1];
        if (evt.clientY > lastItem.getBoundingClientRect().bottom - 4) { showDropLine(lastItem, false); list.classList.add('drop-target'); }
      } else list.classList.add('drop-target');
    });
    list.addEventListener('dragleave', (evt) => { if (!list.contains(evt.relatedTarget)) { list.classList.remove('drop-target'); hideDropLine(); } });
    list.addEventListener('drop', (evt) => {
      if (!dragState || dragState.type !== 'bookmark') return;
      evt.preventDefault();
      hideDropLine(); list.classList.remove('drop-target');
      const { bookmarkId, fromGroupId } = dragState;
      const toGroupId = list.dataset.groupId;
      if (!bookmarkId || !fromGroupId || !toGroupId) return;
      const toGroup = currentBoard().groups.find((g) => g.id === toGroupId);
      if (!toGroup) return;
      moveBookmark(bookmarkId, fromGroupId, toGroupId, toGroup.bookmarks.length);
      save(); renderGroups();
    });
  });
}

// ---------- MODAL HELPERS ----------
let _dlg = null;
function openModal(id) { $(id).classList.remove('hidden'); }
function closeModal(id) {
  $(id).classList.add('hidden');
  if (id === 'dialog-modal' && _dlg) { const d = _dlg; _dlg = null; d.resolve(null); }
  if (id === 'bulk-modal') resetImportPlan();
}
function anyModalOpen() { return !!document.querySelector('.modal:not(.hidden)'); }

document.querySelectorAll('.modal-close-btn').forEach(btn => {
  btn.addEventListener('click', () => { const m = btn.closest('.modal'); if (m) closeModal(m.id); });
});
document.querySelectorAll('.modal').forEach(modal => {
  let downOnBackdrop = false;
  modal.addEventListener('mousedown', (e) => { downOnBackdrop = e.target === modal; });
  modal.addEventListener('click', (e) => { if (e.target === modal && downOnBackdrop) closeModal(modal.id); });
});

// Tabs inside modals
document.querySelectorAll('.m-tabs').forEach(tabs => {
  tabs.addEventListener('click', (e) => {
    const t = e.target.closest('.m-tab');
    if (!t) return;
    const box = tabs.closest('.modal-box');
    box.querySelectorAll('.m-tab').forEach(x => x.classList.toggle('active', x === t));
    box.querySelectorAll('.m-panel').forEach(p => p.classList.toggle('active', p.id === t.dataset.tab));
    if (t.dataset.tab === 'io-export') refreshExport();
  });
});

// Generic form dialog (replaces prompt())
function askForm({ title, message = '', fields = [], submit = 'Save', danger = false }) {
  return new Promise((resolve) => {
    if (_dlg) { const d = _dlg; _dlg = null; d.resolve(null); }
    const box = $('dialog-box');
    box.innerHTML = '';
    const h = document.createElement('h3'); h.textContent = title; box.appendChild(h);
    if (message) { const p = document.createElement('p'); p.textContent = message; box.appendChild(p); }
    const inputs = {};
    fields.forEach(f => {
      const label = document.createElement('label'); label.className = 'field';
      const span = document.createElement('span'); span.textContent = f.label || f.name;
      const input = document.createElement('input'); input.type = 'text';
      input.value = f.value || ''; input.placeholder = f.placeholder || ''; input.autocomplete = 'off';
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSubmit(); } });
      label.append(span, input); box.appendChild(label);
      inputs[f.name] = input;
    });
    const err = document.createElement('p'); err.className = 'form-error hidden'; box.appendChild(err);
    const actions = document.createElement('div'); actions.className = 'modal-actions';
    const cancel = document.createElement('button'); cancel.className = 'btn'; cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => closeModal('dialog-modal'));
    const ok = document.createElement('button'); ok.className = 'btn ' + (danger ? 'danger' : 'primary'); ok.textContent = submit;
    ok.addEventListener('click', () => doSubmit());
    actions.append(cancel, ok); box.appendChild(actions);

    function doSubmit() {
      const values = {};
      for (const f of fields) {
        const v = inputs[f.name].value;
        if (f.required && !v.trim()) { err.textContent = `${f.label || f.name} can't be empty.`; err.classList.remove('hidden'); inputs[f.name].focus(); return; }
        if (f.validate) { const msg = f.validate(v); if (msg) { err.textContent = msg; err.classList.remove('hidden'); inputs[f.name].focus(); return; } }
        values[f.name] = v;
      }
      const d = _dlg; _dlg = null;
      $('dialog-modal').classList.add('hidden');
      if (d) d.resolve(values);
    }

    _dlg = { resolve };
    openModal('dialog-modal');
    const first = fields.length ? inputs[fields[0].name] : ok;
    setTimeout(() => { first.focus(); if (first.select) first.select(); }, 40);
  });
}
async function askConfirm({ title, message, confirmText = 'Confirm', danger = false }) {
  const r = await askForm({ title, message, fields: [], submit: confirmText, danger });
  return !!r;
}

// ---------- ADD / EDIT BOOKMARK MODAL ----------
let bmCtx = null;
let _bmFavTimer = null;

function openBookmarkModal(group, bookmark = null) {
  const board = currentBoard();
  bmCtx = { group, bookmark, titleTouched: !!bookmark };
  $('bm-heading').textContent = bookmark ? 'Edit bookmark' : 'Add bookmark';
  $('bm-save').textContent = bookmark ? 'Save changes' : 'Add bookmark';
  const sel = $('bm-group');
  sel.innerHTML = '';
  board.groups.forEach(g => sel.appendChild(new Option(g.name, g.id)));
  sel.value = group.id;
  $('bm-url').value = bookmark ? bookmark.url : '';
  $('bm-title').value = bookmark ? bookmark.title : '';
  $('bm-error').classList.add('hidden');
  updateBmPreview();
  openModal('bookmark-modal');
  setTimeout(() => { $('bm-url').focus(); $('bm-url').select(); }, 40);
}

function updateBmPreview() {
  const url = normalizeUrl($('bm-url').value);
  const fav = $('bm-fav'), letter = $('bm-letter');
  const title = $('bm-title').value.trim() || (url ? suggestTitle(url) : '');
  const g = currentBoard().groups.find(x => x.id === $('bm-group').value);
  $('bm-sub').textContent = url ? new URL(url).hostname : (g ? `Adding to ${g.name}` : '');
  if (bmCtx && bmCtx.bookmark && !url) $('bm-sub').textContent = '';
  if (!url) $('bm-sub').textContent = g ? `Adding to ${g.name}` : '';
  letter.textContent = (title || '?')[0].toUpperCase();
  clearTimeout(_bmFavTimer);
  if (!url) { fav.hidden = true; letter.hidden = false; return; }
  _bmFavTimer = setTimeout(() => {
    const src = getFavicon(url);
    fav.onload = () => { fav.hidden = false; letter.hidden = true; };
    fav.onerror = () => { fav.hidden = true; letter.hidden = false; };
    if (fav.src !== src) fav.src = src; else { fav.hidden = false; letter.hidden = true; }
  }, 250);
}

$('bm-url').addEventListener('input', () => {
  if (bmCtx && !bmCtx.titleTouched) {
    const u = normalizeUrl($('bm-url').value);
    $('bm-title').value = u ? suggestTitle(u) : '';
  }
  $('bm-error').classList.add('hidden');
  updateBmPreview();
});
$('bm-title').addEventListener('input', () => {
  if (bmCtx) bmCtx.titleTouched = $('bm-title').value.trim() !== '';
  updateBmPreview();
});
$('bm-group').addEventListener('change', updateBmPreview);
['bm-url', 'bm-title'].forEach(id => $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveBookmarkFromModal(); } }));
$('bm-save').addEventListener('click', saveBookmarkFromModal);

function saveBookmarkFromModal() {
  if (!bmCtx) return;
  const url = normalizeUrl($('bm-url').value);
  if (!url) {
    const e = $('bm-error');
    e.textContent = 'Enter a valid link, for example github.com or https://github.com';
    e.classList.remove('hidden');
    $('bm-url').focus();
    return;
  }
  const title = $('bm-title').value.trim() || suggestTitle(url);
  const board = currentBoard();
  const target = board.groups.find(g => g.id === $('bm-group').value) || bmCtx.group;
  const { group, bookmark } = bmCtx;
  if (bookmark) {
    bookmark.title = title; bookmark.url = url;
    if (target !== group) {
      group.bookmarks = group.bookmarks.filter(b => b.id !== bookmark.id);
      target.bookmarks.push(bookmark);
    }
  } else {
    target.bookmarks.push({ id: bkId(), title, url });
  }
  save(); renderGroups();
  closeModal('bookmark-modal');
  toast(bookmark ? 'Bookmark updated' : `Added "${title}" to ${target.name}`);
  bmCtx = null;
}

// ---------- CONTEXT MENU ----------
function showContextMenu(x, y) {
  const menu = $('context-menu');
  menu.style.left = Math.min(x, window.innerWidth - 190) + 'px';
  menu.style.top = Math.min(y, window.innerHeight - 200) + 'px';
  menu.classList.remove('hidden');
}
function hideContextMenu() { $('context-menu').classList.add('hidden'); }
document.addEventListener('click', () => hideContextMenu());

$('ctx-open').addEventListener('click', () => { if (contextTarget) window.open(contextTarget.bookmark.url, '_blank'); });
$('ctx-open-incognito').addEventListener('click', () => {
  if (contextTarget) chrome.runtime.sendMessage({ type: 'open_incognito', url: contextTarget.bookmark.url });
});
$('ctx-copy').addEventListener('click', () => {
  if (!contextTarget) return;
  navigator.clipboard.writeText(contextTarget.bookmark.url).then(() => toast('Link copied'), () => toast('Could not copy'));
});
$('ctx-edit').addEventListener('click', () => { if (contextTarget) openBookmarkModal(contextTarget.group, contextTarget.bookmark); });
$('ctx-delete').addEventListener('click', () => {
  if (!contextTarget) return;
  const { group, bookmark } = contextTarget;
  group.bookmarks = group.bookmarks.filter(b => b.id !== bookmark.id);
  state.trash.push({ ...bookmark, deletedAt: Date.now(), fromGroup: group.name });
  save(); renderGroups();
});

// ---------- MULTI-SELECT ----------
function toggleSelect(groupId, bookmarkId, el) {
  const idx = state.selectedBookmarks.findIndex(s => s.bookmarkId === bookmarkId);
  if (idx > -1) { state.selectedBookmarks.splice(idx, 1); el.classList.remove('selected'); }
  else { state.selectedBookmarks.push({ groupId, bookmarkId }); el.classList.add('selected'); }
  updateSelBar();
}
function updateSelBar() {
  $('sel-bar').classList.toggle('hidden', !state.multiSelectMode);
  const n = state.selectedBookmarks.length;
  $('sel-count').textContent = n === 1 ? '1 selected' : `${n} selected`;
  $('sel-open').disabled = $('sel-delete').disabled = n === 0;
}
function updateMultiselectBtn() {
  $('btn-multiselect').classList.toggle('active', state.multiSelectMode);
  updateSelBar();
}
function setMultiSelect(on) {
  state.multiSelectMode = on;
  if (on) { state.editMode = false; }
  if (!on) state.selectedBookmarks = [];
  save(); render();
}
$('btn-multiselect').addEventListener('click', () => setMultiSelect(!state.multiSelectMode));
$('sel-done').addEventListener('click', () => setMultiSelect(false));
function selectedBookmarkObjects() {
  const out = [];
  currentBoard().groups.forEach(g => g.bookmarks.forEach(b => {
    if (state.selectedBookmarks.some(s => s.bookmarkId === b.id)) out.push({ group: g, bookmark: b });
  }));
  return out;
}
$('sel-open').addEventListener('click', () => {
  selectedBookmarkObjects().forEach(({ bookmark }) => chrome.tabs.create({ url: bookmark.url, active: false }));
});
$('sel-delete').addEventListener('click', async () => {
  const sel = selectedBookmarkObjects();
  if (!sel.length) return;
  const ok = await askConfirm({ title: 'Delete bookmarks', message: `Move ${sel.length} bookmark(s) to the trash?`, confirmText: 'Delete', danger: true });
  if (!ok) return;
  sel.forEach(({ group, bookmark }) => {
    group.bookmarks = group.bookmarks.filter(b => b.id !== bookmark.id);
    state.trash.push({ ...bookmark, deletedAt: Date.now(), fromGroup: group.name });
  });
  state.selectedBookmarks = [];
  save(); renderGroups(); updateSelBar();
});

// ---------- PRIVACY / EDIT MODE ----------
function updatePrivacyBtn() {
  $('btn-privacy').classList.toggle('active', state.privacyBlur);
  document.body.classList.toggle('privacy-blur', state.privacyBlur);
}
$('btn-privacy').addEventListener('click', () => { state.privacyBlur = !state.privacyBlur; save(); render(); });

function updateEditModeBtn() {
  $('btn-edit-mode').classList.toggle('active', state.editMode);
  document.body.classList.toggle('edit-mode', state.editMode);
}
$('btn-edit-mode').addEventListener('click', () => {
  state.editMode = !state.editMode;
  if (state.editMode) { state.multiSelectMode = false; state.selectedBookmarks = []; }
  save(); render();
});

// ---------- SEARCH ----------
function openSearch() {
  openModal('search-modal');
  $('search-input').value = ''; $('search-results').innerHTML = '';
  setTimeout(() => $('search-input').focus(), 60);
}
$('btn-search').addEventListener('click', openSearch);
$('search-input').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase().trim();
  const results = $('search-results');
  results.innerHTML = '';
  if (!q) return;
  state.boards.forEach(board => board.groups.forEach(group => group.bookmarks.forEach(bk => {
    if (bk.title.toLowerCase().includes(q) || bk.url.toLowerCase().includes(q)) {
      const item = document.createElement('div');
      item.className = 'search-result-item' + (results.children.length === 0 ? ' first' : '');
      const img = document.createElement('img'); img.className = 'bookmark-favicon'; img.src = getFavicon(bk.url);
      const span = document.createElement('span');
      span.textContent = bk.title;
      const small = document.createElement('small'); small.textContent = `${group.name} in ${board.name}`;
      span.appendChild(small);
      item.append(img, span);
      item.addEventListener('click', () => { window.open(bk.url, '_blank'); closeModal('search-modal'); });
      results.appendChild(item);
    }
  })));
  if (!results.children.length) results.innerHTML = '<p class="hint" style="padding:10px">No results found.</p>';
});
$('search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { const f = $('search-results').querySelector('.search-result-item'); if (f) f.click(); }
});

// ---------- IMPORT / EXPORT ----------
function allBookmarks() {
  const out = [];
  state.boards.forEach(b => b.groups.forEach(g => g.bookmarks.forEach(bk => out.push(bk))));
  return out;
}
function buildExportText() {
  const list = allBookmarks();
  if (!list.length) return '';
  return list.map(b => `${String(b.title).replace(/\s*[\r\n]+\s*/g, ' ').trim()}\n${b.url}`).join('\n\n') + '\n';
}

// Format: name / link / empty line, repeated. Also accepts a plain list of links.
function parseBookmarkText(text) {
  const blocks = String(text || '').replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/)
    .map(b => b.split('\n').map(l => l.trim()).filter(Boolean)).filter(b => b.length);
  const items = [];
  let skipped = 0;
  const push = (title, raw) => {
    const url = normalizeUrl(raw);
    if (!url) { skipped++; return; }
    items.push({ title: (title || '').trim() || suggestTitle(url), url });
  };
  for (const lines of blocks) {
    if (lines.length === 1) {
      if (isUrlish(lines[0])) push('', lines[0]); else skipped++;
    } else if (lines.length === 2) {
      if (isUrlish(lines[1])) push(lines[0], lines[1]);
      else if (isUrlish(lines[0])) push(lines[1], lines[0]);
      else skipped++;
    } else if (lines.every(isUrlish)) {
      lines.forEach(l => push('', l));
    } else {
      let name = null;
      for (const l of lines) {
        if (isUrlish(l)) { push(name || '', l); name = null; }
        else { if (name !== null) skipped++; name = l; }
      }
      if (name !== null) skipped++;
    }
  }
  return { items, skipped };
}

let ioPlan = null; // AI-sorted plan: [{title,url,group}]
function resetImportPlan() {
  ioPlan = null;
  $('io-ai-results').innerHTML = '';
  $('io-dest-field').classList.remove('hidden');
  $('io-import-btn').textContent = 'Import';
  updateImportStatus();
}
function fillDestSelect() {
  const sel = $('io-dest');
  sel.innerHTML = '';
  state.boards.forEach(b => {
    const og = document.createElement('optgroup'); og.label = b.name;
    b.groups.forEach(g => og.appendChild(new Option(g.name, `${b.id}|${g.id}`)));
    og.appendChild(new Option('New group in this board...', `${b.id}|__new__`));
    sel.appendChild(og);
  });
  const cb = currentBoard();
  sel.value = cb.groups.length ? `${cb.id}|${cb.groups[0].id}` : `${cb.id}|__new__`;
  syncNewGroupInput();
}
function syncNewGroupInput() {
  const isNew = $('io-dest').value.endsWith('|__new__');
  $('io-newgroup').classList.toggle('hidden', !isNew);
  if (isNew && !$('io-newgroup').value) $('io-newgroup').value = 'Imported';
}
function updateImportStatus() {
  const { items, skipped } = parseBookmarkText($('io-text').value);
  const st = $('io-status');
  if (!$('io-text').value.trim()) { st.textContent = ''; }
  else st.textContent = `${items.length} bookmark${items.length === 1 ? '' : 's'} found` + (skipped ? `, ${skipped} line${skipped === 1 ? '' : 's'} ignored` : '');
  $('io-import-btn').disabled = !items.length && !ioPlan;
  $('io-ai-btn').disabled = !items.length;
}
$('btn-bulk-import').addEventListener('click', () => {
  fillDestSelect();
  $('io-text').value = '';
  resetImportPlan();
  document.querySelector('#bulk-modal .m-tab[data-tab="io-import"]').click();
  openModal('bulk-modal');
  setTimeout(() => $('io-text').focus(), 60);
});
$('io-text').addEventListener('input', () => { if (ioPlan) resetImportPlan(); else updateImportStatus(); });
$('io-dest').addEventListener('change', syncNewGroupInput);
$('io-file-btn').addEventListener('click', () => $('io-file').click());
$('io-file').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => { $('io-text').value = String(r.result || ''); resetImportPlan(); };
  r.readAsText(f);
  e.target.value = '';
});

function findOrCreateGroup(board, name) {
  let g = board.groups.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (!g) { g = { id: groupId(), name, bookmarks: [] }; board.groups.push(g); }
  return g;
}
function addItems(group, items, skipDup) {
  const seen = new Set(group.bookmarks.map(b => urlKey(b.url)));
  let added = 0, dup = 0;
  for (const it of items) {
    const k = urlKey(it.url);
    if (skipDup && seen.has(k)) { dup++; continue; }
    seen.add(k);
    group.bookmarks.push({ id: bkId(), title: it.title, url: it.url });
    added++;
  }
  return { added, dup };
}

$('io-import-btn').addEventListener('click', () => {
  const skipDup = $('io-skipdup').checked;
  let added = 0, dup = 0, targetBoard = currentBoard();
  if (ioPlan) {
    const byGroup = {};
    ioPlan.forEach(p => (byGroup[p.group] = byGroup[p.group] || []).push(p));
    Object.entries(byGroup).forEach(([name, items]) => {
      const r = addItems(findOrCreateGroup(targetBoard, name), items, skipDup);
      added += r.added; dup += r.dup;
    });
  } else {
    const { items } = parseBookmarkText($('io-text').value);
    if (!items.length) { toast('No bookmarks found in the text'); return; }
    const [bid, gid] = $('io-dest').value.split('|');
    targetBoard = state.boards.find(b => b.id === bid) || currentBoard();
    const group = gid === '__new__' ? findOrCreateGroup(targetBoard, $('io-newgroup').value.trim() || 'Imported') : targetBoard.groups.find(g => g.id === gid);
    if (!group) return;
    ({ added, dup } = addItems(group, items, skipDup));
  }
  state.currentBoardId = targetBoard.id;
  save(); render();
  closeModal('bulk-modal');
  toast(`Imported ${added} bookmark${added === 1 ? '' : 's'}` + (dup ? `, skipped ${dup} duplicate${dup === 1 ? '' : 's'}` : ''));
});

$('io-ai-btn').addEventListener('click', async () => {
  const { items } = parseBookmarkText($('io-text').value);
  if (!items.length) return;
  const box = $('io-ai-results');
  box.innerHTML = '<p class="hint">Sorting...</p>';
  $('io-ai-btn').disabled = true;
  const existing = state.boards.flatMap(b => b.groups.map(g => g.name));
  const suggested = await window.aiSuggestGroups(items.map(i => i.url), existing);
  const map = {};
  (suggested || []).forEach(s => { if (s && s.url) map[s.url] = s.group; });
  ioPlan = items.map(i => ({ ...i, group: (map[i.url] || (window.guessGroupFallback ? window.guessGroupFallback(i.url) : 'Imported')).toString().trim() || 'Imported' }));
  box.innerHTML = '';
  if (!state.apiKey) { const n = document.createElement('p'); n.className = 'hint'; n.textContent = 'No API key set, so a basic rule-based sort was used.'; box.appendChild(n); }
  ioPlan.forEach(p => {
    const row = document.createElement('div'); row.className = 'bulk-row';
    const u = document.createElement('span'); u.className = 'url'; u.textContent = p.title;
    const s = document.createElement('span'); s.className = 'suggested'; s.textContent = p.group;
    row.append(u, s); box.appendChild(row);
  });
  $('io-dest-field').classList.add('hidden'); $('io-newgroup').classList.add('hidden');
  $('io-import-btn').textContent = `Import ${ioPlan.length} sorted`;
  $('io-import-btn').disabled = false;
});

function refreshExport() {
  const text = buildExportText();
  const n = allBookmarks().length;
  $('io-export-text').value = text;
  $('io-export-count').textContent = n
    ? `${n} bookmark${n === 1 ? '' : 's'} from ${state.boards.length} board${state.boards.length === 1 ? '' : 's'}. Each entry is a name, a link, and an empty line.`
    : 'There are no bookmarks to export yet.';
  $('io-download-btn').disabled = $('io-copy-btn').disabled = !n;
}
$('io-download-btn').addEventListener('click', () => {
  const text = buildExportText();
  if (!text) return;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  a.href = URL.createObjectURL(blob);
  a.download = `voidtab-bookmarks-${stamp}.txt`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Bookmarks exported');
});
$('io-copy-btn').addEventListener('click', () => {
  navigator.clipboard.writeText(buildExportText()).then(() => toast('Copied to clipboard'), () => toast('Could not copy'));
});

// ---------- INCOGNITO ----------
$('btn-incognito').addEventListener('click', async () => {
  const r = await askForm({
    title: 'Open in incognito',
    fields: [{ name: 'url', label: 'Link', placeholder: 'example.com', required: true, validate: v => normalizeUrl(v) ? '' : 'Enter a valid link.' }],
    submit: 'Open',
  });
  if (r) chrome.runtime.sendMessage({ type: 'open_incognito', url: normalizeUrl(r.url) });
});

// ---------- TRASH ----------
$('btn-trash').addEventListener('click', () => { renderTrash(); openModal('trash-modal'); });
function renderTrash() {
  const list = $('trash-list');
  list.innerHTML = '';
  if (!state.trash.length) { list.innerHTML = '<p class="hint" style="padding:8px">Trash is empty.</p>'; return; }
  state.trash.forEach((item, idx) => {
    const row = document.createElement('div'); row.className = 'trash-item';
    const info = document.createElement('span'); info.textContent = `${item.title} (${item.fromGroup})`;
    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'trash-restore-btn'; restoreBtn.textContent = 'Restore';
    restoreBtn.addEventListener('click', () => {
      const group = findOrCreateGroup(currentBoard(), item.fromGroup);
      group.bookmarks.push({ id: bkId(), title: item.title, url: item.url });
      state.trash.splice(idx, 1);
      save(); renderGroups(); renderTrash();
    });
    row.append(info, restoreBtn); list.appendChild(row);
  });
}
$('empty-trash-btn').addEventListener('click', async () => {
  if (!state.trash.length) return;
  const ok = await askConfirm({ title: 'Empty trash', message: 'Permanently delete all trashed items?', confirmText: 'Empty trash', danger: true });
  if (ok) { state.trash = []; save(); renderTrash(); }
});

// ---------- SETTINGS ----------
function bindSwitch(id, key, after) {
  $(id).addEventListener('change', () => { state[key] = $(id).checked; saveSoon(); if (after) after(); });
}
function bindSeg(id, key, after) {
  $(id).addEventListener('click', (e) => {
    const b = e.target.closest('button[data-val]');
    if (!b) return;
    state[key] = b.dataset.val;
    $(id).querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
    saveSoon(); if (after) after();
  });
}
function setSeg(id, val) { $(id).querySelectorAll('button').forEach(x => x.classList.toggle('active', x.dataset.val === val)); }

function buildAccentSwatches() {
  const wrap = $('accent-swatches');
  wrap.innerHTML = '';
  ACCENTS.forEach(col => {
    const b = document.createElement('button');
    b.className = 'swatch'; b.style.setProperty('--sw', col); b.dataset.color = col; b.title = col;
    b.addEventListener('click', () => setAccent(col));
    wrap.appendChild(b);
  });
  const c = document.createElement('input'); c.type = 'color'; c.id = 'accent-custom'; c.title = 'Custom color';
  c.addEventListener('input', () => setAccent(c.value));
  wrap.appendChild(c);
}
function setAccent(col) {
  state.accent = col; applyAccent(); FX.refreshColors(); applyCardEffect(); saveSoon(); syncAccentUI();
}
function syncAccentUI() {
  document.querySelectorAll('.swatch').forEach(s => s.classList.toggle('active', s.dataset.color.toLowerCase() === state.accent.toLowerCase()));
  $('accent-custom').value = state.accent;
}

function syncSettingsUI() {
  $('theme-select').value = state.theme || 'auto';
  $('api-key-input').value = state.apiKey || '';
  $('set-clock').checked = !!state.showClock;
  $('set-24h').checked = !!state.clock24;
  $('set-seconds').checked = !!state.showSeconds;
  $('set-date').checked = !!state.showDate;
  $('set-greeting').checked = !!state.showGreeting;
  $('set-name').value = state.userName || '';
  $('set-search').checked = !!state.showSearch;
  setSeg('seg-clocksize', state.clockSize || 'm');
  setSeg('seg-clockfont', state.clockFont || 'body');
  setSeg('seg-clockweight', state.clockWeight || '300');
  document.querySelectorAll('#clock-color-select .chip').forEach(c => c.classList.toggle('active', c.dataset.cc === (state.clockColor || 'theme')));
  $('clock-custom-color-field').classList.toggle('hidden', state.clockColor !== 'custom');
  $('clock-color-custom').value = state.clockColorCustom || '#ffffff';
  const eff = state.cardEffect || 'transparent';
  document.querySelectorAll('.effect-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.effect === eff));
  syncAccentUI();
}
$('btn-settings').addEventListener('click', () => {
  syncSettingsUI();
  document.querySelector('#settings-modal .m-tab[data-tab="s-general"]').click();
  openModal('settings-modal');
});
$('theme-select').addEventListener('change', () => { state.theme = $('theme-select').value; applyAppearance(); saveSoon(); });
$('api-key-input').addEventListener('input', () => { state.apiKey = $('api-key-input').value.trim(); saveSoon(); });
bindSwitch('set-clock', 'showClock', renderHero);
bindSwitch('set-24h', 'clock24', renderHero);
bindSwitch('set-seconds', 'showSeconds', renderHero);
bindSwitch('set-date', 'showDate', renderHero);
bindSwitch('set-greeting', 'showGreeting', renderHero);
bindSwitch('set-search', 'showSearch', renderHero);
bindSeg('seg-clocksize', 'clockSize', renderHero);
bindSeg('seg-clockfont', 'clockFont', applyClockStyle);
bindSeg('seg-clockweight', 'clockWeight', applyClockStyle);
document.querySelectorAll('#clock-color-select .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    state.clockColor = chip.dataset.cc;
    document.querySelectorAll('#clock-color-select .chip').forEach(c => c.classList.toggle('active', c === chip));
    $('clock-custom-color-field').classList.toggle('hidden', state.clockColor !== 'custom');
    applyClockStyle(); saveSoon();
  });
});
$('clock-color-custom').addEventListener('input', () => { state.clockColorCustom = $('clock-color-custom').value; applyClockStyle(); saveSoon(); });
$('set-name').addEventListener('input', () => { state.userName = $('set-name').value; saveSoon(); tickClock(); });
$('reset-clock-pos').addEventListener('click', () => { state.clockPos = { ...DEFAULT_CLOCKPOS }; save(); renderHero(); });
$('save-settings-btn').addEventListener('click', () => save());

document.querySelectorAll('.effect-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.cardEffect = btn.dataset.effect;
    document.querySelectorAll('.effect-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyCardEffect(); save();
  });
});

// ---------- ADD BOARD / GROUP ----------
$('add-board-btn').addEventListener('click', async () => {
  const r = await askForm({ title: 'New board', fields: [{ name: 'name', label: 'Board name', placeholder: 'e.g. Work', required: true }], submit: 'Create' });
  if (!r) return;
  const id = boardId();
  state.boards.push({ id, name: r.name.trim(), groups: [] });
  state.currentBoardId = id;
  save(); render();
});
function createGroupFromModal() {
  const name = $('new-group-name').value.trim();
  if (!name) return;
  currentBoard().groups.push({ id: groupId(), name, bookmarks: [] });
  $('new-group-name').value = '';
  save(); renderGroups(); closeModal('add-group-modal');
}
$('confirm-add-group-btn').addEventListener('click', createGroupFromModal);
$('new-group-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') createGroupFromModal(); });

// ---------- BACKGROUND MODAL ----------
function buildSceneGrid() {
  const grid = $('scene-grid');
  grid.innerHTML = '';
  const mk = (key, name, bgCss) => {
    const b = document.createElement('button');
    b.className = 'scene-tile'; b.dataset.scene = key; b.style.background = bgCss;
    const s = document.createElement('span'); s.textContent = name; b.appendChild(s);
    b.addEventListener('click', () => { state.scene = key; applyScene(); FX.refreshColors(); saveSoon(); syncSceneUI(); });
    grid.appendChild(b);
  };
  Object.entries(SCENES).forEach(([key, s]) => {
    mk(key, s.name, `radial-gradient(circle at 20% 25%, ${s.c[0]}cc, transparent 60%), radial-gradient(circle at 85% 75%, ${s.c[1]}bb, transparent 60%), linear-gradient(160deg, ${s.bg[0]}, ${s.bg[1]})`);
  });
  mk('custom', 'Custom', 'conic-gradient(from 200deg, #ef4444, #f59e0b, #22c55e, #06b6d4, #6366f1, #ec4899, #ef4444)');
}
function syncSceneUI() {
  document.querySelectorAll('.scene-tile').forEach(t => t.classList.toggle('active', t.dataset.scene === state.scene));
  $('custom-colors').classList.toggle('hidden', state.scene !== 'custom');
  $('cc-base').value = state.sceneCustom.base; $('cc-c1').value = state.sceneCustom.c1; $('cc-c2').value = state.sceneCustom.c2;
  $('set-anim').checked = !!state.sceneAnimated;
  $('set-grain').checked = !!state.sceneGrain;
  setSeg('seg-pattern', state.scenePattern || 'none');
  $('set-wpblur').value = state.wpBlur || 0; $('v-wpblur').textContent = (state.wpBlur || 0) + 'px';
  $('set-wpdim').value = state.wpDim || 0; $('v-wpdim').textContent = (state.wpDim || 0) + '%';
  document.querySelectorAll('#fx-select .chip').forEach(c => c.classList.toggle('active', c.dataset.fx === state.cursorFx));
  $('set-fxint').value = state.cursorFxIntensity; $('v-fxint').textContent = state.cursorFxIntensity + '%';
}
[['cc-base', 'base'], ['cc-c1', 'c1'], ['cc-c2', 'c2']].forEach(([id, key]) => {
  $(id).addEventListener('input', () => { state.sceneCustom[key] = $(id).value; applyScene(); saveSoon(); });
});
bindSwitch('set-anim', 'sceneAnimated', applyScene);
bindSwitch('set-grain', 'sceneGrain', applyScene);
bindSeg('seg-pattern', 'scenePattern', applyScene);

$('set-wpblur').addEventListener('input', (e) => { state.wpBlur = +e.target.value; $('v-wpblur').textContent = state.wpBlur + 'px'; document.documentElement.style.setProperty('--wp-blur', state.wpBlur + 'px'); saveSoon(); });
$('set-wpdim').addEventListener('input', (e) => { state.wpDim = +e.target.value; $('v-wpdim').textContent = state.wpDim + '%'; document.documentElement.style.setProperty('--wp-dim', String(state.wpDim / 100)); saveSoon(); });
document.querySelectorAll('#fx-select .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    state.cursorFx = chip.dataset.fx;
    FX.set(state.cursorFx, state.cursorFxIntensity / 100);
    syncSceneUI(); saveSoon();
  });
});
$('set-fxint').addEventListener('input', (e) => {
  state.cursorFxIntensity = +e.target.value; $('v-fxint').textContent = state.cursorFxIntensity + '%';
  FX.set(state.cursorFx, state.cursorFxIntensity / 100); saveSoon();
});

$('wallpaper-btn').addEventListener('click', () => {
  $('wallpaper-file-input').value = '';
  $('upload-filename').textContent = state.wallpaper === '__local__' ? 'Local image in use' : 'No file chosen';
  $('custom-wallpaper-input').value = (state.wallpaper && state.wallpaper !== '__local__') ? state.wallpaper : '';
  syncSceneUI();
  document.querySelector('#wallpaper-modal .m-tab[data-tab="bg-scene"]').click();
  openModal('wallpaper-modal');
});
$('apply-wallpaper-btn').addEventListener('click', async () => {
  const val = $('custom-wallpaper-input').value.trim();
  if (!val) { toast('Paste an image URL first'); return; }
  state.wallpaper = val;
  save(); await applyWallpaper();
  toast('Wallpaper applied');
});
$('remove-wallpaper-btn').addEventListener('click', async () => {
  if (!state.wallpaper) { toast('No wallpaper image is set'); return; }
  const wasLocal = state.wallpaper === '__local__';
  state.wallpaper = '';
  $('custom-wallpaper-input').value = ''; $('upload-filename').textContent = 'No file chosen';
  if (wasLocal) { try { await dbSet('voidtab_wallpaper_local', ''); } catch {} }
  save(); await applyWallpaper();
  toast('Wallpaper removed, showing the scene');
});
$('wallpaper-upload-btn').addEventListener('click', () => $('wallpaper-file-input').click());
$('wallpaper-file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try { await dbSet('voidtab_wallpaper_local', ev.target.result); }
    catch (err) { toast('Failed to save the image. Try a URL instead.'); return; }
    state.wallpaper = '__local__';
    $('custom-wallpaper-input').value = '';
    $('upload-filename').textContent = file.name;
    save(); applyWallpaper();
  };
  reader.readAsDataURL(file);
});

// ---------- AI PANEL ----------
$('ai-fab').addEventListener('click', () => $('ai-panel').classList.toggle('hidden'));
$('ai-panel-close').addEventListener('click', () => $('ai-panel').classList.add('hidden'));
const aiInput = $('ai-input');
function sendAIMessage() {
  const text = aiInput.value.trim();
  if (!text) return;
  appendAIMsg('user', text);
  aiInput.value = '';
  window.aiChat(text);
}
$('ai-send').addEventListener('click', sendAIMessage);
aiInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendAIMessage(); });
function appendAIMsg(role, text) {
  const msgs = $('ai-messages');
  const div = document.createElement('div');
  div.className = `ai-msg ${role}`;
  div.textContent = text;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}
window.appendAIMsg = appendAIMsg;

// ---------- KEYBOARD SHORTCUTS ----------
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal:not(.hidden)').forEach(m => closeModal(m.id));
    hideContextMenu();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
  if (e.key === '/' && !e.ctrlKey && !e.metaKey && !anyModalOpen()) {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    if (!$('hero').classList.contains('hidden') && state.showSearch) { e.preventDefault(); $('hero-search-input').focus(); }
  }
});

// ---------- SYSTEM THEME LISTENER ----------
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.theme === 'auto') { applyScene(); FX.refreshColors(); }
});

// ---------- INIT ----------
buildAccentSwatches();
buildSceneGrid();
FX.init();
load(() => {
  state.multiSelectMode = false; state.selectedBookmarks = [];
  document.body.classList.add('intro');
  render();
  setTimeout(() => document.body.classList.remove('intro'), 1500);
});
