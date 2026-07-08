import { renderPitch } from './pitch.js';
import { speakJa, speakSeq, speakButton } from './tts.js';
import { dateInfo, timeInfo } from './clock.js';
import {
  buildQueue, bonusQueue, grade, dueCount, unseenCount, nextDueDate, studiedCount,
  isSeen, addStamp, getStamps, streakLength, todayKey, Rating, NEW_PER_DAY,
} from './srs.js';

const view = document.getElementById('view');
const dueBadge = document.getElementById('due-badge');

let manifest = null;
const lessonCache = new Map();

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

async function getManifest() {
  if (!manifest) manifest = await fetchJson('data/manifest.json');
  return manifest;
}

async function getLesson(id) {
  if (!lessonCache.has(id)) {
    lessonCache.set(id, await fetchJson(`data/lessons/${id}.json`));
  }
  return lessonCache.get(id);
}

// Review runs on sentences only: they are the unit of conversation practice,
// and each card's breakdown carries the grammar. Vocab and grammar stay in
// the notebook for reference.
async function getAllReviewItems() {
  const { lessons } = await getManifest();
  const items = [];
  for (const meta of lessons) {
    const lesson = await getLesson(meta.id);
    for (const s of lesson.sentences) {
      items.push({ itemId: `${lesson.id}/${s.id}`, kind: 'sentence', data: s, lessonId: lesson.id });
    }
  }
  return items;
}

async function updateDueBadge() {
  try {
    const items = await getAllReviewItems();
    const n = dueCount(items);
    dueBadge.hidden = n === 0;
    dueBadge.textContent = n;
  } catch { /* badge is decoration; never block the page on it */ }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function sessionMinutes(n) {
  return Math.max(1, Math.ceil(n / 4));
}

// ---------- today ----------

function stampCalendar() {
  const stamps = getStamps();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const wrap = el('div', 'stamp-card');
  const head = el('div', 'stamp-month', `${month + 1}月のスタンプ`);
  const streak = streakLength(now);
  if (streak >= 2) head.appendChild(el('span', 'streak', `🔥 ${streak}日連続`));
  wrap.appendChild(head);

  const grid = el('div', 'stamp-grid');
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cell = el('div', 'stamp-day', stamps.has(key) ? '話' : String(day));
    if (stamps.has(key)) cell.classList.add('stamped');
    if (day === now.getDate()) cell.classList.add('today');
    grid.appendChild(cell);
  }
  wrap.appendChild(grid);
  return wrap;
}

async function renderToday() {
  const items = await getAllReviewItems();
  const queue = buildQueue(items);
  const stamped = getStamps().has(todayKey());

  view.replaceChildren();
  const hero = el('div', 'today-hero');

  if (queue.length === 0) {
    hero.appendChild(el('div', 'today-done-big', stamped ? 'きょうのぶんは、おしまい！' : 'きょうは何もありません'));
    const unseen = unseenCount(items);
    const next = nextDueDate(items);
    let sub = '';
    if (unseen > 0) sub = `あしたは新しいカードが${Math.min(NEW_PER_DAY, unseen)}枚とどきます`;
    else if (next) sub = `つぎの復習は ${todayKey(next)} です`;
    if (sub) hero.appendChild(el('p', 'today-sub', sub));
    if (unseen > 0) {
      const more = el('a', 'bonus-btn', `もっとやる（+${Math.min(NEW_PER_DAY, unseen)}枚）`);
      more.href = '#/review';
      hero.appendChild(more);
    }
  } else {
    hero.appendChild(el('div', 'today-label', 'きょうのぶん'));
    const big = el('div', 'today-big');
    big.appendChild(el('span', 'today-count', String(queue.length)));
    big.appendChild(el('span', 'today-unit', '枚'));
    hero.appendChild(big);
    hero.appendChild(el('p', 'today-sub', `約${sessionMinutes(queue.length)}分でおわります`));
    const start = el('a', 'start-btn', 'はじめる');
    start.href = '#/review';
    hero.appendChild(start);
  }
  view.appendChild(hero);
  view.appendChild(stampCalendar());
  view.appendChild(clockLine());
}

