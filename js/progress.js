// Progress tab: body weight trend, measurements, and strength records.
import { state, save } from './store.js';
import { esc, fmt, uid, num, ymd, parseYmd, addDays, niceDate, shortDate, lineChart, e1rm } from './util.js';
import { weightSeries, weeklyTrendChange, siteSeries, historyFor, bestFor, trainedExercises, toDisp, toKg, wu, lenDisp, lenCm, lu, SITES } from './calc.js';
import { actions, submits, nav, openSheet, closeSheet, toast, buzz, icon } from './ui.js';

export const progNav = { tab: 'body', range: 90, allWeights: false };
const day = s => parseYmd(s).getTime() / 864e5;
const signed = (n, dp = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n), dp)}`;

function bodyHtml() {
  const all = weightSeries();
  let weight;
  if (!all.length) {
    weight = `<section class="card empty"><span class="sub">No weigh-ins yet</span>
<span class="muted">Log your weight as often as you like. The trend line smooths out day-to-day swings.</span>
<button class="btn primary" data-action="weight-log">Log weight</button></section>`;
  } else {
    const last = all[all.length - 1], ch = weeklyTrendChange(all);
    const from = progNav.range ? addDays(ymd(), -progNav.range) : '';
    const s = all.filter(w => !from || w.date >= from);
    const chart = lineChart([
      { pts: s.map(w => ({ x: day(w.date), y: toDisp(w.kg) })), color: '#E879F9', faint: true },
      { pts: s.map(w => ({ x: day(w.date), y: toDisp(w.trend) })), color: '#E879F9' }
    ], { label: 'Weight trend', glow: 'glow-magenta' });
    const rows = [...all].reverse().slice(0, progNav.allWeights ? 400 : 5).map(w => `<div class="swipe"><button class="swipe-del" data-action="weight-del" data-id="${w.id}">Delete</button>
<div class="swipe-body" data-action="weight-log" data-date="${w.date}"><span class="sub">${niceDate(w.date)}</span><span class="v">${fmt(toDisp(w.kg), 1)} ${wu()}</span></div></div>`).join('');
    weight = `<section class="card lg">
<div class="row between" style="align-items:flex-start"><div class="col"><span class="label">Weight trend</span>
<span class="big"><span data-count="${toDisp(last.trend).toFixed(1)}" data-dp="1">${fmt(toDisp(last.trend), 1)}</span><span class="unit"> ${wu()}</span></span>
<span class="muted">${ch == null ? 'Smoothed average. Builds as you log.' : signed(toDisp(ch)) + ' ' + wu() + ' over the last week'}</span></div>
<button class="btn primary sm" data-action="weight-log">${icon.plus} Log</button></div>
${chart || '<span class="muted">No weigh-ins in this range.</span>'}
<div class="seg">${[[30, '1M'], [90, '3M'], [365, '1Y'], [0, 'All']].map(([d, l]) => `<button class="${progNav.range === d ? 'on' : ''}" data-action="prog-range" data-d="${d}">${l}</button>`).join('')}</div>
<span class="muted small">Dots are daily weigh-ins. The line is your trend.</span></section>
<div class="list">${rows}</div>
${all.length > 5 ? `<button class="link" data-action="weights-all" style="align-self:flex-start">${progNav.allWeights ? 'Show fewer' : `Show all ${all.length}`}</button>` : ''}`;
  }

  const sites = SITES.map(site => {
    const s = siteSeries(site), last = s[s.length - 1], first = s[0];
    const d = last && first !== last ? lenDisp(last.cm) - lenDisp(first.cm) : null;
    return `<button class="item press" data-action="site-view" data-site="${site}"><span class="col grow"><span class="sub">${site}</span>
<span class="muted small">${last ? shortDate(last.date) + (d != null ? ` · ${signed(d)} since start` : '') : 'Not logged'}</span></span>
<span class="v">${last ? fmt(lenDisp(last.cm), 1) + ' ' + lu() : '–'}</span></button>`;
  }).join('');

  return `${weight}
