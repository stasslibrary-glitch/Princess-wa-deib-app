
/* =========================================================
   PD — FIREBASE CLOUD MESSAGING SERVICE WORKER
   Background notifications + notification click handling
   ========================================================= */

importScripts(
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js"
);

importScripts(
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js"
);


/* ================= FIREBASE CONFIG ================= */

firebase.initializeApp({
    apiKey: "AIzaSyBqmqVQCvgPpary3GOCLks3IBsoeerqGHs",
    authDomain: "princess-wa-deib.firebaseapp.com",
    projectId: "princess-wa-deib",
    storageBucket: "princess-wa-deib.firebasestorage.app",
    messagingSenderId: "802098476214",
    appId: "1:802098476214:web:80f8ed04a82bd53e236217"
});

const messaging = firebase.messaging();


/* ================= BACKGROUND MESSAGE ================= */

messaging.onBackgroundMessage(async (payload) => {
    console.log("💌 PD background push received:", payload);

    /*
      Firebase/browser can automatically display notification
      payloads. Do not display them again, or users may see
      duplicate notifications.
    */
    if (payload.notification) {
        return;
    }

    const data = payload.data || {};

    const title = data.title || "Princess wa Deib ❤️";
    const body = data.body || "You have a new message 💕";

    const options = {
        body,
        icon: new URL("./icon-192.png", self.registration.scope).href,
        badge: new URL("./icon-192.png", self.registration.scope).href,
        vibrate: [200, 100, 200],
        tag: data.tag || "pd-chat-message",
        renotify: true,
        data: {
            url: data.url || "./chat.html",
            messageId: data.messageId || ""
        }
    };

    await self.registration.showNotification(title, options);
});


/* ================= NOTIFICATION CLICK ================= */

self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    event.waitUntil((async () => {
        const targetUrl = new URL(
            event.notification.data?.url || "./chat.html",
            self.registration.scope
        ).href;

        const windows = await clients.matchAll({
            type: "window",
            includeUncontrolled: true
        });

        // Focus an existing PD tab, navigating it to the chat.
        for (const client of windows) {
            if (
                client.url.startsWith(self.registration.scope) &&
                "focus" in client
            ) {
                if ("navigate" in client) {
                    await client.navigate(targetUrl);
                }

                return client.focus();
            }
        }

        // Otherwise, open PD chat in a new tab/window.
        return clients.openWindow(targetUrl);
    })());
});
