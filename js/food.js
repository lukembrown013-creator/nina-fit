// Food tab: daily log by meal, quick add, own foods, saved meals, recents.
import { state, save } from './store.js';
import { esc, fmt, uid, num, ymd, addDays, niceDate } from './util.js';
import { dayTotals, recentFoods, guessMeal, MEALS } from './calc.js';
import { actions, inputs, submits, nav, openSheet, closeSheet, toast, buzz, icon } from './ui.js';

export const foodNav = { date: ymd() };
const kc = e => (e.kcal || 0) * (e.qty ?? 1);
const macroLine = e => { const q = e.qty ?? 1; return `P ${fmt((e.p || 0) * q, 0)} · C ${fmt((e.c || 0) * q, 0)} · F ${fmt((e.f || 0) * q, 0)}`; };

export function renderFood() {
  const date = foodNav.date, tot = dayTotals(date), tg = state.settings.targets;
  const stat = (label, val, target, color, unit) => `<div class="col"><span class="muted small" style="font-weight:600">${label}</span>
<span class="sub"><span data-count="${Math.round(val)}">${fmt(val, 0)}</span><span class="unit">${target ? ' / ' + fmt(target, 0) : ''}${unit}</span></span>
<div class="bar"><i data-w="${target ? Math.min(100, (val / target) * 100).toFixed(1) : 0}" style="background:${color}"></i></div></div>`;

  const meals = MEALS.map(meal => {
    const items = state.foodLog.filter(e => e.date === date && e.meal === meal).sort((a, b) => (a.ts || 0) - (b.ts || 0));
    const sum = items.reduce((a, e) => a + kc(e), 0);
    return `<div class="sec-head"><h2>${meal}${items.length ? ` <span class="muted" style="font-weight:500">· ${fmt(sum, 0)} kcal</span>` : ''}</h2>
<button class="icon-btn" data-action="food-add" data-meal="${meal}" aria-label="Add to ${meal}" style="color:var(--cyan)">${icon.plus}</button></div>
${items.length ? `<div class="list">${items.map(e => `<div class="swipe"><button class="swipe-del" data-action="food-del" data-id="${e.id}">Delete</button>
<div class="swipe-body" data-action="food-edit" data-id="${e.id}"><div class="col grow"><span class="sub ellip">${esc(e.name)}</span>
<span class="muted small">${(e.qty ?? 1) !== 1 ? fmt(e.qty, 2) + ' × ' : ''}${esc(e.serving || 'serving')} · ${macroLine(e)}</span></div>
<span class="v">${fmt(kc(e), 0)}</span></div></div>`).join('')}</div>
${items.length >= 2 ? `<button class="link" data-action="meal-save" data-meal="${meal}" style="align-self:flex-start">Save as a meal</button>` : ''}` : ''}`;
  }).join('');

  return `<header class="head"><h1>Food</h1>
<div class="row" style="gap:6px"><button class="icon-btn" data-action="food-day" data-d="-1" aria-label="Previous day">${icon.chevL}</button>
<button class="chip${date === ymd() ? ' on' : ''}" data-action="food-today" style="min-height:44px">${niceDate(date)}</button>
<button class="icon-btn" data-action="food-day" data-d="1" aria-label="Next day">${icon.chevR}</button></div></header>
<section class="card lg">
<div class="row between" style="align-items:flex-end"><div class="col"><span class="label">Calories</span>
<span class="big" data-count="${Math.round(tot.kcal)}">${fmt(tot.kcal, 0)}</span></div>
<span class="muted" style="padding-bottom:4px">${tg.kcal ? (tg.kcal - tot.kcal >= 0 ? fmt(tg.kcal - tot.kcal, 0) + ' left of ' : fmt(tot.kcal - tg.kcal, 0) + ' over ') + fmt(tg.kcal, 0) : 'No calorie target set'}</span></div>
<div class="bar" style="height:8px;border-radius:4px"><i data-w="${tg.kcal ? Math.min(100, (tot.kcal / tg.kcal) * 100).toFixed(1) : 0}" style="background:linear-gradient(90deg,#22D3EE,#A78BFA)"></i></div>
<div class="grid3">${stat('Protein', tot.p, tg.p, 'var(--cyan)', ' g')}${stat('Carbs', tot.c, tg.c, 'var(--violet)', ' g')}${stat('Fat', tot.f, tg.f, '#F0ABFC', ' g')}</div>
</section>
${tot.n ? '' : `<section class="card empty"><span class="sub">Nothing logged ${date === ymd() ? 'yet today' : 'this day'}</span>
<span class="muted">Tap + next to a meal. Foods you log show up under Recent for one-tap logging next time.</span></section>`}
${meals}`;
}

