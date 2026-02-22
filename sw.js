const CACHE_NAME = 'work-utils-v1';
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

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
