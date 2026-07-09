#!/usr/bin/env python3
"""Validate (and level-fill) the drills in a lesson JSON.

Usage: python3 tools/check_drills.py data/lessons/YYYY-MM-DD.json [--fix]

Every seeded vocab word in drills[].vocab MUST exist in the bundled open
JLPT N5/N4 word lists (tools/data/jlpt_n5.csv, jlpt_n4.csv, from
github.com/elzup/jlpt-word-list, MIT). This is the hard guarantee that
seeded words are core-level; a word not on the lists fails the import.
With --fix, the `level` field is written from the lists.
"""

import csv
import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent / "data"


def load_level(level: str) -> dict:
    words = {}
    with open(DATA / f"jlpt_{level.lower()}.csv", newline="") as f:
        for row in csv.DictReader(f):
            words[row["expression"]] = row
            words[row["reading"]] = row
    return words


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    path = Path(sys.argv[1])
    fix = "--fix" in sys.argv
    lesson = json.loads(path.read_text())
    n5 = load_level("n5")
    n4 = load_level("n4")

    errors = []
    for d in lesson.get("drills", []):
        if not d.get("zh"):
            errors.append(f"{d['id']}: missing zh prompt")
        if not d.get("ja"):
            errors.append(f"{d['id']}: missing ja answer")
        if not d.get("points"):
            errors.append(f"{d['id']}: missing points")
        for v in d.get("vocab", []):
            if v["word"] in n5 or v["reading"] in n5:
                level = "N5"
            elif v["word"] in n4 or v["reading"] in n4:
                level = "N4"
            else:
                errors.append(f"{d['id']}: seed word not in N5/N4 lists: {v['word']}（{v['reading']}）")
                continue
            if fix:
                v["level"] = level
            elif v.get("level") != level:
                errors.append(f"{d['id']}: {v['word']} level should be {level}, got {v.get('level')}")

    if errors:
        print("\n".join(errors))
        sys.exit(f"FAILED: {len(errors)} problem(s)")

    if fix:
        path.write_text(json.dumps(lesson, ensure_ascii=False, indent=2) + "\n")
    n = len(lesson.get("drills", []))
    seeds = sum(len(d.get("vocab", [])) for d in lesson.get("drills", []))
    print(f"OK: {n} drills, {seeds} seed words all on the N5/N4 lists")


if __name__ == "__main__":
    main()
