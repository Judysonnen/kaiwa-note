# Lesson import spec

This is the standing instruction for turning Di's raw lesson notes (pasted from
the teacher's chat) into a lesson JSON file. Any Claude session importing notes
follows this spec so every lesson comes out in the same shape.

## Workflow

1. Di pastes the raw notes and says to import them (optionally with the lesson
   date; default to today's date).
2. Save the raw notes verbatim to `data/raw/YYYY-MM-DD.txt`.
3. Parse them into `data/lessons/YYYY-MM-DD.json` following the rules below.
4. Add the lesson to `data/manifest.json` (append, keep chronological order).
5. Generate audio: `python3 tools/gen_audio.py data/lessons/YYYY-MM-DD.json`
   (needs `edge-tts` installed and network; writes mp3 clips to `data/audio/`).
   If it fails, continue anyway — the site falls back to browser speech.
6. Commit with message `Add lesson YYYY-MM-DD` (English) and push. Cloudflare
   Pages deploys automatically.

## Classification rules

Each line (or small group of lines) of the notes becomes one of:

- **vocab**: single words or short set phrases, often written by the teacher as
  `語（よみ）` or with an English gloss. Includes katakana loanwords and proper
  nouns (writers, book titles).
- **grammar**: patterns and usage notes, e.g. `Verb + たいです`,
  `てform: ongoing action`, contrast notes like `特にないです ≠ 別に`.
  Attach example sentences from the same notes when they clearly illustrate
  the pattern (an example may appear both here and in sentences).
- **sentences**: full conversational sentences worth rereading in context.

When one line contains both a new word and a full sentence, create both a vocab
entry (with the sentence in `note`) and a sentence entry.

## Fields

Vocab: `{ id, word, reading, accent, meaning, meaning_zh, note, note_zh }`
(`meaning_zh` is the Chinese gloss, used as the recall-card prompt)

- `id`: `v01`, `v02`, ... in note order; grammar `g01...`; sentences `s01...`.
- `reading`: kana. For katakana words, repeat the word.
- `accent`: pitch-accent nucleus number (0 = heiban), **only when confident**;
  otherwise `null`. Never guess.
- `meaning`: short English gloss (matches the teacher's style). Keep any emoji
  the teacher used.
- `note`: an example or teacher remark from the notes, else `null`.
- `note_zh`: Chinese translation of `note` when present (notes get audio and
  are displayed like example sentences).

Grammar: `{ id, pattern, explanation, examples, detail }` where `examples` is
an array of `{ ja, zh }` objects (Japanese sentence from the notes plus a
Chinese translation), and `detail` is a Chinese explanation (讲解) written at
import time: 接续方式 (how the pattern attaches or conjugates), core usage,
and any nuance the teacher pointed out. Two to four sentences, aimed at a
beginner.

Sentences: `{ id, ja, meaning, zh, breakdown }` with a short English gloss
(`meaning`), a Chinese translation (`zh`), and `breakdown`: an array of 1-4
Chinese strings walking through the sentence's grammar for a beginner — why
each conjugation/particle/form is used (e.g. why て-form here, why plain ない
before ので). Write these at import time; assume Di has NOT seen the pattern
before. Sentences are reviewed as production cards (Chinese front, Japanese
back), so `zh` should read as a natural prompt for saying the Japanese.

Review is sentences-only (`NEW_MIX` in `js/srs.js`); grammar and vocab are
notebook reference material, and their content should be woven into the
sentence breakdowns.

## Style

- Keep the teacher's original wording wherever possible; this is Di's notebook,
  not a textbook.
- Fix nothing silently: if a note looks like a typo or is ambiguous, keep it
  and flag it to Di in the chat.
- Lesson `title`: a short Japanese phrase summarizing the topic, e.g.
  `趣味と読書の話`.
