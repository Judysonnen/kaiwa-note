// Japanese speech via the browser's built-in speech synthesis.

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

export function speakJa(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  u.rate = 0.9;
  if (!jaVoice) jaVoice = pickVoice();
  if (jaVoice) u.voice = jaVoice;
  speechSynthesis.speak(u);
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
