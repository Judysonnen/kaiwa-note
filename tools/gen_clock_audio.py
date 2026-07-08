#!/usr/bin/env python3
"""Pre-generate the component clips for the date/time clock widget.

Usage: python3 tools/gen_clock_audio.py

The kana tables below MUST mirror js/clock.js: the widget chains these exact
strings at playback (dateInfo/timeInfo `parts`), resolving each to an mp3 by
the same FNV-1a hash used everywhere else. Run once; rerunning skips clips
that already exist.
"""

import asyncio

from gen_audio import generate

MONTH_KANA = ['いちがつ', 'にがつ', 'さんがつ', 'しがつ', 'ごがつ', 'ろくがつ',
              'しちがつ', 'はちがつ', 'くがつ', 'じゅうがつ', 'じゅういちがつ', 'じゅうにがつ']

WEEK_KANA = ['にちようび', 'げつようび', 'かようび', 'すいようび',
             'もくようび', 'きんようび', 'どようび']

DAY_KANA = {
    1: 'ついたち', 2: 'ふつか', 3: 'みっか', 4: 'よっか', 5: 'いつか',
    6: 'むいか', 7: 'なのか', 8: 'ようか', 9: 'ここのか', 10: 'とおか',
    14: 'じゅうよっか', 20: 'はつか', 24: 'にじゅうよっか',
}

ONES_KANA = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう']
TENS_KANA = ['', 'じゅう', 'にじゅう', 'さんじゅう', 'よんじゅう', 'ごじゅう']

HOUR_KANA = ['れいじ', 'いちじ', 'にじ', 'さんじ', 'よじ', 'ごじ', 'ろくじ',
             'しちじ', 'はちじ', 'くじ', 'じゅうじ', 'じゅういちじ', 'じゅうにじ']

MIN_ONES = ['', 'いっぷん', 'にふん', 'さんぷん', 'よんぷん', 'ごふん',
            'ろっぷん', 'ななふん', 'はっぷん', 'きゅうふん']


def day_kana(d: int) -> str:
    if d in DAY_KANA:
        return DAY_KANA[d]
    return TENS_KANA[d // 10] + ONES_KANA[d % 10] + 'にち'


def minute_kana(m: int) -> str:
    if m == 0:
        return 'ちょうど'
    tens, ones = divmod(m, 10)
    if ones == 0:
        return TENS_KANA[tens].removesuffix('じゅう') + 'じゅっぷん'
    return TENS_KANA[tens] + MIN_ONES[ones]


def clock_texts() -> list[str]:
    texts = ['きょうは', 'いまは', 'ごぜん', 'ごご']
    texts += MONTH_KANA
    texts += [day_kana(d) for d in range(1, 32)]
    texts += [f'{w}です' for w in WEEK_KANA]
    texts += HOUR_KANA
    texts += [f'{minute_kana(m)}です' for m in range(0, 60)]
    return texts


if __name__ == '__main__':
    # Normal speaking rate: these clips are chained at playback, and the
    # lesson-clip -10% slowdown makes chained speech drag.
    asyncio.run(generate(clock_texts(), rate='+0%', force=True))
