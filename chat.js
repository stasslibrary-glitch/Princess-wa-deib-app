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

const messageSound = new Audio("sounds/message.mp3");

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

    const email = user.email?.toLowerCase();

    const profile = PD_PROFILES[email];

    if (!profile) {

        console.error(
            "❌ This Firebase email is not assigned a PD profile:",
            email
        );

        return false;
    }


    const profileRef = doc(
        db,
        "users",
        user.uid
    );


    /*
       IMPORTANT:

       We write the profile every time the user logs in.
       This fixes old/wrong profile information that may
       already exist in Firestore.
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

            updatedAt: serverTimestamp()

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
       Elements specifically marked with
       data-user-name will show the logged-in user.
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
       The chat header should show the PERSON
       YOU ARE TALKING TO, not yourself.
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
   DISPLAY MESSAGE
   ========================================================= */

function displayMessage(data) {

    const container =
        document.querySelector(
            ".chat-messages"
        );


    if (
        !container ||
        !currentProfile
    )
        return;


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


    const text =
        document.createElement(
            "div"
        );


    text.className =
        "message-text";


    text.textContent =
        data.text || "";


    const time =
        document.createElement(
            "span"
        );


    time.className =
        "message-time";


    if (
        data.createdAt &&
        typeof data.createdAt.toDate ===
        "function"
    ) {

        const date =
            data.createdAt.toDate();


        time.textContent =
            date.toLocaleTimeString(
                [],
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );

    }


    message.appendChild(text);

    message.appendChild(time);

    container.appendChild(message);

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


    let firstChatLoad = true;

onSnapshot(
    messagesQuery,
    snapshot => {

        const container =
            document.querySelector(".chat-messages");

        if (!container) return;

        container.innerHTML = "";

        snapshot.forEach(docSnapshot => {

            displayMessage(
                docSnapshot.data()
            );

        });

        requestAnimationFrame(() => {

            container.scrollTop =
                container.scrollHeight;

        });

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
            await setupProfile(user);


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