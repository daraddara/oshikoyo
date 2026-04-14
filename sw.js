const CACHE_NAME = 'oshikoyo-v1.2.0';
const ASSETS = [
    './',
    './index.html',
    './src/style.css',
    './src/script.js',
    './manifest.json',
    './src/assets/default_image.png',
    './src/assets/icon-192.png',
    './src/assets/icon-512.png',
    './src/assets/default_landscape_demo.jpg',
];

self.addEventListener('install', (event) => {
    // 新しいキャッシュをインストール
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
    );
    // すぐに新しいService Workerをアクティブにする
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // 古いキャッシュを削除
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== 'shared-image') {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (event.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
        event.respondWith((async () => {
            try {
                const formData = await event.request.formData();
                const imageFile = formData.get('image');

                if (imageFile) {
                    const cache = await caches.open('shared-image');
                    await cache.put('shared-image-file', new Response(imageFile));
                }

                // Redirect to the main page with a query parameter
                return Response.redirect('./?shared=true', 303);
            } catch (error) {
                console.error('Error handling share target:', error);
                return Response.redirect('./', 303);
            }
        })());
        return;
    }

    event.respondWith(
        caches.match(event.request, { ignoreSearch: true })
            .then((response) => response || fetch(event.request).catch(() => caches.match('./')))
    );
});
