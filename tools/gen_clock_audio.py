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
TENS_KANA = ['', 'じゅう', 'にじゅう', 'さんじゅう', 'よんじゅう', 'ごじゅう',
             'ろくじゅう', 'ななじゅう', 'はちじゅう', 'きゅうじゅう']

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


# Fixed interface phrases (jaLine targets in js/main.js). Dynamic strings
# (counts, dates) fall back to system speech when tapped.
UI_TEXTS = [
    'きょうのぶんは、おしまい！', 'きょうは何もありません', 'きょうのぶん',
    'はじめる', 'もっとやる', '答えを見る', 'つぎへ', 'もう一度', 'できた',
    '日本語で言ってみましょう', '日本語は？',
    'おつかれさま！', 'ナイス！', '完璧だ！', '今日も勝ち。',
    '継続は力なり。', 'すばらしい！', 'その調子！', 'やるじゃん！',
]

# Dynamic lines have a small bounded range: generate every variant so the
# exact string always resolves to a clip (strings must match js/main.js).
UI_TEXTS += [f'あしたは新しいカードが{n}枚とどきます' for n in range(1, 11)]
UI_TEXTS += [f'約{m}分でおわります' for m in range(1, 21)]


def num_kana(n: int) -> str:
    if n == 0:
        return 'ゼロ'
    return TENS_KANA[n // 10] + ONES_KANA[n % 10]


# Progress-line components: chained as
# ぜんぶで / <num> / 勉強したのは / <num> / のこりは / <num>です
UI_TEXTS += ['ぜんぶで', '勉強したのは', 'のこりは',
             'ぜんぶ勉強しました！あとは復習だけです']
UI_TEXTS += [num_kana(n) for n in range(1, 100)]
UI_TEXTS += [f'{num_kana(n)}です' for n in range(1, 100)]

if __name__ == '__main__':
    # Normal speaking rate: these clips are chained at playback, and the
    # lesson-clip -10% slowdown makes chained speech drag.
    asyncio.run(generate(clock_texts() + UI_TEXTS, rate='+0%'))
