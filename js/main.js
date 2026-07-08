import { renderPitch } from './pitch.js';
import { speakJa, speakButton } from './tts.js';
import {
  buildQueue, grade, dueCount, unseenCount, nextDueDate,
  addStamp, getStamps, streakLength, todayKey, Rating, NEW_PER_DAY,
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

// Flatten every reviewable entry across all lessons. Grammar and sentences
// are the core material; vocab supports them.
async function getAllReviewItems() {
  const { lessons } = await getManifest();
  const items = [];
  for (const meta of lessons) {
    const lesson = await getLesson(meta.id);
    for (const g of lesson.grammar) {
      items.push({ itemId: `${lesson.id}/${g.id}`, kind: 'grammar', data: g, lessonId: lesson.id });
    }
    for (const s of lesson.sentences) {
      items.push({ itemId: `${lesson.id}/${s.id}`, kind: 'sentence', data: s, lessonId: lesson.id });
    }
    for (const v of lesson.vocab) {
      items.push({ itemId: `${lesson.id}/${v.id}`, kind: 'vocab', data: v, lessonId: lesson.id });
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
  if (v.note) card.appendChild(el('div', 'note', v.note));
  const foot = el('div', 'tcard-foot');
  foot.appendChild(el('span', 'kind kind-vocab', '単語'));
  foot.appendChild(speakButton(v.word));
  card.appendChild(foot);
  return card;
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

const GRADES = [
  { rating: Rating.Again, label: 'もう一度', cls: 'b-again' },
  { rating: Rating.Hard, label: '難しい', cls: 'b-hard' },
  { rating: Rating.Good, label: '普通', cls: 'b-good' },
  { rating: Rating.Easy, label: '簡単', cls: 'b-easy' },
];

async function renderReview() {
  const items = await getAllReviewItems();
  let queue = buildQueue(items);
  let sessionTotal = queue.length;
  let done = 0;

  function showDone() {
    if (done > 0) addStamp();
    view.replaceChildren();
    const doneBox = el('div', 'review-done');
    if (done > 0) {
      doneBox.appendChild(el('div', 'big-stamp', '話'));
      doneBox.appendChild(el('div', 'done-title', 'きょうのぶん、おしまい！'));
      doneBox.appendChild(el('p', 'sub', `${done}枚できました。スタンプを押しました 🎉`));
    } else {
      doneBox.appendChild(el('div', 'done-title', 'きょうは何もありません'));
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
    view.appendChild(el('p', 'review-status', `のこり ${queue.length} 枚`));

    const TAG = { vocab: '単語', grammar: '文法', sentence: '例文' };
    const card = el('div', 'bigcard');
    card.appendChild(el('div', `card-tag tag-${kind}`, TAG[kind]));

    let front;
    if (kind === 'sentence') {
      // Production practice: Chinese prompt, say it in Japanese, then check.
      front = el('div', 'card-front is-sentence', data.zh || data.meaning);
      card.appendChild(front);
      card.appendChild(el('div', 'card-hint', '日本語で言ってみましょう'));
    } else {
      front = el('div', `card-front${kind === 'grammar' ? ' is-grammar' : ''}`,
        kind === 'vocab' ? data.word : data.pattern);
      front.lang = 'ja';
      card.appendChild(front);
    }

    const back = el('div', 'card-back');
    back.hidden = true;
    if (kind === 'vocab') {
      back.appendChild(renderPitch(data.reading, data.accent));
      back.appendChild(el('div', 'meaning', data.meaning));
      if (data.note) back.appendChild(el('div', 'example', data.note));
      back.appendChild(speakButton(data.word));
    } else if (kind === 'grammar') {
      back.appendChild(el('div', 'meaning', data.explanation));
      if (data.detail) back.appendChild(el('div', 'detail', data.detail));
      for (const ex of (data.examples || []).slice(0, 2)) {
        back.appendChild(exampleLine(ex));
      }
    } else {
      const answer = el('div', 'sentence-answer', data.ja);
      answer.lang = 'ja';
      back.appendChild(answer);
      back.appendChild(speakButton(data.ja));
    }
    card.appendChild(back);
    view.appendChild(card);

    const revealBtn = el('button', 'reveal-btn', '答えを見る');
    revealBtn.type = 'button';
    view.appendChild(revealBtn);

    const gradeRow = el('div', 'grade-row');
    gradeRow.hidden = true;
    for (const g of GRADES) {
      const btn = el('button', `grade-btn ${g.cls}`);
      btn.type = 'button';
      btn.textContent = g.label;
      btn.addEventListener('click', () => {
        grade(itemId, g.rating, kind);
        queue.shift();
        if (g.rating === Rating.Again) {
          // Back of today's stack; it doesn't count as done yet.
          queue.push({ itemId, kind, data });
        } else {
          done += 1;
        }
        showCard();
      });
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
