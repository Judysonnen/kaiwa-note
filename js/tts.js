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
