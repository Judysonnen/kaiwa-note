import { renderPitch } from './pitch.js';
import { speakJa, speakButton } from './tts.js';
import { buildQueue, grade, dueCount, Rating } from './srs.js';

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

// Flatten every reviewable entry (vocab + grammar) across all lessons.
async function getAllReviewItems() {
  const { lessons } = await getManifest();
  const items = [];
  for (const meta of lessons) {
    const lesson = await getLesson(meta.id);
    for (const v of lesson.vocab) {
      items.push({ itemId: `${lesson.id}/${v.id}`, kind: 'vocab', data: v, lessonId: lesson.id });
    }
    for (const g of lesson.grammar) {
      items.push({ itemId: `${lesson.id}/${g.id}`, kind: 'grammar', data: g, lessonId: lesson.id });
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

function sectionLabel(text, count) {
  const label = el('h2', 'section-label', text);
  if (count !== undefined) label.appendChild(el('span', 'count', String(count)));
  return label;
}

// ---------- lessons list ----------

async function renderLessonList() {
  view.replaceChildren(sectionLabel('レッスン'));
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

function vocabEntry(v) {
  const entry = el('div', 'entry');
  const head = el('div', 'entry-head');

  const headword = el('span', 'headword');
  headword.lang = 'ja';
  if (v.word !== v.reading) {
    const ruby = document.createElement('ruby');
    ruby.appendChild(document.createTextNode(v.word));
    const rt = document.createElement('rt');
    rt.textContent = v.reading;
    ruby.appendChild(rt);
    headword.appendChild(ruby);
  } else {
    headword.textContent = v.word;
  }
  head.appendChild(headword);
  head.appendChild(renderPitch(v.reading, v.accent));
  head.appendChild(speakButton(v.word));
  head.appendChild(el('span', 'entry-meaning', v.meaning));
  entry.appendChild(head);
  if (v.note) entry.appendChild(el('p', 'entry-note', v.note));
  return entry;
}

function grammarCard(g) {
  const card = el('div', 'grammar-card');
  const pattern = el('div', 'pattern', g.pattern);
  pattern.lang = 'ja';
  card.appendChild(pattern);
  card.appendChild(el('p', 'grammar-exp', g.explanation));
  if (g.examples?.length) {
    const ul = el('ul', 'grammar-examples');
    for (const ex of g.examples) {
      const li = el('li');
      li.appendChild(speakButton(ex));
      const s = el('span', null, ex);
      s.lang = 'ja';
      li.appendChild(s);
      ul.appendChild(li);
    }
    card.appendChild(ul);
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
  const back = el('a', 'back-link', '← レッスン一覧');
  back.href = '#/';
  view.appendChild(back);

  const head = el('div', 'lesson-head');
  const h1 = el('h1', null, lesson.title);
  h1.lang = 'ja';
  head.appendChild(h1);
  head.appendChild(el('span', 'lesson-date', lesson.date));
  view.appendChild(head);

  view.appendChild(sectionLabel('単語', lesson.vocab.length));
  for (const v of lesson.vocab) view.appendChild(vocabEntry(v));

  view.appendChild(sectionLabel('文法', lesson.grammar.length));
  for (const g of lesson.grammar) view.appendChild(grammarCard(g));

  view.appendChild(sectionLabel('例文', lesson.sentences.length));
  const ul = el('ul', 'sentence-list');
  for (const s of lesson.sentences) {
    const li = el('li');
    li.appendChild(speakButton(s.ja));
    const wrap = el('div');
    const ja = el('div', 'sentence-ja', s.ja);
    ja.lang = 'ja';
    wrap.appendChild(ja);
    wrap.appendChild(el('div', 'sentence-en', s.meaning));
    li.appendChild(wrap);
    ul.appendChild(li);
  }
  view.appendChild(ul);
}

// ---------- review ----------

const GRADES = [
  { rating: Rating.Again, label: 'もう一度', hint: 'また忘れた', cls: 'again' },
  { rating: Rating.Hard, label: '難しい', hint: 'ぎりぎり', cls: '' },
  { rating: Rating.Good, label: '普通', hint: '思い出せた', cls: '' },
  { rating: Rating.Easy, label: '簡単', hint: '楽勝', cls: '' },
];

async function renderReview() {
  const items = await getAllReviewItems();
  let queue = buildQueue(items);
  const total = queue.length;
  let done = 0;

  function showDone() {
    view.replaceChildren();
    const doneBox = el('div', 'review-done', '今日の復習は終わりです');
    doneBox.appendChild(el('p', 'sub', `${done}枚のカードを復習しました。おつかれさまでした！`));
    view.appendChild(doneBox);
    updateDueBadge();
  }

  function showCard() {
    if (!queue.length) { showDone(); return; }
    const { itemId, kind, data } = queue[0];

    view.replaceChildren();
    view.appendChild(el('p', 'review-status', `のこり ${queue.length} 枚 ・ すんだ ${done} 枚`));

    const card = el('div', 'card');
    card.appendChild(el('div', 'card-tag', kind === 'vocab' ? '単語' : '文法'));
    const front = el('div', `card-front${kind === 'grammar' ? ' is-grammar' : ''}`,
      kind === 'vocab' ? data.word : data.pattern);
    front.lang = 'ja';
    card.appendChild(front);

    const back = el('div', 'card-back');
    back.hidden = true;
    if (kind === 'vocab') {
      back.appendChild(renderPitch(data.reading, data.accent));
      back.appendChild(el('div', 'meaning', data.meaning));
      if (data.note) back.appendChild(el('div', 'example', data.note));
      back.appendChild(speakButton(data.word));
    } else {
      back.appendChild(el('div', 'meaning', data.explanation));
      for (const ex of (data.examples || []).slice(0, 2)) {
        back.appendChild(el('div', 'example', ex));
      }
      if (data.examples?.length) back.appendChild(speakButton(data.examples[0]));
    }
    card.appendChild(back);
    view.appendChild(card);

    const revealBtn = el('button', 'reveal-btn', '答えを見る');
    revealBtn.type = 'button';
    view.appendChild(revealBtn);

    const gradeRow = el('div', 'grade-row');
    gradeRow.hidden = true;
    for (const g of GRADES) {
      const btn = el('button', `grade-btn ${g.cls}`.trim());
      btn.type = 'button';
      btn.textContent = g.label;
      const hint = document.createElement('small');
      hint.textContent = g.hint;
      btn.appendChild(hint);
      btn.addEventListener('click', () => {
        grade(itemId, g.rating);
        done += 1;
        queue.shift();
        // "Again" sends the card to the back of today's session.
        if (g.rating === Rating.Again) { queue.push({ itemId, kind, data }); done -= 1; }
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
    });
  }

  if (!total) { showDone(); return; }
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
    } else if (hash === '#/review') {
      setActiveNav('review');
      await renderReview();
    } else {
      setActiveNav('lessons');
      await renderLessonList();
    }
  } catch (err) {
    view.replaceChildren(el('p', 'empty-note', `読み込みエラー: ${err.message}`));
  }
  updateDueBadge();
}

window.addEventListener('hashchange', route);
route();
