// All app data lives on this device. It is kept in memory in `state` and written to
// IndexedDB (falling back to localStorage) every time something changes.
const DB_NAME = 'nina-fit', STORE = 'kv', LS_PREFIX = 'ninafit:';
export const APP_ID = 'nina-fit', VERSION = 1;

export const defaultSettings = () => ({
  name: 'Nina',
  units: 'lb',            // body weight and lifting: 'lb' or 'kg'
  lenUnits: 'in',         // measurements: 'in' or 'cm'
  targets: { kcal: null, p: null, c: null, f: null },
  rest: 120,              // default rest timer, seconds
  bar: { lb: 45, kg: 20 },
  inc: { lb: 5, kg: 2.5 },
  hide: {},               // dashboard cards hidden by the user
  onboarded: false,
  installDismissed: false,
  lastBackup: null
});

const KEYS = ['settings', 'weights', 'measurements', 'foods', 'meals', 'foodLog', 'templates', 'workouts', 'customExercises', 'activeWorkout', 'photos'];
// Keys that sync to the cloud (when signed in). Photos never leave this device, and an
// in-progress workout is just scratch state — neither belongs in the synced payload.
export const SYNC_KEYS = KEYS.filter(k => k !== 'activeWorkout' && k !== 'photos');

export const state = {
  settings: defaultSettings(),
  weights: [],          // { id, date, kg }
  measurements: [],     // { id, date, site, cm }
  foods: [],            // { id, name, serving, kcal, p, c, f }
  meals: [],            // { id, name, items: [{ name, serving, kcal, p, c, f, qty }] }
  foodLog: [],          // { id, date, meal, name, serving, kcal, p, c, f, qty, ts }
  templates: [],        // { id, name, days: [0-6], exercises: [{ name, sets, reps }] }
  workouts: [],         // { id, date, start, end, name, templateId, exercises: [{ name, muscle, sets: [{ kg, reps, rpe, pr }] }] }
  customExercises: [],  // { name, muscle, equip }
  activeWorkout: null,
  photos: []            // { id, date, blob } — stored only on this device, never synced or exported
};

let db = null;
function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no indexedDB'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('blocked'));
  });
}
function idbGet(key) {
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORE).objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
function idbSet(key, val) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function read(key) {
  if (db) return idbGet(key);
  try { const raw = localStorage.getItem(LS_PREFIX + key); return raw == null ? undefined : JSON.parse(raw); } catch { return undefined; }
}
async function write(key, val) {
  if (db) return idbSet(key, val);
  try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(val)); } catch { /* storage unavailable */ }
}

function mergeSettings(saved) {
  const d = defaultSettings();
  if (!saved || typeof saved !== 'object') return d;
  return {
    ...d, ...saved,
    targets: { ...d.targets, ...(saved.targets || {}) },
    bar: { ...d.bar, ...(saved.bar || {}) },
    inc: { ...d.inc, ...(saved.inc || {}) },
    hide: { ...(saved.hide || {}) }
  };
}

export async function load() {
  try { db = await openDb(); } catch { db = null; }
  for (const k of KEYS) {
    const v = await read(k);
    if (k === 'settings') state.settings = mergeSettings(v);
    else if (k === 'activeWorkout') state.activeWorkout = v || null;
    else state[k] = Array.isArray(v) ? v : [];
  }
  // Ask the browser not to evict this data under storage pressure.
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch { /* optional */ }
}

// Called after every save() — sync.js hooks in here to push changes to the cloud
// without store.js needing to know sync exists.
let saveHook = null;
export function onSave(fn) { saveHook = fn; }

export function save(...keys) {
  for (const k of keys) write(k, state[k]).catch(() => {});
  if (saveHook) { try { saveHook(keys); } catch { /* sync is best-effort */ } }
}

// Local backup file — a device-level export the user triggers themselves. Photos are left
// out: they stay on this device only, and don't suit a JSON file anyway.
export function exportData() {
  const data = {};
  for (const k of KEYS) if (k !== 'activeWorkout' && k !== 'photos') data[k] = state[k];
  return { app: APP_ID, version: VERSION, exportedAt: new Date().toISOString(), data };
}

export function importData(obj) {
  if (!obj || obj.app !== APP_ID || !obj.data) throw new Error('This file is not a Nina Fit backup.');
  for (const k of KEYS) {
    if (k === 'activeWorkout' || k === 'photos') continue; // never touched by backup/restore
    if (k === 'settings') state.settings = mergeSettings(obj.data.settings);
    else state[k] = Array.isArray(obj.data[k]) ? obj.data[k] : [];
  }
  state.settings.onboarded = true;
  save(...KEYS.filter(k => k !== 'photos'));
}

export function wipe() {
  for (const k of KEYS) {
    if (k === 'settings') state.settings = defaultSettings();
    else if (k === 'activeWorkout') state.activeWorkout = null;
    else state[k] = [];
  }
  save(...KEYS);
}

export const hasData = () => state.weights.length + state.foodLog.length + state.workouts.length + state.measurements.length > 0;
