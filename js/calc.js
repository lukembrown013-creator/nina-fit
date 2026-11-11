// Derived numbers: unit conversion, daily totals, trends, training history.
import { state } from './store.js';
import { KG_LB, CM_IN, ymd, addDays, weekStart, e1rm } from './util.js';
import { LIBRARY } from './exercises.js';

// Everything is stored in kg and cm, and shown in the units chosen in Settings.
export const wu = () => state.settings.units;
export const toDisp = kg => (kg == null ? null : wu() === 'lb' ? kg * KG_LB : kg);
export const toKg = v => (v == null ? null : wu() === 'lb' ? v / KG_LB : v);
export const lu = () => state.settings.lenUnits;
export const lenDisp = cm => (cm == null ? null : lu() === 'in' ? cm * CM_IN : cm);
export const lenCm = v => (v == null ? null : lu() === 'in' ? v / CM_IN : v);

export const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
export const SITES = ['Waist', 'Hips', 'Glutes', 'Chest', 'Shoulders', 'Arms', 'Thighs', 'Calves'];

export const allExercises = () => [...LIBRARY, ...state.customExercises].sort((a, b) => a.name.localeCompare(b.name));
export const muscleOf = name => (LIBRARY.find(e => e.name === name) || state.customExercises.find(e => e.name === name) || {}).muscle || 'Other';

// ---------- nutrition ----------
export function dayTotals(date) {
  const t = { kcal: 0, p: 0, c: 0, f: 0, n: 0 };
  for (const e of state.foodLog) {
    if (e.date !== date) continue;
    const q = e.qty ?? 1;
    t.kcal += (e.kcal || 0) * q; t.p += (e.p || 0) * q; t.c += (e.c || 0) * q; t.f += (e.f || 0) * q; t.n++;
  }
  return t;
}

// Most recently logged distinct foods, newest first.
export function recentFoods(limit = 30) {
  const seen = new Set(), out = [];
  const sorted = [...state.foodLog].sort((a, b) => (b.ts || 0) - (a.ts || 0));
  for (const e of sorted) {
    const k = (e.name || '').toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k); out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

// Guess the meal from her own habits at this time of day, falling back to typical hours.
export function guessMeal(now = new Date()) {
  const hr = now.getHours() + now.getMinutes() / 60;
  const counts = {};
  for (const e of state.foodLog) {
    if (!e.ts) continue;
    const d = new Date(e.ts), h = d.getHours() + d.getMinutes() / 60;
    if (Math.abs(h - hr) <= 1) counts[e.meal] = (counts[e.meal] || 0) + 1;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] >= 3 && MEALS.includes(best[0])) return best[0];
  if (hr < 10.5) return 'Breakfast';
  if (hr < 14.5) return 'Lunch';
  if (hr < 17) return 'Snacks';
  if (hr < 21) return 'Dinner';
  return 'Snacks';
}

// ---------- body ----------
// One entry per day, with a smoothed trend (exponential moving average) that ignores daily noise.
export function weightSeries() {
  const arr = [...state.weights].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let ema = null;
  return arr.map(w => {
    ema = ema == null ? w.kg : ema + 0.25 * (w.kg - ema);
    return { ...w, trend: ema };
  });
}

// Change in the trend over roughly the last week. Null until there is enough history.
export function weeklyTrendChange(series = weightSeries()) {
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  const cutoff = addDays(last.date, -7);
  let ref = null;
  for (const s of series) if (s.date <= cutoff) ref = s;
  if (!ref) ref = series[0];
  if (ref === last) return null;
  return last.trend - ref.trend;
}

export function siteSeries(site) {
  return state.measurements.filter(m => m.site === site).sort((a, b) => (a.date < b.date ? -1 : 1));
}

// ---------- training ----------
export function historyFor(name) {
  const out = [];
  for (const w of state.workouts) {
    const sets = w.exercises.filter(e => e.name === name).flatMap(e => e.sets);
    if (sets.length) out.push({ date: w.date, ts: w.start, sets });
  }
  return out.sort((a, b) => a.ts - b.ts);
}
export const lastSession = name => { const h = historyFor(name); return h[h.length - 1] || null; };

export function bestFor(name) {
  let best = null;
  for (const s of historyFor(name)) {
    for (const set of s.sets) {
      const e = e1rm(set.kg, set.reps);
      if (set.kg > 0 && (!best || e > best.e1)) best = { e1: e, kg: set.kg, reps: set.reps, date: s.date };
    }
  }
  return best;
}

export function trainedExercises() {
  const map = new Map();
  for (const w of state.workouts) for (const e of w.exercises) {
    if (!map.has(e.name) || map.get(e.name) < w.start) map.set(e.name, w.start);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

export const weekWorkouts = (ws = weekStart()) => {
  const end = addDays(ws, 7);
  return state.workouts.filter(w => w.date >= ws && w.date < end);
};
export function muscleSets(ws = weekStart()) {
  const out = {};
  for (const w of weekWorkouts(ws)) for (const e of w.exercises) {
    const m = e.muscle || muscleOf(e.name);
    out[m] = (out[m] || 0) + e.sets.length;
  }
  return out;
}
export const todaysTemplate = () => {
  const d = (new Date().getDay() + 6) % 7;
  return state.templates.find(t => (t.days || []).includes(d)) || null;
};
export const workoutVolumeKg = w => w.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + (s.kg || 0) * (s.reps || 0), 0), 0);
export const workoutSets = w => w.exercises.reduce((a, e) => a + e.sets.length, 0);

// ---------- consistency ----------
// For each date: how many kinds of things were logged (training, food, body), 0 to 3.
export function activityMap() {
  const m = {};
  const add = (date, bit) => { m[date] = (m[date] || 0) | bit; };
  for (const w of state.workouts) add(w.date, 1);
  for (const f of state.foodLog) add(f.date, 2);
  for (const w of state.weights) add(w.date, 4);
  for (const x of state.measurements) add(x.date, 4);
  const out = {};
  for (const [d, bits] of Object.entries(m)) out[d] = (bits & 1) + ((bits >> 1) & 1) + ((bits >> 2) & 1);
  return out;
}
export { ymd };
