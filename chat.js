
/* =========================================================
   PRINCESS WA DEIB — REALTIME CHAT
   chat.js
   Firebase • Live messages • Replies • Voice notes
   Presence • Read receipts • Date separators
   ========================================================= */

import { auth, db, storage, presenceDB } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    doc,
    updateDoc,
    arrayUnion
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import {
    ref as storageRef,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";

import {
    ref as databaseRef,
    onValue,
    onDisconnect,
    set,
    serverTimestamp as databaseTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";


/* =========================================================
   CONFIGURATION
   ========================================================= */

const CHAT_COLLECTION = "messages";

const PD_PROFILES = {
    "princess@gmail.com": {
        name: "Baby",
        displayName: "Baby ❤️"
    },

    "deib@gmail.com": {
        name: "Hubby",
        displayName: "Hubby 💜"
    }
};

const DEFAULT_PROFILE = {
    name: "My Love",
    displayName: "My Love ❤️"
};

let currentUser = null;
let currentProfile = null;

let unsubscribeMessages = null;
let unsubscribePresence = null;

let replyTarget = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordingStartedAt = 0;
let isRecording = false;
let isSending = false;
let messagesStarted = false;


/* =========================================================
   DOM HELPERS
   ========================================================= */

const $ = (selector, parent = document) =>
    parent.querySelector(selector);

const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];

function getChatElements() {
    return {
        messages: $("#chatMessages"),
        form: $("#chatForm"),
        input: $("#messageInput"),
        voiceButton: $("#voiceButton"),
        attachButton: $("#attachButton"),
        presence: $("#pd-presence-status"),
        loader: $("#pd-chat-loader")
    };
}

function safeText(value) {
    return String(value ?? "");
}

function showChatError(message) {
    console.error("[PD Chat]", message);

    let notice = $("#pd-chat-error");

    if (!notice) {
        notice = document.createElement("div");
        notice.id = "pd-chat-error";
        notice.setAttribute("role", "alert");

        Object.assign(notice.style, {
            margin: "10px",
            padding: "12px",
            borderRadius: "12px",
            background: "rgba(255,70,120,.13)",
            color: "#ffd9e5",
            fontSize: "13px",
            textAlign: "center",
            overflowWrap: "anywhere"
        });

        const { messages } = getChatElements();

        if (messages?.parentElement) {
            messages.parentElement.insertBefore(
                notice,
                messages
            );
        } else {
            document.body.appendChild(notice);
        }
    }

    notice.textContent = message;
}

function clearChatError() {
    $("#pd-chat-error")?.remove();
}


/* =========================================================
   STYLES
   ========================================================= */

function installChatStyles() {
    if ($("#pd-chat-extra-styles")) return;

    const style = document.createElement("style");
    style.id = "pd-chat-extra-styles";

    style.textContent = `
        #chatMessages {
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch;
            overflow-y: auto;
            overflow-x: hidden;
            scroll-behavior: smooth;
            overscroll-behavior: contain;
        }

        #chatMessages .message {
            display: flex !important;
            align-items: flex-end !important;
            gap: 5px;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0;
            padding: 2px 3px !important;
            margin: 3px 0 !important;
            background: transparent !important;
            border: 0 !important;
            box-shadow: none !important;
            box-sizing: border-box;
        }

        
/* Sent messages — RIGHT */
#chatMessages .message.sent {
    flex-direction: row-reverse !important;
    justify-content: flex-start !important;
    align-self: stretch;
}

/* Received messages — LEFT */
#chatMessages .message.received {
    flex-direction: row !important;
    justify-content: flex-start !important;
    align-self: stretch;
}

        }

        #chatMessages .pd-message-bubble {
            width: fit-content;
            min-width: 0;
            max-width: min(78%, 340px);
            padding: 10px 12px 7px;
            border-radius: 17px;
            overflow-wrap: anywhere;
            word-break: break-word;
            box-sizing: border-box;
            box-shadow: 0 4px 14px rgba(0,0,0,.13);
        }

        #chatMessages .message.sent .pd-message-bubble {
            color: #fff;
            background: linear-gradient(140deg, #9c48ed, #7134bc);
            border-bottom-left-radius: 5px;
        }

        #chatMessages .message.received .pd-message-bubble {
            color: #fff;
            background: #30203f;
            border: 1px solid rgba(210,160,255,.13);
            border-bottom-right-radius: 5px;
        }

        #chatMessages .pd-message-text {
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            line-height: 1.48;
            font-size: 14px;
        }

        #chatMessages .pd-message-quote {
            display: block;
            width: 100%;
            box-sizing: border-box;
            margin: 0 0 8px;
            padding: 8px 10px;
            text-align: left;
            border: 0;
            border-left: 3px solid #e8a7ff;
            border-radius: 8px;
            background: rgba(18, 8, 30, .43);
            color: #f7eaff;
            cursor: pointer;
        }

        #chatMessages .pd-message-quote-sender {
            display: block;
            color: #e9b7ff;
            font-size: 11px;
            font-weight: 700;
            margin-bottom: 3px;
        }

        #chatMessages .pd-message-quote-text {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            font-size: 12px;
            opacity: .9;
            overflow-wrap: anywhere;
        }

        #chatMessages .pd-reply-trigger {
            flex: 0 0 27px;
            width: 27px;
            height: 27px;
            padding: 0;
            margin-bottom: 5px;
            display: inline-flex;
            justify-content: center;
            align-items: center;
            border: 1px solid rgba(208,160,255,.23);
            border-radius: 50%;
            background: rgba(118,67,153,.22);
            color: #edc5ff;
            cursor: pointer;
            font-size: 12px;
            box-shadow: none;
            transition: transform .18s ease, background .18s ease;
        }

        #chatMessages .pd-reply-trigger:hover {
            transform: scale(1.08);
            background: rgba(170,92,230,.36);
        }

        #chatMessages .pd-message-footer {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 5px;
            margin-top: 5px;
            font-size: 10px;
            line-height: 1.2;
            opacity: .76;
        }

        #chatMessages .pd-message-receipt {
            letter-spacing: -2px;
            font-size: 12px;
        }

        #chatMessages .pd-message-receipt.is-read {
            color: #8ee8ff;
            opacity: 1;
        }

        #chatMessages .chat-date-separator,
        #chatMessages .pd-date-separator {
            flex: 0 0 auto;
            align-self: center;
            width: fit-content;
            max-width: 90%;
            margin: 12px auto !important;
            padding: 6px 12px;
            border-radius: 20px;
            background: rgba(111,72,140,.25);
            border: 1px solid rgba(213,173,255,.12);
            color: #ead6ff;
            text-align: center;
            font-size: 11px;
        }

        #chatMessages .pd-voice-player {
            display: flex;
            align-items: center;
            gap: 9px;
            min-width: 160px;
        }

        #chatMessages .pd-voice-play {
            width: 35px;
            height: 35px;
            flex: 0 0 35px;
            border: 0;
            border-radius: 50%;
            background: rgba(255,255,255,.18);
            color: white;
            cursor: pointer;
        }

        #chatMessages .pd-voice-details {
            flex: 1;
            min-width: 0;
        }

        #chatMessages .pd-voice-progress {
            width: 100%;
            height: 4px;
            accent-color: #e4b5ff;
        }

        #chatMessages .pd-voice-duration {
            display: block;
            margin-top: 5px;
            font-size: 10px;
            opacity: .75;
        }

        #pd-reply-preview {
            display: none;
            align-items: center;
            gap: 9px;
            margin: 5px 10px;
            padding: 9px 11px;
            border-left: 3px solid #d9a2ff;
            border-radius: 9px;
            background: rgba(104,56,132,.23);
            color: #f8eaff;
        }

        #pd-reply-preview.active {
            display: flex;
        }

        #pd-reply-preview .pd-reply-preview-content {
            flex: 1;
            min-width: 0;
        }

        #pd-reply-preview .pd-reply-preview-name {
            font-size: 11px;
            font-weight: 700;
            color: #e6b8ff;
            margin-bottom: 3px;
        }

        #pd-reply-preview .pd-reply-preview-text {
            font-size: 12px;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        }

        #pd-reply-preview button {
            border: 0;
            background: transparent;
            color: #fff;
            font-size: 18px;
            cursor: pointer;
        }

        #messageInput {
            resize: none;
            overflow-y: auto;
            max-height: 120px;
            min-height: 42px;
            box-sizing: border-box;
        }

        .pd-recording-active {
            color: #ff6a9c !important;
            animation: pd-recording-pulse .9s infinite alternate;
        }

        @keyframes pd-recording-pulse {
            from { opacity: .65; transform: scale(1); }
            to { opacity: 1; transform: scale(1.09); }
        }

        @media (max-width: 480px) {
            #chatMessages .pd-message-bubble {
                max-width: min(79%, 320px);
            }

            #chatMessages .pd-reply-trigger {
                width: 25px;
                height: 25px;
                flex-basis: 25px;
            }
        }
    `;

    document.head.appendChild(style);
}


/* =========================================================
   PROFILE
   ========================================================= */

function getProfile(user) {
    const email = (user.email || "").toLowerCase();

    return {
        uid: user.uid,
        email,
        name: PD_PROFILES[email]?.name || user.displayName || DEFAULT_PROFILE.name,
        displayName:
            PD_PROFILES[email]?.displayName ||
            user.displayName ||
            DEFAULT_PROFILE.displayName
    };
}

function setupProfile() {
    if (!currentUser) return;

    currentProfile = getProfile(currentUser);

    $$("[data-user-name]").forEach(element => {
        element.textContent = currentProfile.name;
    });

    $$("[data-chat-person-name]").forEach(element => {
        element.textContent = currentProfile.name;
    });

    $$("[data-chat-display-name]").forEach(element => {
        element.textContent = currentProfile.displayName;
    });

    document.title = `${currentProfile.name} ❤️ | PD Chat`;
}


/* =========================================================
   LOADER
   ========================================================= */

function hideChatLoader() {
    const { loader } = getChatElements();

    if (!loader) return;

    loader.classList.add("hidden");
    loader.setAttribute("aria-hidden", "true");

    loader.style.opacity = "0";
    loader.style.pointerEvents = "none";

    setTimeout(() => {
        loader.style.display = "none";
    }, 250);
}

function showChatLoader() {
    const { loader } = getChatElements();

    if (!loader) return;

    loader.style.display = "flex";
    loader.style.opacity = "1";
    loader.style.pointerEvents = "auto";
    loader.classList.remove("hidden");
    loader.setAttribute("aria-hidden", "false");
}


/* =========================================================
   DATE AND TIME
   ========================================================= */

function formatTime(timestamp) {
    if (!timestamp) return "";

    const date = timestamp.toDate
        ? timestamp.toDate()
        : new Date(timestamp);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
    });
}

