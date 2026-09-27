
/* =========================================================
   PRINCESS WA DEIB — CHAT
   ========================================================= */

import {
    auth,
    db
} from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    doc,
    setDoc,
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


let currentProfile = null;


/* =========================================================
   PD MESSAGE NOTIFICATION SOUND
   ========================================================= */

const messageSound =
    new Audio("sounds/message.mp3");

messageSound.volume = 0.7;

let firstMessagesLoaded = false;


/* =========================================================
   PD PROFILES
   ========================================================= */

const PD_PROFILES = {

    /* PRINCESS ACCOUNT */
    "princess@gmail.com": {
        name: "Princess",
        displayName: "Jaris ❤️"
    },

    /* DEIB ACCOUNT */
    "deib@gmail.com": {
        name: "Deib",
        displayName: "Ernest ❤️"
    }

};


/* =========================================================
   GET / CREATE PROFILE
   ========================================================= */

async function setupProfile(user) {

    const email =
        user.email?.toLowerCase();

    const profile =
        PD_PROFILES[email];

    if (!profile) {

        console.error(
            "❌ This Firebase email is not assigned to a PD profile:",
            email
        );

        return false;
    }


    const profileRef =
        doc(
            db,
            "users",
            user.uid
        );


    /*
       Write/update profile every login.
    */

    currentProfile = {

        uid: user.uid,

        email: email,

        name: profile.name,

        displayName: profile.displayName

    };


    await setDoc(
        profileRef,
        {

            uid: user.uid,

            email: email,

            name: profile.name,

            displayName: profile.displayName,

            updatedAt:
                serverTimestamp()

        },
        {
            merge: true
        }
    );


    updatePDInterface();


    console.log(
        "❤️ PD account:",
        currentProfile.name
    );

    console.log(
        "❤️ Display name:",
        currentProfile.displayName
    );


    return true;

}


/* =========================================================
   UPDATE PD INTERFACE
   ========================================================= */

function updatePDInterface() {

    if (!currentProfile)
        return;


    /*
       Logged-in user's display name.
    */

    const profileNames =
        document.querySelectorAll(
            "[data-user-name]"
        );


    profileNames.forEach(
        element => {

            element.textContent =
                currentProfile.displayName;

        }
    );


    /*
       Person being chatted with.
    */

    const chatPerson =
        document.querySelectorAll(
            "[data-chat-person-name]"
        );


    chatPerson.forEach(
        element => {

            if (
                currentProfile.name ===
                "Deib"
            ) {

                element.textContent =
                    "My Princess 💜";

            } else {

                element.textContent =
                    "My Deib ❤️";

            }

        }
    );

}


/* =========================================================
   SEND MESSAGE
   ========================================================= */

async function sendMessage() {

    const input =
        document.querySelector(
            ".chat-input input"
        );

    const sendButton =
        document.querySelector(
            ".send-message"
        );


    if (
        !input ||
        !currentProfile
    ) {

        return;

    }


    const text =
        input.value.trim();


    if (!text)
        return;


    if (sendButton)
        sendButton.disabled = true;


    try {

        await addDoc(
            collection(
                db,
                "messages"
            ),
            {

                text: text,

                senderUID:
                    currentProfile.uid,

                senderName:
                    currentProfile.name,

                senderDisplayName:
                    currentProfile.displayName,

                createdAt:
                    serverTimestamp()

            }
        );


        input.value = "";

        input.focus();


    } catch (error) {

        console.error(
            "❌ Message failed:",
            error
        );

    }


    if (sendButton)
        sendButton.disabled = false;

}


/* =========================================================
   DATE HELPERS
   ========================================================= */

function getDateKey(date) {

    return (
        date.getFullYear() +
        "-" +
        String(
            date.getMonth() + 1
        ).padStart(2, "0") +
        "-" +
        String(
            date.getDate()
        ).padStart(2, "0")
    );

}


/* =========================================================
   FORMAT CHAT DATE
   ========================================================= */

