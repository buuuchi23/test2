// 達成記録の計算（ヒートマップ・ストリーク・カテゴリ別）
//  - 1日1件以上「完了」または「すすめた」 → 達成日
//  - 休息日はストリークが途切れないが、日数には数えない
//  - 今日まだ達成していないときは、昨日までの連続を表示する
import { addDays, keyOfTime } from './util.js';

// そのタスクに取り組んだ日（完了した日＋すすめた日）
export function activeDays(task) {
  const days = new Set((task.progress || []).map((p) => p.date));
  if (task.completedAt) days.add(keyOfTime(task.completedAt));
  return days;
}

// 日付ごとの「取り組んだタスクの数」（同じタスクは1日1回だけ数える）
export function countByDay(tasks) {
  const map = new Map();
  for (const t of tasks) {
    for (const k of activeDays(t)) map.set(k, (map.get(k) || 0) + 1);
  }
  return map;
}

// 'done' | 'rest' | 'none'
export function dayStatus(date, counts, restDays) {
  if ((counts.get(date) || 0) > 0) return 'done';
  if (restDays.has(date)) return 'rest';
  return 'none';
}

function earliest(counts, restDays) {
  let min = null;
  for (const k of [...counts.keys(), ...restDays]) if (!min || k < min) min = k;
  return min;
}

export function currentStreak(today, counts, restDays) {
  const first = earliest(counts, restDays);
  if (!first) return 0;
  let n = 0;
  // 今日が達成なら今日から、そうでなければ昨日から数える
  let d = dayStatus(today, counts, restDays) === 'done' ? today : addDays(today, -1);
  while (d >= first) {
    const s = dayStatus(d, counts, restDays);
    if (s === 'done') n++;
    else if (s === 'none') break;
    d = addDays(d, -1);
  }
  return n;
}

export function longestStreak(today, counts, restDays) {
  const first = earliest(counts, restDays);
  if (!first) return 0;
  let best = 0;
  let run = 0;
  for (let d = first; d <= today; d = addDays(d, 1)) {
    const s = dayStatus(d, counts, restDays);
    if (s === 'done') { run++; best = Math.max(best, run); }
    else if (s === 'none' && d !== today) run = 0; // 今日まだ未達成なのは途切れ扱いにしない
  }
  return best;
}

// ヒートマップの色の段階（0〜4）
export function heatLevel(count) {
  return Math.min(count, 4);
}
