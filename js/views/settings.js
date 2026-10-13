// 設定画面：カテゴリの管理、データ
import { h, field, openSheet, confirmDialog, toast } from '../ui.js';
import { loadCategories, loadWishes, renameCategory, createCategory, deleteCategory } from '../data.js';

export const title = '設定';

async function appVersion() {
  if (!('caches' in self)) return '―';
  const keys = await caches.keys();
  const k = keys.find((x) => x.startsWith('ikukyu-'));
  return k ? k.replace('ikukyu-', '') : '―';
}

// カテゴリの追加・名前変更・削除
function openCategoryEditor(category, wishCount, { onSaved }) {
  const isNew = !category;
  const name = h('input', { type: 'text', class: 'input', value: category ? category.name : '', placeholder: '例：運動・健康', enterkeyhint: 'done' });
  let close;
  const save = async () => {
    try {
      if (isNew) await createCategory(name.value);
      else await renameCategory(category.id, name.value);
      toast(isNew ? '追加しました' : '保存しました');
      close();
    } catch (err) {
      toast(err.message);
      name.focus();
    }
  };
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); save(); } });
  close = openSheet(isNew ? 'カテゴリを追加' : 'カテゴリを編集', h('div', { class: 'form' },
    field('カテゴリ名', name),
    h('button', { type: 'button', class: 'btn btn-block', onclick: save }, isNew ? '追加する' : '保存する'),
    isNew ? null : h('button', {
      type: 'button', class: 'btn btn-block btn-ghost text-danger',
      onclick: async () => {
        const msg = wishCount
          ? `「${category.name}」を削除しますか？\n中のやりたいこと${wishCount}件は「その他」に移ります。`
          : `「${category.name}」を削除しますか？`;
        if (!(await confirmDialog(msg, { ok: '削除する', danger: true }))) return;
        try {
          const moved = await deleteCategory(category.id);
          toast(moved ? `削除して、${moved}件を「その他」に移しました` : '削除しました');
          close();
        } catch (err) {
          toast(err.message);
        }
      },
    }, '削除する'),
  ), { onClose: onSaved });
  if (isNew) setTimeout(() => name.focus(), 250);
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