actions['food-day'] = el => { foodNav.date = addDays(foodNav.date, +el.dataset.d); nav.render(true); };
actions['food-today'] = () => { foodNav.date = ymd(); nav.render(true); };
export function shiftFoodDay(d) { foodNav.date = addDays(foodNav.date, d); nav.render(true); }

function logEntry(src, meal, date, qty) {
  state.foodLog.push({
    id: uid(), date, meal, name: src.name, serving: src.serving || '', kcal: +src.kcal || 0, p: +src.p || 0, c: +src.c || 0, f: +src.f || 0,
    qty: qty ?? src.qty ?? 1, ts: Date.now()
  });
}

// ---------- add food sheet ----------
let add = { meal: 'Breakfast', date: ymd(), tab: 'recent', q: '' };
const TABS = [['recent', 'Recent'], ['foods', 'My foods'], ['meals', 'Meals'], ['quick', 'Quick add']];

function addList() {
  const q = add.q.trim().toLowerCase(), match = n => !q || (n || '').toLowerCase().includes(q);
  const row = (action, key, e, right) => `<button class="item press" data-action="${action}" data-k="${esc(key)}">
<span class="col grow"><span class="sub ellip">${esc(e.name)}</span><span class="muted small">${right}</span></span>
<span class="v c-cyan">${icon.plus}</span></button>`;
  if (add.tab === 'recent') {
    const list = recentFoods().filter(e => match(e.name));
    return list.length ? `<div class="list">${list.map(e => row('add-recent', e.id, e, `${fmt(kc(e), 0)} kcal · ${(e.qty ?? 1) !== 1 ? fmt(e.qty, 2) + ' × ' : ''}${esc(e.serving || 'serving')}`)).join('')}</div>`
      : `<span class="muted" style="padding:8px 0">${q ? 'No recent foods match.' : 'Foods you log will appear here for one-tap logging.'}</span>`;
  }
  if (add.tab === 'foods') {
    const list = state.foods.filter(e => match(e.name)).sort((a, b) => a.name.localeCompare(b.name));
    return `${list.length ? `<div class="list">${list.map(e => row('add-food', e.id, e, `${fmt(e.kcal, 0)} kcal · ${esc(e.serving || 'serving')}`)).join('')}</div>` : `<span class="muted" style="padding:8px 0">${q ? 'No saved foods match.' : 'Save the foods you eat often.'}</span>`}
<button class="btn ghost block" data-action="food-new">${icon.plus} New food</button>`;
  }
  if (add.tab === 'meals') {
    const list = state.meals.filter(e => match(e.name));
    return list.length ? `<div class="list">${list.map(m => `<div class="swipe"><button class="swipe-del" data-action="meal-del" data-id="${m.id}">Delete</button>
<div class="swipe-body" data-action="add-meal" data-k="${m.id}"><span class="col grow"><span class="sub ellip">${esc(m.name)}</span>
<span class="muted small">${m.items.length} items · ${fmt(m.items.reduce((a, e) => a + kc(e), 0), 0)} kcal</span></span><span class="v c-cyan">${icon.plus}</span></div></div>`).join('')}</div>`
      : `<span class="muted" style="padding:8px 0">${q ? 'No saved meals match.' : 'Log two or more foods in a meal, then tap “Save as a meal”.'}</span>`;
  }
  return foodForm({ submit: 'quick-add', cta: 'Add', saveOption: true });
}

