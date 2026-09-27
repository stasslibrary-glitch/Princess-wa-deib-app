
/* =========================================================
   PD — NOTIFICATIONS
   FIRESTORE REAL-TIME MESSAGE NOTIFICATIONS
   ========================================================= */

import {
    auth,
    db
} from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    collection,
    query,
    orderBy,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


/* =========================================================
   SETTINGS
   ========================================================= */

let currentUser = null;

let firstLoad = true;

let knownMessages = new Set();

let notificationSound = null;


/* =========================================================
   NOTIFICATION SOUND
   ========================================================= */

function setupNotificationSound() {

    notificationSound =
        new Audio("sounds/message.mp3");

    notificationSound.volume = 0.75;

}


/* =========================================================
   ENABLE SOUND AFTER USER INTERACTION
   ========================================================= */

document.addEventListener(
    "click",
    () => {

        if (!notificationSound) {

            setupNotificationSound();

        }

        /*
           This prepares the browser to allow
           future notification sounds.
        */

        notificationSound
            ?.play()
            .then(() => {

                notificationSound.pause();

                notificationSound.currentTime = 0;

            })
            .catch(() => {});

    },
    {
        once: true
    }
);


/* =========================================================
   PLAY NOTIFICATION SOUND
   ========================================================= */

function playNotificationSound() {

    if (!notificationSound) {

        setupNotificationSound();

    }


    if (!notificationSound)
        return;


    notificationSound.currentTime = 0;


    notificationSound
        .play()
        .catch(error => {

            console.log(
                "🔕 Browser blocked notification sound:",
                error
            );

        });

}


/* =========================================================
   CREATE POPUP CONTAINER
   ========================================================= */

function createNotificationContainer() {

    let container =
        document.getElementById(
            "pd-notification-container"
        );


    if (container)
        return container;


    container =
        document.createElement("div");


    container.id =
        "pd-notification-container";


    container.innerHTML = `

        <div
            id="pd-message-popup"
            class="pd-message-popup"
        >

            <div class="pd-popup-icon">
                <i class="fa-solid fa-heart"></i>
            </div>

            <div class="pd-popup-text">

                <strong>
                    New message ❤️
                </strong>

                <span id="pd-popup-message">
                    You have a new message
                </span>

            </div>

            <button
                id="pd-popup-close"
                aria-label="Close notification"
            >
                ×
            </button>

        </div>

    `;


    document.body.appendChild(
        container
    );


    const closeButton =
        document.getElementById(
            "pd-popup-close"
        );


    closeButton?.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            hideNotificationPopup();

        }
    );


    return container;

}


/* =========================================================
   SHOW POPUP
   ========================================================= */

let popupTimer = null;


function showNotificationPopup(
    senderName,
    messageText
) {

    createNotificationContainer();


    const popup =
        document.getElementById(
            "pd-message-popup"
        );


    const message =
        document.getElementById(
            "pd-popup-message"
        );


    if (!popup || !message)
        return;


    message.textContent =
        `${senderName}: ${messageText}`;


    popup.classList.remove(
        "show"
    );


    /*
       Small delay allows the
       animation to restart.
    */

    requestAnimationFrame(() => {

        requestAnimationFrame(() => {

            popup.classList.add(
                "show"
            );

        });

    });


    clearTimeout(
        popupTimer
    );


    popupTimer =
        setTimeout(
            () => {

                hideNotificationPopup();

            },
            5000
        );

}


/* =========================================================
   HIDE POPUP
   ========================================================= */

function hideNotificationPopup() {

    const popup =
        document.getElementById(
            "pd-message-popup"
        );


    if (popup) {

        popup.classList.remove(
            "show"
        );

    }

}


/* =========================================================
   BROWSER NOTIFICATION
   ========================================================= */

