/* REAL MACROS: service worker. Guarda la app para que abra sin internet. */
var VERSION = 'real-macros-app-787e9ecb5a';
var FUENTES = 'real-macros-fuentes';
var ARCHIVOS = ["./", "actividades.js", "alimentos.js", "app.js", "apple-touch-icon.png", "calc.js", "config.js", "datos.js", "dia.js", "entreno.js", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "icon.svg", "index.html", "inicio.js", "instalar.js", "manifest.webmanifest", "peso.js", "recetas.js", "semana.js", "store.js", "styles.css"];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(ARCHIVOS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (claves) {
    return Promise.all(claves.filter(function (k) { return k !== VERSION && k !== FUENTES; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin === self.location.origin) {
    // Con internet trae la versión más nueva y la guarda; sin internet usa la guardada.
    e.respondWith(fetch(req).then(function (res) {
      if (res.ok) { var copia = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copia); }); }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (r) {
        return r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error());
      });
    }));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    // Tipografías: lo guardado primero y se actualiza por detrás.
    e.respondWith(caches.open(FUENTES).then(function (c) {
      return c.match(req).then(function (guardada) {
        var red = fetch(req).then(function (res) { c.put(req, res.clone()); return res; });
        return guardada || red;
      });
    }));
  }
});
