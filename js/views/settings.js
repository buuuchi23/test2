// 設定画面
import { h } from '../ui.js';
import { getAll } from '../db.js';

export const title = '設定';

async function appVersion() {
  if (!('caches' in self)) return '―';
  const keys = await caches.keys();
  const k = keys.find((x) => x.startsWith('ikukyu-'));
  return k ? k.replace('ikukyu-', '') : '―';
}

export async function render(root) {
  const categories = await getAll('categories');
  categories.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  root.append(
    h('section', { class: 'card' },
      h('h2', { class: 'card-title' }, 'データの保存'),
      h('p', {}, `この端末に保存されています。カテゴリ：${categories.length}件`),
      h('ul', { class: 'plain-list' }, categories.map((c) => h('li', {}, c.name))),
    ),
    h('p', { class: 'muted center small' }, `バージョン ${await appVersion()}`),
  );
}