// A quiet date/time line: tap either part to hear it read in Japanese and
// see the kana reading, for learning how dates and times are said.
function clockLine() {
  const wrap = el('div', 'clock-line');
  const row = el('div', 'clock-row');
  const kana = el('div', 'clock-kana');
  kana.hidden = true;

  function makeSeg(getInfo) {
    const btn = el('button', 'clock-seg');
    btn.type = 'button';
    btn.title = '日本語で読み上げ';
    btn.textContent = getInfo().display;
    btn.addEventListener('click', () => {
      const info = getInfo();
      speakSeq(info.parts, info.speech);
      kana.textContent = info.kana;
      kana.hidden = false;
    });
    return btn;
  }

  const dateSeg = makeSeg(dateInfo);
  const timeSeg = makeSeg(timeInfo);
  row.appendChild(dateSeg);
  row.appendChild(el('span', 'clock-sep', '・'));
  row.appendChild(timeSeg);
  wrap.appendChild(row);
  wrap.appendChild(kana);

  const tick = setInterval(() => {
    if (!wrap.isConnected) { clearInterval(tick); return; }
    timeSeg.textContent = timeInfo().display;
  }, 15000);
  return wrap;
}

// ---------- lessons list ----------

async function renderLessonList() {
  view.replaceChildren(el('h1', 'page-title', 'ノート'));
  const { lessons } = await getManifest();
  if (!lessons.length) {
    view.appendChild(el('p', 'empty-note', 'まだレッスンがありません。ノートを貼り付けて追加してください。'));
    return;
  }
  const list = el('ul', 'lesson-list');
  for (const meta of [...lessons].reverse()) {
    const li = el('li');
    const a = el('a', 'lesson-link');
    a.href = `#/lesson/${meta.id}`;
    a.appendChild(el('span', 'lesson-date', meta.date));
    a.appendChild(el('span', 'lesson-title', meta.title));
    getLesson(meta.id).then(lesson => {
      a.appendChild(el('span', 'lesson-counts',
        `単語 ${lesson.vocab.length} ・ 文法 ${lesson.grammar.length}`));
    });
    li.appendChild(a);
    list.appendChild(li);
  }
  view.appendChild(list);
}

// ---------- lesson detail ----------

function sectionChip(text, kind, count) {
  const label = el('h2', 'section-chip', text);
  label.dataset.kind = kind;
  label.appendChild(el('span', 'count', String(count)));
  return label;
}

function vocabCard(v) {
  const card = el('div', 'tcard');
  const word = el('div', 'word');
  word.lang = 'ja';
  if (v.word !== v.reading) {
    const ruby = document.createElement('ruby');
    ruby.appendChild(document.createTextNode(v.word));
    const rt = document.createElement('rt');
    rt.textContent = v.reading;
    ruby.appendChild(rt);
    word.appendChild(ruby);
  } else {
    word.textContent = v.word;
  }
  if (v.accent !== null && v.accent !== undefined) {
    word.appendChild(renderPitch(v.reading, v.accent));
  }
  card.appendChild(word);
  card.appendChild(el('div', 'mean', v.meaning));
  const foot = el('div', 'tcard-foot');
  foot.appendChild(speakButton(v.word));
  card.appendChild(foot);
  if (v.note) card.appendChild(exampleLine({ ja: v.note, zh: v.note_zh }));
  return card;
}

// Per-sentence grammar walkthrough (the 讲解 for beginners).
function breakdownList(points) {
  const ul = el('ul', 'breakdown');
  for (const p of points) ul.appendChild(el('li', null, p));
  return ul;
}

// Examples were plain strings before translations were added.
function exJa(ex) { return typeof ex === 'string' ? ex : ex.ja; }
function exZh(ex) { return typeof ex === 'string' ? null : ex.zh; }

function exampleLine(ex) {
  const line = el('div', 'gex-line');
  line.appendChild(speakButton(exJa(ex)));
  const body = el('div', 'gex-body');
  const ja = el('div', 'gex', exJa(ex));
  ja.lang = 'ja';
  body.appendChild(ja);
  if (exZh(ex)) body.appendChild(el('div', 'gex-zh', exZh(ex)));
  line.appendChild(body);
  return line;
}

function grammarCard(g) {
  const card = el('div', 'tcard tcard-wide');
  const pattern = el('div', 'word pattern', g.pattern);
  pattern.lang = 'ja';
  card.appendChild(pattern);
  card.appendChild(el('div', 'mean', g.explanation));
  if (g.detail) card.appendChild(el('div', 'detail', g.detail));
  for (const ex of g.examples || []) {
    card.appendChild(exampleLine(ex));
  }
  return card;
}

