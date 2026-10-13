// 設定画面：カテゴリの管理、データのエクスポート／インポート／全削除
import { h, toast, confirmDialog } from '../ui.js';
import { loadCategories, loadWishes } from '../data.js';
import { getMeta } from '../db.js';
import { openCategoryEditor } from '../editors.js';
import { exportData, markExported, saveBackupFile, parseBackup, summarize, importData, deleteAllData } from '../backup.js';

const fmtDateTime = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const title = '設定';

async function appVersion() {
  if (!('caches' in self)) return '―';
  const keys = await caches.keys();
  const k = keys.find((x) => x.startsWith('ikukyu-'));
  return k ? k.replace('ikukyu-', '') : '―';
}

export async function render(root, { rerender, navigate }) {
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

  // データ
  const [prepared, lastExportAt] = await Promise.all([exportData(), getMeta('lastExportAt')]);

  const fileInput = h('input', { type: 'file', class: 'visually-hidden', 'aria-hidden': 'true', tabindex: '-1' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const json = parseBackup(await file.text());
      const n = summarize(json);
      const when = n.exportedAt ? `（${fmtDateTime(n.exportedAt)} に書き出したもの）` : '';
      const ok = await confirmDialog(
        `このファイルを読み込みますか？${when}\n\nカテゴリ ${n.categories}件\nやりたいこと ${n.wishes}件\nタスク ${n.tasks}件\n休息日 ${n.restDays}日\n\n⚠️ この端末の今のデータはすべて消えて、ファイルの内容に置き換わります。`,
        { ok: '読み込む', danger: true });
      if (!ok) return;
      await importData(json);
      toast('読み込みました。データを復元しました');
      navigate('today');
    } catch (err) {
      toast(err.message);
    }
  });

  root.append(h('section', { class: 'card' },
    h('h2', { class: 'card-title' }, '💾 データ'),
    h('p', { class: 'muted small' }, 'データはこの端末の中だけに保存されています。iPhone と iPad の間で移すときや、もしものときのために、ときどき書き出しておくと安心です。'),
    h('p', { class: 'small' }, lastExportAt ? `最後に書き出した日時：${fmtDateTime(lastExportAt)}` : 'まだ書き出したことはありません'),
    h('div', { class: 'btn-col' },
      h('button', {
        type: 'button', class: 'btn btn-block',
        onclick: async () => {
          const result = await saveBackupFile(prepared);
          if (result === 'cancelled') return;
          await markExported();
          toast(result === 'shared' ? '書き出しました' : 'ファイルを保存しました');
          rerender();
        },
      }, '📤 エクスポート（書き出す）'),
      h('p', { class: 'muted small' }, '共有メニューの「“ファイル”に保存」で、iCloud Drive などに保存できます。AirDrop で別の端末に送ることもできます。'),
      h('button', { type: 'button', class: 'btn btn-block btn-outline', onclick: () => fileInput.click() }, '📥 インポート（読み込む）'),
      fileInput,
    ),
  ));

  root.append(h('section', { class: 'card' },
    h('h2', { class: 'card-title' }, '🗑 全データ削除'),
    h('p', { class: 'muted small' }, 'カテゴリ・やりたいこと・タスク・記録をすべて消して、はじめて開いたときの状態に戻します。'),
    h('button', {
      type: 'button', class: 'btn btn-block btn-ghost text-danger',
      onclick: async () => {
        const ok = await confirmDialog('本当にすべてのデータを削除しますか？\n\n消したデータは元に戻せません。必要なら、先に「エクスポート」で書き出しておいてください。',
          { ok: 'すべて削除する', danger: true });
        if (!ok) return;
        await deleteAllData();
        toast('すべてのデータを削除しました');
        navigate('setup');
      },
    }, 'すべてのデータを削除する'),
  ));

  root.append(h('p', { class: 'muted center small' }, `バージョン ${await appVersion()}`));
}
