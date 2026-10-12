// 記録画面（ステップ4で中身を作ります）
import { h } from '../ui.js';

export const title = '記録';

export async function render(root) {
  root.append(h('section', { class: 'card' },
    h('p', { class: 'muted' }, 'ここに、達成カレンダーと連続記録が表示されます（準備中）'),
  ));
}