async function renderLesson(id) {
  let lesson;
  try {
    lesson = await getLesson(id);
  } catch {
    view.replaceChildren(el('p', 'empty-note', `レッスン「${id}」が見つかりません。`));
    return;
  }

  view.replaceChildren();
  const back = el('a', 'back-link', '← ノート');
  back.href = '#/lessons';
  view.appendChild(back);

  const head = el('div', 'lesson-head');
  const h1 = el('h1', 'page-title', lesson.title);
  h1.lang = 'ja';
  head.appendChild(h1);
  head.appendChild(el('span', 'lesson-date', lesson.date));
  view.appendChild(head);

  view.appendChild(sectionChip('文法', 'grammar', lesson.grammar.length));
  const gGrid = el('div', 'grid grid-wide');
  for (const g of lesson.grammar) gGrid.appendChild(grammarCard(g));
  view.appendChild(gGrid);

  view.appendChild(sectionChip('例文', 'sentence', lesson.sentences.length));
  const ul = el('ul', 'sentence-list');
  for (const s of lesson.sentences) {
    const li = el('li');
    li.appendChild(speakButton(s.ja));
    const wrap = el('div');
    const ja = el('div', 'sentence-ja', s.ja);
    ja.lang = 'ja';
    wrap.appendChild(ja);
    wrap.appendChild(el('div', 'sentence-en', s.zh || s.meaning));
    if (s.breakdown?.length) wrap.appendChild(breakdownList(s.breakdown));
    li.appendChild(wrap);
    ul.appendChild(li);
  }
  view.appendChild(ul);

  view.appendChild(sectionChip('単語', 'vocab', lesson.vocab.length));
  const vGrid = el('div', 'grid');
  for (const v of lesson.vocab) vGrid.appendChild(vocabCard(v));
  view.appendChild(vGrid);
}

// ---------- review ----------

// Two buttons only: deciding between four grades every card is friction.
const GRADES = [
  { rating: Rating.Again, label: 'もう一度', cls: 'b-again' },
  { rating: Rating.Good, label: 'できた', cls: 'b-good' },
];

const PRAISE = [
  'おつかれさま！', 'ナイス！', '完璧だ！', '今日も勝ち。',
  '継続は力なり。', 'すばらしい！', 'その調子！', 'やるじゃん！',
];

function confetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = el('div', 'confetti');
  const colors = ['#FF4D00', '#101010', '#8A8A85'];
  for (let i = 0; i < 36; i++) {
    const bit = el('span', 'confetti-bit');
    bit.style.left = `${Math.random() * 100}%`;
    bit.style.background = colors[i % colors.length];
    bit.style.animationDelay = `${Math.random() * 0.4}s`;
    bit.style.animationDuration = `${1.1 + Math.random() * 0.9}s`;
    bit.style.transform = `rotate(${Math.random() * 360}deg)`;
    box.appendChild(bit);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 2600);
}

