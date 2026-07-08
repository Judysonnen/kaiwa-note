# nihongo-note

Static site (no build step): plain HTML + ES modules, deployed to Cloudflare
Pages at nihongo-note.pages.dev. Review scheduling uses the vendored ts-fsrs
bundle in `js/vendor/`; review progress lives in the browser's localStorage,
lesson content lives in `data/`.

When Di pastes lesson notes and asks to import them, follow `IMPORT_SPEC.md`
exactly, then commit and push without asking (push triggers the deploy).
Commit messages in English.

To preview locally: `python3 -m http.server` in the repo root (fetch() needs a
server; opening index.html from file:// will not work).
