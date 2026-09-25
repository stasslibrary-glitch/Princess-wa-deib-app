/* =========================================================
   PD — NOTIFICATIONS
   Firebase Cloud Messaging
   ========================================================= */

import {
    getMessaging,
    getToken,
    onMessage
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging.js";

import {
    app,
    auth
} from "./firebase.js";


/* =========================================================
   FIREBASE MESSAGING
   ========================================================= */

const messaging = getMessaging(app);


/* =========================================================
   ASK FOR NOTIFICATION PERMISSION
   ========================================================= */

async function enablePDNotifications() {

    try {

        if (!("Notification" in window)) {

            console.log("❌ This device does not support notifications.");

            return;

        }


        const permission = await Notification.requestPermission();


        if (permission !== "granted") {

            console.log("🔕 PD notification permission was not granted.");

            return;

        }


        console.log("🔔 PD notification permission granted.");


        /*
         IMPORTANT:

         We will put your Firebase Cloud Messaging
         Web Push certificate key here later.
        */

        const token = await getToken(messaging, {

            vapidKey: "BIXOKrV58L1gLD618OUPv9Qq0AddRv-O5mhtOlGQQPDzhueRa-PczLbbM2GwUuT23Lw0cdAOJIHeMjg6c9nsGqg"

        });


        if (token) {

            console.log("🔔 PD FCM TOKEN:");
            console.log(token);

            /*
             We will save this token to Firestore
             so PD knows which phone belongs to
             which account.
            */

        } else {

            console.log("⚠️ No FCM token received.");

        }


    } catch (error) {

        console.error(
            "❌ PD notification setup failed:",
            error
        );

    }

}


/* =========================================================
   FOREGROUND NOTIFICATIONS
   ========================================================= */

onMessage(messaging, payload => {

    console.log("💌 PD message received:", payload);


    const title =
        payload.notification?.title ||
        "Princess wa Deib ❤️";


    const body =
        payload.notification?.body ||
        "You have a new message 💕";


    /*
     Show notification while PD is open.
    */

    if (Notification.permission === "granted") {

        new Notification(title, {

            body: body,

            icon: "./icon-192.png",

            badge: "./icon-192.png"

        });

    }

});


/* =========================================================
   START
   ========================================================= */

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        enablePDNotifications
    );

} else {

    enablePDNotifications();

}