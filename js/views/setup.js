// 初期設定（ステップ2で「なりたい姿」の入力を作ります）
import { h } from '../ui.js';
import { setMeta } from '../db.js';

export const title = 'ようこそ';

export async function render(root, { navigate }) {
  root.append(h('section', { class: 'card welcome' },
    h('div', { class: 'welcome-emoji', 'aria-hidden': 'true' }, '🌱'),
    h('h2', {}, '育休中意識高めよう委員会へ ようこそ'),
    h('p', {}, '毎日すこしずつ、なりたい自分に近づいていきましょう。'),
    h('button', {
      type: 'button', class: 'btn btn-block',
      onclick: async () => { await setMeta('setupDone', true); navigate('today'); },
    }, 'はじめる'),
  ));
}
