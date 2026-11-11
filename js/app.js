// App entry: boot, navigation, global event wiring, quick-add menu, welcome tour.
import { state, load, save } from './store.js';
import { $, $$, esc, ymd } from './util.js';
import { actions, inputs, submits, nav, openSheet, closeSheet, closeAllSheets, sheetOpen, initGestures, animateIn, swipedRecently, icon } from './ui.js';
import { renderHome } from './home.js';
import { renderTrain } from './train.js';
import { renderFood, openAddFood, shiftFoodDay, foodNav } from './food.js';
import { renderProgress } from './progress.js';
import { renderSettings } from './settings.js';
import { renderWorkout, initWorkout } from './workout.js';
import { pullIfNewer } from './sync.js';

const views = { home: renderHome, train: renderTrain, food: renderFood, progress: renderProgress, settings: renderSettings };

nav.render = (enter = false) => {
  const v = $('#view');
  if (!views[nav.tab]) nav.tab = 'home';
  const top = v.scrollTop;
  document.body.dataset.area = nav.tab;
  v.innerHTML = views[nav.tab]();
  if (enter) {
    v.scrollTop = 0;
    v.classList.remove('view-in'); void v.offsetWidth; v.classList.add('view-in');
  } else v.scrollTop = top;
  for (const t of $$('#tabbar .tab')) {
    const on = t.dataset.tab === nav.tab;
    t.classList.toggle('on', on);
    if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
  }
  animateIn(v, enter);
};

actions['tab'] = el => {
  const tab = el.dataset.tab;
  closeAllSheets();
  if (tab === 'food' && nav.tab !== 'food') foodNav.date = ymd();
  if (tab === nav.tab) { $('#view').scrollTo({ top: 0, behavior: 'smooth' }); return; }
  nav.go(tab);
};

// ---------- quick add (the + button) ----------
actions['quick'] = () => {
  if (sheetOpen()) return closeAllSheets();
  const aw = state.activeWorkout;
  openSheet(`<h2 class="sheet-title">Quick add</h2>
<div class="quick">
<button data-action="q-food"><span class="c-cyan">${icon.food}</span>Log food</button>
<button data-action="q-workout"><span class="c-violet">${icon.lift}</span>${aw ? 'Resume workout' : 'Start workout'}</button>
<button data-action="q-weight"><span class="c-magenta">${icon.scale}</span>Log weight</button>
<button data-action="q-meas"><span class="c-magenta">${icon.tape}</span>Log measurements</button>
</div>`);
};
actions['q-food'] = () => { closeSheet(); openAddFood(); };
actions['q-weight'] = () => { closeSheet(); actions['weight-log']({ dataset: {} }); };
actions['q-meas'] = () => { closeSheet(); actions['meas-log'](); };
actions['q-workout'] = () => {
  closeSheet();
  if (state.activeWorkout) return actions['wk-resume']();
  if (!state.templates.length) return actions['wk-start']({ dataset: {} });
  openSheet(`<h2 class="sheet-title">Start workout</h2>
<div class="list">${state.templates.map(t => `<button class="item press" data-action="wk-start" data-id="${t.id}"><span class="col grow"><span class="sub ellip">${esc(t.name)}</span>
<span class="muted small">${t.exercises.length} exercises</span></span><span class="c-violet">${icon.chevR}</span></button>`).join('')}</div>
<button class="btn ghost block" data-action="wk-start">Empty workout</button>`);
};

