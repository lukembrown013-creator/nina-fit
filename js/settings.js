// Settings: profile, units, targets, training defaults, dashboard cards, backup.
import { state, save, exportData, importData, wipe } from './store.js';
import { $, esc, fmt, num, ymd } from './util.js';
import { actions, inputs, submits, nav, openSheet, closeSheet, confirmSheet, toast, icon } from './ui.js';
import { account, isSignedIn, signup, login, signOut, keepThisPhone, useCloudCopy } from './sync.js';

const CARDS = [['nutrition', 'Nutrition'], ['weight', 'Weight trend'], ['week', 'This week'], ['workout', "Today's workout"], ['calendar', 'Consistency calendar']];

export function renderSettings() {
  const s = state.settings, t = s.targets, u = s.units;
  const numField = (label, key, val, ph = 'not set', mode = 'decimal') => `<label class="field"><span>${label}</span>
<input type="text" inputmode="${mode}" data-input="set-num" data-k="${key}" value="${val ?? ''}" placeholder="${ph}" autocomplete="off"></label>`;
  const macroKcal = (t.p || 0) * 4 + (t.c || 0) * 4 + (t.f || 0) * 9;
  return `<header class="head"><div class="row"><button class="icon-btn" data-action="tab" data-tab="home" aria-label="Back">${icon.chevL}</button><h1>Settings</h1></div></header>

<section class="card"><span class="label">Profile</span>
<label class="field"><span>Name</span><input type="text" data-input="set-text" data-k="name" value="${esc(s.name)}" autocomplete="off"></label></section>

${accountHtml()}

<section class="card"><span class="label">Units</span>
<div class="field"><span>Weight</span><div class="seg"><button class="${u === 'lb' ? 'on' : ''}" data-action="set-unit" data-k="units" data-v="lb">Pounds (lb)</button><button class="${u === 'kg' ? 'on' : ''}" data-action="set-unit" data-k="units" data-v="kg">Kilograms (kg)</button></div></div>
<div class="field"><span>Measurements</span><div class="seg"><button class="${s.lenUnits === 'in' ? 'on' : ''}" data-action="set-unit" data-k="lenUnits" data-v="in">Inches</button><button class="${s.lenUnits === 'cm' ? 'on' : ''}" data-action="set-unit" data-k="lenUnits" data-v="cm">Centimeters</button></div></div>
<span class="muted small">Switching units converts everything already logged.</span></section>

<section class="card" style="--accent:var(--cyan)"><span class="label">Daily targets</span>
${numField('Calories', 'targets.kcal', t.kcal)}
<div class="grid3">${numField('Protein g', 'targets.p', t.p, '–')}${numField('Carbs g', 'targets.c', t.c, '–')}${numField('Fat g', 'targets.f', t.f, '–')}</div>
<span class="muted small" id="macro-note">${macroKcal ? `These macros add up to ${fmt(macroKcal, 0)} kcal.` : 'Leave any target empty to track without one.'}</span></section>

<section class="card"><span class="label">Training</span>
<div class="grid3">${numField('Rest (sec)', 'rest', s.rest, '120', 'numeric')}${numField(`Bar (${u})`, 'bar.' + u, s.bar[u], '', 'decimal')}${numField(`Step (${u})`, 'inc.' + u, s.inc[u], '', 'decimal')}</div>
<span class="muted small">Step is the weight increase suggested once you hit all your target reps.</span></section>

<section class="card"><span class="label">Home screen cards</span>
<div class="chips">${CARDS.map(([k, l]) => `<button class="chip${s.hide[k] ? '' : ' on'}" data-action="set-card" data-k="${k}" aria-pressed="${!s.hide[k]}">${l}</button>`).join('')}</div>
<span class="muted small">Tap to show or hide a card on Home.</span></section>

<section class="card"><span class="label">Your data</span>
<span class="muted" style="line-height:1.5">Everything is stored on this phone only. Export a backup file now and then so nothing is ever lost, for example before changing phones.</span>
<button class="btn primary block" data-action="export">Export backup</button>
<button class="btn ghost block" data-action="import">Restore from backup</button>
<span class="muted small">${s.lastBackup ? 'Last backup: ' + new Date(s.lastBackup).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No backup made yet.'}</span>
<button class="btn danger block" data-action="erase">Erase all data</button></section>

<section class="card"><span class="label">About</span>
<button class="btn ghost block" data-action="intro-replay">Replay the welcome tour</button>
<span class="muted small">Nina Fit · version 1.0 (Phase 2)</span></section>`;
}

