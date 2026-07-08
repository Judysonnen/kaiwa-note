// Japanese audio: pre-generated neural TTS clips (see tools/gen_audio.py)
// play first; the browser's built-in speech synthesis is the fallback for
// any text without a clip.

let jaVoice = null;

function pickVoice() {
  const voices = speechSynthesis.getVoices().filter(v => v.lang.startsWith('ja'));
  if (!voices.length) return null;
  // Prefer higher-quality system voices when available.
  const preferred = ['Kyoko (Enhanced)', 'Kyoko', 'O-Ren', 'Google 日本語'];
  for (const name of preferred) {
    const v = voices.find(v => v.name.includes(name));
    if (v) return v;
  }
  return voices[0];
}

if ('speechSynthesis' in window) {
  speechSynthesis.addEventListener?.('voiceschanged', () => { jaVoice = pickVoice(); });
  jaVoice = pickVoice();
}

// Must match fnv1a32() in tools/gen_audio.py: FNV-1a over UTF-8 bytes of NFC text.
function fnv1a32(text) {
  const bytes = new TextEncoder().encode(text.normalize('NFC'));
  let h = 0x811c9dc5;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function speakSynth(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  u.rate = 0.9;
  if (!jaVoice) jaVoice = pickVoice();
  if (jaVoice) u.voice = jaVoice;
  speechSynthesis.speak(u);
}

const clipCache = new Map();
// Texts whose clip already failed to load; go straight to synthesis next time.
const missing = new Set();
let current = null;

export function speakJa(text) {
  if (current) { current.pause(); current = null; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();

  if (missing.has(text)) { speakSynth(text); return; }

  let audio = clipCache.get(text);
  if (!audio) {
    audio = new Audio(`data/audio/${fnv1a32(text)}.mp3`);
    clipCache.set(text, audio);
  }
  current = audio;
  audio.currentTime = 0;
  audio.play().catch(() => {
    missing.add(text);
    clipCache.delete(text);
    speakSynth(text);
  });
}

// --- chained playback via Web Audio -----------------------------------
// Dates/times are assembled from component clips. Playing them as <audio>
// elements one after another sounds choppy (loading gaps + silence padding
// in each clip), so decode everything up front, trim the silence, and
// schedule the buffers back to back on one timeline.

let actx = null;
const bufferCache = new Map();
let seqSources = [];
let seqToken = 0;

function trimSilence(buf, threshold = 0.012) {
  const data = buf.getChannelData(0);
  const sr = buf.sampleRate;
  let start = 0;
  let end = data.length - 1;
  while (start < data.length && Math.abs(data[start]) < threshold) start++;
  while (end > start && Math.abs(data[end]) < threshold) end--;
  start = Math.max(0, Math.floor(start - sr * 0.015));
  end = Math.min(data.length, Math.floor(end + sr * 0.04));
  const out = actx.createBuffer(buf.numberOfChannels, end - start, sr);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    out.copyToChannel(buf.getChannelData(c).slice(start, end), c);
  }
  return out;
}

async function loadBuffer(text) {
  if (bufferCache.has(text)) return bufferCache.get(text);
  const res = await fetch(`data/audio/${fnv1a32(text)}.mp3`);
  if (!res.ok) throw new Error(`no clip for ${text}`);
  actx = actx || new (window.AudioContext || window.webkitAudioContext)();
  const decoded = await actx.decodeAudioData(await res.arrayBuffer());
  const trimmed = trimSilence(decoded);
  bufferCache.set(text, trimmed);
  return trimmed;
}

function stopSeq() {
  seqSources.forEach(s => { try { s.stop(); } catch { /* already ended */ } });
  seqSources = [];
}

export async function speakSeq(parts, fallbackText) {
  const token = ++seqToken;
  stopSeq();
  if (current) { current.pause(); current = null; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  try {
    const buffers = await Promise.all(parts.map(loadBuffer));
    if (token !== seqToken) return;
    await actx.resume();
    let at = actx.currentTime + 0.03;
    for (const buf of buffers) {
      const src = actx.createBufferSource();
      src.buffer = buf;
      src.connect(actx.destination);
      src.start(at);
      at += buf.duration + 0.045; // breath-sized gap between components
      seqSources.push(src);
    }
  } catch {
    if (token === seqToken && fallbackText) speakSynth(fallbackText);
  }
}

export function speakButton(text, label = '発音を聞く') {
  const btn = document.createElement('button');
  btn.className = 'speak';
  btn.type = 'button';
  btn.title = label;
  btn.setAttribute('aria-label', `${label}: ${text}`);
  btn.textContent = '\u{1F50A}';
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    speakJa(text);
  });
  return btn;
}
