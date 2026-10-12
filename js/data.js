// なりたい姿・カテゴリ・やりたいことの読み書き
import { getAll, get, put, del, transact, getMeta, setMeta } from './db.js';
import { uid, nowISO } from './util.js';

export const MINUTES = [
  { v: 5, label: '5分' },
  { v: 15, label: '15分' },
  { v: 30, label: '30分' },
  { v: 60, label: '1時間' },
  { v: 120, label: 'それ以上' },
];

export const ENERGY = [
  { v: 'low', label: '疲れててもできる' },
  { v: 'mid', label: 'ふつう' },
  { v: 'high', label: '元気なとき' },
];

export const minutesLabel = (v) => (MINUTES.find((m) => m.v === v) || {}).label;
export const energyLabel = (v) => (ENERGY.find((e) => e.v === v) || {}).label;

const byCreated = (a, b) => (a.createdAt || '').localeCompare(b.createdAt || '');

// ---- カテゴリ ----
export async function loadCategories() {
  return (await getAll('categories')).sort(byCreated);
}

// 同じ名前があればそれを返す
export async function createCategory(name) {
  name = name.trim();
  if (!name) throw new Error('カテゴリ名を入れてください');
  const exists = (await getAll('categories')).find((c) => c.name === name);
  if (exists) return exists;
  return put('categories', { id: uid(), name, isDefault: false, createdAt: nowISO() });
}

export async function renameCategory(id, name) {
  name = name.trim();
  if (!name) throw new Error('カテゴリ名を入れてください');
  const c = await get('categories', id);
  if (!c) return;
  c.name = name;
  await put('categories', c);
}

const OTHER_NAME = 'その他';

// カテゴリを削除する。中のやりたいこと・タスクは「その他」に移す
// 戻り値：移した件数
export async function deleteCategory(id) {
  const [categories, wishes, tasks, goals] = await Promise.all([
    getAll('categories'), getAll('wishes'), getAll('tasks'), getAll('goals'),
  ]);
  const movingWishes = wishes.filter((w) => w.categoryId === id);
  const movingTasks = tasks.filter((t) => t.categoryId === id);
  const needOther = movingWishes.length + movingTasks.length > 0;

  let otherId = await getMeta('otherCategoryId');
  let other = otherId && categories.find((c) => c.id === otherId);
  if (needOther && other && other.id === id) {
    throw new Error('「その他」の中にやりたいことがあるため、削除できません。先に別のカテゴリへ移してください。');
  }
  const newOther = needOther && !other
    ? { id: uid(), name: OTHER_NAME, isDefault: false, createdAt: nowISO() }
    : null;
  if (newOther) other = newOther;

  await transact(['categories', 'wishes', 'tasks', 'goals', 'meta'], (s) => {
    if (newOther) {
      s.categories.put(newOther);
      s.meta.put({ key: 'otherCategoryId', value: newOther.id });
    }
    for (const w of movingWishes) s.wishes.put({ ...w, categoryId: other.id });
    for (const t of movingTasks) s.tasks.put({ ...t, categoryId: other.id });
    for (const g of goals) {
      if (g.categoryIds.includes(id)) s.goals.put({ ...g, categoryIds: g.categoryIds.filter((c) => c !== id) });
    }
    s.categories.delete(id);
    if (otherId === id) s.meta.delete('otherCategoryId');
  });
  return movingWishes.length;
}

// ---- なりたい姿 ----
export async function loadGoals() {
  return (await getAll('goals')).sort(byCreated);
}

export async function saveGoal({ id, text, categoryIds = [] }) {
  text = text.trim();
  if (!text) throw new Error('なりたい姿を入れてください');
  const old = id ? await get('goals', id) : null;
  return put('goals', {
    id: id || uid(),
    text,
    categoryIds: [...new Set(categoryIds)],
    createdAt: old ? old.createdAt : nowISO(),
  });
}

export async function deleteGoal(id) {
  await del('goals', id);
}

// ---- やりたいこと ----
export async function loadWishes() {
  return (await getAll('wishes')).sort(byCreated);
}

export async function saveWish(data) {
  const title = (data.title || '').trim();
  if (!title) throw new Error('タイトルを入れてください');
  if (!data.categoryId) throw new Error('カテゴリを選んでください');
  const old = data.id ? await get('wishes', data.id) : null;
  return put('wishes', {
    excluded: false,
    lastDoneAt: null,
    ...(old || {}),
    id: data.id || uid(),
    title,
    categoryId: data.categoryId,
    minutes: data.minutes ?? null,
    energy: data.energy ?? null,
    memo: (data.memo || '').trim(),
    createdAt: old ? old.createdAt : nowISO(),
  });
}

// 1行1件のテキストをタイトルの配列にする（空行・前後の空白は無視）
export function parseBulk(text) {
  return text.split(/\r\n|\r|\n/).map((line) => line.trim()).filter(Boolean);
}

export async function addWishes(titles, categoryId) {
  if (!categoryId) throw new Error('カテゴリを選んでください');
  const base = Date.now();
  await transact(['wishes'], (s) => {
    titles.forEach((title, i) => {
      s.wishes.put({
        id: uid(), title, categoryId, minutes: null, energy: null, memo: '',
        excluded: false, lastDoneAt: null,
        createdAt: new Date(base + i).toISOString(), // 貼り付けた順を保つ
      });
    });
  });
  return titles.length;
}

export async function setExcluded(id, excluded) {
  const w = await get('wishes', id);
  if (!w) return;
  w.excluded = excluded;
  await put('wishes', w);
}

export async function deleteWish(id) {
  await del('wishes', id);
}

// ---- 初期設定 ----
export const isSetupDone = () => getMeta('setupDone', false);
export const markSetupDone = () => setMeta('setupDone', true);
