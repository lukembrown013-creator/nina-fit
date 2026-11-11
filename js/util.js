// Small shared helpers: DOM, dates, formatting, and SVG drawing.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const z = n => String(n).padStart(2, '0');
export const ymd = (d = new Date()) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
export const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const dow = s => (parseYmd(s).getDay() + 6) % 7; // Monday = 0
export const weekStart = (s = ymd()) => addDays(s, -dow(s));
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const niceDate = s => {
  const t = ymd();
  if (s === t) return 'Today';
  if (s === addDays(t, -1)) return 'Yesterday';
  if (s === addDays(t, 1)) return 'Tomorrow';
  return parseYmd(s).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};
export const shortDate = s => parseYmd(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const fmt = (n, dp = 1) => {
  if (n == null || !isFinite(n)) return '–';
  const p = 10 ** dp;
  return (Math.round(n * p) / p).toLocaleString('en-US', { maximumFractionDigits: dp });
};
// Parse a user-typed number; accepts a comma as the decimal mark. Returns null if empty or invalid.
export const num = v => {
  if (v == null) return null;
  const s = String(v).trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
};
export const clock = sec => {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${z(m)}:${z(s)}` : `${m}:${z(s)}`;
};

export const KG_LB = 2.2046226218;
export const CM_IN = 0.3937007874;
// Estimated one-rep max (Epley).
export const e1rm = (w, r) => (r <= 0 ? 0 : r === 1 ? w : w * (1 + r / 30));

let gid = 0;
export function ring({ size = 132, stroke = 12, pct = 0, from = '#22D3EE', to = '#A78BFA', main = '', sub = '', label = '', cls = '' }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, m = size / 2;
  const p = Math.max(0, Math.min(1, pct || 0));
  const id = 'rg' + (++gid);
  return `<svg class="ring ${cls}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label)}">
<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
<circle cx="${m}" cy="${m}" r="${r}" fill="none" stroke="#1A1A1A" stroke-width="${stroke}"/>
<circle class="ring-arc" cx="${m}" cy="${m}" r="${r}" fill="none" stroke="url(#${id})" stroke-width="${stroke}" stroke-linecap="round"
 stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${c.toFixed(2)}" data-offset="${(c * (1 - p)).toFixed(2)}" transform="rotate(-90 ${m} ${m})"${p === 0 ? ' opacity="0"' : ''}/>
<text x="${m}" y="${m - 2}" text-anchor="middle" fill="#fff" font-size="${Math.round(size * 0.2)}" font-weight="800">${esc(main)}</text>
<text x="${m}" y="${m + 18}" text-anchor="middle" fill="#A1A1AA" font-size="11" font-weight="500">${esc(sub)}</text>
</svg>`;
}

// Line chart. series: [{ pts: [{x, y}], color, width, faint }]. Returns '' when there is nothing to draw.
export function lineChart(series, { w = 320, h = 130, pad = 10, label = 'Chart', glow = '' } = {}) {
  const all = series.flatMap(s => s.pts);
  if (!all.length) return '';
  let x0 = Math.min(...all.map(p => p.x)), x1 = Math.max(...all.map(p => p.x));
  let y0 = Math.min(...all.map(p => p.y)), y1 = Math.max(...all.map(p => p.y));
  if (x1 === x0) { x0 -= 1; x1 += 1; }
  if (y1 === y0) { y0 -= 1; y1 += 1; }
  const yr = y1 - y0; y0 -= yr * 0.12; y1 += yr * 0.12;
  const X = x => pad + ((x - x0) / (x1 - x0)) * (w - pad * 2);
  const Y = y => h - pad - ((y - y0) / (y1 - y0)) * (h - pad * 2);
  let out = `<svg class="chart ${glow}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">`;
  for (const g of [0.25, 0.5, 0.75]) out += `<line x1="${pad}" x2="${w - pad}" y1="${(h * g).toFixed(1)}" y2="${(h * g).toFixed(1)}" stroke="#161616" stroke-width="1"/>`;
  for (const s of series) {
    if (!s.pts.length) continue;
    if (s.faint) {
      out += s.pts.map(p => `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="2.5" fill="${s.color}" opacity=".35"/>`).join('');
      continue;
    }
    if (s.pts.length === 1) {
      out += `<circle cx="${X(s.pts[0].x).toFixed(1)}" cy="${Y(s.pts[0].y).toFixed(1)}" r="4.5" fill="${s.color}"/>`;
      continue;
    }
    const d = s.pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ');
    const last = s.pts[s.pts.length - 1];
    out += `<path class="draw" pathLength="1" d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 3}" stroke-linecap="round" stroke-linejoin="round"/>`;
    out += `<circle cx="${X(last.x).toFixed(1)}" cy="${Y(last.y).toFixed(1)}" r="4.5" fill="${s.color}"/>`;
  }
  return out + '</svg>';
}

export function spark(values, color) {
  if (values.length < 2) return '';
  const pts = values.map((y, i) => ({ x: i, y }));
  return lineChart([{ pts, color, width: 2.5 }], { w: 150, h: 46, pad: 5, label: 'Trend line', glow: 'glow-magenta' }).replace(/<line[^>]*>/g, '');
}
