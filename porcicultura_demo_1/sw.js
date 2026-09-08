const CACHE_NAME = "bioara-v1-cache-20260907-r15";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./app/main.js",
  "./app/config.js",
  "./app/calc.js",
  "./app/csv.js",
  "./app/db.js",
  "./app/ui.js",
  "./logos/bioara.webp",
  "./logos/bioara.jpg",
  "./logos/cerdo_2.png",
  "./logos/cerdo.png",
  "./logos/cerdo_1.png",
  "../V1_app_data/01_precios_supuestos_bioara.csv"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
