// 共通の小さな道具（日付はすべて端末のローカル時刻で扱う）

const pad = (n) => String(n).padStart(2, '0');

// Date → "YYYY-MM-DD"（ローカル時刻）
export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey() {
  return dateKey(new Date());
}

// "YYYY-MM-DD" → ローカル時刻 0:00 の Date
export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// 日付キーに日数を足す（マイナス可）
export function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

// ISO 文字列などのタイムスタンプ → ローカル日付キー
export function keyOfTime(time) {
  return dateKey(new Date(time));
}

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

// "10月12日（月）"
export function formatDay(key) {
  const d = parseKey(key);
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEK[d.getDay()]}）`;
}

export function nowISO() {
  return new Date().toISOString();
}

export function uid() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
