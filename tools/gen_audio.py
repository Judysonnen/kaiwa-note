#!/usr/bin/env python3
"""Pre-generate natural TTS audio for a lesson using Microsoft Edge neural voices.

Usage: python3 tools/gen_audio.py data/lessons/YYYY-MM-DD.json

Requires: python3 -m pip install --user edge-tts (and network access).

Every Japanese string in the lesson (vocab words, grammar examples, sentences)
becomes data/audio/<fnv1a32-of-text>.mp3. The site computes the same hash in
js/tts.js and plays the file, falling back to browser speech synthesis when a
file is missing, so partially generated audio is never a problem.
"""

import asyncio
import json
import sys
import unicodedata
from pathlib import Path

import edge_tts

VOICE = "ja-JP-NanamiNeural"
RATE = "-10%"  # slightly slow, for learners

ROOT = Path(__file__).resolve().parent.parent
AUDIO_DIR = ROOT / "data" / "audio"


def fnv1a32(text: str) -> str:
    """Must match fnv1a32() in js/tts.js: FNV-1a over UTF-8 bytes of NFC text."""
    h = 0x811C9DC5
    for b in unicodedata.normalize("NFC", text).encode("utf-8"):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"


def lesson_texts(lesson: dict) -> list[str]:
    texts = []
    for v in lesson.get("vocab", []):
        texts.append(v["word"])
        if v.get("note"):
            texts.append(v["note"])
    for g in lesson.get("grammar", []):
        for ex in g.get("examples", []):
            texts.append(ex["ja"] if isinstance(ex, dict) else ex)
    for s in lesson.get("sentences", []):
        texts.append(s["ja"])
    # De-duplicate, keep order.
    seen = set()
    unique = []
    for t in texts:
        if t not in seen:
            seen.add(t)
            unique.append(t)
    return unique


async def generate(texts: list[str]) -> None:
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    todo = [(t, AUDIO_DIR / f"{fnv1a32(t)}.mp3") for t in texts]
    todo = [(t, p) for t, p in todo if not p.exists()]
    print(f"{len(texts)} texts, {len(todo)} to generate")
    for i, (text, path) in enumerate(todo, 1):
        communicate = edge_tts.Communicate(text, VOICE, rate=RATE)
        await communicate.save(str(path))
        print(f"[{i}/{len(todo)}] {path.name}  {text[:36]}")


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    lesson = json.loads(Path(sys.argv[1]).read_text())
    asyncio.run(generate(lesson_texts(lesson)))


if __name__ == "__main__":
    main()
