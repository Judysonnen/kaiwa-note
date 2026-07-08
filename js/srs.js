// Spaced-repetition scheduling on top of ts-fsrs. Card states live in
// localStorage, keyed by "<lessonId>/<entryId>"; lesson content itself
// stays in the repo's JSON files.
//
// New cards are drip-fed with a per-kind daily mix. Grammar and sentences
// are the core of conversation practice, vocab is supporting material, so the mix
// weights them accordingly and the queue serves grammar/sentences first.

import { fsrs, createEmptyCard, Rating } from './vendor/ts-fsrs.mjs';

const STORE_KEY = 'kaiwa-note:srs:v1';
const META_KEY = 'kaiwa-note:meta:v1';

export const NEW_MIX = { grammar: 3, sentence: 4, vocab: 3 };
export const NEW_PER_DAY = Object.values(NEW_MIX).reduce((a, b) => a + b, 0);
const KIND_ORDER = ['grammar', 'sentence', 'vocab'];

const scheduler = fsrs();

export { Rating };

function loadJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || {};
  } catch {
    return {};
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function todayKey(now = new Date()) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadMeta() {
  const meta = loadJson(META_KEY);
  meta.intro = meta.intro || {};   // dateKey -> { kind: count } introduced that day
  meta.stamps = meta.stamps || []; // dateKeys with a completed session
  return meta;
}

function introToday(meta, now) {
  const raw = meta.intro[todayKey(now)];
  // Older versions stored a plain number; treat it as already-used allowance.
  if (typeof raw === 'number') return { grammar: raw, sentence: raw, vocab: raw };
  return raw || {};
}

function reviveCard(raw) {
  const card = { ...raw };
  card.due = new Date(card.due);
  if (card.last_review) card.last_review = new Date(card.last_review);
  return card;
}

export function getCard(itemId) {
  const store = loadJson(STORE_KEY);
  return store[itemId] ? reviveCard(store[itemId]) : createEmptyCard(new Date());
}

export function grade(itemId, rating, kind = 'vocab', now = new Date()) {
  const store = loadJson(STORE_KEY);
  if (!store[itemId]) {
    // First study of this card: count it against today's per-kind quota.
    const meta = loadMeta();
    const key = todayKey(now);
    const day = introToday(meta, now);
    day[kind] = (day[kind] || 0) + 1;
    meta.intro[key] = day;
    saveJson(META_KEY, meta);
  }
  const card = store[itemId] ? reviveCard(store[itemId]) : createEmptyCard(now);
  const result = scheduler.repeat(card, now)[rating];
  store[itemId] = result.card;
  saveJson(STORE_KEY, store);
  return result.card;
}

// Today's queue: every due card (oldest first), then fresh cards by kind
// priority (grammar, sentence, vocab), each capped by its daily allowance.
export function buildQueue(items, now = new Date()) {
  const store = loadJson(STORE_KEY);
  const meta = loadMeta();
  const used = introToday(meta, now);

  const due = [];
  const fresh = { grammar: [], sentence: [], vocab: [] };
  for (const item of items) {
    const raw = store[item.itemId];
    if (!raw) fresh[item.kind]?.push(item);
    else if (new Date(raw.due) <= now) due.push({ item, due: new Date(raw.due) });
  }
  due.sort((a, b) => a.due - b.due);

  const queue = due.map(d => d.item);
  for (const kind of KIND_ORDER) {
    const allowance = Math.max(0, NEW_MIX[kind] - (used[kind] || 0));
    queue.push(...fresh[kind].slice(0, allowance));
  }
  return queue;
}

export function dueCount(items, now = new Date()) {
  return buildQueue(items, now).length;
}

// How many unseen cards exist in total (tomorrow's material and beyond).
export function unseenCount(items) {
  const store = loadJson(STORE_KEY);
  return items.filter(i => !store[i.itemId]).length;
}

// Earliest future due date among studied cards, for the "all done" screen.
export function nextDueDate(items, now = new Date()) {
  const store = loadJson(STORE_KEY);
  let next = null;
  for (const item of items) {
    const raw = store[item.itemId];
    if (!raw) continue;
    const due = new Date(raw.due);
    if (due > now && (!next || due < next)) next = due;
  }
  return next;
}

// ---------- stamp card ----------

export function addStamp(now = new Date()) {
  const meta = loadMeta();
  const key = todayKey(now);
  if (!meta.stamps.includes(key)) {
    meta.stamps.push(key);
    saveJson(META_KEY, meta);
  }
}

export function getStamps() {
  return new Set(loadMeta().stamps);
}

export function streakLength(now = new Date()) {
  const stamps = getStamps();
  let streak = 0;
  const d = new Date(now);
  // Today counts if stamped; otherwise start counting from yesterday.
  if (!stamps.has(todayKey(d))) d.setDate(d.getDate() - 1);
  while (stamps.has(todayKey(d))) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