function foodForm({ submit, cta, v = {}, saveOption = false, qty = false, id = '' }) {
  const f = (name, label, mode, val, ph = '') => `<label class="field"><span>${label}</span><input type="text" name="${name}" inputmode="${mode}" value="${esc(val ?? '')}" placeholder="${ph}" autocomplete="off"></label>`;
  return `<form data-submit="${submit}" data-id="${id}" class="col" style="gap:12px">
${f('name', 'Name', 'text', v.name, saveOption ? 'optional' : 'e.g. Greek yogurt')}
<div class="grid2">${f('serving', 'Serving', 'text', v.serving, 'e.g. 1 cup')}${qty ? f('qty', 'Servings', 'decimal', v.qty ?? 1) : f('kcal', 'Calories', 'decimal', v.kcal, '0')}</div>
${qty ? f('kcal', 'Calories per serving', 'decimal', v.kcal, '0') : ''}
<div class="grid3">${f('p', 'Protein g', 'decimal', v.p, '0')}${f('c', 'Carbs g', 'decimal', v.c, '0')}${f('f', 'Fat g', 'decimal', v.f, '0')}</div>
${saveOption ? '<label class="check-row"><input type="checkbox" name="keep" value="1"> Also save to My foods</label>' : ''}
<button class="btn primary block" type="submit">${cta}</button></form>`;
}

function addHtml() {
  return `<div class="sheet-head"><h2 class="sheet-title">Add food</h2><button class="btn ghost sm" data-action="sheet-close">Done</button></div>
<div class="chips scroll">${MEALS.map(m => `<button class="chip${add.meal === m ? ' on' : ''}" data-action="add-meal-pick" data-m="${m}">${m}</button>`).join('')}</div>
<div class="seg">${TABS.map(([k, l]) => `<button class="${add.tab === k ? 'on' : ''}" data-action="add-tab" data-t="${k}">${l}</button>`).join('')}</div>
${add.tab === 'quick' ? '' : `<input type="search" data-input="add-q" value="${esc(add.q)}" placeholder="Search" autocomplete="off" autocorrect="off" enterkeyhint="search">`}
<div id="add-list" class="col" style="gap:12px;min-height:40vh">${addList()}</div>`;
}
export function openAddFood(meal, date) {
  add = { meal: meal || guessMeal(), date: date || (nav.tab === 'food' ? foodNav.date : ymd()), tab: recentFoods(1).length ? 'recent' : 'quick', q: '' };
  openSheet(`<div style="--accent:var(--cyan)" class="col" id="add-wrap">${addHtml()}</div>`);
}
const refreshAdd = () => { const w = document.getElementById('add-wrap'); if (w) w.innerHTML = addHtml(); };
actions['food-add'] = el => openAddFood(el.dataset.meal, foodNav.date);
actions['add-meal-pick'] = el => { add.meal = el.dataset.m; refreshAdd(); };
actions['add-tab'] = el => { add.tab = el.dataset.t; add.q = ''; refreshAdd(); };
inputs['add-q'] = el => { add.q = el.value; const l = document.getElementById('add-list'); if (l) l.innerHTML = addList(); };

const logged = name => { save('foodLog'); buzz(); toast(`Added ${name} to ${add.meal}`); nav.render(); };
actions['add-recent'] = el => { const e = state.foodLog.find(x => x.id === el.dataset.k); if (e) { logEntry(e, add.meal, add.date); logged(e.name); refreshAdd(); } };
actions['add-food'] = el => { const e = state.foods.find(x => x.id === el.dataset.k); if (e) { logEntry(e, add.meal, add.date, 1); logged(e.name); } };
actions['add-meal'] = el => {
  const m = state.meals.find(x => x.id === el.dataset.k); if (!m) return;
  for (const it of m.items) logEntry(it, add.meal, add.date);
  logged(m.name);
};
actions['meal-del'] = el => { state.meals = state.meals.filter(m => m.id !== el.dataset.id); save('meals'); refreshAdd(); };

