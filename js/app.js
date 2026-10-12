// アプリの入口：画面切り替え（#/today など）と Service Worker の登録
import { openDB, ensureSeed, getMeta } from './db.js';
import { todayKey } from './util.js';
import { toast } from './ui.js';
import * as today from './views/today.js';
import * as list from './views/list.js';
import * as record from './views/record.js';
import * as settings from './views/settings.js';
import * as setup from './views/setup.js';

const ROUTES = { today, list, record, settings, setup };
const DEFAULT_ROUTE = 'today';

const viewEl = document.getElementById('view');
const titleEl = document.getElementById('screen-title');
const tabbarEl = document.getElementById('tabbar');

let renderedDay = todayKey();
let renderSeq = 0;

function parseHash() {
  const [name, ...rest] = location.hash.replace(/^#\/?/, '').split('/');
  return { name: name || DEFAULT_ROUTE, params: rest };
}

export function navigate(name) {
  if (parseHash().name === name) render();
  else location.hash = `#/${name}`;
}

// 今の画面を描き直す（データを変えたあとなどに呼ぶ）
export async function render() {
  const seq = ++renderSeq;
  let { name, params } = parseHash();
  if (!ROUTES[name]) name = DEFAULT_ROUTE;

  const setupDone = await getMeta('setupDone', false);
  if (!setupDone && name !== 'setup') name = 'setup';

  const view = ROUTES[name];
  const frag = document.createDocumentFragment();
  try {
    await view.render(frag, { params, rerender: render, navigate });
  } catch (err) {
    console.error(err);
    frag.textContent = '';
    frag.append(errorBox(err));
  }
  if (seq !== renderSeq) return; // 途中で別の画面に移ったら捨てる

  renderedDay = todayKey();
  titleEl.textContent = view.title;
  document.title = name === 'today' ? '育休中意識高めよう委員会' : `${view.title}｜育休中意識高めよう委員会`;
  document.body.dataset.route = name;
  tabbarEl.hidden = name === 'setup';
  for (const a of tabbarEl.querySelectorAll('a')) {
    const active = a.dataset.tab === name;
    a.classList.toggle('active', active);
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  viewEl.replaceChildren(frag);
}

function errorBox(err) {
  const div = document.createElement('div');
  div.className = 'card';
  div.textContent = `うまく表示できませんでした。アプリを開き直してみてください。（${err && err.message ? err.message : err}）`;
  return div;
}

// 日付が変わった状態で戻ってきたら描き直す（真夜中をまたいだとき用）
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && renderedDay !== todayKey()) render();
});

window.addEventListener('hashchange', () => {
  render();
  window.scrollTo(0, 0);
});

// ---- Service Worker（オフライン対応と更新のお知らせ） ----
function setupServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  let updateRequested = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (updateRequested) location.reload();
  });

  const banner = document.getElementById('update-banner');
  const showUpdate = (worker) => {
    banner.hidden = false;
    document.getElementById('update-btn').onclick = () => {
      updateRequested = true;
      banner.hidden = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
    };
  };

  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdate(nw);
      });
    });
    // アプリに戻ってきたときに更新を確認する（オフラインなら何もしない）
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) reg.update().catch(() => {});
    });
  }).catch((err) => console.warn('Service Worker の登録に失敗しました', err));
}

async function start() {
  try {
    await openDB();
    await ensureSeed();
  } catch (err) {
    console.error(err);
    viewEl.replaceChildren(errorBox(err));
    toast('データの準備ができませんでした');
    return;
  }
  // 保存領域をできるだけ消されにくくする（対応端末のみ）
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  await render();
  setupServiceWorker();
}

start();
