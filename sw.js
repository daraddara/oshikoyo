const CACHE_NAME = 'oshigoto-calendar-v6';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    './assets/default_image.png',
    './assets/icon-192.png',
    './assets/icon-512.png'
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
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (event.request.method === 'POST' && url.pathname === '/share-target') {
        event.respondWith((async () => {
            try {
                const formData = await event.request.formData();
                const imageFile = formData.get('image');

                if (imageFile) {
                    const cache = await caches.open('shared-image');
                    await cache.put('shared-image-file', new Response(imageFile));
                }

                // Redirect to the main page with a query parameter
                return Response.redirect('/?shared=true', 303);
            } catch (error) {
                console.error('Error handling share target:', error);
                return Response.redirect('/', 303);
            }
        })());
        return;
    }

    event.respondWith(
        caches.match(event.request, { ignoreSearch: true })
            .then((response) => response || fetch(event.request))
    );
});
