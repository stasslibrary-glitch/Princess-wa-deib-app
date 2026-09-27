
/* =========================================================
   PRINCESS WA DEIB — CHAT
   FAST CHAT + DATES + VOICE NOTES
   ========================================================= */

import {
    auth,
    db,
    storage
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

import {
    ref,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";


/* =========================================================
   PD PROFILE
   ========================================================= */

let currentProfile = null;


const PD_PROFILES = {

    "princess@gmail.com": {
        name: "Princess",
        displayName: "Jaris ❤️"
    },

    "deib@gmail.com": {
        name: "Deib",
        displayName: "Ernest ❤️"
    }

};


/* =========================================================
   PROFILE
   ========================================================= */

async function setupProfile(user) {

    const email =
        user.email?.toLowerCase();

    const profile =
        PD_PROFILES[email];


    if (!profile) {

        console.error(
            "❌ No PD profile for:",
            email
        );

        return false;

    }


    currentProfile = {

        uid: user.uid,

        email: email,

        name: profile.name,

        displayName:
            profile.displayName

    };


    /*
       Update Firestore profile,
       but don't let this delay chat.
    */

    setDoc(
        doc(
            db,
            "users",
            user.uid
        ),
        {

            uid: user.uid,

            email: email,

            name: profile.name,

            displayName:
                profile.displayName,

            updatedAt:
                serverTimestamp()

        },
        {
            merge: true
        }
    ).catch(
        error => {

            console.error(
                "Profile update error:",
                error
            );

        }
    );


    updatePDInterface();

    return true;

}


/* =========================================================
   UPDATE INTERFACE
   ========================================================= */

function updatePDInterface() {

    if (!currentProfile)
        return;


    document
        .querySelectorAll(
            "[data-user-name]"
        )
        .forEach(
            element => {

                element.textContent =
                    currentProfile.displayName;

            }
        );


    document
        .querySelectorAll(
            "[data-chat-person-name]"
        )
        .forEach(
            element => {

                element.textContent =
                    currentProfile.name ===
                    "Deib"

                        ? "My Princess 💜"

                        : "My Deib ❤️";

            }
        );

}


/* =========================================================
   SEND TEXT
   ========================================================= */

async function sendMessage() {

    if (!currentProfile)
        return;


    const input =
        document.getElementById(
            "messageInput"
        );


    const button =
        document.querySelector(
            ".send-message"
        );


    if (!input)
        return;


    const text =
        input.value.trim();


    if (!text)
        return;


    if (button)
        button.disabled = true;


    try {

        await addDoc(
            collection(
                db,
                "messages"
            ),
            {

                type: "text",

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


    if (button)
        button.disabled = false;

}


/* =========================================================
   DATE HELPERS
   ========================================================= */

function getDateKey(date) {

    return [
        date.getFullYear(),

        String(
            date.getMonth() + 1
        ).padStart(2, "0"),

        String(
            date.getDate()
        ).padStart(2, "0")

    ].join("-");

}


function formatChatDate(date) {

    const today =
        new Date();


    const yesterday =
        new Date();


    yesterday.setDate(
        yesterday.getDate() - 1
    );


    const key =
        getDateKey(date);


    if (
        key ===
        getDateKey(today)
    ) {

        return "Today";

    }


    if (
        key ===
        getDateKey(yesterday)
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
   DATE SEPARATOR
   ========================================================= */

function addDateSeparator(
    container,
    date
) {

    const separator =
        document.createElement(
            "div"
        );


    separator.className =
        "chat-date-separator";


    const span =
        document.createElement(
            "span"
        );


    span.textContent =
        formatChatDate(date);


    separator.appendChild(
        span
    );


    container.appendChild(
        separator
    );

}


/* =========================================================
   DISPLAY TEXT MESSAGE
   ========================================================= */

function displayTextMessage(
    container,
    data,
    date
) {

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


    if (date) {

        time.textContent =
            date.toLocaleTimeString(
                [],
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );

    }


    message.appendChild(
        text
    );

    message.appendChild(
        time
    );


    container.appendChild(
        message
    );

}


/* =========================================================
   DISPLAY VOICE MESSAGE
   ========================================================= */

function displayVoiceMessage(
    container,
    data
) {

    if (!data.audioURL)
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
            ? "message sent voice-message"
            : "message received voice-message";


    const box =
        document.createElement(
            "div"
        );


    box.className =
        "voice-message-box";


    const icon =
        document.createElement(
            "div"
        );


    icon.className =
        "voice-icon";


    icon.innerHTML =
        '<i class="fa-solid fa-microphone"></i>';


    const audio =
        document.createElement(
            "audio"
        );


    audio.controls = true;

    audio.preload = "metadata";

    audio.src =
        data.audioURL;


    box.appendChild(
        icon
    );

    box.appendChild(
        audio
    );


    message.appendChild(
        box
    );


    container.appendChild(
        message
    );

}


/* =========================================================
   START CHAT
   ========================================================= */

function startChat() {

    const container =
        document.getElementById(
            "chatMessages"
        );


    if (!container)
        return;


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
               Render immediately.
            */

            container.innerHTML = "";


            let previousDateKey =
                null;


            snapshot.forEach(
                docSnapshot => {

                    const data =
                        docSnapshot.data();


                    let date = null;


                    if (
                        data.createdAt &&
                        typeof
                        data.createdAt.toDate ===
                        "function"
                    ) {

                        date =
                            data.createdAt.toDate();

                    }


                    /*
                       Date separator
                    */

                    if (date) {

                        const dateKey =
                            getDateKey(
                                date
                            );


                        if (
                            dateKey !==
                            previousDateKey
                        ) {

                            addDateSeparator(
                                container,
                                date
                            );


                            previousDateKey =
                                dateKey;

                        }

                    }


                    /*
                       Voice
                    */

                    if (
                        data.type ===
                        "voice"
                    ) {

                        displayVoiceMessage(
                            container,
                            data
                        );

                    }

                    /*
                       Text
                    */

                    else {

                        displayTextMessage(
                            container,
                            data,
                            date
                        );

                    }

                }
            );


            requestAnimationFrame(
                () => {

                    container.scrollTop =
                        container.scrollHeight;

                }
            );

        },

        error => {

            console.error(
                "❌ Firestore chat error:",
                error
            );

        }

    );

}


/* =========================================================
   VOICE RECORDING
   ========================================================= */

let mediaRecorder = null;

let audioChunks = [];

let recording = false;


/* =========================================================
   START RECORDING
   ========================================================= */

async function startRecording() {

    if (recording)
        return;


    try {

        const stream =
            await navigator
                .mediaDevices
                .getUserMedia({
                    audio: true
                });


        mediaRecorder =
            new MediaRecorder(
                stream
            );


        audioChunks = [];

        recording = true;


        mediaRecorder.ondataavailable =
            event => {

                if (
                    event.data.size > 0
                ) {

                    audioChunks.push(
                        event.data
                    );

                }

            };


        mediaRecorder.onstop =
            async () => {

                stream
                    .getTracks()
                    .forEach(
                        track =>
                            track.stop()
                    );


                const blob =
                    new Blob(
                        audioChunks,
                        {
                            type:
                                mediaRecorder.mimeType ||
                                "audio/webm"
                        }
                    );


                if (
                    blob.size > 0
                ) {

                    await uploadVoice(
                        blob
                    );

                }

            };


        mediaRecorder.start();


        updateVoiceButton(
            true
        );


        console.log(
            "🔴 PD voice recording started"
        );


    } catch (error) {

        console.error(
            "❌ Microphone error:",
            error
        );


        alert(
            "Please allow microphone access for PD ❤️"
        );

    }

}


/* =========================================================
   STOP RECORDING
   ========================================================= */

function stopRecording() {

    if (
        !mediaRecorder ||
        !recording
    )
        return;


    recording = false;


    mediaRecorder.stop();


    updateVoiceButton(
        false
    );

}


/* =========================================================
   UPLOAD VOICE
   ========================================================= */

async function uploadVoice(
    audioBlob
) {

    if (!currentProfile)
        return;


    const button =
        document.getElementById(
            "voiceButton"
        );


    if (button)
        button.classList.add(
            "uploading"
        );


    try {

        const fileName =
            `voice_${Date.now()}.webm`;


        const storageRef =
            ref(
                storage,
                `voice-messages/${currentProfile.uid}/${fileName}`
            );


        await uploadBytes(
            storageRef,
            audioBlob
        );


        const audioURL =
            await getDownloadURL(
                storageRef
            );


        await addDoc(
            collection(
                db,
                "messages"
            ),
            {

                type: "voice",

                audioURL:
                    audioURL,

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


    } catch (error) {

        console.error(
            "❌ Voice upload error:",
            error
        );


        alert(
            "Voice note failed to send."
        );

    }


    if (button)
        button.classList.remove(
            "uploading"
        );

}


/* =========================================================
   VOICE BUTTON
   ========================================================= */

function setupVoiceButton() {

    const button =
        document.getElementById(
            "voiceButton"
        );


    if (!button)
        return;


    button.addEventListener(
        "click",
        async () => {

            if (recording) {

                stopRecording();

            } else {

                await startRecording();

            }

        }
    );

}


function updateVoiceButton(
    active
) {

    const button =
        document.getElementById(
            "voiceButton"
        );


    if (!button)
        return;


    if (active) {

        button.classList.add(
            "recording"
        );


        button.innerHTML =
            '<i class="fa-solid fa-stop"></i>';

    } else {

        button.classList.remove(
            "recording"
        );


        button.innerHTML =
            '<i class="fa-solid fa-microphone"></i>';

    }

}


/* =========================================================
   AUTH
   ========================================================= */

onAuthStateChanged(
    auth,

    async user => {

        if (!user) {

            window.location.href =
                "login.html";

            return;

        }


        /*
           Setup profile first,
           then immediately start chat.
        */

        const ready =
            await setupProfile(
                user
            );


        if (!ready)
            return;


        startChat();

    }
);


/* =========================================================
   BUTTON EVENTS
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        /*
           TEXT SEND
        */

        const sendButton =
            document.querySelector(
                ".send-message"
            );


        if (sendButton) {

            sendButton.addEventListener(
                "click",
                sendMessage
            );

        }


        /*
           ENTER
        */

        const input =
            document.getElementById(
                "messageInput"
            );


        if (input) {

            input.addEventListener(
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

        }


        /*
           VOICE
        */

        setupVoiceButton();

    }
);
