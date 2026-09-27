
/* =========================================================
   PD — NOTIFICATIONS
   WhatsApp-style unread count + popup + sound
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

let unreadCount =
    Number(
        localStorage.getItem(
            "pdUnreadMessages"
        ) || 0
    );


/* =========================================================
   NOTIFICATION SOUND
   ========================================================= */

const notificationSound =
    new Audio(
        "sounds/message.mp3"
    );

notificationSound.preload = "auto";

notificationSound.volume = 1.0;


/* =========================================================
   PREPARE SOUND
   ========================================================= */

let soundUnlocked = false;


function unlockNotificationSound() {

    if (soundUnlocked)
        return;


    notificationSound
        .play()
        .then(() => {

            notificationSound.pause();

            notificationSound.currentTime = 0;

            soundUnlocked = true;

            console.log(
                "🔊 PD notification sound unlocked."
            );

        })
        .catch(() => {

            /*
               Browser may still be waiting
               for a stronger user interaction.
            */

        });

}


/*
   Unlock after the user's first interaction.
*/

document.addEventListener(
    "click",
    unlockNotificationSound,
    {
        once: true
    }
);

document.addEventListener(
    "touchstart",
    unlockNotificationSound,
    {
        once: true
    }
);


/* =========================================================
   PLAY SOUND
   ========================================================= */

function playNotificationSound() {

    notificationSound.currentTime = 0;


    notificationSound
        .play()
        .then(() => {

            console.log(
                "🔊 PD notification sound played."
            );

        })
        .catch(error => {

            console.warn(
                "🔕 Sound blocked:",
                error
            );

        });

}


/* =========================================================
   UPDATE CHAT BADGE
   ========================================================= */

function updateChatBadge() {

    const badges =
        document.querySelectorAll(
            "#chatNotification"
        );


    badges.forEach(
        badge => {

            if (unreadCount > 0) {

                badge.textContent =
                    unreadCount;

                badge.style.display =
                    "flex";

            } else {

                badge.textContent =
                    "0";

                badge.style.display =
                    "none";

            }

        }
    );


    localStorage.setItem(
        "pdUnreadMessages",
        unreadCount
    );

}


/* =========================================================
   CLEAR UNREAD
   ========================================================= */

function clearUnreadMessages() {

    unreadCount = 0;


    localStorage.setItem(
        "pdUnreadMessages",
        "0"
    );


    updateChatBadge();

}


/* =========================================================
   POPUP
   ========================================================= */

let popupTimer;


function createPopup() {

    if (
        document.getElementById(
            "pd-notification-container"
        )
    ) {

        return;

    }


    const container =
        document.createElement(
            "div"
        );


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

                <strong id="pd-popup-title">
                    New message ❤️
                </strong>

                <span id="pd-popup-body">
                    You have a new message
                </span>

            </div>

            <button
                id="pd-popup-close"
                type="button"
            >
                ×
            </button>

        </div>

    `;


    document.body.appendChild(
        container
    );


    document
        .getElementById(
            "pd-popup-close"
        )
        ?.addEventListener(
            "click",
            hidePopup
        );

}


/* =========================================================
   SHOW POPUP
   ========================================================= */

function showPopup(
    sender,
    message
) {

    createPopup();


    const popup =
        document.getElementById(
            "pd-message-popup"
        );


    const title =
        document.getElementById(
            "pd-popup-title"
        );


    const body =
        document.getElementById(
            "pd-popup-body"
        );


    if (!popup)
        return;


    title.textContent =
        `${sender} ❤️`;


    body.textContent =
        message;


    popup.classList.remove(
        "show"
    );


    requestAnimationFrame(
        () => {

            popup.classList.add(
                "show"
            );

        }
    );


    clearTimeout(
        popupTimer
    );


    popupTimer =
        setTimeout(
            hidePopup,
            5000
        );

}


/* =========================================================
   HIDE POPUP
   ========================================================= */

function hidePopup() {

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
   NEW MESSAGE
   ========================================================= */

function handleNewMessage(
    data
) {

    /*
       Don't notify yourself.
    */

    if (
        data.senderUID ===
        currentUser.uid
    ) {

        return;

    }


    let messageText =
        data.text;


    /*
       Voice message
    */

    if (
        data.type ===
        "voice"
    ) {

        messageText =
            "🎙️ Sent you a voice note";

    }


    if (!messageText) {

        messageText =
            "You have a new message 💕";

    }


    /*
       Increase unread count.
    */

    unreadCount++;


    updateChatBadge();


    /*
       Popup.
    */

    showPopup(
        data.senderDisplayName ||
        data.senderName ||
        "My Love",

        messageText
    );


    /*
       Sound.
    */

    playNotificationSound();


    console.log(
        "💌 New PD message!",
        unreadCount
    );

}


/* =========================================================
   FIRESTORE LISTENER
   ========================================================= */

function startNotificationListener() {

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

               Remember existing messages
               but don't notify them.
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


                updateChatBadge();


                console.log(
                    "🔔 PD notifications ready."
                );


                return;

            }


            /*
               LOOK FOR NEW MESSAGES
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


                        if (
                            knownMessages.has(
                                id
                            )
                        )
                            return;


                        knownMessages.add(
                            id
                        );


                        handleNewMessage(
                            change.doc.data()
                        );

                    }
                );

        },

        error => {

            console.error(
                "❌ PD notification error:",
                error
            );

        }

    );

}


/* =========================================================
   CHAT PAGE
   ========================================================= */

const isChatPage =
    window.location.pathname
        .toLowerCase()
        .includes(
            "chat.html"
        );


/*
   Opening chat means the user
   has seen their messages.
*/

if (isChatPage) {

    clearUnreadMessages();

}


/* =========================================================
   AUTH
   ========================================================= */

onAuthStateChanged(
    auth,

    user => {

        if (!user)
            return;


        currentUser =
            user;


        startNotificationListener();

    }
);
