// Settings: profile, units, targets, training defaults, dashboard cards, backup.
import { state, save, exportData, importData, wipe } from './store.js';
import { $, esc, fmt, num, ymd } from './util.js';
import { actions, inputs, nav, confirmSheet, toast, icon } from './ui.js';

const CARDS = [['nutrition', 'Nutrition'], ['weight', 'Weight trend'], ['week', 'This week'], ['workout', "Today's workout"], ['calendar', 'Consistency calendar']];

export function renderSettings() {
  const s = state.settings, t = s.targets, u = s.units;
  const numField = (label, key, val, ph = 'not set', mode = 'decimal') => `<label class="field"><span>${label}</span>
<input type="text" inputmode="${mode}" data-input="set-num" data-k="${key}" value="${val ?? ''}" placeholder="${ph}" autocomplete="off"></label>`;
  const macroKcal = (t.p || 0) * 4 + (t.c || 0) * 4 + (t.f || 0) * 9;
  return `<header class="head"><div class="row"><button class="icon-btn" data-action="tab" data-tab="home" aria-label="Back">${icon.chevL}</button><h1>Settings</h1></div></header>

<section class="card"><span class="label">Profile</span>
<label class="field"><span>Name</span><input type="text" data-input="set-text" data-k="name" value="${esc(s.name)}" autocomplete="off"></label></section>

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
<span class="muted small">Nina Fit · version 1.0 (Phase 1)</span></section>`;
}

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
