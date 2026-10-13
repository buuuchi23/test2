// IndexedDB の薄いラッパー。データ量は小さいので「全部読む」中心のシンプルな作り。
import { uid, nowISO } from './util.js';

const DB_NAME = 'ikukyu-iinkai';
const DB_VERSION = 1;

// ストア名 → 主キー
export const STORES = {
  categories: 'id',
  wishes: 'id',
  tasks: 'id',
  dayLogs: 'date',
  dailyPicks: 'date',
  meta: 'key',
};

export const DEFAULT_CATEGORIES = [
  '学習・資格・読書',
  '趣味・創作',
  '暮らし・家のこと',
  '育児関連',
  '投資関連',
];

let dbPromise = null;

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [name, keyPath] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // 別タブで DB が更新されたら閉じて再読み込みに備える
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('データベースが別の画面で使用中です'));
  });
  return dbPromise;
}

async function store(name, mode = 'readonly') {
  const db = await openDB();
  return db.transaction(name, mode).objectStore(name);
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('保存が中断されました'));
  });
}

export async function getAll(name) {
  return reqToPromise((await store(name)).getAll());
}

export async function get(name, key) {
  return reqToPromise((await store(name)).get(key));
}

export async function put(name, value) {
  const s = await store(name, 'readwrite');
  await reqToPromise(s.put(value));
  await txDone(s.transaction);
  return value;
}

export async function del(name, key) {
  const s = await store(name, 'readwrite');
  await reqToPromise(s.delete(key));
  await txDone(s.transaction);
}

// 複数ストアをまとめて書き換える（すべて成功 or すべて失敗）
// fn には { ストア名: ObjectStore } が渡される
export async function transact(names, fn) {
  const db = await openDB();
  const tx = db.transaction(names, 'readwrite');
  const stores = Object.fromEntries(names.map((n) => [n, tx.objectStore(n)]));
  fn(stores);
  await txDone(tx);
}

// メタ情報（初期設定済みフラグなど）
export async function getMeta(key, fallback = undefined) {
  const row = await get('meta', key);
  return row ? row.value : fallback;
}

export async function setMeta(key, value) {
  await put('meta', { key, value });
}

// 初回だけ初期カテゴリを入れる
export async function ensureSeed() {
  if (await getMeta('seeded', false)) return;
  const createdAt = nowISO();
  await transact(['categories', 'meta'], (s) => {
    DEFAULT_CATEGORIES.forEach((name, i) => {
      // 並び順を保つため作成時刻を1ミリ秒ずつずらす
      const t = new Date(Date.parse(createdAt) + i).toISOString();
      s.categories.put({ id: uid(), name, isDefault: true, createdAt: t });
    });
    s.meta.put({ key: 'seeded', value: true });
  });
}
