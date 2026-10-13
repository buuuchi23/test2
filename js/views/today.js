// 今日の画面：おすすめ3件（おまかせ／条件指定）と今日のタスク
import { h, chips, toast, linkify, emptyState } from '../ui.js';
import { todayKey, formatDay, keyOfTime, parseKey } from '../util.js';
import {
  MINUTES, loadCategories, loadWishes, loadTasks, addTask, setTaskDone,
  loadDailyPick, saveDailyPick, minutesLabel, energyLabel,
} from '../data.js';
import { pickWishes, MOODS } from '../picker.js';
import { openWishEditor, openTaskAdder, openTaskEditor } from '../editors.js';

export const title = '今日';

const CHEERS = ['やったね！🎉', 'えらい！✨', 'ナイス！👏', '今日も一歩前進🌱', 'すばらしい！💮'];

const conditionReady = (p) => p.mode !== 'condition' || (p.condition && p.condition.minutes != null && p.condition.mood);

export async function render(root, { rerender }) {
  const today = todayKey();
  const [categories, wishes, tasks] = await Promise.all([loadCategories(), loadWishes(), loadTasks()]);
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const wishById = new Map(wishes.map((w) => [w.id, w]));

  // 今日のタスク：未完了すべて（前の日からの持ち越し含む）＋今日完了したもの
  const openTasks = tasks.filter((t) => !t.completedAt);
  const doneToday = tasks.filter((t) => t.completedAt && keyOfTime(t.completedAt) === today)
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const busyWishIds = new Set(openTasks.filter((t) => t.wishId).map((t) => t.wishId));
  const doneTodayWishIds = new Set(doneToday.filter((t) => t.wishId).map((t) => t.wishId));

  // おすすめの候補：除外中と、すでに未完了タスクになっているものは外す
  const activeWishes = wishes.filter((w) => !w.excluded);
  const candidates = activeWishes.filter((w) => !busyWishIds.has(w.id));
  const isShowable = (id) => wishById.has(id) && !wishById.get(id).excluded;

  const generate = (pick, avoidIds = []) => ({
    ...pick,
    wishIds: pickWishes(candidates, { today, condition: pick.mode === 'condition' ? pick.condition : null, avoidIds }),
  });

  // その日最初に開いたときに3件決めて保存。中身が全部なくなっていたら選び直す
  let pick = await loadDailyPick(today);
  if (!pick) {
    pick = generate({ date: today, mode: 'auto', condition: null });
    await saveDailyPick(pick);
  } else if (conditionReady(pick) && !pick.wishIds.some(isShowable) && candidates.length) {
    const next = generate(pick);
    if (next.wishIds.length) { pick = next; await saveDailyPick(pick); }
  }

  const update = async (next) => { await saveDailyPick(next); rerender(); };
  const addWish = () => openWishEditor(null, { categories, onSaved: rerender });

  root.append(h('p', { class: 'date-label' }, formatDay(today)));

  // ---- おすすめ ----
  const modeTabs = chips([{ v: 'auto', label: '🎲 おまかせ' }, { v: 'condition', label: '🎯 条件指定' }], {
    value: pick.mode, allowNone: false,
    onChange: (mode) => {
      if (mode === 'auto') update(generate({ ...pick, mode: 'auto', condition: null }));
      else {
        const p = { ...pick, mode: 'condition', condition: pick.condition || { minutes: null, mood: null } };
        update(conditionReady(p) ? generate(p) : p);
      }
    },
  });
  modeTabs.el.classList.add('tabs');

  const recCard = h('section', { class: 'card' },
    h('h2', { class: 'card-title' }, '✨ 今日のおすすめ'),
    modeTabs.el);

  if (pick.mode === 'condition') {
    const cond = pick.condition || { minutes: null, mood: null };
    const setCond = (patch) => {
      const p = { ...pick, condition: { ...cond, ...patch } };
      update(conditionReady(p) ? generate(p) : p);
    };
    recCard.append(h('div', { class: 'cond' },
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, '⏱ 空き時間'),
        chips(MINUTES, { value: cond.minutes, allowNone: false, onChange: (v) => setCond({ minutes: v }) }).el),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, '🔋 いまの気分'),
        chips(MOODS, { value: cond.mood, allowNone: false, onChange: (v) => setCond({ mood: v }) }).el),
    ));
  }

  if (!conditionReady(pick)) {
    recCard.append(h('p', { class: 'muted center hint' }, '空き時間と気分を選ぶと、合うものを3つ選びます 👆'));
  } else {
    const ids = pick.wishIds.filter(isShowable);
    if (!ids.length) {
      let msg;
      if (!activeWishes.length) msg = 'やりたいことリストが空っぽです。まずは1つ登録してみましょう。';
      else if (pick.mode === 'condition' && candidates.length) msg = '条件に合うやりたいことが見つかりませんでした。条件を変えるか、やりたいことを追加してみましょう。';
      else msg = 'いまおすすめできるものがありません。リストのやりたいことは、すべてタスクになっています。';
      recCard.append(emptyState('🌱', msg,
        h('button', { type: 'button', class: 'btn btn-block', onclick: addWish }, '＋ やりたいことを追加する')));
    } else {
      recCard.append(h('ul', { class: 'picks' }, ids.map((id) => pickCard(wishById.get(id)))));
      if (ids.length < 3) {
        recCard.append(h('p', { class: 'muted small center' },
          pick.mode === 'condition' ? '条件に合うのは、いまはこれだけでした。' : 'おすすめできるのは、いまはこれだけでした。'),
        h('button', { type: 'button', class: 'btn btn-block btn-ghost', onclick: addWish }, '＋ やりたいことを追加する'));
      }
      recCard.append(h('button', {
        type: 'button', class: 'btn btn-block btn-outline reroll',
        onclick: () => update(generate(pick, ids)),
      }, '🔄 別のを見る'));
    }
  }
  root.append(recCard);

  function pickCard(w) {
    const meta = [
      w.minutes ? `⏱ ${minutesLabel(w.minutes)}` : null,
      w.energy ? `🔋 ${energyLabel(w.energy)}` : null,
    ].filter(Boolean);
    let action;
    if (busyWishIds.has(w.id)) {
      action = h('span', { class: 'pick-state' }, '✓ タスクに追加済み');
    } else if (doneTodayWishIds.has(w.id)) {
      action = h('span', { class: 'pick-state done' }, '🎉 今日やりました');
    } else {
      action = h('button', {
        type: 'button', class: 'btn btn-small',
        onclick: async () => {
          await addTask({ title: w.title, categoryId: w.categoryId, wishId: w.id });
          toast('今日のタスクに追加しました');
          rerender();
        },
      }, '＋ タスクにする');
    }
    return h('li', { class: 'pick' },
      h('span', { class: 'pick-cat' }, catName.get(w.categoryId) || ''),
      h('span', { class: 'pick-title' }, w.title),
      meta.length ? h('span', { class: 'wish-meta' }, meta.join('　')) : null,
      w.memo ? h('p', { class: 'pick-memo' }, linkify(w.memo)) : null,
      h('div', { class: 'pick-action' }, action),
    );
  }

  // ---- 今日のタスク ----
  const all = [...openTasks, ...doneToday];
  const taskCard = h('section', { class: 'card' },
    h('div', { class: 'cat-head' },
      h('h2', { class: 'card-title' }, '✅ 今日のタスク'),
      all.length ? h('span', { class: 'muted small' }, `${doneToday.length} / ${all.length} 完了`) : null),
  );
  if (!all.length) {
    taskCard.append(h('p', { class: 'muted' }, 'まだタスクはありません。おすすめから選んでみましょう 🌱'));
  } else {
    taskCard.append(h('ul', { class: 'task-list' }, all.map(taskRow)));
  }
  taskCard.append(h('button', {
    type: 'button', class: 'btn btn-block btn-ghost',
    onclick: () => openTaskAdder({ categories, wishes, busyWishIds, onSaved: rerender }),
  }, '＋ タスクを追加'));
  root.append(taskCard);

  function taskRow(t) {
    const done = !!t.completedAt;
    const created = keyOfTime(t.createdAt);
    const sub = [catName.get(t.categoryId)];
    if (!done && created < today) {
      const d = parseKey(created);
      sub.push(`${d.getMonth() + 1}/${d.getDate()} から`);
    }
    return h('li', { class: done ? 'task done' : 'task' },
      h('button', {
        type: 'button', class: 'check', role: 'checkbox',
        'aria-checked': done ? 'true' : 'false',
        'aria-label': done ? `${t.title}を未完了に戻す` : `${t.title}を完了にする`,
        onclick: async () => {
          await setTaskDone(t.id, !done);
          toast(done ? '未完了に戻しました' : CHEERS[Math.floor(Math.random() * CHEERS.length)]);
          rerender();
        },
      }, done ? '✓' : ''),
      h('button', {
        type: 'button', class: 'task-main',
        onclick: () => openTaskEditor(t, { categories, onSaved: rerender }),
      },
      h('span', { class: 'task-title' }, t.title),
      h('span', { class: 'wish-meta' }, sub.filter(Boolean).join('・'))),
    );
  }

}
