// Account + cloud sync. Everything here is optional: the app works fully offline and
// local-only if nobody signs in. Photos are never part of the synced payload (see store.js).
import { state, onSave, exportData, importData, hasData } from './store.js';

const TOKEN_KEY = 'ninafit:token', NAME_KEY = 'ninafit:account', BASE_KEY = 'ninafit:baseUpdatedAt';

export const account = {
  name: localStorage.getItem(NAME_KEY) || null,
  token: localStorage.getItem(TOKEN_KEY) || null,
  baseUpdatedAt: Number(localStorage.getItem(BASE_KEY)) || 0,
  syncing: false,
  lastError: null
};
export const isSignedIn = () => !!account.token;

async function api(path, opts = {}) {
  const headers = { 'content-type': 'application/json' };
  if (account.token) headers.authorization = 'Bearer ' + account.token;
  let res;
  try {
    res = await fetch('/api' + path, { ...opts, headers });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  let body = null;
  try { body = await res.json(); } catch { /* no body */ }
  if (!res.ok && res.status !== 409) throw new Error((body && body.error) || 'Something went wrong.');
  return { status: res.status, body };
}

function setSession(token, name) {
  account.token = token; account.name = name; account.baseUpdatedAt = 0;
  localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(NAME_KEY, name); localStorage.setItem(BASE_KEY, '0');
}
export function signOut() {
  account.token = null; account.name = null; account.baseUpdatedAt = 0;
  localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(NAME_KEY); localStorage.removeItem(BASE_KEY);
}

function setBase(updatedAt) { account.baseUpdatedAt = updatedAt; localStorage.setItem(BASE_KEY, String(updatedAt)); }

function syncablePayload() { return exportData().data; }
function applyCloudData(data, updatedAt) {
  importData({ app: 'nina-fit', version: 1, data });
  setBase(updatedAt);
}

export async function pushNow() {
  if (!isSignedIn()) return;
  account.syncing = true; account.lastError = null;
  try {
    const { status, body } = await api('/sync', { method: 'PUT', body: JSON.stringify({ data: syncablePayload(), baseUpdatedAt: account.baseUpdatedAt }) });
    if (status === 409) { applyCloudData(body.data, body.updatedAt); return { conflict: true }; }
    setBase(body.updatedAt);
    return { pushed: true };
  } catch (e) {
    account.lastError = e.message; throw e;
  } finally {
    account.syncing = false;
  }
}

// Silent pull used on app open/foreground — only applies if the cloud actually has something newer.
export async function pullIfNewer() {
  if (!isSignedIn()) return false;
  try {
    const { body } = await api('/sync', { method: 'GET' });
    if (body && body.data && body.updatedAt > account.baseUpdatedAt) { applyCloudData(body.data, body.updatedAt); return true; }
  } catch { /* offline — fine, local data still works */ }
  return false;
}

export async function signup(name, passcode) {
  const { body } = await api('/signup', { method: 'POST', body: JSON.stringify({ name, passcode }) });
  setSession(body.token, body.name);
  await pushNow(); // this device's existing local data becomes the first cloud copy
}

// Returns { done:true } once signed in with nothing left to resolve, or
// { choice:true, cloudData, cloudUpdatedAt } when both this phone and the cloud already
// have data, so the caller (Settings UI) can ask which one to keep.
export async function login(name, passcode) {
  const { body } = await api('/login', { method: 'POST', body: JSON.stringify({ name, passcode }) });
  setSession(body.token, body.name);
  const { body: syncBody } = await api('/sync', { method: 'GET' });
  if (syncBody && syncBody.data) {
    if (hasData()) return { choice: true, cloudData: syncBody.data, cloudUpdatedAt: syncBody.updatedAt };
    applyCloudData(syncBody.data, syncBody.updatedAt);
    return { done: true };
  }
  await pushNow();
  return { done: true };
}
export function keepThisPhone() { return pushNow(); }
export function useCloudCopy(cloudData, cloudUpdatedAt) { applyCloudData(cloudData, cloudUpdatedAt); }

// Debounced auto-push: any save() to a synced key schedules a push a couple seconds later,
// so a flurry of edits (typing in Settings, finishing a workout) becomes one network call.
let pushTimer = null;
onSave(keys => {
  if (!isSignedIn()) return;
  if (!keys.some(k => k !== 'activeWorkout' && k !== 'photos')) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { pushNow().catch(() => {}); }, 2500);
});