<div class="sec-head"><h2>Measurements</h2><button class="link" data-action="meas-log">${icon.plus}&nbsp;Log</button></div>
<div class="list">${sites}</div>`;
}

function strengthHtml() {
  const names = trainedExercises();
  if (!names.length) {
    return `<section class="card empty"><span class="sub">No lifts logged yet</span>
<span class="muted">After your first workout, your best sets and strength curves show up here.</span>
<button class="btn primary" data-action="tab" data-tab="train" style="--accent:var(--violet)">Go to Train</button></section>`;
  }
  return `<div class="list">${names.map(n => {
    const b = bestFor(n);
    return `<button class="item press" data-action="lift-view" data-name="${esc(n)}"><span class="col grow"><span class="sub ellip">${esc(n)}</span>
<span class="muted small">${b ? `Best set ${fmt(toDisp(b.kg), 2)} ${wu()} × ${b.reps} · ${shortDate(b.date)}` : 'Bodyweight'}</span></span>
<span class="v">${b ? fmt(toDisp(b.e1), 0) : '–'}<span class="unit"> est. max</span></span></button>`;
  }).join('')}</div>
<span class="muted small">Estimated max is a one-rep estimate from your best set. It is a guide for tracking progress, not a target to test.</span>`;
}

export function renderProgress() {
  return `<header class="head"><h1>Progress</h1></header>
<div class="seg"><button class="${progNav.tab === 'body' ? 'on' : ''}" data-action="prog-tab" data-t="body">Body</button>
<button class="${progNav.tab === 'strength' ? 'on' : ''}" data-action="prog-tab" data-t="strength">Strength</button></div>
${progNav.tab === 'body' ? bodyHtml() : strengthHtml()}`;
}

actions['prog-tab'] = el => { progNav.tab = el.dataset.t; nav.render(true); };
actions['prog-range'] = el => { progNav.range = +el.dataset.d; nav.render(); };
actions['weights-all'] = () => { progNav.allWeights = !progNav.allWeights; nav.render(); };

// ---------- weight ----------
actions['weight-log'] = el => {
  const date = el.dataset.date || ymd();
  const existing = state.weights.find(w => w.date === date);
  const lastW = weightSeries().pop();
  const val = existing ? fmt(toDisp(existing.kg), 1).replace(/,/g, '') : '';
  openSheet(`<div style="--accent:var(--magenta)" class="col"><div class="sheet-head"><h2 class="sheet-title">${existing ? 'Edit weigh-in' : 'Log weight'}</h2><button class="link" data-action="sheet-close">Cancel</button></div>
<form data-submit="weight-save" class="col" style="gap:12px">
<label class="field"><span>Weight (${wu()})</span><input type="text" name="w" inputmode="decimal" value="${val}" placeholder="${lastW ? fmt(toDisp(lastW.kg), 1).replace(/,/g, '') : '0.0'}" autocomplete="off" style="height:64px;font-size:28px;font-weight:800;text-align:center"></label>
<label class="field"><span>Date</span><input type="date" name="date" value="${date}" max="${ymd()}"></label>
<button class="btn primary block" type="submit">Save</button></form></div>`);
};
submits['weight-save'] = v => {
  const w = num(v.w), date = v.date || ymd();
  if (!w || w <= 0) return toast('Enter your weight');
  const kg = toKg(w), i = state.weights.findIndex(x => x.date === date);
  if (i >= 0) state.weights[i].kg = kg; else state.weights.push({ id: uid(), date, kg });
  save('weights'); closeSheet(); buzz(); nav.render(); toast('Weight saved');
};
actions['weight-del'] = el => { state.weights = state.weights.filter(w => w.id !== el.dataset.id); save('weights'); nav.render(); toast('Weigh-in deleted'); };

// ---------- measurements ----------
actions['meas-log'] = () => {
  openSheet(`<div style="--accent:var(--magenta)" class="col"><div class="sheet-head"><h2 class="sheet-title">Log measurements</h2><button class="link" data-action="sheet-close">Cancel</button></div>
