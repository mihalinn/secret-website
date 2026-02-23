const CACHE_NAME = 'work-utils-v2';
const ASSETS = [
    './',
    './index.html',
    './driving_report.html',
    './pdfcompress.html',
    './common.css',
    './common.js',
    './index.css',
    './index.js',
    './driving_report.css',
    './driving_report_core.js',
    './driving_report_events.js',
    './driving_report_form.js',
    './driving_report_history.js',
    './driving_report_scanner.js',
    './driving_report_settings.js',
    './driving_report_transport.js'
];

// インストール時にアセットをキャッシュ
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

// アクティベート時に古いキャッシュを削除
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// フェッチ処理：ネットワーク優先（開発時の不整合を防ぐ）
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});
