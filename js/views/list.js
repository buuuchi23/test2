// リスト画面（ステップ2で中身を作ります）
import { h } from '../ui.js';

export const title = 'やりたいことリスト';

export async function render(root) {
  root.append(h('section', { class: 'card' },
    h('p', { class: 'muted' }, 'ここに、カテゴリ別のやりたいことが並びます（準備中）'),
  ));
}