async function showBrowserNotification(
    senderName,
    messageText
) {

    if (
        !("Notification" in window)
    )
        return;


    /*
       Don't request permission
       automatically.

       The browser requires user interaction
       before permission can be requested
       in many situations.
    */

    if (
        Notification.permission !==
        "granted"
    )
        return;


    try {

        new Notification(
            `${senderName} ❤️`,
            {

                body:
                    messageText,

                icon:
                    "./icon-192.png",

                badge:
                    "./icon-192.png"

            }
        );

    } catch (error) {

        console.log(
            "Browser notification unavailable:",
            error
        );

    }

}


/* =========================================================
   UPDATE CHAT BADGE
   ========================================================= */

function updateNotificationBadge() {

    const badge =
        document.getElementById(
            "chatNotification"
        );


    if (!badge)
        return;


    let unread =
        parseInt(
            localStorage.getItem(
                "pdUnreadMessages"
            ) || "0"
        );


    unread++;


    localStorage.setItem(
        "pdUnreadMessages",
        unread
    );


    badge.textContent =
        unread;


    badge.style.display =
        "flex";

}


/* =========================================================
   CLEAR CHAT BADGE
   ========================================================= */

function clearNotificationBadge() {

    localStorage.setItem(
        "pdUnreadMessages",
        "0"
    );


    const badge =
        document.getElementById(
            "chatNotification"
        );


    if (!badge)
        return;


    badge.textContent =
        "0";


    badge.style.display =
        "none";

}


/* =========================================================
   WATCH FIRESTORE MESSAGES
   ========================================================= */

function startNotificationListener() {

    if (!currentUser)
        return;


    console.log(
        "🔔 PD notification listener started."
    );


    const messagesQuery =
        query(
            collection(
                db,
                "messages"
            ),

            orderBy(
                "createdAt",
                "asc"
            )
        );


    onSnapshot(

        messagesQuery,

        snapshot => {

            /*
               FIRST LOAD

               Remember all existing messages,
               but don't notify for them.
            */

            if (firstLoad) {

                snapshot.forEach(
                    docSnapshot => {

                        knownMessages.add(
                            docSnapshot.id
                        );

                    }
                );


                firstLoad = false;


                console.log(
                    "🔔 Existing PD messages loaded:",
                    knownMessages.size
                );


                return;

            }


            /*
               NEW MESSAGES
            */

            snapshot.docChanges()
                .forEach(
                    change => {

                        if (
                            change.type !==
                            "added"
                        )
                            return;


                        const id =
                            change.doc.id;


                        /*
                           Don't process the
                           same message twice.
                        */

                        if (
                            knownMessages.has(
                                id
                            )
                        )
                            return;


                        knownMessages.add(
                            id
                        );


                        const data =
                            change.doc.data();


                        /*
                           Don't notify yourself.
                        */

                        if (
                            data.senderUID ===
                            currentUser.uid
                        )
                            return;


                        const sender =
                            data.senderName ||
                            "My Love";


                        const text =
                            data.text ||
                            "Sent you a voice note 🎙️";


                        console.log(
                            "💌 New PD message:",
                            data
                        );


                        /*
                           SOUND
                        */

                        playNotificationSound();


                        /*
                           BEAUTIFUL POPUP
                        */

                        showNotificationPopup(
                            sender,
                            text
                        );


                        /*
                           CHAT BADGE
                        */

                        updateNotificationBadge();


                        /*
                           BROWSER NOTIFICATION
                        */

                        showBrowserNotification(
                            sender,
                            text
                        );

                    }
                );

        },

        error => {

            console.error(
                "❌ PD notification listener error:",
                error
            );

        }

    );

}


/* =========================================================
   CLEAR BADGE WHEN CHAT IS OPEN
   ========================================================= */

if (
    window.location.pathname
        .toLowerCase()
        .includes("chat.html")
) {

    clearNotificationBadge();

}


/* =========================================================
   AUTH
   ========================================================= */

onAuthStateChanged(
    auth,

    user => {

        if (!user) {

            return;

        }


        currentUser =
            user;


        startNotificationListener();

    }
);

