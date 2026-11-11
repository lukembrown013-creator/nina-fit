// Train tab: workout templates, weekly volume, history, and the exercise picker.
import { state, save } from './store.js';
import { esc, fmt, uid, num, niceDate, clock, DAYS } from './util.js';
import { allExercises, muscleSets, weekWorkouts, workoutSets, workoutVolumeKg, todaysTemplate, toDisp, wu } from './calc.js';
import { MUSCLES } from './exercises.js';
import { actions, inputs, nav, openSheet, setSheet, closeSheet, confirmSheet, toast, icon } from './ui.js';

const daysLabel = t => ((t.days || []).length ? [...t.days].sort().map(d => DAYS[d]).join(', ') : 'Any day');

export function renderTrain() {
  const aw = state.activeWorkout, today = todaysTemplate();
  const tpls = state.templates.map(t => `<div class="item press" data-action="tpl-edit" data-id="${t.id}">
<div class="col grow"><span class="sub ellip">${esc(t.name)}${today && today.id === t.id ? ' <span class="c-violet small">· today</span>' : ''}</span>
<span class="muted small">${t.exercises.length} ${t.exercises.length === 1 ? 'exercise' : 'exercises'} · ${daysLabel(t)}</span></div>
<button class="btn primary sm" data-action="wk-start" data-id="${t.id}">Start</button></div>`).join('');

  const ms = muscleSets(), max = Math.max(1, ...Object.values(ms));
  const vol = Object.entries(ms).sort((a, b) => b[1] - a[1]).map(([m, n]) => `<div class="row"><span class="muted" style="width:92px">${esc(m)}</span>
<div class="bar grow"><i data-w="${((n / max) * 100).toFixed(0)}" style="background:var(--violet)"></i></div><span class="sub" style="width:28px;text-align:right">${n}</span></div>`).join('');

  const hist = [...state.workouts].sort((a, b) => b.start - a.start).slice(0, 12).map(w => `<div class="swipe">
<button class="swipe-del" data-action="wk-del" data-id="${w.id}">Delete</button>
<div class="swipe-body" data-action="wk-view" data-id="${w.id}"><div class="col grow"><span class="sub ellip">${esc(w.name)}</span>
<span class="muted small">${niceDate(w.date)} · ${workoutSets(w)} sets · ${clock((w.end - w.start) / 1000)}</span></div>
<span class="muted">${icon.chevR}</span></div></div>`).join('');

  return `<header class="head"><h1>Train</h1></header>
${aw ? `<section class="card glow-violet" style="flex-direction:row;align-items:center;justify-content:space-between">
<div class="col"><span class="label">In progress</span><span class="title ellip">${esc(aw.name)}</span></div>
<button class="btn primary" data-action="wk-resume">Resume</button></section>` : ''}
<div class="sec-head"><h2>Workouts</h2><button class="link" data-action="tpl-new">${icon.plus}&nbsp;New</button></div>
${tpls ? `<div class="list">${tpls}</div>` : `<section class="card empty"><span class="sub">No workouts saved yet</span>
<span class="muted">Build a template for each day of your split. Starting one fills in your last weights and reps.</span>
<button class="btn primary" data-action="tpl-new">Create a workout</button></section>`}
${aw ? '' : `<button class="btn ghost block" data-action="wk-start">Start an empty workout</button>`}
<div class="sec-head"><h2>Sets this week</h2><span class="muted small">${weekWorkouts().length} ${weekWorkouts().length === 1 ? 'workout' : 'workouts'}</span></div>
${vol ? `<section class="card">${vol}</section>` : `<section class="card"><span class="muted">Sets per muscle group appear here once you train this week.</span></section>`}
<div class="sec-head"><h2>History</h2></div>
${hist ? `<div class="list">${hist}</div>` : `<section class="card"><span class="muted">Finished workouts are listed here. Swipe one left to delete it.</span></section>`}`;
}