function formatChatDate(date) {

    const today =
        new Date();


    const yesterday =
        new Date();


    yesterday.setDate(
        yesterday.getDate() - 1
    );


    const messageDate =
        getDateKey(date);

    const todayDate =
        getDateKey(today);

    const yesterdayDate =
        getDateKey(yesterday);


    if (
        messageDate ===
        todayDate
    ) {

        return "Today";

    }


    if (
        messageDate ===
        yesterdayDate
    ) {

        return "Yesterday";

    }


    return date.toLocaleDateString(
        "en-GB",
        {
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );

}


/* =========================================================
   DISPLAY MESSAGE
   ========================================================= */

function displayMessage(
    data,
    previousDateKey
) {

    const container =
        document.querySelector(
            ".chat-messages"
        );


    if (
        !container ||
        !currentProfile
    ) {

        return previousDateKey;

    }


    /* -----------------------------------------
       GET MESSAGE DATE
       ----------------------------------------- */

    let messageDate = null;


    if (
        data.createdAt &&
        typeof data.createdAt.toDate ===
        "function"
    ) {

        messageDate =
            data.createdAt.toDate();

    }


    /* -----------------------------------------
       ADD DATE SEPARATOR
       ----------------------------------------- */

    if (messageDate) {

        const currentDateKey =
            getDateKey(
                messageDate
            );


        if (
            currentDateKey !==
            previousDateKey
        ) {

            const separator =
                document.createElement(
                    "div"
                );


            separator.className =
                "chat-date-separator";


            const separatorText =
                document.createElement(
                    "span"
                );


            separatorText.textContent =
                formatChatDate(
                    messageDate
                );


            separator.appendChild(
                separatorText
            );


            container.appendChild(
                separator
            );


            previousDateKey =
                currentDateKey;

        }

    }


    /* -----------------------------------------
       CREATE MESSAGE
       ----------------------------------------- */

    const message =
        document.createElement(
            "div"
        );


    const mine =
        data.senderUID ===
        currentProfile.uid;


    message.className =
        mine
            ? "message sent"
            : "message received";


    /* -----------------------------------------
       MESSAGE TEXT
       ----------------------------------------- */

    const text =
        document.createElement(
            "div"
        );


    text.className =
        "message-text";


    text.textContent =
        data.text || "";


    /* -----------------------------------------
       MESSAGE TIME
       ----------------------------------------- */

    const time =
        document.createElement(
            "span"
        );


    time.className =
        "message-time";


    if (messageDate) {

        time.textContent =
            messageDate.toLocaleTimeString(
                [],
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );

    }


    /* -----------------------------------------
       ADD MESSAGE TO CHAT
       ----------------------------------------- */

    message.appendChild(
        text
    );

    message.appendChild(
        time
    );

    container.appendChild(
        message
    );


    return previousDateKey;

}


/* =========================================================
   REAL-TIME CHAT
   ========================================================= */

function startChat() {

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

            const container =
                document.querySelector(
                    ".chat-messages"
                );


            if (!container)
                return;


            /*
               Clear the current display.
            */

            container.innerHTML = "";


            /*
               Keep track of the date
               of the previous message.
            */

            let previousDateKey =
                null;


            snapshot.forEach(
                docSnapshot => {

                    const data =
                        docSnapshot.data();


                    previousDateKey =
                        displayMessage(
                            data,
                            previousDateKey
                        );

                }
            );


            /*
               Scroll to newest message.
            */

            requestAnimationFrame(
                () => {

                    container.scrollTop =
                        container.scrollHeight;

                }
            );

        },

        error => {

            console.error(
                "❌ Chat loading error:",
                error
            );

        }

    );

}


/* =========================================================
   START PD
   ========================================================= */

onAuthStateChanged(
    auth,

    async user => {

        if (!user) {

            window.location.href =
                "login.html";

            return;

        }


        console.log(
            "🔐 Firebase user:",
            user.email
        );


        const profileReady =
            await setupProfile(
                user
            );


        if (!profileReady)
            return;


        startChat();

    }
);


/* =========================================================
   SEND BUTTON
   ========================================================= */

document
    .querySelector(
        ".send-message"
    )
    ?.addEventListener(
        "click",
        sendMessage
    );


/* =========================================================
   ENTER TO SEND
   ========================================================= */

document
    .querySelector(
        ".chat-input input"
    )
    ?.addEventListener(
        "keydown",

        event => {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();

                sendMessage();

            }

        }
    );
