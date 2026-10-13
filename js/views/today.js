// 今日の画面：おすすめ3件（おまかせ／条件指定）と今日のタスク
import { h, chips, toast, linkify, emptyState } from '../ui.js';
import { todayKey, formatDay, keyOfTime, parseKey } from '../util.js';
import {
  MINUTES, loadCategories, loadWishes, loadTasks, addTask, setTaskDone,
  loadDailyPick, saveDailyPick, minutesLabel, energyLabel, loadRestDays, setRest,
} from '../data.js';
import { countByDay, currentStreak, longestStreak } from '../stats.js';
import { pickWishes, MOODS } from '../picker.js';
import { openWishEditor, openTaskEditor, openProgressSheet } from '../editors.js';

export const title = '今日';

const CHEERS = ['やったね！🎉', 'えらい！✨', 'ナイス！👏', '今日も一歩前進🌱', 'すばらしい！💮'];

const conditionReady = (p) => p.mode !== 'condition' || (p.condition && p.condition.minutes != null && p.condition.mood);

export async function render(root, { rerender }) {
  const today = todayKey();
  const [categories, wishes, tasks, restDays] = await Promise.all([loadCategories(), loadWishes(), loadTasks(), loadRestDays()]);
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

  // 表示モード（📝タスク一覧／🎯条件指定）は日ごとに保存。条件指定の3件も保存して、中身が全部なくなっていたら選び直す
  let pick = await loadDailyPick(today);
  if (!pick) {
    pick = { date: today, mode: 'list', condition: null, wishIds: [] };
    await saveDailyPick(pick);
  } else if (pick.mode !== 'condition') {
    pick = { ...pick, mode: 'list' }; // 以前の「おまかせ」は一覧として表示
  } else if (conditionReady(pick) && !pick.wishIds.some(isShowable) && candidates.length) {
    const next = generate(pick);
    if (next.wishIds.length) { pick = next; await saveDailyPick(pick); }
  }

  const update = async (next) => { await saveDailyPick(next); rerender(); };
  const addWish = () => openWishEditor(null, { categories, onSaved: rerender });

  root.append(h('p', { class: 'date-label' }, formatDay(today)));

  // ---- 連続記録と「今日は休む」 ----
  const counts = countByDay(tasks);
  const streak = currentStreak(today, counts, restDays);
  const best = longestStreak(today, counts, restDays);
  const doneTodayCount = counts.get(today) || 0;
  const isRest = restDays.has(today);
  let streakMsg;
  if (doneTodayCount) streakMsg = '今日も達成！この調子です 🎉';
  else if (isRest) streakMsg = '今日は休息日。ゆっくり休んでね 🌙';
  else if (streak) streakMsg = `今日1つ完了するか「すすめた」を押すと、${streak + 1}日連続になります`;
  else streakMsg = '今日1つ完了するか「すすめた」を押して、記録をスタートしよう 🌱';
  root.append(h('section', { class: 'card streak-card' },
    h('div', { class: 'streak-main' },
      h('div', { class: 'streak-num' },
        h('span', { class: 'streak-label' }, '🔥 連続達成'),
        h('span', { class: 'streak-value' }, String(streak), h('small', {}, '日'))),
      h('div', { class: 'streak-best' }, `最長 ${best}日`)),
    h('p', { class: 'streak-msg' }, streakMsg),
    doneTodayCount ? null : h('button', {
      type: 'button', class: isRest ? 'btn btn-small btn-ghost' : 'btn btn-small btn-outline rest-btn',
      onclick: async () => {
        await setRest(today, !isRest);
        toast(isRest ? '休息日を取り消しました' : '今日は休息日にしました。連続記録は途切れません 🌙');
        rerender();
      },
    }, isRest ? '休息日を取り消す' : '🌙 今日は休む'),
  ));

  // ---- おすすめ ----
  const modeTabs = chips([{ v: 'list', label: '📝 タスク一覧' }, { v: 'condition', label: '🎯 条件指定' }], {
    value: pick.mode, allowNone: false,
    onChange: (mode) => {
      if (mode === 'list') update({ ...pick, mode: 'list' });
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

  if (pick.mode === 'list') {
    // やりたいことリストを全部並べて、ここから今日のタスクにする
    if (!activeWishes.length) {
      recCard.append(emptyState('🌱', 'やりたいことリストが空っぽです。まずは1つ登録してみましょう。',
        h('button', { type: 'button', class: 'btn btn-block', onclick: addWish }, '＋ やりたいことを追加する')));
    } else {
      const groups = categories.map((c) => [c, activeWishes.filter((w) => w.categoryId === c.id)]).filter(([, ws]) => ws.length);
      const known = new Set(categories.map((c) => c.id));
      const orphans = activeWishes.filter((w) => !known.has(w.categoryId));
      if (orphans.length) groups.push([{ name: 'カテゴリなし' }, orphans]);
      recCard.append(h('p', { class: 'muted small list-lead' }, 'やりたいことリストから、今日やるものを選んでタスクにしましょう。'),
        ...groups.map(([c, ws]) => h('div', { class: 'today-group' },
          h('h3', { class: 'pick-group' }, c.name),
          h('ul', { class: 'wish-list' }, ws.map(listRow)))));
    }
  } else if (!conditionReady(pick)) {
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
        recCard.append(h('p', { class: 'muted small center' }, '条件に合うのは、いまはこれだけでした。'),
        h('button', { type: 'button', class: 'btn btn-block btn-ghost', onclick: addWish }, '＋ やりたいことを追加する'));
      }
      recCard.append(h('button', {
        type: 'button', class: 'btn btn-block btn-outline reroll',
        onclick: () => update(generate(pick, ids)),
      }, '🔄 別のを見る'));
    }
  }
  root.append(recCard);

  function metaOf(w) {
    return [
      w.minutes ? `⏱ ${minutesLabel(w.minutes)}` : null,
      w.energy ? `🔋 ${energyLabel(w.energy)}` : null,
    ].filter(Boolean);
  }

  // 「＋タスクにする」ボタン（すでにタスクなら状態を表示）
  function actionFor(w) {
    if (busyWishIds.has(w.id)) return h('span', { class: 'pick-state' }, '✓ 追加済み');
    if (doneTodayWishIds.has(w.id)) return h('span', { class: 'pick-state done' }, '🎉 今日やった');
    return h('button', {
      type: 'button', class: 'btn btn-small',
      onclick: async () => {
        await addTask({ title: w.title, categoryId: w.categoryId, wishId: w.id });
        toast('今日のタスクに追加しました');
        rerender();
      },
    }, '＋ タスクにする');
  }

  function listRow(w) {
    const meta = metaOf(w);
    return h('li', { class: 'wish-row today-row' },
      h('div', { class: 'wish-main' },
        h('span', { class: 'wish-title' }, w.title),
        meta.length ? h('span', { class: 'wish-meta' }, meta.join('　')) : null),
      actionFor(w));
  }

  function pickCard(w) {
    const meta = metaOf(w);
    const action = actionFor(w);
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
    taskCard.append(h('p', { class: 'muted' }, 'まだタスクはありません。上の「今日のおすすめ」から選んでみましょう 🌱'));
  } else {
    taskCard.append(h('ul', { class: 'task-list' }, all.map(taskRow)),
      h('p', { class: 'muted small task-hint' }, '終わったら左の ◯ をタップ（または「すすめた」→「最後までできた」）で完了です。途中までなら「すすめた」で今日の分を記録できます。'));
  }
  root.append(taskCard);

  function taskRow(t) {
    const done = !!t.completedAt;
    const created = keyOfTime(t.createdAt);
    const sub = [catName.get(t.categoryId)];
    if (!done && created < today) {
      const d = parseKey(created);
      sub.push(`${d.getMonth() + 1}/${d.getDate()} から`);
    }
    const progress = t.progress || [];
    const todayProgress = progress.find((p) => p.date === today);
    const lastProgress = progress[progress.length - 1];
    let progressLine = null;
    if (lastProgress && !done) {
      const d = parseKey(lastProgress.date);
      const when = lastProgress.date === today ? '今日' : `${d.getMonth() + 1}/${d.getDate()}`;
      progressLine = h('span', { class: 'task-progress' }, `📝 ${when}：${lastProgress.note || 'すすめた'}`);
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
      progressLine,
      h('span', { class: 'wish-meta' }, sub.filter(Boolean).join('・'))),
      done ? null : h('button', {
        type: 'button', class: todayProgress ? 'progress-btn on' : 'progress-btn',
        'aria-label': todayProgress ? `${t.title}の今日の記録を見る` : `${t.title}を今日すすめた`,
        onclick: () => openProgressSheet(t, today, { onSaved: rerender }),
      }, todayProgress ? '✓ すすめた' : '▶ すすめた'),
    );
  }

}
