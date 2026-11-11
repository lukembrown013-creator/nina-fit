// Barcode scanning for the Food tab. iOS Safari has no built-in camera barcode API, so this
// loads a small WASM decoder from a CDN on first use — that needs network, same as the food
// lookup itself. If the camera or the decoder aren't available, manual entry always works.
import { $, esc } from './util.js';
import { actions, submits, closeSheet, openSheet, toast } from './ui.js';

const DETECTOR_URL = 'https://cdn.jsdelivr.net/npm/barcode-detector@3.2.0/dist/es/ponyfill.min.js';
let detectorPromise = null;
function getDetector() {
  if (!detectorPromise) {
    detectorPromise = import(DETECTOR_URL).then(m => new m.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] }));
  }
  return detectorPromise;
}

let stream = null, raf = null, live = false, resultCb = null;

function renderOverlay() {
  $('#scan').innerHTML = `<div class="scan-head"><button class="icon-btn" data-action="scan-close" aria-label="Close scanner">&#10005;</button>
<span class="muted small" style="color:#fff">Point the camera at a barcode</span>
<span style="width:44px"></span></div>
<video id="scan-video" autoplay playsinline muted></video>
<div class="scan-frame"></div>
<div class="scan-foot"><span class="muted small">Can't scan it?</span><button class="btn ghost sm" data-action="scan-manual">Type the barcode instead</button></div>`;
}

// onCode(code, errorMessage): called exactly once. code is a string on success; on cancel
// or failure, code is null and errorMessage is set only for an actual failure (not a plain cancel).
export async function openScanner(onCode) {
  resultCb = onCode;
  const el = $('#scan'); el.hidden = false;
  renderOverlay();
  let detector;
  try {
    [stream, detector] = await Promise.all([
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }),
      getDetector()
    ]);
  } catch (e) {
    const msg = e && e.name === 'NotAllowedError' ? 'Camera access was not allowed.' : "Couldn't start the scanner — check your connection.";
    closeScanner(); toast(msg); openManualEntry(); return; // fall back to typing it in, rather than a dead end
  }
  const video = $('#scan-video');
  if (!video) { closeScanner(); return; } // closed while starting up
  video.srcObject = stream;
  await video.play().catch(() => {});
  live = true;
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
  const loop = async () => {
    if (!live) return;
    if (video.readyState >= 2 && video.videoWidth) {
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      try {
        const codes = await detector.detect(canvas);
        if (codes.length && live) { const code = codes[0].rawValue; closeScanner(); finish(code, null); return; }
      } catch { /* decode miss on this frame — try the next one */ }
    }
    if (live) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}

export function closeScanner() {
  live = false;
  if (raf) cancelAnimationFrame(raf);
  raf = null;
  if (stream) { for (const t of stream.getTracks()) t.stop(); stream = null; }
  const el = $('#scan'); if (el) { el.hidden = true; el.innerHTML = ''; }
}
function finish(code, err) { const cb = resultCb; resultCb = null; if (cb) cb(code, err); }

function openManualEntry() {
  openSheet(`<div style="--accent:var(--cyan)" class="col"><div class="sheet-head"><h2 class="sheet-title">Enter barcode</h2><button class="link" data-action="sheet-close">Cancel</button></div>
<form data-submit="scan-manual-go" class="col" style="gap:12px">
<label class="field"><span>Barcode number</span><input type="text" name="code" inputmode="numeric" placeholder="e.g. 00000000000" autocomplete="off" autofocus></label>
<button class="btn primary block" type="submit">Look up</button></form></div>`);
}
actions['scan-close'] = () => { closeScanner(); finish(null, null); };
actions['scan-manual'] = () => { closeScanner(); openManualEntry(); };
submits['scan-manual-go'] = v => {
  const code = String(v.code || '').replace(/\D/g, '');
  closeSheet();
  if (!code) return toast('Enter the numbers under the barcode');
  finish(code, null);
};
