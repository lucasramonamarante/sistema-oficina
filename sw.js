const CACHE_NAME = 'garagem-184-v1';

// Instala o motor do App
self.addEventListener('install', (event) => {
    console.log('👷‍♂️ Service Worker da Garagem 184 instalado com sucesso!');
});

// Faz a ponte entre o App e a Internet
self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});