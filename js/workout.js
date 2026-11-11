// Workout mode: full-screen set tracker with rest timer, PR detection and plate calculator.
import { state, save } from './store.js';
import { $, esc, fmt, uid, num, ymd, clock, e1rm, niceDate } from './util.js';
import { lastSession, bestFor, muscleOf, toDisp, toKg, wu } from './calc.js';
import { actions, inputs, nav, openSheet, closeSheet, closeAllSheets, confirmSheet, toast, celebrate, beep, primeAudio, buzz, icon } from './ui.js';
import { pickExercise } from './train.js';

let open = false, wakeLock = null;

// ---------- screen wake lock (keeps the phone awake during a workout) ----------
async function lockScreen() {
  try { if (open && navigator.wakeLock && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch { wakeLock = null; }
}
function unlockScreen() { try { if (wakeLock) wakeLock.release(); } catch { /* ignore */ } wakeLock = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { lockScreen(); tick(); } });

// ---------- building a workout ----------
const blankSet = () => ({ w: '', reps: '', rpe: '', done: false, pr: false });
function buildExercise(name, sets = 3, reps = null) {
  const last = lastSession(name);
  const rows = [];
  for (let i = 0; i < Math.max(1, sets); i++) {
    const s = blankSet();
    // Smart default: start from what she did last time on the same set.
    const prev = last && (last.sets[i] || last.sets[last.sets.length - 1]);
    if (prev) { s.w = prev.kg ? String(+toDisp(prev.kg).toFixed(2)) : ''; s.reps = String(prev.reps); }
    else if (reps) s.reps = String(reps);
    rows.push(s);
  }
  return { name, muscle: muscleOf(name), reps, sets: rows };
}

function startWorkout(tpl) {
  if (state.activeWorkout) return showWorkout();
  state.activeWorkout = {
    id: uid(), name: tpl ? tpl.name : 'Workout', templateId: tpl ? tpl.id : null, start: Date.now(),
    exercises: tpl ? tpl.exercises.map(e => buildExercise(e.name, e.sets, e.reps)) : [], rest: null
  };
  save('activeWorkout');
  primeAudio();
  showWorkout();
  nav.render();
}
function showWorkout() { open = true; $('#workout').hidden = false; renderWorkout(); lockScreen(); tick(); }
function hideWorkout() { open = false; $('#workout').hidden = true; unlockScreen(); tick(); }

// ---------- rendering ----------
function suggestion(ex) {
  const last = lastSession(ex.name);
  if (!last) return '';
  const top = Math.max(...last.sets.map(s => s.kg || 0));
  if (!top) return '';
  const topSets = last.sets.filter(s => s.kg === top), inc = state.settings.inc[wu()] || 0;
  if (ex.reps && topSets.every(s => s.reps >= ex.reps)) return `You hit every rep last time. Try ${fmt(toDisp(top) + inc, 2)} ${wu()}.`;
  if (ex.reps) return `Aim for ${ex.reps} reps at ${fmt(toDisp(top), 2)} ${wu()}.`;
  return `Match ${fmt(toDisp(top), 2)} ${wu()} and try for one more rep.`;
}

function exerciseCard(ex, i) {
  const last = lastSession(ex.name), sug = suggestion(ex);
  const lastTxt = last ? `Last (${niceDate(last.date)}): ${last.sets.map(s => `${s.kg ? fmt(toDisp(s.kg), 2) + '×' : ''}${s.reps}`).join(', ')}` : 'First time logging this';
  const rows = ex.sets.map((s, j) => `<div class="set-grid set-row${s.done ? ' done' : ''}${s.pr ? ' pr' : ''}">
<span class="set-n">${s.pr ? '★' : j + 1}</span>
<input type="text" inputmode="decimal" aria-label="Weight, set ${j + 1}" data-input="wk-f" data-i="${i}" data-s="${j}" data-f="w" value="${esc(s.w)}" placeholder="0">
<input type="text" inputmode="numeric" aria-label="Reps, set ${j + 1}" data-input="wk-f" data-i="${i}" data-s="${j}" data-f="reps" value="${esc(s.reps)}" placeholder="0">
<input type="text" inputmode="decimal" class="rpe" aria-label="RPE, set ${j + 1}" data-input="wk-f" data-i="${i}" data-s="${j}" data-f="rpe" value="${esc(s.rpe)}" placeholder="–">
<button class="set-check" data-action="wk-check" data-i="${i}" data-s="${j}" aria-label="${s.done ? 'Undo set' : 'Complete set'} ${j + 1}" aria-pressed="${s.done}">${icon.check}</button></div>`).join('');
  return `<section class="card ex">
<div class="row between"><div class="col grow"><h3>${esc(ex.name)}</h3><span class="muted small">${esc(lastTxt)}</span></div>
<button class="icon-btn" data-action="wk-plates" data-i="${i}" aria-label="Plate calculator">${icon.plates}</button>
<button class="icon-btn" data-action="wk-menu" data-i="${i}" aria-label="Exercise options">${icon.dots}</button></div>
${sug ? `<span class="pill">${esc(sug)}</span>` : ''}
<div class="set-grid h"><span>Set</span><span>${wu()}</span><span>Reps</span><span>RPE</span><span></span></div>
${rows}
<div class="row between"><button class="link" data-action="wk-add-set" data-i="${i}">${icon.plus}&nbsp;Add set</button>
${ex.sets.length > 1 ? `<button class="link" style="color:var(--muted)" data-action="wk-rm-set" data-i="${i}">Remove last set</button>` : ''}</div>
</section>`;
}

export function renderWorkout() {
  const aw = state.activeWorkout, el = $('#workout');
  if (!aw) { el.hidden = true; el.innerHTML = ''; open = false; return; }
  const old = $('.wk-body', el), top = old ? old.scrollTop : 0;
  el.innerHTML = `<header class="wk-head">
<button class="icon-btn" data-action="wk-min" aria-label="Minimize workout">${icon.chevD}</button>
<div class="col grow" style="gap:2px"><h2>${esc(aw.name)}</h2><span id="wk-elapsed">0:00</span></div>
<button class="btn primary sm" data-action="wk-finish" style="--accent:var(--violet)">Finish</button></header>
<div class="wk-body">
${aw.exercises.map(exerciseCard).join('') || `<section class="card empty"><span class="sub">Add your first exercise</span><span class="muted">Your last weights and reps fill in automatically.</span></section>`}
<button class="btn ghost block" data-action="wk-add-ex">${icon.plus} Add exercise</button>
<button class="btn danger block" data-action="wk-discard">Discard workout</button>
</div>
<div class="rest-bar" id="rest-bar" hidden>
<div class="col" style="gap:0"><span class="muted small">Rest</span><span class="rest-time" id="rest-time">0:00</span></div>
<div class="grow"></div>
<button class="btn ghost sm" data-action="rest-adj" data-d="-15" aria-label="15 seconds less">−15</button>
<button class="btn ghost sm" data-action="rest-adj" data-d="15" aria-label="15 seconds more">+15</button>
<button class="btn primary sm" data-action="rest-skip" style="--accent:var(--violet)">Skip</button>
<div class="rest-prog"><i id="rest-prog"></i></div></div>`;
  $('.wk-body', el).scrollTop = top;
  tick();
}

// ---------- ticker: elapsed time, rest countdown, minimized pill ----------
function tick() {
  const aw = state.activeWorkout, mini = $('#mini');
  if (!aw) { if (mini) mini.hidden = true; return; }
  const now = Date.now(), el = $('#wk-elapsed');
  let restLeft = null;
  if (aw.rest) {
    restLeft = (aw.rest.end - now) / 1000;
    if (restLeft <= 0) {
      aw.rest = null; restLeft = null; save('activeWorkout');
      beep(); buzz(200); toast('Rest over. Next set.');
    }
  }
  if (el) el.textContent = clock((now - aw.start) / 1000);
  const bar = $('#rest-bar');
  if (bar) {
    bar.hidden = restLeft == null;
    if (restLeft != null) {
      $('#rest-time').textContent = clock(Math.ceil(restLeft));
      $('#rest-prog').style.width = Math.max(0, Math.min(100, (restLeft / aw.rest.total) * 100)) + '%';
    }
  }
  if (mini) {
    mini.hidden = open;
    $('#mini-name').textContent = aw.name;
    $('#mini-time').textContent = restLeft != null ? 'Rest ' + clock(Math.ceil(restLeft)) : clock((now - aw.start) / 1000);
  }
}
setInterval(tick, 500);

// ---------- actions ----------
actions['wk-start'] = el => {
  if (state.activeWorkout) return showWorkout();
  const tpl = el.dataset.id ? state.templates.find(t => t.id === el.dataset.id) : null;
  closeAllSheets();
  startWorkout(tpl || null);
};
actions['wk-resume'] = () => { if (state.activeWorkout) showWorkout(); };
actions['wk-min'] = () => { hideWorkout(); nav.render(); };

inputs['wk-f'] = el => {
  const aw = state.activeWorkout; if (!aw) return;
  const s = aw.exercises[+el.dataset.i]?.sets[+el.dataset.s]; if (!s) return;
  s[el.dataset.f] = el.value;
  save('activeWorkout');
};

actions['wk-check'] = el => {
  const aw = state.activeWorkout; if (!aw) return;
  const ex = aw.exercises[+el.dataset.i], s = ex.sets[+el.dataset.s];
  primeAudio();
  if (s.done) { s.done = false; s.pr = false; save('activeWorkout'); return renderWorkout(); }
  const reps = num(s.reps), w = num(s.w) || 0;
  if (!reps || reps <= 0) return toast('Enter reps first');
  s.done = true;
  // Personal record: best estimated one-rep max so far, compared with all earlier workouts.
  const best = bestFor(ex.name);
  if (best && w > 0) {
    const e = e1rm(toKg(w), reps);
    const earlier = Math.max(0, ...ex.sets.filter(x => x !== s && x.done).map(x => e1rm(toKg(num(x.w) || 0), num(x.reps) || 0)));
    if (e > Math.max(best.e1, earlier) + 1e-6) s.pr = true;
  }
  aw.rest = { end: Date.now() + state.settings.rest * 1000, total: state.settings.rest };
  save('activeWorkout');
  renderWorkout();
  buzz(15);
  if (s.pr) { celebrate(); toast('New personal record'); }
};

actions['wk-add-set'] = el => {
  const ex = state.activeWorkout.exercises[+el.dataset.i], prev = ex.sets[ex.sets.length - 1];
  ex.sets.push({ ...blankSet(), w: prev ? prev.w : '', reps: prev ? prev.reps : '' });
  save('activeWorkout'); renderWorkout();
};
actions['wk-rm-set'] = el => {
  const ex = state.activeWorkout.exercises[+el.dataset.i];
  if (ex.sets.length > 1) ex.sets.pop();
  save('activeWorkout'); renderWorkout();
};
actions['wk-add-ex'] = () => pickExercise(name => {
  state.activeWorkout.exercises.push(buildExercise(name, 3, null));
  save('activeWorkout'); renderWorkout();
  requestAnimationFrame(() => { const b = $('.wk-body'); if (b) b.scrollTop = b.scrollHeight; });
});

actions['wk-menu'] = el => {
  const i = +el.dataset.i, ex = state.activeWorkout.exercises[i], n = state.activeWorkout.exercises.length;
  openSheet(`<h2 class="sheet-title">${esc(ex.name)}</h2>
${i > 0 ? `<button class="btn ghost block" data-action="wk-move" data-i="${i}" data-d="-1">Move up</button>` : ''}
${i < n - 1 ? `<button class="btn ghost block" data-action="wk-move" data-i="${i}" data-d="1">Move down</button>` : ''}
<button class="btn danger block" data-action="wk-rm-ex" data-i="${i}">Remove from this workout</button>
<button class="btn ghost block" data-action="sheet-close">Cancel</button>`);
};
actions['wk-move'] = el => {
  const a = state.activeWorkout.exercises, i = +el.dataset.i, j = i + +el.dataset.d;
  if (j >= 0 && j < a.length) [a[i], a[j]] = [a[j], a[i]];
  save('activeWorkout'); closeSheet(); renderWorkout();
};
actions['wk-rm-ex'] = el => { state.activeWorkout.exercises.splice(+el.dataset.i, 1); save('activeWorkout'); closeSheet(); renderWorkout(); };

actions['rest-adj'] = el => {
  const r = state.activeWorkout && state.activeWorkout.rest; if (!r) return;
  r.end += +el.dataset.d * 1000; r.total = Math.max(r.total, (r.end - Date.now()) / 1000);
  save('activeWorkout'); tick();
};
actions['rest-skip'] = () => { if (state.activeWorkout) { state.activeWorkout.rest = null; save('activeWorkout'); tick(); } };

actions['wk-discard'] = () => confirmSheet({ title: 'Discard this workout?', text: 'Nothing from this session will be saved.', ok: 'Discard', danger: true }, () => {
  state.activeWorkout = null; save('activeWorkout'); hideWorkout(); renderWorkout(); nav.render();
});

actions['wk-finish'] = () => {
  const aw = state.activeWorkout; if (!aw) return;
  const exercises = aw.exercises.map(ex => ({
    name: ex.name, muscle: ex.muscle,
    sets: ex.sets.filter(s => s.done && num(s.reps) > 0).map(s => ({ kg: toKg(num(s.w) || 0), reps: Math.round(num(s.reps)), rpe: num(s.rpe), pr: !!s.pr }))
  })).filter(ex => ex.sets.length);
  if (!exercises.length) return toast('Tick off at least one set, or discard the workout');
  const pending = aw.exercises.reduce((a, ex) => a + ex.sets.filter(s => !s.done).length, 0);
  const finish = () => {
    const w = { id: aw.id, date: ymd(new Date(aw.start)), start: aw.start, end: Date.now(), name: aw.name, templateId: aw.templateId, exercises };
    state.workouts.push(w);
    state.activeWorkout = null;
    save('workouts', 'activeWorkout');
    hideWorkout(); renderWorkout(); nav.render();
    const sets = exercises.reduce((a, e) => a + e.sets.length, 0);
    const vol = exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.kg * s.reps, 0), 0);
    const prs = exercises.flatMap(e => e.sets.filter(s => s.pr).map(s => `${e.name}: ${fmt(toDisp(s.kg), 2)} ${wu()} × ${s.reps}`));
    openSheet(`<h2 class="sheet-title">Workout complete</h2>
<div class="grid3" style="--accent:var(--violet)">
<div class="col"><span class="muted small">Time</span><span class="title">${clock((w.end - w.start) / 1000)}</span></div>
<div class="col"><span class="muted small">Sets</span><span class="title">${sets}</span></div>
<div class="col"><span class="muted small">Volume</span><span class="title">${fmt(toDisp(vol), 0)}<span class="unit"> ${wu()}</span></span></div></div>
${prs.length ? `<div class="col"><span class="label c-magenta">Personal records</span>${prs.map(p => `<span class="sub">★ ${esc(p)}</span>`).join('')}</div>` : ''}
<button class="btn primary block" data-action="sheet-close" style="--accent:var(--violet)">Done</button>`);
    if (prs.length) celebrate();
  };
  if (pending) confirmSheet({ title: 'Finish workout?', text: `${pending} unticked ${pending === 1 ? 'set' : 'sets'} will not be saved.`, ok: 'Finish' }, finish);
  else finish();
};