const readFood = v => ({ name: (v.name || '').trim(), serving: (v.serving || '').trim(), kcal: num(v.kcal) || 0, p: num(v.p) || 0, c: num(v.c) || 0, f: num(v.f) || 0 });
submits['quick-add'] = v => {
  const f = readFood(v);
  if (!f.kcal && !f.p && !f.c && !f.f) return toast('Enter calories or macros');
  if (!f.name) f.name = 'Quick add';
  logEntry(f, add.meal, add.date, 1);
  if (v.keep && f.name !== 'Quick add' && !state.foods.some(x => x.name.toLowerCase() === f.name.toLowerCase())) { state.foods.push({ id: uid(), ...f }); save('foods'); }
  logged(f.name); refreshAdd();
};
actions['food-new'] = () => openSheet(`<div style="--accent:var(--cyan)" class="col"><div class="sheet-head"><h2 class="sheet-title">New food</h2><button class="link" data-action="sheet-close">Cancel</button></div>
${foodForm({ submit: 'food-create', cta: 'Save and add' })}</div>`);
submits['food-create'] = v => {
  const f = readFood(v);
  if (!f.name) return toast('Give the food a name');
  state.foods.push({ id: uid(), ...f }); save('foods');
  logEntry(f, add.meal, add.date, 1);
  closeSheet(); logged(f.name); refreshAdd();
};

// ---------- edit and delete log entries ----------
let editMeal = 'Breakfast';
const editHtml = e => `<div style="--accent:var(--cyan)" class="col" id="edit-wrap"><div class="sheet-head"><h2 class="sheet-title">Edit entry</h2><button class="link" data-action="sheet-close">Cancel</button></div>
<div class="chips scroll">${MEALS.map(m => `<button class="chip${editMeal === m ? ' on' : ''}" data-action="edit-meal" data-m="${m}">${m}</button>`).join('')}</div>
${foodForm({ submit: 'food-update', cta: 'Save', v: e, qty: true, id: e.id })}
<button class="btn danger block" data-action="food-del" data-id="${e.id}" data-close="1">Delete entry</button></div>`;
actions['food-edit'] = el => { const e = state.foodLog.find(x => x.id === el.dataset.id); if (!e) return; editMeal = e.meal; openSheet(editHtml(e)); };
actions['edit-meal'] = el => {
  editMeal = el.dataset.m;
  for (const c of document.querySelectorAll('#edit-wrap [data-action="edit-meal"]')) c.classList.toggle('on', c.dataset.m === editMeal);
};
submits['food-update'] = (v, form) => {
  const e = state.foodLog.find(x => x.id === form.dataset.id); if (!e) return closeSheet();
  const f = readFood(v), q = num(v.qty);
  Object.assign(e, f, { name: f.name || e.name, qty: q && q > 0 ? q : 1, meal: editMeal });
  save('foodLog'); closeSheet(); nav.render();
};
actions['food-del'] = el => {
  state.foodLog = state.foodLog.filter(e => e.id !== el.dataset.id);
  save('foodLog'); if (el.dataset.close) closeSheet(); nav.render(); toast('Entry deleted');
};

// ---------- save a logged meal for reuse ----------
let mealDraft = null;
actions['meal-save'] = el => {
  const items = state.foodLog.filter(e => e.date === foodNav.date && e.meal === el.dataset.meal);
  mealDraft = items.map(e => ({ name: e.name, serving: e.serving, kcal: e.kcal, p: e.p, c: e.c, f: e.f, qty: e.qty ?? 1 }));
  openSheet(`<div style="--accent:var(--cyan)" class="col"><h2 class="sheet-title">Save as a meal</h2>
<span class="muted">${items.length} items. Log them all again later in one tap.</span>
<form data-submit="meal-create" class="col" style="gap:12px"><label class="field"><span>Meal name</span><input type="text" name="name" placeholder="e.g. Usual breakfast" autocomplete="off"></label>
<button class="btn primary block" type="submit">Save meal</button></form>
<button class="btn ghost block" data-action="sheet-close">Cancel</button></div>`);
};
submits['meal-create'] = v => {
  const name = (v.name || '').trim();
  if (!name) return toast('Give the meal a name');
  state.meals.push({ id: uid(), name, items: mealDraft || [] }); save('meals');
  closeSheet(); toast('Meal saved');
};