function dateKey(timestamp) {
    const date = timestamp?.toDate
        ? timestamp.toDate()
        : timestamp
            ? new Date(timestamp)
            : new Date();

    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatDateSeparator(timestamp) {
    const date = timestamp?.toDate
        ? timestamp.toDate()
        : timestamp
            ? new Date(timestamp)
            : new Date();

    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    if (dateKey(date) === dateKey(now)) return "Today";

    if (dateKey(date) === dateKey(yesterday)) return "Yesterday";

    return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: date.getFullYear() === now.getFullYear()
            ? undefined
            : "numeric"
    });
}

function makeDateSeparator(timestamp) {
    const separator = document.createElement("div");

    separator.className = "pd-date-separator chat-date-separator";
    separator.textContent = formatDateSeparator(timestamp);

    return separator;
}


/* =========================================================
   REPLY PREVIEW
   ========================================================= */

function ensureReplyPreview() {
    let preview = $("#pd-reply-preview");

    if (preview) return preview;

    preview = document.createElement("div");
    preview.id = "pd-reply-preview";

    preview.innerHTML = `
        <div class="pd-reply-preview-content">
            <div class="pd-reply-preview-name"></div>
            <div class="pd-reply-preview-text"></div>
        </div>
        <button type="button" aria-label="Cancel reply" title="Cancel reply">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;

    const { form } = getChatElements();

    if (form?.parentElement) {
        form.parentElement.insertBefore(preview, form);
    }

    preview.querySelector("button")?.addEventListener("click", clearReplyMode);

    return preview;
}

function setReplyMode(messageId, data) {
    replyTarget = {
        messageId,
        senderUID: data.senderUID || "",
        senderName: data.senderName || "My Love",
        text: data.type === "voice"
            ? "🎤 Voice message"
            : safeText(data.text || ""),
        type: data.type || "text"
    };

    const preview = ensureReplyPreview();

    preview.querySelector(".pd-reply-preview-name").textContent =
        `Replying to ${replyTarget.senderName}`;

    preview.querySelector(".pd-reply-preview-text").textContent =
        replyTarget.text || "Message";

    preview.classList.add("active");

    const { input } = getChatElements();
    input?.focus();
}

function clearReplyMode() {
    replyTarget = null;

    const preview = $("#pd-reply-preview");

    if (preview) preview.classList.remove("active");
}

function createQuotedMessage(replyTo) {
    if (!replyTo) return null;

    const quote = document.createElement("button");

    quote.type = "button";
    quote.className = "pd-message-quote";

    const sender = document.createElement("span");
    sender.className = "pd-message-quote-sender";
    sender.textContent = replyTo.senderName || "Message";

    const quotedText = document.createElement("span");
    quotedText.className = "pd-message-quote-text";

    quotedText.textContent =
        replyTo.type === "voice"
            ? "🎤 Voice message"
            : safeText(replyTo.text || "Original message");

    quote.append(sender, quotedText);

    quote.addEventListener("click", () => {
        const original = document.getElementById(
            `pd-message-${replyTo.messageId}`
        );

        if (!original) return;

        original.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

        original.animate(
            [
                { filter: "brightness(1)" },
                { filter: "brightness(1.7)" },
                { filter: "brightness(1)" }
            ],
            { duration: 650 }
        );
    });

    return quote;
}


/* =========================================================
   RECEIPTS
   ========================================================= */


function makeMessageFooter(data, mine) {
    const footer = document.createElement("div");
    footer.className = "pd-message-footer";

    const time = document.createElement("span");
    time.textContent = formatTime(data.createdAt);
    footer.appendChild(time);

    if (mine) {
        const receipt = document.createElement("span");
        receipt.className = "pd-message-receipt";

        const readBy = Array.isArray(data.readBy) ? data.readBy : [];
        const deliveredTo = Array.isArray(data.deliveredTo)
            ? data.deliveredTo
            : [];

        if (readBy.length > 1) {
            receipt.textContent = "💜";
            receipt.classList.add("is-read");
            receipt.title = "Read";
        } else if (deliveredTo.length > 1) {
            receipt.textContent = "💘";
            receipt.title = "Delivered";
        } else {
            receipt.textContent = "👌";
            receipt.title = "Sent";
        }

        footer.appendChild(receipt);
    }

    return footer;
}


async function markMessageDelivered(messageId, data) {
    if (!currentUser || data.senderUID === currentUser.uid) return;

    try {
        await updateDoc(doc(db, CHAT_COLLECTION, messageId), {
            deliveredTo: arrayUnion(currentUser.uid)
        });
    } catch (error) {
        console.warn("[PD Chat] Delivery receipt could not be updated.", error);
    }
}

async function markMessageRead(messageId, data) {
    if (!currentUser || data.senderUID === currentUser.uid) return;

    try {
        await updateDoc(doc(db, CHAT_COLLECTION, messageId), {
            readBy: arrayUnion(currentUser.uid),
            deliveredTo: arrayUnion(currentUser.uid)
        });
    } catch (error) {
        console.warn("[PD Chat] Read receipt could not be updated.", error);
    }
}


/* =========================================================
   REPLY BUTTON
   ========================================================= */

function createReplyButton(messageId, data) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "pd-reply-trigger";
    button.title = "Reply to message";
    button.setAttribute("aria-label", "Reply to message");

    button.innerHTML = `<i class="fa-solid fa-reply"></i>`;

    button.addEventListener("click", () => {
        setReplyMode(messageId, data);
    });

    return button;
}


/* =========================================================
   TEXT MESSAGES
   ========================================================= */

function displayTextMessage(container, data, messageId) {
    const mine = data.senderUID === currentUser.uid;

    const row = document.createElement("div");
    row.id = `pd-message-${messageId}`;
    row.dataset.messageId = messageId;
    row.className = mine ? "message sent" : "message received";

    const bubble = document.createElement("div");
    bubble.className = "pd-message-bubble";

    const quote = createQuotedMessage(data.replyTo);

    if (quote) bubble.appendChild(quote);

    const text = document.createElement("div");
    text.className = "pd-message-text message-text";
    text.textContent = safeText(data.text);

    bubble.appendChild(text);
    bubble.appendChild(makeMessageFooter(data, mine));

    row.appendChild(bubble);
    row.appendChild(createReplyButton(messageId, data));

    container.appendChild(row);

    if (!mine) {
        void markMessageDelivered(messageId, data);
    }

    return row;
}


/* =========================================================
   VOICE MESSAGES
   ========================================================= */

function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(seconds || 0));
    const minutes = Math.floor(total / 60);
    const remaining = total % 60;

    return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function displayVoiceMessage(container, data, messageId) {
    const mine = data.senderUID === currentUser.uid;

    const row = document.createElement("div");
    row.id = `pd-message-${messageId}`;
    row.dataset.messageId = messageId;
    row.className = mine ? "message sent" : "message received";

    const bubble = document.createElement("div");
    bubble.className = "pd-message-bubble";

    const quote = createQuotedMessage(data.replyTo);

    if (quote) bubble.appendChild(quote);

    const player = document.createElement("div");
    player.className = "pd-voice-player";

    const playButton = document.createElement("button");
    playButton.type = "button";
    playButton.className = "pd-voice-play";
    playButton.innerHTML = `<i class="fa-solid fa-play"></i>`;
    playButton.setAttribute("aria-label", "Play voice message");

    const details = document.createElement("div");
    details.className = "pd-voice-details";

    const progress = document.createElement("input");
    progress.type = "range";
    progress.min = "0";
    progress.max = "100";
    progress.value = "0";
    progress.className = "pd-voice-progress";
    progress.setAttribute("aria-label", "Voice message progress");

    const duration = document.createElement("span");
    duration.className = "pd-voice-duration";
    duration.textContent = formatDuration(data.duration);

    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.src = data.audioURL || data.url || "";
    audio.style.display = "none";

    playButton.addEventListener("click", async () => {
        if (!audio.src) return;

        if (audio.paused) {
            $$("audio").forEach(otherAudio => {
                if (otherAudio !== audio) otherAudio.pause();
            });

            try {
                await audio.play();
                playButton.innerHTML = `<i class="fa-solid fa-pause"></i>`;
            } catch (error) {
                console.error("[PD Chat] Could not play voice note.", error);
                showChatError("Unable to play this voice message.");
            }
        } else {
            audio.pause();
        }
    });

    audio.addEventListener("timeupdate", () => {
        if (audio.duration && Number.isFinite(audio.duration)) {
            progress.value = String(
                (audio.currentTime / audio.duration) * 100
            );

            duration.textContent =
                `${formatDuration(audio.currentTime)} / ${formatDuration(audio.duration)}`;
        }
    });

    audio.addEventListener("loadedmetadata", () => {
        if (Number.isFinite(audio.duration)) {
            duration.textContent = formatDuration(audio.duration);
        }
    });

    audio.addEventListener("ended", () => {
        playButton.innerHTML = `<i class="fa-solid fa-play"></i>`;
        progress.value = "0";
    });

    audio.addEventListener("pause", () => {
        playButton.innerHTML = `<i class="fa-solid fa-play"></i>`;
    });

    progress.addEventListener("input", () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
            audio.currentTime =
                (Number(progress.value) / 100) * audio.duration;
        }
    });

    details.append(progress, duration);
    player.append(playButton, details, audio);

    bubble.appendChild(player);
    bubble.appendChild(makeMessageFooter(data, mine));

    row.appendChild(bubble);
    row.appendChild(createReplyButton(messageId, data));

    container.appendChild(row);

    if (!mine) {
        void markMessageDelivered(messageId, data);
    }

    return row;
}


/* =========================================================
   MESSAGE RENDERING
   ========================================================= */

function renderMessages(snapshot) {
    const { messages } = getChatElements();

    if (!messages || !currentUser) return;

    const shouldScroll =
        messages.scrollHeight -
        messages.scrollTop -
        messages.clientHeight < 140;

    messages.replaceChildren();

    let previousDate = null;

    snapshot.forEach(messageSnapshot => {
        const data = messageSnapshot.data();
        const messageId = messageSnapshot.id;

        const key = dateKey(data.createdAt);

        if (key !== previousDate) {
            messages.appendChild(makeDateSeparator(data.createdAt));
            previousDate = key;
        }

        if (data.type === "voice" || data.type === "audio") {
            displayVoiceMessage(messages, data, messageId);
        } else {
            displayTextMessage(messages, data, messageId);
        }

        if (data.senderUID !== currentUser.uid) {
            void markMessageRead(messageId, data);
        }
    });

    if (shouldScroll || snapshot.empty) {
        requestAnimationFrame(() => {
            messages.scrollTop = messages.scrollHeight;
        });
    }
}


/* =========================================================
   SEND TEXT MESSAGE
   ========================================================= */

async function sendMessage(event) {
    event?.preventDefault();

    const { input } = getChatElements();

    if (!input || !currentUser || !currentProfile || isSending) return;

    const text = input.value.trim();

    if (!text) return;

    isSending = true;

    const sendButton = $(".send-message");

    if (sendButton) sendButton.disabled = true;

    try {
        const messageData = {
            type: "text",
            text,
            senderUID: currentUser.uid,
            senderName: currentProfile.name,
            senderDisplayName: currentProfile.displayName,
            createdAt: serverTimestamp(),
            deliveredTo: [currentUser.uid],
            readBy: [currentUser.uid]
        };

        if (replyTarget) {
            messageData.replyTo = { ...replyTarget };
        }

        await addDoc(collection(db, CHAT_COLLECTION), messageData);

        input.value = "";
        input.style.height = "auto";

        clearReplyMode();
        clearChatError();
    } catch (error) {
        console.error("[PD Chat] Message send failed:", error);
        showChatError("Your message could not be sent. Check your connection and Firebase permissions.");
    } finally {
        isSending = false;

        if (sendButton) sendButton.disabled = false;

        input.focus();
    }
}


/* =========================================================
   VOICE NOTE RECORDING
   ========================================================= */

function setRecordingUI(active) {
    const { voiceButton } = getChatElements();

    if (!voiceButton) return;

    voiceButton.classList.toggle("pd-recording-active", active);

    voiceButton.innerHTML = active
        ? `<i class="fa-solid fa-stop"></i>`
        : `<i class="fa-solid fa-microphone"></i>`;

    voiceButton.title = active
        ? "Stop recording"
        : "Record voice message";
}

async function startVoiceRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        showChatError("Voice recording is not supported by this browser.");
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

        recordedChunks = [];

        const options = {};

        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
            options.mimeType = "audio/webm;codecs=opus";
        }

        mediaRecorder = new MediaRecorder(stream, options);

        mediaRecorder.addEventListener("dataavailable", event => {
            if (event.data?.size > 0) {
                recordedChunks.push(event.data);
            }
        });

        mediaRecorder.addEventListener("stop", async () => {
            stream.getTracks().forEach(track => track.stop());

            setRecordingUI(false);

            const duration = Math.round(
                (Date.now() - recordingStartedAt) / 1000
            );

            if (recordedChunks.length && duration > 0) {
                const blob = new Blob(recordedChunks, {
                    type: mediaRecorder?.mimeType || "audio/webm"
                });

                await uploadVoiceMessage(blob, duration);
            }

            recordedChunks = [];
            mediaRecorder = null;
        });

        recordingStartedAt = Date.now();
        isRecording = true;

        mediaRecorder.start();
        setRecordingUI(true);
    } catch (error) {
        console.error("[PD Chat] Microphone access failed:", error);

        showChatError(
            "Microphone access was denied. Allow microphone access and try again."
        );

        setRecordingUI(false);
    }
}

function stopVoiceRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        isRecording = false;
        mediaRecorder.stop();
    }
}

async function uploadVoiceMessage(blob, duration) {
    if (!currentUser || !currentProfile) return;

    const voiceButton = getChatElements().voiceButton;

    if (voiceButton) voiceButton.disabled = true;

    try {
        const fileName = `voice-${Date.now()}.webm`;

        const fileReference = storageRef(
            storage,
            `chat-voice/${currentUser.uid}/${fileName}`
        );

        await uploadBytes(fileReference, blob, {
            contentType: blob.type || "audio/webm"
        });

        const audioURL = await getDownloadURL(fileReference);

        const messageData = {
            type: "voice",
            text: "",
            audioURL,
            duration,
            senderUID: currentUser.uid,
            senderName: currentProfile.name,
            senderDisplayName: currentProfile.displayName,
            createdAt: serverTimestamp(),
            deliveredTo: [currentUser.uid],
            readBy: [currentUser.uid]
        };

        if (replyTarget) {
            messageData.replyTo = { ...replyTarget };
        }

        await addDoc(collection(db, CHAT_COLLECTION), messageData);

        clearReplyMode();
        clearChatError();
    } catch (error) {
        console.error("[PD Chat] Voice upload failed:", error);

        showChatError(
            "Voice note failed to upload. Check Firebase Storage permissions and your connection."
        );
    } finally {
        if (voiceButton) voiceButton.disabled = false;
    }
}


/* =========================================================
   ONLINE PRESENCE
   ========================================================= */

function startOwnPresence() {
    if (!currentUser || !presenceDB) return;

    const statusReference = databaseRef(
        presenceDB,
        `status/${currentUser.uid}`
    );

    const offlineData = {
        state: "offline",
        lastChanged: databaseTimestamp()
    };

    const onlineData = {
        state: "online",
        lastChanged: databaseTimestamp()
    };

    set(statusReference, onlineData).catch(error => {
        console.warn("[PD Chat] Presence update failed:", error);
    });

    onDisconnect(statusReference)
        .set(offlineData)
        .catch(error => {
            console.warn("[PD Chat] Could not register offline status:", error);
        });

    const setOffline = () => {
        set(statusReference, offlineData).catch(() => {});
    };

    window.addEventListener("pagehide", setOffline);
}

function watchPartnerPresence() {
    if (!currentUser || !presenceDB) return;

    const partnerEmail = Object.keys(PD_PROFILES).find(
        email => email !== currentProfile.email
    );

    const presence = getChatElements().presence;

    if (!presence) return;

    presence.textContent = "Connected";

    /*
       Resolve the other user's UID from their existing
       authenticated account record in Firestore, if present.
    */

    const partnerUIDDocument = doc(
        db,
        "users",
        partnerEmail || "partner"
    );

    import("https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js")
        .then(({ getDoc }) => getDoc(partnerUIDDocument))
        .then(userSnapshot => {
            if (!userSnapshot.exists()) {
                presence.textContent = "Together in PD ❤️";
                return;
            }

            const partnerUID = userSnapshot.data().uid;

            if (!partnerUID) {
                presence.textContent = "Together in PD ❤️";
                return;
            }

            const partnerStatus = databaseRef(
                presenceDB,
                `status/${partnerUID}`
            );

            unsubscribePresence = onValue(partnerStatus, snapshot => {
                const data = snapshot.val();

                presence.textContent =
                    data?.state === "online"
                        ? "Online now 💜"
                        : "Offline";
            }, error => {
                console.warn("[PD Chat] Presence listener failed:", error);
                presence.textContent = "Together in PD ❤️";
            });
        })
        .catch(error => {
            console.warn("[PD Chat] Could not load partner presence:", error);
            presence.textContent = "Together in PD ❤️";
        });
}


/* =========================================================
   REALTIME CHAT LISTENER
   ========================================================= */

function startChat() {
    if (!currentUser || messagesStarted) return;

    const { messages } = getChatElements();

    if (!messages) {
        showChatError("The chat message area #chatMessages is missing from chat.html.");
        hideChatLoader();
        return;
    }

    messagesStarted = true;

    const messagesQuery = query(
        collection(db, CHAT_COLLECTION),
        orderBy("createdAt", "asc")
    );

    unsubscribeMessages = onSnapshot(
        messagesQuery,
        snapshot => {
            clearChatError();
            renderMessages(snapshot);
            hideChatLoader();
        },
        error => {
            console.error("[PD Chat] Realtime listener failed:", error);

            hideChatLoader();

            showChatError(
                "Chat could not load. Check Firestore access rules and the browser console."
            );

            messagesStarted = false;
        }
    );
}


/* =========================================================
   INPUT AND PAGE EVENTS
   ========================================================= */

function setupPageEvents() {
    const {
        form,
        input,
        voiceButton,
        attachButton
    } = getChatElements();

    if (form && !form.dataset.pdBound) {
        form.dataset.pdBound = "true";

        form.addEventListener("submit", sendMessage);
    }

    if (input && !input.dataset.pdBound) {
        input.dataset.pdBound = "true";

        input.addEventListener("input", () => {
            input.style.height = "auto";

            input.style.height = `${Math.min(
                input.scrollHeight,
                120
            )}px`;
        });

        input.addEventListener("keydown", event => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();

                if (form?.requestSubmit) {
                    form.requestSubmit();
                } else {
                    void sendMessage(event);
                }
            }
        });
    }

    if (voiceButton && !voiceButton.dataset.pdBound) {
        voiceButton.dataset.pdBound = "true";

        voiceButton.addEventListener("click", async event => {
            event.preventDefault();

            if (isRecording) {
                stopVoiceRecording();
            } else {
                await startVoiceRecording();
            }
        });
    }

    /*
       Keep an existing attachment button from accidentally
       submitting the message form. Image/file attachment
       behavior can be added separately if your HTML includes
       a file picker.
    */

    if (attachButton && !attachButton.dataset.pdBound) {
        attachButton.dataset.pdBound = "true";

        attachButton.addEventListener("click", event => {
            event.preventDefault();

            showChatError(
                "File attachments are not enabled in this chat version yet."
            );
        });
    }
}


/* =========================================================
   STARTUP
   ========================================================= */

function startPDChat() {
    installChatStyles();
    setupPageEvents();
    showChatLoader();

    onAuthStateChanged(auth, user => {
        if (unsubscribeMessages) {
            unsubscribeMessages();
            unsubscribeMessages = null;
        }

        if (unsubscribePresence) {
            unsubscribePresence();
            unsubscribePresence = null;
        }

        messagesStarted = false;
        currentUser = user;
        currentProfile = null;

        if (!user) {
            hideChatLoader();

            if (!window.location.pathname.endsWith("/login.html") &&
                !window.location.pathname.endsWith("login.html")) {
                window.location.href = "login.html";
            }

            return;
        }

        setupProfile();
        startOwnPresence();
        watchPartnerPresence();
        startChat();
    }, error => {
        console.error("[PD Chat] Authentication listener failed:", error);

        hideChatLoader();

        showChatError(
            "Could not verify your login. Refresh the page or sign in again."
        );
    });
}


/* =========================================================
   CLEANUP
   ========================================================= */

window.addEventListener("pagehide", () => {
    if (unsubscribeMessages) unsubscribeMessages();
    if (unsubscribePresence) unsubscribePresence();
});


/* Start only after the document is ready */
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startPDChat, {
        once: true
    });
} else {
    startPDChat();
}
