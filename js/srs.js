// Spaced-repetition scheduling on top of ts-fsrs. Card states live in
// localStorage, keyed by "<lessonId>/<entryId>"; lesson content itself
// stays in the repo's JSON files.

import { fsrs, createEmptyCard, Rating } from './vendor/ts-fsrs.mjs';

const STORE_KEY = 'nihongo-note:srs:v1';
const scheduler = fsrs();

export { Rating };

function loadStore() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveStore(store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function reviveCard(raw) {
  const card = { ...raw };
  card.due = new Date(card.due);
  if (card.last_review) card.last_review = new Date(card.last_review);
  return card;
}

export function getCard(itemId) {
  const store = loadStore();
  return store[itemId] ? reviveCard(store[itemId]) : createEmptyCard(new Date());
}

export function isDue(itemId, now = new Date()) {
  const store = loadStore();
  if (!store[itemId]) return true; // never studied
  return new Date(store[itemId].due) <= now;
}

export function grade(itemId, rating, now = new Date()) {
  const card = getCard(itemId);
  const result = scheduler.repeat(card, now)[rating];
  const store = loadStore();
  store[itemId] = result.card;
  saveStore(store);
  return result.card;
}

// Due items first (oldest due first), then never-studied items in lesson order.
export function buildQueue(items, now = new Date()) {
  const store = loadStore();
  const due = [];
  const fresh = [];
  for (const item of items) {
    const raw = store[item.itemId];
    if (!raw) fresh.push(item);
    else if (new Date(raw.due) <= now) due.push({ item, due: new Date(raw.due) });
  }
  due.sort((a, b) => a.due - b.due);
  return [...due.map(d => d.item), ...fresh];
}

export function dueCount(items, now = new Date()) {
  return buildQueue(items, now).length;
}