// ---------- welcome tour ----------
const STEPS = [
  { h: 'Welcome', p: 'Your training, nutrition and body progress in one place, built around you.', color: '#A78BFA' },
  { h: 'One button logs everything', p: 'Tap the glowing + at the bottom to log food or weight, or to start a workout. Most things take three taps or fewer.', color: '#22D3EE' },
  { h: 'Yours to shape', p: 'Targets, units and what shows on your home screen are all in Settings. Nothing is fixed, and there are no streaks to break.', color: '#E879F9' }
];
let step = 0;
function renderIntro() {
  const el = $('#intro'), s = STEPS[step], last = step === STEPS.length - 1;
  el.hidden = false;
  el.innerHTML = `<div class="intro-art"><svg width="180" height="180" viewBox="0 0 180 180" aria-hidden="true" style="filter:drop-shadow(0 0 24px ${s.color}88)">
<defs><linearGradient id="ig" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A78BFA"/><stop offset="1" stop-color="#22D3EE"/></linearGradient></defs>
<circle cx="90" cy="90" r="74" fill="none" stroke="#161616" stroke-width="16"/>
<circle class="ring-arc" cx="90" cy="90" r="74" fill="none" stroke="url(#ig)" stroke-width="16" stroke-linecap="round" stroke-dasharray="465" stroke-dashoffset="465" data-offset="${(465 * (1 - (step + 1) / STEPS.length)).toFixed(1)}" transform="rotate(-90 90 90)"/></svg></div>
<div class="intro-body">
<div class="dots">${STEPS.map((_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div>
<h1>${s.h}${step === 0 && state.settings.name ? ', ' + esc(state.settings.name) : ''}</h1><p>${s.p}</p>
<button class="btn primary block" data-action="intro-next" style="--accent:var(--violet);margin-top:10px">${last ? 'Get started' : 'Next'}</button>
${last ? '' : '<button class="link" data-action="intro-skip" style="align-self:center;color:var(--muted)">Skip</button>'}</div>`;
  animateIn(el, false);
}
function endIntro() { $('#intro').hidden = true; $('#intro').innerHTML = ''; state.settings.onboarded = true; save('settings'); }
actions['intro-next'] = () => { if (step < STEPS.length - 1) { step++; renderIntro(); } else endIntro(); };
actions['intro-skip'] = endIntro;
actions['intro-replay'] = () => { step = 0; renderIntro(); };

// ---------- global event wiring ----------
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  if (swipedRecently() && el.closest('.swipe-body')) return; // a swipe just ended on this row
  const fn = actions[el.dataset.action];
  if (fn) fn(el, e);
});
document.addEventListener('input', e => {
  const el = e.target.closest('[data-input]');
  if (el && inputs[el.dataset.input]) inputs[el.dataset.input](el, e);
});
document.addEventListener('submit', e => {
  e.preventDefault();
  const form = e.target, fn = submits[form.dataset.submit];
  if (fn) fn(Object.fromEntries(new FormData(form)), form);
});
// Select the whole number when a numeric field is focused, so typing replaces it.
document.addEventListener('focusin', e => {
  const el = e.target;
  if (el.matches && el.matches('input[inputmode=decimal],input[inputmode=numeric]')) setTimeout(() => { try { el.select(); } catch { /* ignore */ } }, 0);
});
// Keep bottom sheets above the on-screen keyboard.
if (window.visualViewport) {
  const setVvh = () => document.documentElement.style.setProperty('--vvh', window.visualViewport.height + 'px');
  window.visualViewport.addEventListener('resize', setVvh); setVvh();
}
// Refresh when the app comes back to the foreground on a new day.
let lastDay = ymd();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (ymd() !== lastDay) { lastDay = ymd(); foodNav.date = lastDay; nav.render(); }
  pullIfNewer().then(applied => { if (applied) nav.render(); }).catch(() => {});
});

async function boot() {
  await load();
  await pullIfNewer().catch(() => {}); // picks up changes made elsewhere since last time; silent if offline
  initGestures({ onPageSwipe: d => { if (nav.tab === 'food') shiftFoodDay(d); } });
  nav.render(true);
  renderWorkout();
  $('#workout').hidden = true; // an unfinished workout stays minimized until resumed
  initWorkout();
  if (!state.settings.onboarded) { step = 0; renderIntro(); }
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
boot().catch(err => {
  console.error(err);
  $('#view').innerHTML = `<section class="card"><span class="sub">Something went wrong starting the app</span><span class="muted">${esc(err && err.message)}</span></section>`;
});
