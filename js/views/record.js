// 記録画面：連続記録、達成カレンダー（ヒートマップ）、カテゴリ別の達成数
import { h, chips } from '../ui.js';
import { todayKey, dateKey, formatDay, keyOfTime } from '../util.js';
import { loadCategories, loadTasks, loadRestDays } from '../data.js';
import { countByDay, dayStatus, currentStreak, longestStreak, heatLevel } from '../stats.js';

export const title = '記録';

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

// 画面を描き直しても覚えておくもの
const state = { month: null, selected: null, catPeriod: 'month' };

const monthKey = (key) => key.slice(0, 7); // "2026-10"

export async function render(root, { rerender }) {
  const today = todayKey();
  const [categories, tasks, restDays] = await Promise.all([loadCategories(), loadTasks(), loadRestDays()]);
  const counts = countByDay(tasks);
  const done = tasks.filter((t) => t.completedAt);

  if (!state.month || state.month > monthKey(today)) state.month = monthKey(today);
  const [y, m] = state.month.split('-').map(Number);

  // ---- 数字のまとめ ----
  const thisMonth = monthKey(today);
  const monthDays = [...counts.keys()].filter((k) => monthKey(k) === thisMonth).length;
  const tile = (label, value, unit) => h('div', { class: 'tile' },
    h('span', { class: 'tile-label' }, label),
    h('span', { class: 'tile-value' }, String(value), h('small', {}, unit)));
  root.append(h('section', { class: 'tiles' },
    tile('🔥 連続達成', currentStreak(today, counts, restDays), '日'),
    tile('🏆 最長記録', longestStreak(today, counts, restDays), '日'),
    tile('📅 今月の達成日', monthDays, '日'),
    tile('✅ これまでの完了', done.length, '件'),
  ));

  // ---- 達成カレンダー ----
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const earliestData = [...counts.keys(), ...restDays].sort()[0] || today;
  const canPrev = `${y}-${String(m).padStart(2, '0')}` > monthKey(earliestData);
  const canNext = state.month < thisMonth;
  const shiftMonth = (n) => {
    state.month = dateKey(new Date(y, m - 1 + n, 1)).slice(0, 7);
    state.selected = null;
    rerender();
  };

  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(h('span', { class: 'cal-cell blank', 'aria-hidden': 'true' }));
  for (let d = 1; d <= daysInMonth; d++) {
    const key = dateKey(new Date(y, m - 1, d));
    const n = counts.get(key) || 0;
    const status = dayStatus(key, counts, restDays);
    const future = key > today;
    const cls = ['cal-cell', `heat-${heatLevel(n)}`];
    if (status === 'rest') cls.push('rest');
    if (key === today) cls.push('today');
    if (future) cls.push('future');
    if (state.selected === key) cls.push('selected');
    const label = `${formatDay(key)} ${status === 'rest' ? '休息日' : `完了${n}件`}`;
    cells.push(h('button', {
      type: 'button', class: cls.join(' '), 'aria-label': label, disabled: future,
      onclick: () => { state.selected = state.selected === key ? null : key; rerender(); },
    }, h('span', { class: 'cal-day' }, String(d)),
    status === 'rest' ? h('span', { class: 'cal-mark', 'aria-hidden': 'true' }, '🌙') : null));
  }

  const calCard = h('section', { class: 'card' },
    h('div', { class: 'cal-head' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': '前の月', disabled: !canPrev, onclick: () => shiftMonth(-1) }, '‹'),
      h('h2', { class: 'card-title' }, `${y}年${m}月`),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': '次の月', disabled: !canNext, onclick: () => shiftMonth(1) }, '›')),
    h('div', { class: 'cal-grid cal-week', 'aria-hidden': 'true' }, WEEK.map((w) => h('span', {}, w))),
    h('div', { class: 'cal-grid' }, cells),
    h('div', { class: 'legend' },
      h('span', {}, '少ない'),
      [0, 1, 2, 3, 4].map((l) => h('span', { class: `swatch heat-${l}`, title: l === 4 ? '4件以上' : `${l}件` })),
      h('span', {}, '多い'),
      h('span', { class: 'legend-rest' }, h('span', { class: 'swatch rest' }), '🌙 休息日')),
  );

  // タップした日の中身
  if (state.selected) {
    const key = state.selected;
    const list = done.filter((t) => keyOfTime(t.completedAt) === key);
    const catName = new Map(categories.map((c) => [c.id, c.name]));
    calCard.append(h('div', { class: 'day-detail' },
      h('h3', {}, formatDay(key)),
      list.length
        ? h('ul', { class: 'plain-list' }, list.map((t) => h('li', {}, t.title, h('span', { class: 'muted small' }, ` ${catName.get(t.categoryId) || ''}`))))
        : h('p', { class: 'muted' }, restDays.has(key) ? '休息日でした 🌙' : '完了したタスクはありません'),
    ));
  } else {
    calCard.append(h('p', { class: 'muted small center' }, '日付をタップすると、その日にやったことが見られます'));
  }
  root.append(calCard);

  // ---- カテゴリ別の達成数 ----
  const inPeriod = state.catPeriod === 'month' ? done.filter((t) => monthKey(keyOfTime(t.completedAt)) === thisMonth) : done;
  const perCat = categories.map((c) => ({ name: c.name, n: inPeriod.filter((t) => t.categoryId === c.id).length }));
  const known = new Set(categories.map((c) => c.id));
  const orphan = inPeriod.filter((t) => !known.has(t.categoryId)).length;
  if (orphan) perCat.push({ name: 'カテゴリなし', n: orphan });
  perCat.sort((a, b) => b.n - a.n);
  const maxN = Math.max(1, ...perCat.map((c) => c.n));

  const period = chips([{ v: 'month', label: '今月' }, { v: 'all', label: 'これまで' }], {
    value: state.catPeriod, allowNone: false,
    onChange: (v) => { state.catPeriod = v; rerender(); },
  });
  period.el.classList.add('tabs', 'tabs-small');
  root.append(h('section', { class: 'card' },
    h('h2', { class: 'card-title' }, '🗂 カテゴリ別の達成数'),
    period.el,
    inPeriod.length
      ? h('ul', { class: 'bars' }, perCat.map((c) => h('li', { class: 'bar-row' },
        h('span', { class: 'bar-name' }, c.name),
        h('span', { class: 'bar-track' }, h('span', { class: 'bar-fill', style: { width: `${(c.n / maxN) * 100}%` } })),
        h('span', { class: 'bar-n' }, `${c.n}件`))))
      : h('p', { class: 'muted' }, state.catPeriod === 'month' ? '今月はまだ完了したタスクがありません。' : 'まだ完了したタスクがありません。'),
  ));

}
