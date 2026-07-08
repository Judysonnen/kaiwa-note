// Render standard Japanese pitch-accent notation: an overline over high morae,
// with a downward tick where the pitch drops. `accent` is the accent nucleus
// number (0 = heiban); null means unknown, render plain reading.

const SMALL_KANA = new Set([...'ゃゅょぁぃぅぇぉャュョァィゥェォ']);

export function toMorae(reading) {
  const morae = [];
  for (const ch of reading) {
    if (SMALL_KANA.has(ch) && morae.length > 0) {
      morae[morae.length - 1] += ch;
    } else {
      morae.push(ch);
    }
  }
  return morae;
}

export function renderPitch(reading, accent) {
  const morae = toMorae(reading);
  const span = document.createElement('span');
  span.className = 'pitch';
  span.lang = 'ja';

  if (accent === null || accent === undefined) {
    span.textContent = reading;
    return span;
  }

  morae.forEach((mora, i) => {
    const m = document.createElement('span');
    m.textContent = mora;
    const n = i + 1;
    let hi;
    if (accent === 0) hi = n >= 2;
    else if (accent === 1) hi = n === 1;
    else hi = n >= 2 && n <= accent;
    m.className = 'mora' + (hi ? ' hi' : '');
    if (accent > 0 && n === accent) m.classList.add('drop');
    span.appendChild(m);
  });

  const num = document.createElement('span');
  num.className = 'accent-num';
  num.textContent = `[${accent}]`;
  span.appendChild(num);
  return span;
}
