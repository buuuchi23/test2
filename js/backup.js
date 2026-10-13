// バックアップ：エクスポート（JSONに書き出す）／インポート（JSONから完全に復元する）／全データ削除
import { STORES, getAll, transact, ensureSeed, setMeta } from './db.js';
import { todayKey, nowISO } from './util.js';

const APP_ID = 'ikukyu-iinkai';
const FORMAT_VERSION = 1;
const STORE_NAMES = Object.keys(STORES);

// すべてのデータを1つのオブジェクトにまとめる
// （iPhoneの共有シートはタップ直後でないと開けないため、画面表示のときに先に作っておく）
export async function exportData() {
  const data = {};
  for (const name of STORE_NAMES) data[name] = await getAll(name);
  return { app: APP_ID, version: FORMAT_VERSION, exportedAt: nowISO(), data };
}

export const markExported = () => setMeta('lastExportAt', nowISO());

export function backupFileName() {
  return `ikukyu-backup-${todayKey()}.json`;
}

// ファイルとして保存する。iPhone/iPad では共有シート（「ファイルに保存」など）を優先
export async function saveBackupFile(json) {
  const text = JSON.stringify(json, null, 1);
  const name = backupFileName();
  const file = new File([text], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelled';
      // 共有できなかったときはダウンロードに切り替える
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}

// 読み込んだ JSON を確かめる。問題があれば分かりやすいメッセージで投げる
export function parseBackup(text) {
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('ファイルを読み取れませんでした。このアプリで書き出したJSONファイルを選んでください。');
  }
  if (!json || json.app !== APP_ID || typeof json.data !== 'object' || json.data === null) {
    throw new Error('このアプリのバックアップファイルではないようです。');
  }
  if (json.version > FORMAT_VERSION) {
    throw new Error('新しいバージョンのアプリで作られたファイルです。アプリを更新してからもう一度お試しください。');
  }
  for (const [name, key] of Object.entries(STORES)) {
    const rows = json.data[name] ?? [];
    if (!Array.isArray(rows) || rows.some((r) => !r || typeof r !== 'object' || r[key] === undefined || r[key] === null)) {
      throw new Error('ファイルの中身が壊れているようです。');
    }
  }
  return json;
}

export function summarize(json) {
  const n = (name) => (json.data[name] || []).length;
  return {
    categories: n('categories'),
    wishes: n('wishes'),
    tasks: n('tasks'),
    restDays: (json.data.dayLogs || []).filter((d) => d.rest).length,
    exportedAt: json.exportedAt,
  };
}

// 今のデータをすべて消して、バックアップの中身に置き換える（途中で失敗したら何も変わらない）
export async function importData(json) {
  await transact(STORE_NAMES, (s) => {
    for (const name of STORE_NAMES) {
      s[name].clear();
      for (const row of json.data[name] || []) s[name].put(row);
    }
    // 古い形式で初期設定済みの印がなくても、ようこそ画面に戻らないようにする
    if (!(json.data.meta || []).some((m) => m.key === 'setupDone')) s.meta.put({ key: 'setupDone', value: true });
    if (!(json.data.meta || []).some((m) => m.key === 'seeded')) s.meta.put({ key: 'seeded', value: true });
  });
}

// すべて消して、はじめて開いたときの状態に戻す
export async function deleteAllData() {
  await transact(STORE_NAMES, (s) => {
    for (const name of STORE_NAMES) s[name].clear();
  });
  await ensureSeed();
}
