# kaiwa-note

Static site (no build step): plain HTML + ES modules, deployed to Cloudflare
Pages at kaiwa-note.pages.dev. Review scheduling uses the vendored ts-fsrs
bundle in `js/vendor/`; review progress lives in the browser's localStorage,
lesson content lives in `data/`. Audio clips in `data/audio/` are
pre-generated neural TTS (tools/gen_audio.py, edge-tts, filenames are FNV-1a
hashes of the text); the site falls back to browser speech synthesis for any
text without a clip.

When Di pastes lesson notes and asks to import them, follow `IMPORT_SPEC.md`
exactly, then commit and push without asking (push triggers the deploy).
Commit messages in English.

To preview locally: `python3 -m http.server` in the repo root (fetch() needs a
server; opening index.html from file:// will not work).
## Cloud sync (optional)

Review progress lives in localStorage; the Pages Function in
functions/api/state.js backs it up to Cloudflare KV so devices share
progress. One-time setup in the Cloudflare dashboard: create a KV
namespace, bind it to the Pages project as `STATE`, set a secret env
var `SYNC_TOKEN`, redeploy, then tap 同期 in the site footer on each
device and enter the token. Without setup the site stays local-only.
