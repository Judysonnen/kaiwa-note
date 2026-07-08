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
5. Commit with message `Add lesson YYYY-MM-DD` (English) and push. Cloudflare
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

Vocab: `{ id, word, reading, accent, meaning, note }`

- `id`: `v01`, `v02`, ... in note order; grammar `g01...`; sentences `s01...`.
- `reading`: kana. For katakana words, repeat the word.
- `accent`: pitch-accent nucleus number (0 = heiban), **only when confident**;
  otherwise `null`. Never guess.
- `meaning`: short English gloss (matches the teacher's style). Keep any emoji
  the teacher used.
- `note`: an example or teacher remark from the notes, else `null`.

Grammar: `{ id, pattern, explanation, examples }` where `examples` is an array
of Japanese sentences from the notes.

Sentences: `{ id, ja, meaning }` with a short English translation.

## Style

- Keep the teacher's original wording wherever possible; this is Di's notebook,
  not a textbook.
- Fix nothing silently: if a note looks like a typo or is ambiguous, keep it
  and flag it to Di in the chat.
- Lesson `title`: a short Japanese phrase summarizing the topic, e.g.
  `趣味と読書の話`.
