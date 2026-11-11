// Nina Fit API — login + cloud sync. Everything else is served as static assets.
// No dependencies: passcode hashing (PBKDF2) and session tokens (HMAC) both use the
// Workers runtime's built-in Web Crypto API.

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json' }
});

// ---------- bytes <-> hex / base64url ----------
const toHex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
const fromHex = hex => { const a = new Uint8Array(hex.length / 2); for (let i = 0; i < a.length; i++) a[i] = parseInt(hex.substr(i * 2, 2), 16); return a; };
const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
function timingSafeEqual(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i]; return r === 0; }

// ---------- passcode hashing (PBKDF2-SHA256, 100k iterations) ----------
async function hashPasscode(passcode, saltBytes) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(passcode), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' }, key, 256);
  return new Uint8Array(bits);
}

// ---------- session tokens (HMAC-SHA256, 90-day expiry) ----------
async function hmacKey(env) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function signToken(env, payloadObj) {
  const payload = b64url(new TextEncoder().encode(JSON.stringify(payloadObj)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env), new TextEncoder().encode(payload));
  return payload + '.' + b64url(new Uint8Array(sig));
}
async function verifyToken(env, token) {
  const [payload, sigPart] = String(token || '').split('.');
  if (!payload || !sigPart) return null;
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(env), fromB64url(sigPart), new TextEncoder().encode(payload));
  if (!ok) return null;
  try {
    const obj = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    if (!obj || !obj.exp || obj.exp < Date.now()) return null;
    return obj;
  } catch { return null; }
}
async function requireUser(request, env) {
  const m = (request.headers.get('authorization') || '').match(/^Bearer (.+)$/);
  if (!m) return null;
  const payload = await verifyToken(env, m[1]);
  return payload ? payload.uid : null;
}
const NINETY_DAYS = 1000 * 60 * 60 * 24 * 90;

// ---------- routes ----------
async function signup(request, env) {
  const body = await request.json().catch(() => null);
  const name = String(body?.name || '').trim();
  const passcode = String(body?.passcode || '');
  if (!name || name.length > 40) return json({ error: 'Enter a name.' }, 400);
  if (passcode.length < 4) return json({ error: 'Passcode must be at least 4 characters.' }, 400);
  const existing = await env.DB.prepare('SELECT id FROM users WHERE name = ? COLLATE NOCASE').bind(name).first();
  if (existing) return json({ error: 'That name already has an account. Try logging in instead.' }, 409);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashPasscode(passcode, salt);
  const now = Date.now();
  const res = await env.DB.prepare('INSERT INTO users (name, passcode_hash, salt, created_at) VALUES (?, ?, ?, ?)')
    .bind(name, toHex(hash), toHex(salt), now).run();
  const token = await signToken(env, { uid: res.meta.last_row_id, exp: now + NINETY_DAYS });
  return json({ token, name }, 201);
}

async function login(request, env) {
  const body = await request.json().catch(() => null);
  const name = String(body?.name || '').trim();
  const passcode = String(body?.passcode || '');
  const row = await env.DB.prepare('SELECT id, name, passcode_hash, salt FROM users WHERE name = ? COLLATE NOCASE').bind(name).first();
  if (!row) return json({ error: 'No account with that name. Check the spelling, or create one.' }, 401);
  const hash = await hashPasscode(passcode, fromHex(row.salt));
  if (!timingSafeEqual(hash, fromHex(row.passcode_hash))) return json({ error: 'Wrong passcode.' }, 401);
  const token = await signToken(env, { uid: row.id, exp: Date.now() + NINETY_DAYS });
  return json({ token, name: row.name });
}

async function getSync(request, env) {
  const uid = await requireUser(request, env);
  if (!uid) return json({ error: 'Not signed in.' }, 401);
  const row = await env.DB.prepare('SELECT data, updated_at FROM sync_state WHERE user_id = ?').bind(uid).first();
  if (!row) return json({ data: null, updatedAt: 0 });
  return json({ data: JSON.parse(row.data), updatedAt: row.updated_at });
}

async function putSync(request, env) {
  const uid = await requireUser(request, env);
  if (!uid) return json({ error: 'Not signed in.' }, 401);
  const body = await request.json().catch(() => null);
  if (!body || typeof body.data !== 'object' || body.data === null) return json({ error: 'Bad request.' }, 400);
  const baseUpdatedAt = Number(body.baseUpdatedAt) || 0;
  const row = await env.DB.prepare('SELECT updated_at, data FROM sync_state WHERE user_id = ?').bind(uid).first();
  const serverUpdatedAt = row ? row.updated_at : 0;
  // Someone else (or another device) pushed a newer copy than the one this device last saw.
  if (row && serverUpdatedAt > baseUpdatedAt) return json({ conflict: true, data: JSON.parse(row.data), updatedAt: serverUpdatedAt }, 409);
  const now = Date.now(), dataJson = JSON.stringify(body.data);
  if (row) await env.DB.prepare('UPDATE sync_state SET data = ?, updated_at = ? WHERE user_id = ?').bind(dataJson, now, uid).run();
  else await env.DB.prepare('INSERT INTO sync_state (user_id, data, updated_at) VALUES (?, ?, ?)').bind(uid, dataJson, now).run();
  return json({ updatedAt: now });
}

// ---------- food lookup (proxies Open Food Facts; browsers can't set a custom
// User-Agent themselves, so this runs server-side with one, per OFF's usage terms) ----------
async function foodLookup(env, barcode) {
  if (!/^[0-9]{6,14}$/.test(barcode)) return json({ error: 'That is not a valid barcode.' }, 400);
  let res;
  try {
    res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,serving_size,nutriments`, {
      headers: { 'User-Agent': 'NinaFit/1.0 - personal single-household fitness app - contact lukembrown013@gmail.com' }
    });
  } catch { return json({ error: "Couldn't reach the food database." }, 502); }
  if (!res.ok) return json({ error: "Couldn't reach the food database." }, 502);
  const body = await res.json().catch(() => null);
  if (!body || body.status !== 1 || !body.product) return json({ found: false });
  const p = body.product, n = p.nutriments || {};
  const perServing = n['energy-kcal_serving'] != null;
  return json({
    found: true,
    name: p.product_name || 'Unknown product',
    serving: p.serving_size || (perServing ? '1 serving' : '100 g'),
    kcal: (perServing ? n['energy-kcal_serving'] : n['energy-kcal_100g']) ?? 0,
    p: (perServing ? n['proteins_serving'] : n['proteins_100g']) ?? 0,
    c: (perServing ? n['carbohydrates_serving'] : n['carbohydrates_100g']) ?? 0,
    f: (perServing ? n['fat_serving'] : n['fat_100g']) ?? 0
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      if (request.method === 'POST' && url.pathname === '/api/signup') return await signup(request, env);
      if (request.method === 'POST' && url.pathname === '/api/login') return await login(request, env);
      if (request.method === 'GET' && url.pathname === '/api/sync') return await getSync(request, env);
      if (request.method === 'PUT' && url.pathname === '/api/sync') return await putSync(request, env);
      const foodMatch = url.pathname.match(/^\/api\/food\/([0-9A-Za-z]+)$/);
      if (request.method === 'GET' && foodMatch) return await foodLookup(env, foodMatch[1]);
      return json({ error: 'Not found' }, 404);
    } catch (e) {
      return json({ error: 'Server error' }, 500);
    }
  }
};
