// キャッシュ名は機能追加のたびにここを変える(変えないとservice-worker.js自体の
// 更新をブラウザが検知できず、いつまでも古いキャッシュが使われ続けてしまう)
const CACHE_NAME = 'ytkc-cache-v2';
const ASSETS = [
  './',
  './index.html',
  './share.html',
  './video.html',
  './watch.html',
  './import.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ネットワーク優先: オンラインなら常に最新のファイルを使う。
// オフラインのときだけキャッシュにフォールバックする(以前は逆で、
// 一度キャッシュされたファイルをずっと使い続けてしまう問題があった)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((networkRes) => {
        if (networkRes && networkRes.ok) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkRes;
      })
      .catch(() => caches.match(event.request))
  );
});
