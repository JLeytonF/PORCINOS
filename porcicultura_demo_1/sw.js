const CACHE_NAME = "bioara-v1-cache-20260909-r1";
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
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .then((response) => {
        const responseClone = response.clone();
        if (response && response.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
