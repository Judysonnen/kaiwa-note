// Japanese readings for today's date and the current time, so the clock
// widget can both display and correctly pronounce them. Readings are built
// in kana because TTS engines misread bare kanji dates (8日, 4時, 20日...).

const MONTH_KANA = ['いちがつ', 'にがつ', 'さんがつ', 'しがつ', 'ごがつ', 'ろくがつ',
  'しちがつ', 'はちがつ', 'くがつ', 'じゅうがつ', 'じゅういちがつ', 'じゅうにがつ'];

const WEEK_KANJI = ['日', '月', '火', '水', '木', '金', '土'];
const WEEK_KANA = ['にちようび', 'げつようび', 'かようび', 'すいようび',
  'もくようび', 'きんようび', 'どようび'];

// Days of the month with irregular readings.
const DAY_KANA = {
  1: 'ついたち', 2: 'ふつか', 3: 'みっか', 4: 'よっか', 5: 'いつか',
  6: 'むいか', 7: 'なのか', 8: 'ようか', 9: 'ここのか', 10: 'とおか',
  14: 'じゅうよっか', 20: 'はつか', 24: 'にじゅうよっか',
};

const ONES_KANA = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];
const TENS_KANA = ['', 'じゅう', 'にじゅう', 'さんじゅう', 'よんじゅう', 'ごじゅう'];

function dayKana(d) {
  if (DAY_KANA[d]) return DAY_KANA[d];
  const tens = Math.floor(d / 10);
  const ones = d % 10;
  return TENS_KANA[tens] + ONES_KANA[ones] + 'にち';
}

const HOUR_KANA = ['れいじ', 'いちじ', 'にじ', 'さんじ', 'よじ', 'ごじ', 'ろくじ',
  'しちじ', 'はちじ', 'くじ', 'じゅうじ', 'じゅういちじ'];

// ふん/ぷん readings for single digits (index = minute ones digit).
const MIN_ONES = ['', 'いっぷん', 'にふん', 'さんぷん', 'よんぷん', 'ごふん',
  'ろっぷん', 'ななふん', 'はっぷん', 'きゅうふん'];

function minuteKana(m) {
  if (m === 0) return 'ちょうど';
  const tens = Math.floor(m / 10);
  const ones = m % 10;
  if (ones === 0) return TENS_KANA[tens].replace(/じゅう$/, 'じゅっぷん');
  return TENS_KANA[tens] + MIN_ONES[ones];
}

export function dateInfo(now = new Date()) {
  const m = now.getMonth();
  const d = now.getDate();
  const w = now.getDay();
  return {
    display: `${m + 1}月${d}日（${WEEK_KANJI[w]}）`,
    kana: `${MONTH_KANA[m]} ${dayKana(d)}、${WEEK_KANA[w]}`,
    speech: `きょうは、${MONTH_KANA[m]}${dayKana(d)}、${WEEK_KANA[w]}です。`,
  };
}

export function timeInfo(now = new Date()) {
  const h = now.getHours();
  const min = now.getMinutes();
  const half = h < 12 ? 'ごぜん' : 'ごご';
  const halfKanji = h < 12 ? '午前' : '午後';
  // Noon reads as 12時 (じゅうにじ) in everyday speech; midnight as 0時 (れいじ).
  const h12 = h === 12 ? 12 : h % 12;
  const hourK = h12 === 12 ? 'じゅうにじ' : HOUR_KANA[h12];
  const minK = minuteKana(min);
  return {
    display: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
    kana: `${half} ${hourK} ${minK}`,
    speech: `いまは、${half}${hourK}${min === 0 ? 'ちょうど' : minK}です。`,
    kanji: `${halfKanji}${h12}時${min === 0 ? '' : `${min}分`}`,
  };
}