async function renderReview() {
  const items = await getAllReviewItems();
  let queue = buildQueue(items);
  let sessionTotal = queue.length;
  let done = 0;
  let combo = 0;

  function showDone() {
    if (done > 0) { addStamp(); confetti(); }
    view.replaceChildren();
    const doneBox = el('div', 'review-done');
    if (done > 0) {
      doneBox.appendChild(el('div', 'big-stamp', '話'));
      doneBox.appendChild(el('div', 'done-title', PRAISE[Math.floor(Math.random() * PRAISE.length)]));
      doneBox.appendChild(el('p', 'sub',
        `${done}枚できました ・ 通算 ${studiedCount(items)}枚 ・ 🔥 ${streakLength()}日連続`));
    } else {
      doneBox.appendChild(el('div', 'done-title', 'きょうは何もありません'));
    }
    const bonus = bonusQueue(items);
    if (bonus.length) {
      const more = el('button', 'bonus-btn', `もっとやる（+${bonus.length}枚）`);
      more.type = 'button';
      more.addEventListener('click', () => {
        queue = bonus;
        sessionTotal = bonus.length;
        done = 0;
        combo = 0;
        showCard();
      });
      doneBox.appendChild(more);
    }
    const home = el('a', 'note-link', '← きょうのページへ');
    home.href = '#/';
    doneBox.appendChild(home);
    view.appendChild(doneBox);
    updateDueBadge();
  }

  function showCard() {
    if (!queue.length) { showDone(); return; }
    const { itemId, kind, data } = queue[0];

    view.replaceChildren();

    const progress = el('div', 'progress');
    const fill = el('div', 'progress-fill');
    fill.style.width = `${Math.round((done / Math.max(1, sessionTotal)) * 100)}%`;
    progress.appendChild(fill);
    view.appendChild(progress);
    const status = el('p', 'review-status', `のこり ${queue.length} 枚`);
    if (combo >= 3) status.appendChild(el('span', 'combo', ` 🔥 ${combo}連続！`));
    view.appendChild(status);

    const TAG = { vocab: '単語', grammar: '文法', sentence: '例文' };
    const learning = !isSeen(itemId); // first pass: show everything, no quiz
    const card = el('div', 'bigcard');
    card.appendChild(el('div', `card-tag tag-${kind}`, TAG[kind] + (learning ? ' ・ NEW' : '')));

    // Front: on first pass it's the Japanese itself; on reviews it's the
    // Chinese prompt (vocab, sentences) or the pattern (grammar).
    if (kind === 'vocab') {
      if (learning) {
        const front = el('div', 'card-front', data.word);
        front.lang = 'ja';
        card.appendChild(front);
      } else {
        card.appendChild(el('div', 'card-front is-sentence', data.meaning_zh || data.meaning));
        card.appendChild(el('div', 'card-hint', '日本語は？'));
      }
    } else if (kind === 'grammar') {
      const front = el('div', 'card-front is-grammar', data.pattern);
      front.lang = 'ja';
      card.appendChild(front);
    } else {
      if (learning) {
        const front = el('div', 'card-front is-grammar', data.ja);
        front.lang = 'ja';
        card.appendChild(front);
      } else {
        card.appendChild(el('div', 'card-front is-sentence', data.zh || data.meaning));
        card.appendChild(el('div', 'card-hint', '日本語で言ってみましょう'));
      }
    }

    const back = el('div', 'card-back');
    back.hidden = !learning;
    if (kind === 'vocab') {
      if (!learning) {
        const answer = el('div', 'sentence-answer', data.word);
        answer.lang = 'ja';
        back.appendChild(answer);
      }
      back.appendChild(renderPitch(data.reading, data.accent));
      back.appendChild(el('div', 'meaning', data.meaning));
      back.appendChild(speakButton(data.word));
      if (data.note) back.appendChild(exampleLine({ ja: data.note, zh: data.note_zh }));
    } else if (kind === 'grammar') {
      back.appendChild(el('div', 'meaning', data.explanation));
      if (data.detail) back.appendChild(el('div', 'detail', data.detail));
      for (const ex of (data.examples || []).slice(0, 2)) {
        back.appendChild(exampleLine(ex));
      }
    } else {
      if (!learning) {
        const answer = el('div', 'sentence-answer', data.ja);
        answer.lang = 'ja';
        back.appendChild(answer);
      } else {
        back.appendChild(el('div', 'meaning', data.zh || data.meaning));
      }
      back.appendChild(speakButton(data.ja));
      if (data.breakdown?.length) back.appendChild(breakdownList(data.breakdown));
    }
    card.appendChild(back);
    view.appendChild(card);

    function answer(rating) {
      grade(itemId, rating, kind);
      queue.shift();
      if (rating === Rating.Again) {
        // Back of today's stack; it doesn't count as done yet.
        queue.push({ itemId, kind, data });
        combo = 0;
      } else {
        done += 1;
        combo += 1;
      }
      showCard();
    }

    if (learning) {
      // First exposure: read it, listen, move on. No self-test yet.
      const next = el('button', 'reveal-btn', 'つぎへ');
      next.type = 'button';
      next.addEventListener('click', () => answer(Rating.Good));
      view.appendChild(next);
      return;
    }

    const revealBtn = el('button', 'reveal-btn', '答えを見る');
    revealBtn.type = 'button';
    view.appendChild(revealBtn);

    const gradeRow = el('div', 'grade-row');
    gradeRow.hidden = true;
    for (const g of GRADES) {
      const btn = el('button', `grade-btn ${g.cls}`);
      btn.type = 'button';
      btn.textContent = g.label;
      btn.addEventListener('click', () => answer(g.rating));
      gradeRow.appendChild(btn);
    }
    view.appendChild(gradeRow);

    revealBtn.addEventListener('click', () => {
      back.hidden = false;
      revealBtn.hidden = true;
      gradeRow.hidden = false;
      if (kind === 'vocab') speakJa(data.word);
      if (kind === 'sentence') speakJa(data.ja);
    });
  }

  showCard();
}

// ---------- router ----------

function setActiveNav(name) {
  document.querySelectorAll('.site-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.nav === name);
  });
}

async function route() {
  const hash = location.hash || '#/';
  view.classList.toggle('center-view', hash === '#/review');
  try {
    if (hash.startsWith('#/lesson/')) {
      setActiveNav('lessons');
      await renderLesson(hash.slice('#/lesson/'.length));
    } else if (hash === '#/lessons') {
      setActiveNav('lessons');
      await renderLessonList();
    } else if (hash === '#/review') {
      setActiveNav('today');
      await renderReview();
    } else {
      setActiveNav('today');
      await renderToday();
    }
  } catch (err) {
    view.replaceChildren(el('p', 'empty-note', `読み込みエラー: ${err.message}`));
  }
  updateDueBadge();
}

window.addEventListener('hashchange', route);
route();
