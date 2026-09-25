/* =========================================================
   PD — FIREBASE CLOUD MESSAGING SERVICE WORKER
   ========================================================= */

importScripts(
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js"
);

importScripts(
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js"
);


/* =========================================================
   FIREBASE CONFIG
   ========================================================= */

firebase.initializeApp({

    apiKey: "AIzaSyBqmqVQCvgPpary3GOCLks3IBsoeerqGHs",
    authDomain: "princess-wa-deib.firebaseapp.com",
    projectId: "princess-wa-deib",
    storageBucket: "princess-wa-deib.firebasestorage.app",
    messagingSenderId: "802098476214",
    appId: "1:802098476214:web:80f8ed04a82bd53e236217"

});


/* =========================================================
   MESSAGING
   ========================================================= */

const messaging = firebase.messaging();


/* =========================================================
   BACKGROUND MESSAGE
   ========================================================= */

messaging.onBackgroundMessage(payload => {

    console.log(
        "💌 PD background message received:",
        payload
    );


    const title =
        payload.notification?.title ||
        "Princess wa Deib ❤️";


    const options = {

        body:
            payload.notification?.body ||
            "You have a new message 💕",

        icon: "./icon-192.png",

        badge: "./icon-192.png",

        vibrate: [200, 100, 200],

        data: {
            url: "./chat.html"
        }

    };


    self.registration.showNotification(
        title,
        options
    );

});


/* =========================================================
   OPEN CHAT WHEN NOTIFICATION IS TAPPED
   ========================================================= */

self.addEventListener(
    "notificationclick",
    event => {

        event.notification.close();


        event.waitUntil(

            clients.matchAll({
                type: "window",
                includeUncontrolled: true
            })

            .then(clientList => {

                for (const client of clientList) {

                    if (
                        client.url.includes("chat.html") &&
                        "focus" in client
                    ) {

                        return client.focus();

                    }

                }


                if (clients.openWindow) {

                    return clients.openWindow(
                        "./chat.html"
                    );

                }

            })

        );

    }
);