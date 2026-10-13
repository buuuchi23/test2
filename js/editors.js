// 編集用のシート（やりたいこと・一括登録）
import { h, field, chips, select, inlineAdd, openSheet, confirmDialog, toast } from './ui.js';
import {
  MINUTES, ENERGY, createCategory, saveWish, deleteWish, setExcluded,
  parseBulk, addWishes,
} from './data.js';

function categorySelect(categories, value) {
  return select(categories.map((c) => ({ v: c.id, label: c.name })), value || (categories[0] && categories[0].id));
}

// カテゴリが1つもないときの案内（作るとシートを開き直す）
function noCategoryNotice(categories, reopen) {
  return h('div', { class: 'card notice' },
    h('p', {}, 'まずはカテゴリを1つ作りましょう。'),
    inlineAdd('カテゴリ名（例：学習）', '＋ 作る', async (name) => {
      categories.push(await createCategory(name));
      reopen();
    }),
  );
}

// やりたいことの追加・編集
export function openWishEditor(wish, { categories, categoryId, onSaved }) {
  const isNew = !wish;
  const w = wish || { categoryId };
  let close;
  const reopen = () => { close(); openWishEditor(wish, { categories, categoryId, onSaved }); };

  if (!categories.length) {
    close = openSheet('やりたいことを追加', noCategoryNotice(categories, reopen), { onClose: onSaved });
    return;
  }

  const title = h('input', { type: 'text', class: 'input', value: w.title || '', placeholder: '例：NISAの本を1章読む', enterkeyhint: 'done' });
  const cat = categorySelect(categories, w.categoryId);
  const minutes = chips(MINUTES, { value: w.minutes ?? null });
  const energy = chips(ENERGY, { value: w.energy ?? null });
  const memo = h('textarea', { class: 'input', rows: 3, placeholder: '参考URLなど（なくてもOK）' });
  memo.value = w.memo || '';

  const save = async () => {
    try {
      await saveWish({ ...w, title: title.value, categoryId: cat.value, minutes: minutes.value, energy: energy.value, memo: memo.value });
      toast(isNew ? '登録しました' : '保存しました');
      close();
    } catch (err) {
      toast(err.message);
      title.focus();
    }
  };
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); title.blur(); } });

  const extra = isNew ? null : h('div', { class: 'btn-col' },
    h('button', {
      type: 'button', class: 'btn btn-ghost',
      onclick: async () => {
        await setExcluded(w.id, !w.excluded);
        toast(w.excluded ? 'おすすめに戻しました' : 'おすすめから外しました');
        close();
      },
    }, w.excluded ? '↩︎ おすすめに戻す' : '🙆 もういい（おすすめから外す）'),
    h('button', {
      type: 'button', class: 'btn btn-ghost text-danger',
      onclick: async () => {
        if (!(await confirmDialog(`「${w.title}」を削除しますか？`, { ok: '削除する', danger: true }))) return;
        await deleteWish(w.id);
        toast('削除しました');
        close();
      },
    }, '削除する'),
  );

  close = openSheet(isNew ? 'やりたいことを追加' : 'やりたいことを編集', h('div', { class: 'form' },
    field('タイトル（必須）', title),
    field('カテゴリ', cat),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, '目安時間'), minutes.el,
      h('span', { class: 'field-hint' }, '選ばないと「いつでも」扱いになります')),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, '元気度'), energy.el,
      h('span', { class: 'field-hint' }, '選ばないと「どれでも」扱いになります')),
    field('メモ', memo),
    h('button', { type: 'button', class: 'btn btn-block', onclick: save }, isNew ? '登録する' : '保存する'),
    extra,
  ), { onClose: onSaved });
  if (isNew) setTimeout(() => title.focus(), 250);
}

// 1行1件でまとめて登録
export function openBulkAdd({ categories, categoryId, onSaved }) {
  let close;
  const reopen = () => { close(); openBulkAdd({ categories, categoryId, onSaved }); };
  if (!categories.length) {
    close = openSheet('まとめて追加', noCategoryNotice(categories, reopen), { onClose: onSaved });
    return;
  }
  const text = h('textarea', {
    class: 'input', rows: 8,
    placeholder: 'NISAの本を1章読む\n英単語を20個覚える\n散歩しながら写真を撮る',
  });
  const cat = categorySelect(categories, categoryId);
  const submit = h('button', { type: 'button', class: 'btn btn-block', disabled: true }, '登録する');
  const update = () => {
    const n = parseBulk(text.value).length;
    submit.disabled = n === 0;
    submit.textContent = n ? `${n}件を登録する` : '登録する';
  };
  text.addEventListener('input', update);
  submit.addEventListener('click', async () => {
    const titles = parseBulk(text.value);
    if (!titles.length) return;
    try {
      await addWishes(titles, cat.value);
      toast(`${titles.length}件を登録しました`);
      close();
    } catch (err) {
      toast(err.message);
    }
  });
  close = openSheet('まとめて追加', h('div', { class: 'form' },
    field('やりたいこと（1行に1つ）', text, 'メモ帳などからそのまま貼り付けられます。空の行は無視されます。'),
    field('カテゴリ', cat),
    h('p', { class: 'muted small' }, '目安時間・元気度は、あとから1件ずつ設定できます。'),
    submit,
  ), { onClose: onSaved });
  setTimeout(() => text.focus(), 250);
}

