// Shared UI plumbing: action registry, navigation, bottom sheets, toast, confetti, gestures.
import { $, $$, esc, fmt } from './util.js';

export const actions = {};   // click handlers by data-action name: fn(element, event)
export const inputs = {};    // input handlers by data-input name: fn(element, event)
export const submits = {};   // form handlers by data-submit name: fn(valuesObject, form)

export const nav = {
  tab: 'home',
  render() {},
  go(tab) { this.tab = tab; this.render(true); }
};

// ---------- bottom sheets (stackable) ----------
const root = () => $('#sheet-root');
const liveSheets = () => [...root().children].filter(w => !w.classList.contains('closing'));

export function openSheet(html) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-backdrop" data-action="sheet-close"></div>
<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-grab"></div><div class="sheet-content">${html}</div></div>`;
  root().appendChild(wrap);
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
  return wrap;
}
export function setSheet(html) {
  const w = liveSheets().pop();
  if (!w) return;
  const sheet = $('.sheet', w), top = sheet.scrollTop;
  $('.sheet-content', w).innerHTML = html;
  sheet.scrollTop = top;
}
export function closeSheet() {
  const w = liveSheets().pop();
  if (!w) return;
  if (document.activeElement && w.contains(document.activeElement)) document.activeElement.blur();
  w.classList.remove('open');
  w.classList.add('closing');
  setTimeout(() => w.remove(), 240);
}
export function closeAllSheets() { while (liveSheets().length) closeSheet(); }
export const sheetOpen = () => liveSheets().length > 0;
actions['sheet-close'] = () => closeSheet();

let confirmCb = null;
export function confirmSheet({ title, text = '', ok = 'Confirm', danger = false }, cb) {
  confirmCb = cb;
  openSheet(`<h2 class="sheet-title">${esc(title)}</h2>
${text ? `<p class="muted" style="font-size:15px;line-height:1.5">${esc(text)}</p>` : ''}
<button class="btn ${danger ? 'danger' : 'primary'} block" data-action="confirm-ok">${esc(ok)}</button>
<button class="btn ghost block" data-action="sheet-close">Cancel</button>`);
}
actions['confirm-ok'] = () => { const cb = confirmCb; confirmCb = null; closeSheet(); if (cb) cb(); };

// ---------- toast ----------
let toastTimer = null;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

export const buzz = (ms = 10) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* not supported on iOS */ } };

// ---------- sound ----------
let audio = null;
export function primeAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audio) audio = new AC();
    if (audio.state === 'suspended') audio.resume();
  } catch { /* no audio */ }
}
export function beep() {
  try {
    if (!audio) return;
    [0, 0.22].forEach((t, i) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'sine'; o.frequency.value = i ? 1175 : 880;
      g.gain.setValueAtTime(0.0001, audio.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, audio.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + t + 0.2);
      o.connect(g); g.connect(audio.destination);
      o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.22);
    });
  } catch { /* no audio */ }
}

// ---------- celebration ----------
export function celebrate() {
  const cv = $('#confetti');
  if (!cv || !cv.getContext) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = cv.width = window.innerWidth * dpr, H = cv.height = window.innerHeight * dpr;
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  const colors = ['#A78BFA', '#22D3EE', '#E879F9', '#2DD4BF', '#FFFFFF'];
  const parts = Array.from({ length: 110 }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9, v = (7 + Math.random() * 11) * dpr;
    return { x: W / 2, y: H * 0.62, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: (4 + Math.random() * 5) * dpr,
      r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[(Math.random() * colors.length) | 0] };
  });
  const start = performance.now(), dur = 1500;
  (function frame(now) {
    const t = (now - start) / dur;
    ctx.clearRect(0, 0, W, H);
    if (t >= 1) return;
    for (const p of parts) {
      p.vy += 0.32 * dpr; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - t * t); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
    }
    requestAnimationFrame(frame);
  })(start);
  buzz(30);
}

// ---------- entrance animation for rings, bars and numbers ----------
export function animateIn(scope, countUp) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    for (const a of $$('.ring-arc', scope)) a.style.strokeDashoffset = a.dataset.offset;
    for (const b of $$('.bar > i[data-w]', scope)) b.style.width = b.dataset.w + '%';
  }));
  if (!countUp) return;
  for (const el of $$('[data-count]', scope)) {
    const target = Number(el.dataset.count), dp = Number(el.dataset.dp || 0);
    if (!isFinite(target) || target === 0) continue;
    const t0 = performance.now(), dur = 650;
    const step = now => {
      const t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(target * e, dp);
      if (t < 1 && el.isConnected) requestAnimationFrame(step); else if (el.isConnected) el.textContent = fmt(target, dp);
    };
    requestAnimationFrame(step);
  }
}

