// Service Worker：アプリのファイルを端末に保存して、オフラインでも動くようにする。
// アプリを修正したら、下の VERSION の数字を1つ上げてください（例：v1 → v2）。
const VERSION = 'v11';
const CACHE = `ikukyu-${VERSION}`;

const FILES = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/app.js',
  './js/backup.js',
  './js/data.js',
  './js/db.js',
  './js/editors.js',
  './js/picker.js',
  './js/stats.js',
  './js/ui.js',
  './js/util.js',
  './js/views/today.js',
  './js/views/list.js',
  './js/views/record.js',
  './js/views/settings.js',
  './js/views/setup.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // ブラウザの HTTP キャッシュを通さず、必ず最新のファイルを取りに行く
      cache.addAll(FILES.map((url) => new Request(url, { cache: 'reload' })))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ikukyu-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 「更新する」ボタンが押されたら、新しいバージョンに切り替える
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 外部への通信はしない

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // 画面を開くときは常に保存済みの index.html を返す
    if (req.mode === 'navigate') {
      const page = await cache.match('./index.html');
      if (page) return page;
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(req);
    } catch (err) {
      return new Response('オフラインのため表示できません', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  })());
});
