/* =========================================================
   PD — SERVICE WORKER
   Princess wa Deib
   ========================================================= */

const CACHE_NAME = "pd-app-v1";

const APP_FILES = [
    "./",
    "./index.html",
    "./manifest.json",

    /* Main styles */
    "./style.css",

    /* Main JavaScript */
    "./script.js",

    /* Firebase */
    "./firebase.js",

    /* App pages */
    "./home.html",
    "./chat.html",
    "./love-pie.html",
    "./stats.html",
    "./song.html"
];


/* =========================================================
   INSTALL
   ========================================================= */

self.addEventListener("install", event => {

    console.log("❤️ PD Service Worker installing...");

    event.waitUntil(

        caches.open(CACHE_NAME)
            .then(cache => {

                return cache.addAll(APP_FILES);

            })
            .then(() => {

                console.log("❤️ PD app files cached.");

                return self.skipWaiting();

            })

    );

});


/* =========================================================
   ACTIVATE
   ========================================================= */

self.addEventListener("activate", event => {

    console.log("❤️ PD Service Worker activated.");

    event.waitUntil(

        caches.keys().then(cacheNames => {

            return Promise.all(

                cacheNames.map(cacheName => {

                    if (cacheName !== CACHE_NAME) {

                        return caches.delete(cacheName);

                    }

                })

            );

        }).then(() => {

            return self.clients.claim();

        })

    );

});


/* =========================================================
   FETCH
   ========================================================= */

self.addEventListener("fetch", event => {

    event.respondWith(

        caches.match(event.request)
            .then(cachedResponse => {

                if (cachedResponse) {

                    return cachedResponse;

                }

                return fetch(event.request);

            })
            .catch(() => {

                return caches.match("./index.html");

            })

    );

});