// ---------- gestures: swipe a row left to reveal Delete, swipe the Food screen to change day ----------
let justSwiped = false;
export const swipedRecently = () => justSwiped;

export function initGestures({ onPageSwipe }) {
  let g = null;
  const closeRows = except => {
    for (const b of $$('.swipe-body.open')) if (b !== except) { b.classList.remove('open'); b.style.transform = ''; }
  };
  document.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) { g = null; return; }
    const t = e.touches[0];
    const body = e.target.closest('.swipe-body');
    closeRows(body);
    g = { x: t.clientX, y: t.clientY, body, base: body && body.classList.contains('open') ? -88 : 0, dx: 0, dy: 0, lock: null,
      page: !body && !sheetOpen() && $('#workout').hidden && !!e.target.closest('#view') && !e.target.closest('.chips.scroll') };
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!g) return;
    const t = e.touches[0];
    g.dx = t.clientX - g.x; g.dy = t.clientY - g.y;
    if (!g.lock && (Math.abs(g.dx) > 10 || Math.abs(g.dy) > 10)) g.lock = Math.abs(g.dx) > Math.abs(g.dy) ? 'x' : 'y';
    if (g.lock === 'x' && g.body) {
      const x = Math.max(-104, Math.min(0, g.base + g.dx));
      g.body.classList.add('dragging');
      g.body.style.transform = `translateX(${x}px)`;
    }
  }, { passive: true });
  const end = () => {
    if (!g) return;
    if (g.lock === 'x') {
      justSwiped = true; setTimeout(() => { justSwiped = false; }, 350);
      if (g.body) {
        const open = g.base + g.dx < -44;
        g.body.classList.remove('dragging');
        g.body.classList.toggle('open', open);
        g.body.style.transform = open ? 'translateX(-88px)' : '';
      } else if (g.page && Math.abs(g.dx) > 70 && Math.abs(g.dy) < 60) {
        onPageSwipe(g.dx < 0 ? 1 : -1);
      }
    }
    g = null;
  };
  document.addEventListener('touchend', end, { passive: true });
  document.addEventListener('touchcancel', () => { if (g && g.body) { g.body.classList.remove('dragging'); g.body.style.transform = g.base ? 'translateX(-88px)' : ''; } g = null; }, { passive: true });
}

// Reusable bits of markup
export const icon = {
  chevL: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 5 8 12 15 19"/></svg>',
  chevR: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 5 16 12 9 19"/></svg>',
  chevD: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 9 12 16 19 9"/></svg>',
  plus: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  check: '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 12 10 17 19 7"/></svg>',
  gear: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="17" x2="20" y2="17"/><circle cx="9" cy="7" r="2.5" fill="#0D0D0D"/><circle cx="15" cy="17" r="2.5" fill="#0D0D0D"/></svg>',
  dots: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  plates: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="2" y1="12" x2="22" y2="12"/><line x1="7" y1="6" x2="7" y2="18"/><line x1="17" y1="6" x2="17" y2="18"/></svg>',
  food: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v7a2 2 0 0 0 4 0V3"/><line x1="9" y1="12" x2="9" y2="21"/><path d="M17 21V3c-2 1.5-3 4-3 7 0 1.5 1 2.5 3 2.5"/></svg>',
  scale: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M8 9a5 5 0 0 1 8 0"/><line x1="12" y1="9" x2="13.5" y2="6.5"/></svg>',
  lift: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="7" x2="7" y2="17"/><line x1="17" y1="7" x2="17" y2="17"/><line x1="3.5" y1="9.5" x2="3.5" y2="14.5"/><line x1="20.5" y1="9.5" x2="20.5" y2="14.5"/></svg>',
  tape: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="10" r="6"/><circle cx="9" cy="10" r="1.5"/><path d="M9 16h12v-4h-6"/></svg>',
  scan: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h3"/><path d="M20 7V4h-3"/><path d="M4 17v3h3"/><path d="M20 17v3h-3"/><line x1="6" y1="9" x2="6" y2="15"/><line x1="10" y1="9" x2="10" y2="15"/><line x1="13" y1="9" x2="13" y2="15"/><line x1="17" y1="9" x2="17" y2="15"/></svg>'
};
