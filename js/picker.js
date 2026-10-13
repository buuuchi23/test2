// 今日のおすすめの選び方
//  - 条件指定なら、空き時間・気分に合うものだけ
//  - カテゴリが偏らないように、まずカテゴリを選んでから中身を選ぶ（3件はなるべく別カテゴリ）
//  - 直近3日（今日・昨日・おととい）に完了したものは出にくくする（完全には外さない）
import { addDays, keyOfTime } from './util.js';

export const MOODS = [
  { v: 'low', label: '疲れてる' },
  { v: 'mid', label: 'ふつう' },
  { v: 'high', label: '元気' },
];

// 気分 → 合う元気度（未設定の元気度はどの気分でもOK）
const MOOD_OK = {
  low: ['low'],
  mid: ['low', 'mid'],
  high: ['low', 'mid', 'high'],
};

const MAX_MINUTES = 120; // 「それ以上」

export function matchesCondition(wish, condition) {
  if (!condition) return true;
  const { minutes, mood } = condition;
  if (minutes != null && minutes < MAX_MINUTES && wish.minutes != null && wish.minutes > minutes) return false;
  if (mood && wish.energy && !MOOD_OK[mood].includes(wish.energy)) return false;
  return true;
}

const RECENT_WEIGHT = 0.15; // 直近3日に完了したもの
const SHOWN_WEIGHT = 0.05;  // 「別のを見る」の直前に出ていたもの

export function isRecentlyDone(wish, today) {
  if (!wish.lastDoneAt) return false;
  return keyOfTime(wish.lastDoneAt) >= addDays(today, -2);
}

function weightOf(wish, today, avoidIds) {
  let w = 1;
  if (isRecentlyDone(wish, today)) w *= RECENT_WEIGHT;
  if (avoidIds.has(wish.id)) w *= SHOWN_WEIGHT;
  return w;
}

function weightedPick(items, weightFn, rand) {
  const total = items.reduce((s, x) => s + weightFn(x), 0);
  let r = rand() * total;
  for (const x of items) {
    r -= weightFn(x);
    if (r < 0) return x;
  }
  return items[items.length - 1];
}

// candidates：対象のやりたいこと（除外中などは呼び出し側で外しておく）
// 戻り値：選んだ wish の id の配列（最大 count 件）
export function pickWishes(candidates, { today, condition = null, avoidIds = [], count = 3, rand = Math.random } = {}) {
  const avoid = new Set(avoidIds);
  let pool = candidates.filter((w) => matchesCondition(w, condition));
  const weight = new Map(pool.map((w) => [w.id, weightOf(w, today, avoid)]));
  const picked = [];
  const usedCats = new Set();

  while (picked.length < count && pool.length) {
    // まだ選んでいないカテゴリを優先（全部使い切ったら同じカテゴリからも選ぶ）
    let usable = pool.filter((w) => !usedCats.has(w.categoryId));
    if (!usable.length) usable = pool;

    // カテゴリを選ぶ：件数の多さに左右されないよう、カテゴリごとに「一番出やすい1件の重み」で比べる
    const byCat = new Map();
    for (const w of usable) {
      if (!byCat.has(w.categoryId)) byCat.set(w.categoryId, []);
      byCat.get(w.categoryId).push(w);
    }
    const cats = [...byCat.keys()];
    const catWeight = (c) => Math.max(...byCat.get(c).map((w) => weight.get(w.id)));
    const cat = weightedPick(cats, catWeight, rand);

    const wish = weightedPick(byCat.get(cat), (w) => weight.get(w.id), rand);
    picked.push(wish.id);
    usedCats.add(cat);
    pool = pool.filter((w) => w.id !== wish.id);
  }
  return picked;
}