// ---------- account & cloud sync ----------
function lastSyncedLabel() {
  if (!account.baseUpdatedAt) return 'Not synced yet';
  return 'Last synced ' + new Date(account.baseUpdatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function accountHtml() {
  if (isSignedIn()) {
    return `<section class="card" id="account-card"><span class="label">Account & sync</span>
<span class="sub">${esc(account.name)}</span>
<span class="muted small">${account.syncing ? 'Syncing…' : lastSyncedLabel()}</span>
<span class="muted">Workouts, food, weight and goals back up here. Progress photos always stay on this phone only.</span>
<button class="btn ghost block" data-action="sync-now">Sync now</button>
<button class="btn danger block" data-action="sign-out">Sign out</button></section>`;
  }
  return `<section class="card" id="account-card"><span class="label">Account & sync</span>
<span class="muted" style="line-height:1.5">Sign in to back up and sync across devices. Progress photos always stay on this phone only, signed in or not.</span>
<button class="btn primary block" data-action="account-signup">Create account</button>
<button class="btn ghost block" data-action="account-login">I already have an account</button></section>`;
}
function refreshAccountCard() { const el = document.getElementById('account-card'); if (el) el.outerHTML = accountHtml(); }

const accountForm = (title, submit, cta) => `<div style="--accent:var(--cyan)" class="col"><div class="sheet-head"><h2 class="sheet-title">${title}</h2><button class="link" data-action="sheet-close">Cancel</button></div>
<form data-submit="${submit}" class="col" style="gap:12px">
<label class="field"><span>Name</span><input type="text" name="name" placeholder="e.g. Nina" autocomplete="off" autocapitalize="words"></label>
<label class="field"><span>Passcode</span><input type="password" name="passcode" inputmode="text" placeholder="At least 4 characters" autocomplete="off"></label>
<button class="btn primary block" type="submit">${cta}</button></form></div>`;

actions['account-signup'] = () => openSheet(accountForm('Create account', 'account-signup-go', 'Create account'));
actions['account-login'] = () => openSheet(accountForm('Log in', 'account-login-go', 'Log in'));

let pendingCloudData = null;
submits['account-signup-go'] = async (v, form) => {
  const name = (v.name || '').trim(), passcode = v.passcode || '';
  if (!name) return toast('Enter a name');
  if (passcode.length < 4) return toast('Passcode must be at least 4 characters');
  const btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Creating…';
  try { await signup(name, passcode); closeSheet(); nav.render(); toast('Account created — your data is backed up'); }
  catch (e) { btn.disabled = false; btn.textContent = 'Create account'; toast(e.message); }
};
submits['account-login-go'] = async (v, form) => {
  const name = (v.name || '').trim(), passcode = v.passcode || '';
  if (!name || !passcode) return toast('Enter your name and passcode');
  const btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Logging in…';
  try {
    const r = await login(name, passcode);
    if (r.choice) {
      closeSheet();
      openSheet(`<div style="--accent:var(--cyan)" class="col"><h2 class="sheet-title">Which data should win?</h2>
<p class="muted" style="font-size:15px;line-height:1.5">This phone already has data on it, and so does ${esc(name)}'s account. Keeping this phone's data overwrites the cloud copy; using the cloud copy replaces what's on this phone.</p>
<button class="btn primary block" data-action="account-keep-phone">Keep this phone's data</button>
<button class="btn ghost block" data-action="account-use-cloud" data-updated-at="${r.cloudUpdatedAt}">Use the cloud copy</button></div>`);
      pendingCloudData = r.cloudData;
      return;
    }
    closeSheet(); nav.render(); toast('Logged in');
  } catch (e) { btn.disabled = false; btn.textContent = 'Log in'; toast(e.message); }
};
actions['account-keep-phone'] = async () => { closeSheet(); try { await keepThisPhone(); toast('Kept this phone’s data'); } catch (e) { toast(e.message); } nav.render(); };
actions['account-use-cloud'] = el => {
  useCloudCopy(pendingCloudData, Number(el.dataset.updatedAt)); pendingCloudData = null;
  closeSheet(); nav.go('home'); toast('Restored from the cloud');
};
actions['sync-now'] = async () => {
  refreshAccountCard();
  try { await keepThisPhone(); toast('Synced'); } catch (e) { toast(e.message); }
  refreshAccountCard();
};
actions['sign-out'] = () => confirmSheet({ title: 'Sign out?', text: 'Your data stays on this phone. Sign back in any time to pick up syncing again.', ok: 'Sign out' }, () => {
  signOut(); nav.render(); toast('Signed out');
});

function setPath(key, val) {
  const parts = key.split('.'); let o = state.settings;
  while (parts.length > 1) o = o[parts.shift()];
  o[parts[0]] = val;
}
inputs['set-text'] = el => { setPath(el.dataset.k, el.value.trim()); save('settings'); };
inputs['set-num'] = el => {
  const k = el.dataset.k; let n = num(el.value);
  if (n != null && n < 0) n = null;
  if (k === 'rest') n = n == null ? 120 : Math.min(900, Math.max(5, Math.round(n)));
  else if (k.startsWith('bar.') || k.startsWith('inc.')) { if (n == null) return; }
  else if (n === 0) n = null;
  setPath(k, n); save('settings');
  const t = state.settings.targets, note = $('#macro-note'), mk = (t.p || 0) * 4 + (t.c || 0) * 4 + (t.f || 0) * 9;
  if (note) note.textContent = mk ? `These macros add up to ${fmt(mk, 0)} kcal.` : 'Leave any target empty to track without one.';
};
actions['set-unit'] = el => { state.settings[el.dataset.k] = el.dataset.v; save('settings'); nav.render(); };
actions['set-card'] = el => { const k = el.dataset.k; if (state.settings.hide[k]) delete state.settings.hide[k]; else state.settings.hide[k] = true; save('settings'); nav.render(); };

// ---------- backup ----------
actions['export'] = async () => {
  const json = JSON.stringify(exportData(), null, 2), name = `nina-fit-backup-${ymd()}.json`;
  const done = () => { state.settings.lastBackup = new Date().toISOString(); save('settings'); nav.render(); toast('Backup exported'); };
  try {
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Nina Fit backup' });
      return done();
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return; // share sheet dismissed
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  done();
};
actions['import'] = () => {
  const inp = $('#import-file');
  inp.value = '';
  inp.onchange = () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      let obj;
      try { obj = JSON.parse(r.result); } catch { return toast('That file could not be read'); }
      if (!obj || obj.app !== 'nina-fit' || !obj.data) return toast('That is not a Nina Fit backup');
      const when = obj.exportedAt ? new Date(obj.exportedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'unknown date';
      confirmSheet({ title: 'Restore this backup?', text: `Backup from ${when}. It replaces everything currently on this phone.`, ok: 'Restore', danger: true }, () => {
        try { importData(obj); nav.go('home'); toast('Backup restored'); } catch (e) { toast(e.message || 'Restore failed'); }
      });
    };
    r.readAsText(f);
  };
  inp.click();
};
actions['erase'] = () => confirmSheet({ title: 'Erase all data?', text: 'This removes every log, workout and setting from this phone. Export a backup first if you might want it back.', ok: 'Erase everything', danger: true }, () => {
  wipe(); state.settings.onboarded = true; save('settings'); nav.go('home'); toast('All data erased');
});
