// 編集用のシート（やりたいこと・一括登録・タスク）
import { h, field, chips, select, inlineAdd, openSheet, confirmDialog, toast } from './ui.js';
import {
  MINUTES, ENERGY, createCategory, saveWish, deleteWish, setExcluded,
  parseBulk, addWishes, addTask, updateTask, deleteTask, minutesLabel,
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


// タスクを追加（やりたいことリストから選ぶ／新しく入力）
export function openTaskAdder({ categories, wishes, busyWishIds = new Set(), onSaved }) {
  let close;
  const body = h('div', { class: 'form' });

  const fromList = () => {
    const search = h('input', { type: 'search', class: 'input', placeholder: 'さがす', enterkeyhint: 'search' });
    const list = h('div', { class: 'pick-list' });
    const usable = wishes.filter((w) => !w.excluded && !busyWishIds.has(w.id));
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      const hits = usable.filter((w) => !q || w.title.toLowerCase().includes(q));
      if (!hits.length) {
        list.replaceChildren(h('p', { class: 'muted small' },
          usable.length ? '見つかりませんでした' : 'えらべるやりたいことがありません。「新しく入力」から追加できます。'));
        return;
      }
      const groups = categories.map((c) => [c, hits.filter((w) => w.categoryId === c.id)]).filter(([, ws]) => ws.length);
      list.replaceChildren(...groups.map(([c, ws]) => h('div', {},
        h('h3', { class: 'pick-group' }, c.name),
        h('ul', { class: 'wish-list' }, ws.map((w) => h('li', { class: 'wish-row' },
          h('button', {
            type: 'button', class: 'wish-main',
            onclick: async () => {
              await addTask({ title: w.title, categoryId: w.categoryId, wishId: w.id });
              toast('今日のタスクに追加しました');
              close();
            },
          },
          h('span', { class: 'wish-title' }, w.title),
          w.minutes ? h('span', { class: 'wish-meta' }, `⏱ ${minutesLabel(w.minutes)}`) : null),
          h('span', { class: 'row-plus', 'aria-hidden': 'true' }, '＋')))),
      )));
    };
    search.addEventListener('input', draw);
    draw();
    return [search, list];
  };

  const fresh = () => {
    if (!categories.length) {
      return [noCategoryNotice(categories, () => { close(); openTaskAdder({ categories, wishes, busyWishIds, onSaved }); })];
    }
    const title = h('input', { type: 'text', class: 'input', placeholder: '例：郵便局に行く', enterkeyhint: 'done' });
    const cat = categorySelect(categories);
    const save = async () => {
      try {
        await addTask({ title: title.value, categoryId: cat.value });
        toast('今日のタスクに追加しました');
        close();
      } catch (err) {
        toast(err.message);
        title.focus();
      }
    };
    title.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); save(); } });
    setTimeout(() => title.focus(), 50);
    return [
      field('タスク', title),
      field('カテゴリ', cat),
      h('button', { type: 'button', class: 'btn btn-block', onclick: save }, '追加する'),
    ];
  };

  const content = h('div', { class: 'form' });
  const tabs = chips([{ v: 'list', label: '📝 リストから選ぶ' }, { v: 'new', label: '✏️ 新しく入力' }], {
    value: 'list', allowNone: false,
    onChange: (v) => content.replaceChildren(...(v === 'list' ? fromList() : fresh())),
  });
  tabs.el.classList.add('tabs');
  content.replaceChildren(...fromList());
  body.append(tabs.el, content);
  close = openSheet('タスクを追加', body, { onClose: onSaved });
}

// タスクの編集・削除
export function openTaskEditor(task, { categories, onSaved }) {
  let close;
  const title = h('input', { type: 'text', class: 'input', value: task.title, enterkeyhint: 'done' });
  const cat = categorySelect(categories, task.categoryId);
  const save = async () => {
    try {
      await updateTask(task.id, { title: title.value, categoryId: cat.value });
      toast('保存しました');
      close();
    } catch (err) {
      toast(err.message);
    }
  };
  close = openSheet('タスクを編集', h('div', { class: 'form' },
    field('タスク', title),
    field('カテゴリ', cat),
    h('button', { type: 'button', class: 'btn btn-block', onclick: save }, '保存する'),
    h('button', {
      type: 'button', class: 'btn btn-block btn-ghost text-danger',
      onclick: async () => {
        if (!(await confirmDialog(`「${task.title}」を削除しますか？`, { ok: '削除する', danger: true }))) return;
        await deleteTask(task.id);
        toast('削除しました');
        close();
      },
    }, '削除する'),
  ), { onClose: onSaved });
}
