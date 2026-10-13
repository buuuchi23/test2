// 設定画面：カテゴリの管理、データ
import { h } from '../ui.js';
import { loadCategories, loadWishes } from '../data.js';
import { openCategoryEditor } from '../editors.js';

export const title = '設定';

async function appVersion() {
  if (!('caches' in self)) return '―';
  const keys = await caches.keys();
  const k = keys.find((x) => x.startsWith('ikukyu-'));
  return k ? k.replace('ikukyu-', '') : '―';
}

export async function render(root, { rerender }) {
  const [categories, wishes] = await Promise.all([loadCategories(), loadWishes()]);
  const countIn = (id) => wishes.filter((w) => w.categoryId === id).length;

  // カテゴリ
  root.append(h('section', { class: 'card' },
    h('h2', { class: 'card-title' }, '🗂 カテゴリ'),
    categories.length
      ? h('ul', { class: 'row-list' }, categories.map((c) => h('li', {}, h('button', {
        type: 'button', class: 'row-btn',
        onclick: () => openCategoryEditor(c, countIn(c.id), { onSaved: rerender }),
      },
      h('span', { class: 'row-title' }, c.name),
      h('span', { class: 'row-sub' }, `${countIn(c.id)}件`),
      h('span', { class: 'chev', 'aria-hidden': 'true' }, '›')))))
      : h('p', { class: 'muted' }, 'カテゴリがありません。'),
    h('button', {
      type: 'button', class: 'btn btn-block btn-outline',
      onclick: () => openCategoryEditor(null, 0, { onSaved: rerender }),
    }, '＋ カテゴリを追加'),
  ));

  // データ（ステップ5でエクスポート／インポートを追加）
  root.append(h('section', { class: 'card' },
    h('h2', { class: 'card-title' }, '💾 データ'),
    h('p', { class: 'muted small' }, 'データはこの端末の中だけに保存されています。'),
  ));

  root.append(h('p', { class: 'muted center small' }, `バージョン ${await appVersion()}`));
}
