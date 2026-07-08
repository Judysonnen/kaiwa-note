# かいわノート

My Japanese lessons are one-on-one conversation practice, and the notes that
come out of them are wonderful but messy: new words, grammar patterns and
half-sentences typed into a chat window as the conversation moves. This site
turns those notes into something I can actually study from.

After each lesson I paste the raw notes into Claude Code, which parses them
into vocabulary, grammar points and example sentences (see `IMPORT_SPEC.md`),
saves them under `data/`, and pushes. Cloudflare Pages redeploys, and the new
lesson shows up here with furigana, pitch-accent marks and a speaker button
that reads everything aloud with the browser's Japanese voice.

The 復習 tab is a flashcard queue scheduled with FSRS (the algorithm behind
modern Anki), using the ts-fsrs bundle vendored in `js/vendor/`. Progress is
stored in localStorage, so reviews are per-browser; the lesson content itself
is just JSON files in this repo.

There is no build step. Serve the folder with `python3 -m http.server` and it
runs.
