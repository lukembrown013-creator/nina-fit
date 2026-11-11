// Home dashboard: today at a glance.
import { state, save, hasData } from './store.js';
import { esc, fmt, ymd, addDays, weekStart, ring, spark, DAYS } from './util.js';
import { dayTotals, weightSeries, weeklyTrendChange, weekWorkouts, workoutSets, todaysTemplate, activityMap, toDisp, wu } from './calc.js';
import { actions, nav, icon } from './ui.js';

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent || '');
const isStandalone = () => navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);

function nutritionCard(t) {
  const tot = dayTotals(t), tg = state.settings.targets;
  const pct = tg.kcal ? tot.kcal / tg.kcal : 0;
  const left = tg.kcal ? tg.kcal - tot.kcal : null;
  const macro = (label, val, target, color) => `<div class="col">
<span class="muted small" style="font-weight:600">${label}</span>
<span class="sub"><span data-count="${Math.round(val)}">${fmt(val, 0)}</span><span class="unit"> ${target ? '/ ' + fmt(target, 0) + ' g' : 'g'}</span></span>
<div class="bar"><i data-w="${target ? Math.min(100, (val / target) * 100).toFixed(1) : 0}" style="background:${color}"></i></div></div>`;
  return `<section class="card lg press" data-action="tab" data-tab="food" style="--accent:var(--cyan)">
<div class="row" style="gap:20px">
${ring({ pct, main: tg.kcal ? Math.round(pct * 100) + '%' : '–', sub: tg.kcal ? 'of today' : 'no target', label: 'Calories', cls: 'glow-cyan' })}
<div class="col" style="gap:4px">
<span class="label">Nutrition</span>
<span class="big" data-count="${Math.round(tot.kcal)}">${fmt(tot.kcal, 0)}</span>
${tg.kcal
    ? `<span class="muted">of ${fmt(tg.kcal, 0)} kcal</span><span style="font-size:13px;font-weight:600">${left >= 0 ? fmt(left, 0) + ' left' : fmt(-left, 0) + ' over'}</span>`
    : `<span class="muted">kcal today</span><button class="link" data-action="tab" data-tab="settings">Set targets</button>`}
</div></div>
<div class="grid3">
${macro('Protein', tot.p, tg.p, 'var(--cyan)')}${macro('Carbs', tot.c, tg.c, 'var(--violet)')}${macro('Fat', tot.f, tg.f, '#F0ABFC')}
</div></section>`;
}

function weightCard() {
  const s = weightSeries();
  if (!s.length) {
    return `<section class="card" style="--accent:var(--magenta)"><span class="label">Weight trend</span>
<span class="muted">No weigh-ins yet.</span><button class="btn ghost sm" data-action="weight-log">Log weight</button></section>`;
  }
  const last = s[s.length - 1], ch = weeklyTrendChange(s);
  const chTxt = ch == null ? 'Trend builds as you log' : `${ch > 0 ? '+' : ch < 0 ? '−' : ''}${fmt(Math.abs(toDisp(ch)), 1)} this week`;
  return `<section class="card press" data-action="tab" data-tab="progress" style="--accent:var(--magenta)"><span class="label">Weight trend</span>
<span class="mid"><span data-count="${toDisp(last.trend).toFixed(1)}" data-dp="1">${fmt(toDisp(last.trend), 1)}</span><span class="unit"> ${wu()}</span></span>
${spark(s.slice(-30).map(x => x.trend), '#E879F9')}
<span class="muted small">${chTxt}</span></section>`;
}

function weekCard() {
  const ws = weekWorkouts(), sets = ws.reduce((a, w) => a + workoutSets(w), 0);
  return `<section class="card press" data-action="tab" data-tab="train" style="--accent:var(--violet)"><span class="label">This week</span>
<span class="mid"><span data-count="${ws.length}">${ws.length}</span><span class="unit"> ${ws.length === 1 ? 'workout' : 'workouts'}</span></span>
<span class="muted small">${sets ? fmt(sets, 0) + ' sets logged' : 'Nothing logged yet this week'}</span></section>`;
}