// ---------- plate calculator ----------
const PLATES = { lb: [45, 35, 25, 10, 5, 2.5], kg: [25, 20, 15, 10, 5, 2.5, 1.25] };
let plateTarget = '';
function platesHtml() {
  const u = wu(), bar = state.settings.bar[u], target = num(plateTarget);
  let body;
  if (target == null) body = '<span class="muted">Enter the total weight you want on the bar.</span>';
  else if (target < bar) body = `<span class="muted">That is lighter than the ${fmt(bar, 2)} ${u} bar.</span>`;
  else {
    let side = (target - bar) / 2; const out = [];
    for (const p of PLATES[u]) while (side >= p - 1e-9) { out.push(p); side -= p; }
    body = `<div class="plates"><span class="barbell"></span>${out.map(p => `<span class="plate" style="height:${Math.round(36 + (p / PLATES[u][0]) * 56)}px">${p}</span>`).join('') || '<span class="muted">Empty bar</span>'}</div>
<span class="muted center" style="display:block;text-align:center">${out.length ? 'Each side: ' + out.join(' + ') + ' ' + u : 'Just the bar'}${side > 1e-6 ? ` · ${fmt(side * 2, 2)} ${u} cannot be loaded with standard plates` : ''}</span>`;
  }
  return body;
}
actions['wk-plates'] = el => {
  const ex = state.activeWorkout && state.activeWorkout.exercises[+el.dataset.i];
  const s = ex && (ex.sets.find(x => !x.done && x.w) || ex.sets[ex.sets.length - 1]);
  plateTarget = s ? s.w : '';
  openSheet(`<div class="sheet-head"><h2 class="sheet-title">Plate calculator</h2><button class="link" data-action="sheet-close">Done</button></div>
<label class="field"><span>Total weight (${wu()}), bar is ${fmt(state.settings.bar[wu()], 2)} ${wu()}</span>
<input type="text" inputmode="decimal" data-input="plate-t" value="${esc(plateTarget)}" placeholder="0"></label>
<div id="plate-out" class="col" style="--accent:var(--violet)">${platesHtml()}</div>`);
};
inputs['plate-t'] = el => { plateTarget = el.value; const o = $('#plate-out'); if (o) o.innerHTML = platesHtml(); };

export function initWorkout() { tick(); }