<span class="muted">Fill in only the ones you measured (${lu()}).</span>
<form data-submit="meas-save" class="col" style="gap:12px">
<div class="grid2">${SITES.map(s => { const l = siteSeries(s).pop(); return `<label class="field"><span>${s}</span><input type="text" name="${s}" inputmode="decimal" placeholder="${l ? fmt(lenDisp(l.cm), 1) : '–'}" autocomplete="off"></label>`; }).join('')}</div>
<label class="field"><span>Date</span><input type="date" name="date" value="${ymd()}" max="${ymd()}"></label>
<button class="btn primary block" type="submit">Save</button></form></div>`);
};
submits['meas-save'] = v => {
  const date = v.date || ymd(); let n = 0;
  for (const site of SITES) {
    const x = num(v[site]); if (!x || x <= 0) continue;
    const cm = lenCm(x), i = state.measurements.findIndex(m => m.site === site && m.date === date);
    if (i >= 0) state.measurements[i].cm = cm; else state.measurements.push({ id: uid(), date, site, cm });
    n++;
  }
  if (!n) return toast('Enter at least one measurement');
  save('measurements'); closeSheet(); buzz(); nav.render(); toast('Measurements saved');
};
function siteHtml(site) {
  const s = siteSeries(site);
  const chart = lineChart([{ pts: s.map(m => ({ x: day(m.date), y: lenDisp(m.cm) })), color: '#E879F9' }], { label: site + ' over time', glow: 'glow-magenta' });
  return `<div style="--accent:var(--magenta)" class="col" id="site-wrap"><div class="sheet-head"><h2 class="sheet-title">${site}</h2><button class="link" data-action="sheet-close">Close</button></div>
${chart || '<span class="muted">Nothing logged yet for this measurement.</span>'}
${s.length ? `<div class="list">${[...s].reverse().map(m => `<div class="item"><span class="sub">${niceDate(m.date)}</span>
<span class="row"><span class="v">${fmt(lenDisp(m.cm), 1)} ${lu()}</span><button class="icon-btn" style="width:40px;height:40px;color:var(--danger)" data-action="meas-del" data-id="${m.id}" data-site="${site}" aria-label="Delete entry">✕</button></span></div>`).join('')}</div>` : ''}
<button class="btn primary block" data-action="meas-log-from-site">${icon.plus} Log measurements</button></div>`;
}
actions['site-view'] = el => openSheet(siteHtml(el.dataset.site));
actions['meas-del'] = el => {
  state.measurements = state.measurements.filter(m => m.id !== el.dataset.id); save('measurements');
  const w = document.getElementById('site-wrap'); if (w) w.outerHTML = siteHtml(el.dataset.site);
  nav.render();
};
actions['meas-log-from-site'] = () => { closeSheet(); actions['meas-log'](); };

// ---------- strength ----------
actions['lift-view'] = el => {
  const name = el.dataset.name, h = historyFor(name), b = bestFor(name);
  // One point per day: the best estimated max that day.
  const byDay = new Map();
  for (const s of h) byDay.set(s.date, Math.max(byDay.get(s.date) || 0, ...s.sets.map(x => e1rm(x.kg, x.reps))));
  const pts = [...byDay.entries()].map(([d, v]) => ({ x: day(d), y: toDisp(v) })).filter(p => p.y > 0);
  const chart = lineChart([{ pts, color: '#A78BFA' }], { label: name + ' strength over time' });
  openSheet(`<div style="--accent:var(--violet)" class="col"><div class="sheet-head"><h2 class="sheet-title">${esc(name)}</h2><button class="link" data-action="sheet-close">Close</button></div>
${b ? `<div class="grid2"><div class="col"><span class="muted small">Best set</span><span class="title">${fmt(toDisp(b.kg), 2)} × ${b.reps}</span></div>
<div class="col"><span class="muted small">Estimated max</span><span class="title">${fmt(toDisp(b.e1), 0)} ${wu()}</span></div></div>` : ''}
${chart}
<div class="list">${[...h].reverse().slice(0, 8).map(s => `<div class="item"><span class="sub">${niceDate(s.date)}</span>
<span class="muted small" style="text-align:right">${s.sets.map(x => `${x.kg ? fmt(toDisp(x.kg), 2) + '×' : ''}${x.reps}`).join(', ')}</span></div>`).join('')}</div></div>`);
};
