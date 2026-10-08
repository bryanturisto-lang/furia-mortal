// Service worker: permite instalar el juego y jugarlo sin internet.
// Estrategia: primero la red (para recibir actualizaciones) y, si no hay conexiÃ³n, la copia guardada.
const CACHE = 'furia-mortal-v5';
const FILES = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'js/util.js', 'js/audio.js', 'js/input.js', 'js/data.js', 'js/fighter.js',
  'js/ai.js', 'js/fx.js', 'js/stage.js', 'js/game.js', 'js/render3d.js',
  'js/vendor/three/three.module.min.js', 'js/vendor/three/addons/loaders/GLTFLoader.js',
  'js/vendor/three/addons/utils/BufferGeometryUtils.js', 'js/vendor/three/addons/utils/SkeletonUtils.js',
  'js/vendor/three/addons/environments/RoomEnvironment.js',
  'modelos/kaizen.glb', 'modelos/glaciar.glb', 'modelos/veneno.glb', 'modelos/fondo.jpg', 'modelos/suelo.jpg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
