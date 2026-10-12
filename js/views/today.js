// 今日の画面（ステップ3・4で中身を作ります）
import { h } from '../ui.js';
import { todayKey, formatDay } from '../util.js';

export const title = '今日';

export async function render(root) {
  root.append(
    h('p', { class: 'date-label' }, formatDay(todayKey())),
    h('section', { class: 'card' },
      h('h2', { class: 'card-title' }, '今日のおすすめ'),
      h('p', { class: 'muted' }, 'ここに、やりたいことリストからのおすすめが3件表示されます（準備中）'),
    ),
  );
}