// ---------- workout detail ----------
actions['wk-view'] = el => {
  const w = state.workouts.find(x => x.id === el.dataset.id);
  if (!w) return;
  const ex = w.exercises.map(e => `<div class="col" style="gap:4px"><span class="sub">${esc(e.name)}</span>
<span class="muted">${e.sets.map(s => `${s.kg ? fmt(toDisp(s.kg), 2) + ' × ' : ''}${s.reps}${s.pr ? ' ★' : ''}`).join(' · ')}</span></div>`).join('');
  openSheet(`<div class="sheet-head"><h2 class="sheet-title">${esc(w.name)}</h2></div>
<span class="muted">${niceDate(w.date)} · ${clock((w.end - w.start) / 1000)} · ${workoutSets(w)} sets · ${fmt(toDisp(workoutVolumeKg(w)), 0)} ${wu()} total</span>
${ex}<span class="muted small">★ marks a personal record.</span>
<button class="btn ghost block" data-action="sheet-close">Close</button>`);
};
actions['wk-del'] = el => {
  confirmSheet({ title: 'Delete this workout?', text: 'It is removed from your history and records.', ok: 'Delete', danger: true }, () => {
    state.workouts = state.workouts.filter(w => w.id !== el.dataset.id);
    save('workouts'); nav.render();
  });
};

// ---------- template editor ----------
let draft = null;
function editorHtml() {
  const d = draft;
  const rows = d.exercises.map((e, i) => `<div class="card" style="padding:14px;gap:10px;background:var(--card2)">
<div class="row between"><span class="sub ellip grow">${esc(e.name)}</span>
<button class="icon-btn" style="width:40px;height:40px" data-action="tpl-up" data-i="${i}" aria-label="Move up"${i === 0 ? ' disabled' : ''}><span style="transform:rotate(180deg);display:flex">${icon.chevD}</span></button>
<button class="icon-btn" style="width:40px;height:40px" data-action="tpl-down" data-i="${i}" aria-label="Move down"${i === d.exercises.length - 1 ? ' disabled' : ''}>${icon.chevD}</button>
<button class="icon-btn" style="width:40px;height:40px;color:var(--danger)" data-action="tpl-rm" data-i="${i}" aria-label="Remove ${esc(e.name)}">✕</button></div>
<div class="grid2"><label class="field"><span>Sets</span><input type="text" inputmode="numeric" data-input="tpl-f" data-i="${i}" data-f="sets" value="${e.sets ?? ''}"></label>
<label class="field"><span>Target reps</span><input type="text" inputmode="numeric" data-input="tpl-f" data-i="${i}" data-f="reps" value="${e.reps ?? ''}" placeholder="optional"></label></div></div>`).join('');
  return `<div class="sheet-head"><h2 class="sheet-title">${d.isNew ? 'New workout' : 'Edit workout'}</h2><button class="btn primary sm" data-action="tpl-save">Save</button></div>
<label class="field"><span>Name</span><input type="text" data-input="tpl-name" value="${esc(d.name)}" placeholder="e.g. Lower A" autocomplete="off"></label>
<div class="field"><span>Usual days (optional)</span><div class="chips">${DAYS.map((n, i) => `<button class="chip${d.days.includes(i) ? ' on' : ''}" data-action="tpl-day" data-i="${i}">${n}</button>`).join('')}</div></div>
${rows || '<span class="muted">No exercises yet.</span>'}
<button class="btn ghost block" data-action="tpl-add">${icon.plus} Add exercise</button>
${d.isNew ? '' : '<button class="btn danger block" data-action="tpl-delete">Delete workout</button>'}`;
}
actions['tpl-new'] = () => { draft = { id: uid(), name: '', days: [], exercises: [], isNew: true }; openSheet(editorHtml()); };
actions['tpl-edit'] = el => {
  const t = state.templates.find(x => x.id === el.dataset.id);
  if (!t) return;
  draft = JSON.parse(JSON.stringify(t)); draft.days = draft.days || []; draft.isNew = false;
  openSheet(editorHtml());
};
inputs['tpl-name'] = el => { draft.name = el.value; };
inputs['tpl-f'] = el => { const n = num(el.value); draft.exercises[+el.dataset.i][el.dataset.f] = n == null ? null : Math.max(0, Math.round(n)); };
actions['tpl-day'] = el => {
  const i = +el.dataset.i;
  draft.days = draft.days.includes(i) ? draft.days.filter(x => x !== i) : [...draft.days, i];
  setSheet(editorHtml());
};
actions['tpl-up'] = el => { const i = +el.dataset.i; if (i > 0) { const a = draft.exercises; [a[i - 1], a[i]] = [a[i], a[i - 1]]; setSheet(editorHtml()); } };
actions['tpl-down'] = el => { const i = +el.dataset.i, a = draft.exercises; if (i < a.length - 1) { [a[i + 1], a[i]] = [a[i], a[i + 1]]; setSheet(editorHtml()); } };
actions['tpl-rm'] = el => { draft.exercises.splice(+el.dataset.i, 1); setSheet(editorHtml()); };
actions['tpl-add'] = () => pickExercise(name => { draft.exercises.push({ name, sets: 3, reps: null }); setSheet(editorHtml()); });
actions['tpl-save'] = () => {
  const d = draft;
  if (!d.name.trim()) return toast('Give the workout a name');
  if (!d.exercises.length) return toast('Add at least one exercise');
  const t = { id: d.id, name: d.name.trim(), days: d.days, exercises: d.exercises.map(e => ({ name: e.name, sets: e.sets || 3, reps: e.reps || null })) };
  const i = state.templates.findIndex(x => x.id === t.id);
  if (i >= 0) state.templates[i] = t; else state.templates.push(t);
  save('templates'); closeSheet(); nav.render(); toast('Workout saved');
};
actions['tpl-delete'] = () => {
  const id = draft.id;
  confirmSheet({ title: 'Delete this workout template?', text: 'Your past workouts and records stay.', ok: 'Delete', danger: true }, () => {
    state.templates = state.templates.filter(t => t.id !== id);
    save('templates'); closeSheet(); nav.render();
  });
};

