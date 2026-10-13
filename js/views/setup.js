// 初回だけ出す「ようこそ」画面。はじめるを押すとリスト画面へ
import { h } from '../ui.js';
import { markSetupDone } from '../data.js';

export const title = 'ようこそ';

export async function render(root, { navigate }) {
  root.append(h('section', { class: 'card welcome' },
    h('div', { class: 'welcome-emoji', 'aria-hidden': 'true' }, '🌱'),
    h('h2', {}, '育休中意識高めよう委員会へ', h('br'), 'ようこそ'),
    h('p', {}, '自分で作った「やりたいことリスト」から、毎日のおすすめを出します。'),
    h('p', {}, 'まずは、やりたいことを登録するところから始めましょう。'),
    h('button', {
      type: 'button', class: 'btn btn-block',
      onclick: async () => { await markSetupDone(); navigate('list'); },
    }, 'はじめる'),
  ));
}
