// リスト画面：カテゴリ別のやりたいこと一覧・追加・一括追加・編集・除外中
import { h, emptyState, toast } from '../ui.js';
import { loadCategories, loadWishes, setExcluded, minutesLabel, energyLabel } from '../data.js';
import { openWishEditor, openBulkAdd } from '../editors.js';

export const title = 'やりたいことリスト';

let excludedOpen = false; // 「除外中」を開いたままにしておく

// 一覧の1行（タップで編集）
export function wishRow(w, onTap, trailing) {
  const meta = [
    w.minutes ? `⏱ ${minutesLabel(w.minutes)}` : null,
    w.energy ? `🔋 ${energyLabel(w.energy)}` : null,
    w.memo ? '📎 メモ' : null,
  ].filter(Boolean);
  return h('li', { class: 'wish-row' },
    h('button', { type: 'button', class: 'wish-main', onclick: onTap },
      h('span', { class: 'wish-title' }, w.title),
      meta.length ? h('span', { class: 'wish-meta' }, meta.join('　')) : null,
    ),
    trailing || null,
  );
}

export async function render(root, { rerender }) {
  const [categories, wishes] = await Promise.all([loadCategories(), loadWishes()]);
  const active = wishes.filter((w) => !w.excluded);
  const excluded = wishes.filter((w) => w.excluded);

  const edit = (w) => openWishEditor(w, { categories, onSaved: rerender });
  const add = (categoryId) => openWishEditor(null, { categories, categoryId, onSaved: rerender });
  const bulk = (categoryId) => openBulkAdd({ categories, categoryId, onSaved: rerender });

  root.append(h('div', { class: 'btn-row sticky-actions' },
    h('button', { type: 'button', class: 'btn', onclick: () => add() }, '＋ 追加'),
    h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => bulk() }, '📋 まとめて追加'),
  ));

  if (!wishes.length) {
    root.append(h('section', { class: 'card' }, emptyState('🌱',
      'やりたいことを登録しましょう。小さなことでも大丈夫です。メモ帳に書いたものを「まとめて追加」で貼り付けると、一気に登録できます。',
      h('button', { type: 'button', class: 'btn btn-block', onclick: () => bulk() }, '📋 まとめて追加する'))));
  } else {
    root.append(h('p', { class: 'muted small center' }, `おすすめ対象 ${active.length}件`));
  }

  const known = new Set(categories.map((c) => c.id));
  const groups = categories.map((c) => ({ id: c.id, name: c.name, items: active.filter((w) => w.categoryId === c.id) }));
  const orphans = active.filter((w) => !known.has(w.categoryId));
  if (orphans.length) groups.push({ id: null, name: 'カテゴリなし', items: orphans });

  for (const g of groups) {
    root.append(h('section', { class: 'card cat-group' },
      h('div', { class: 'cat-head' },
        h('h2', { class: 'card-title' }, g.name, h('span', { class: 'count' }, ` ${g.items.length}`)),
        g.id ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': `${g.name}に追加`, onclick: () => add(g.id) }, '＋') : null,
      ),
      g.items.length
        ? h('ul', { class: 'wish-list' }, g.items.map((w) => wishRow(w, () => edit(w))))
        : h('p', { class: 'muted small' }, 'まだありません'),
    ));
  }

  if (excluded.length) {
    root.append(h('details', { class: 'card excluded', open: excludedOpen, ontoggle: (e) => { excludedOpen = e.target.open; } },
      h('summary', {}, `除外中（${excluded.length}件）`),
      h('p', { class: 'muted small' }, '「もういい」にしたものです。おすすめには出ません。'),
      h('ul', { class: 'wish-list' }, excluded.map((w) => wishRow(w, () => edit(w),
        h('button', {
          type: 'button', class: 'btn btn-small btn-outline',
          onclick: async () => { await setExcluded(w.id, false); toast('おすすめに戻しました'); rerender(); },
        }, '戻す')))),
    ));
  }
}