// ---------- exercise picker (shared with workout mode) ----------
let pick = { cb: null, q: '', muscle: '', creating: false };
function pickList() {
  const q = pick.q.trim().toLowerCase();
  if (pick.creating) {
    return `<span class="sub">Which muscle group is “${esc(pick.q.trim())}”?</span>
<div class="chips">${MUSCLES.map(m => `<button class="chip" data-action="pick-create" data-m="${m}">${m}</button>`).join('')}</div>`;
  }
  const list = allExercises().filter(e => (!pick.muscle || e.muscle === pick.muscle) && (!q || e.name.toLowerCase().includes(q)));
  const exact = allExercises().some(e => e.name.toLowerCase() === q);
  return `<div class="list">${list.map(e => `<button class="item press" data-action="pick-choose" data-name="${esc(e.name)}">
<span class="col grow"><span class="sub ellip">${esc(e.name)}</span><span class="muted small">${esc(e.muscle)} · ${esc(e.equip || 'Custom')}</span></span></button>`).join('')}
${q && !exact ? `<button class="item press" data-action="pick-new"><span class="sub c-violet">${icon.plus} Add “${esc(pick.q.trim())}” as a new exercise</span></button>` : ''}
${!list.length && !q ? '<div class="item"><span class="muted">No exercises in this group.</span></div>' : ''}</div>`;
}
function pickChips() {
  return ['', ...MUSCLES].map(m => `<button class="chip${pick.muscle === m ? ' on' : ''}" data-action="pick-muscle" data-m="${m}">${m || 'All'}</button>`).join('');
}
export function pickExercise(cb) {
  pick = { cb, q: '', muscle: '', creating: false };
  openSheet(`<div class="sheet-head"><h2 class="sheet-title">Add exercise</h2><button class="link" data-action="sheet-close">Cancel</button></div>
<input type="search" data-input="pick-q" placeholder="Search or type a new name" autocomplete="off" autocorrect="off" enterkeyhint="search">
<div class="chips scroll" id="pick-chips">${pickChips()}</div>
<div id="pick-list" style="min-height:46vh">${pickList()}</div>`);
}
const refreshPick = () => {
  const l = document.getElementById('pick-list'), c = document.getElementById('pick-chips');
  if (l) l.innerHTML = pickList();
  if (c) c.innerHTML = pickChips();
};
inputs['pick-q'] = el => { pick.q = el.value; pick.creating = false; refreshPick(); };
actions['pick-muscle'] = el => { pick.muscle = el.dataset.m; pick.creating = false; refreshPick(); };
actions['pick-new'] = () => { pick.creating = true; refreshPick(); };
actions['pick-create'] = el => {
  const name = pick.q.trim();
  if (!name) return;
  state.customExercises.push({ name, muscle: el.dataset.m, equip: 'Custom' });
  save('customExercises');
  const cb = pick.cb; closeSheet(); if (cb) cb(name);
};
actions['pick-choose'] = el => { const cb = pick.cb, name = el.dataset.name; closeSheet(); if (cb) cb(name); };