function workoutCard(t) {
  const aw = state.activeWorkout;
  let body;
  if (aw) {
    body = `<div class="col"><span class="label">Workout in progress</span><span class="title ellip">${esc(aw.name)}</span></div>
<button class="btn primary" data-action="wk-resume">Resume</button>`;
  } else {
    const done = state.workouts.filter(w => w.date === t);
    const tpl = todaysTemplate();
    if (done.length) {
      const w = done[done.length - 1];
      body = `<div class="col"><span class="label c-teal">Done today</span><span class="title ellip">${esc(w.name)}</span>
<span class="muted">${workoutSets(w)} sets logged</span></div>
<button class="btn ghost" data-action="tab" data-tab="train">View</button>`;
    } else if (tpl) {
      body = `<div class="col"><span class="label">Today's workout</span><span class="title ellip">${esc(tpl.name)}</span>
<span class="muted">${tpl.exercises.length} ${tpl.exercises.length === 1 ? 'exercise' : 'exercises'}</span></div>
<button class="btn primary" data-action="wk-start" data-id="${tpl.id}">Start</button>`;
    } else if (state.templates.length) {
      body = `<div class="col"><span class="label">Training</span><span class="title">Nothing planned today</span>
<span class="muted">Pick any workout, or rest.</span></div>
<button class="btn ghost" data-action="tab" data-tab="train">Choose</button>`;
    } else {
      body = `<div class="col"><span class="label">Training</span><span class="title">Build your first workout</span>
<span class="muted">Save a template once, start it in one tap.</span></div>
<button class="btn primary" data-action="tpl-new">Create</button>`;
    }
  }
  return `<section class="card glow-violet" style="--accent:var(--violet);flex-direction:row;align-items:center;justify-content:space-between">${body}</section>`;
}

function calendarCard(t) {
  const act = activityMap(), start = addDays(weekStart(t), -21);
  let cells = '', active = 0;
  for (let i = 0; i < 28; i++) {
    const d = addDays(start, i), lvl = act[d] || 0;
    if (d <= t && lvl) active++;
    cells += `<span class="${d > t ? 'future' : lvl ? 'l' + lvl : ''}${d === t ? ' today' : ''}"></span>`;
  }
  return `<section class="card"><div class="row between"><span class="sub">Consistency</span><span class="muted small">${active} active ${active === 1 ? 'day' : 'days'} · last 4 weeks</span></div>
<div class="cal-head">${DAYS.map(d => `<span>${d[0]}</span>`).join('')}</div>
<div class="cal" role="img" aria-label="${active} active days in the last four weeks">${cells}</div></section>`;
}

function nudges() {
  const s = state.settings;
  let out = '';
  if (isIos() && !isStandalone() && !s.installDismissed) {
    out += `<section class="card" style="border-color:#251D45"><span class="sub">Add to your Home Screen</span>
<span class="muted" style="line-height:1.5">In Safari, tap the Share button, then “Add to Home Screen”. The app then opens full screen and keeps your data safely on this phone.</span>
<button class="link" data-action="install-dismiss">Got it</button></section>`;
  }
  const stale = !s.lastBackup || Date.now() - new Date(s.lastBackup).getTime() > 14 * 864e5;
  if (hasData() && stale && state.foodLog.length + state.workouts.length + state.weights.length >= 10) {
    out += `<section class="card"><span class="sub">Back up your data</span>
<span class="muted" style="line-height:1.5">Everything lives on this phone. A backup file takes a few seconds and means nothing is ever lost.</span>
<button class="btn ghost sm" data-action="export">Export backup</button></section>`;
  }
  return out;
}

export function renderHome() {
  const s = state.settings, t = ymd(), hide = s.hide || {}, now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const hr = now.getHours(), greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const small = [hide.weight ? '' : weightCard(), hide.week ? '' : weekCard()].filter(Boolean);
  return `<header class="head"><div class="col"><span class="eyebrow">${esc(dateStr)}</span><h1>${greet}${s.name ? ', ' + esc(s.name) : ''}</h1></div>
<button class="icon-btn" data-action="tab" data-tab="settings" aria-label="Settings">${icon.gear}</button></header>
${hide.nutrition ? '' : nutritionCard(t)}
${small.length === 2 ? `<div class="grid2">${small.join('')}</div>` : small.join('')}
${hide.workout ? '' : workoutCard(t)}
${hide.calendar ? '' : calendarCard(t)}
${nudges()}`;
}

actions['install-dismiss'] = () => { state.settings.installDismissed = true; save('settings'); nav.render(); };
