
/* =========================================================
   PRINCESS WA DEIB — COMPLETE CHAT SYSTEM
   Text + Multiline Typing + Reply to Message
   Voice Notes + Dates + Online + Last Seen
   Sent + Delivered + Read Receipts
   ========================================================= */

import {
    auth,
    db,
    storage,
    presenceDB
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
    serverTimestamp,
    getDocs,
    where,
    limit,
    updateDoc
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
    push,
    serverTimestamp as databaseServerTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";


/* =========================================================
   PROFILES — PRESERVED FROM YOUR CODE
   ========================================================= */

let currentProfile = null;
let recipientUID = null;

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


/* =========================================================
   GLOBAL STATE
   ========================================================= */

let chatUnsubscribe = null;
let partnerPresenceUnsubscribe = null;
let connectedUnsubscribe = null;
let lastChangedUnsubscribe = null;

let activePresenceUID = null;
let activePartnerUID = null;

let latestMessageDocs = [];
let firstMessagesLoaded = false;

let currentReply = null;
let mediaRecorder = null;
let recording = false;
let audioChunks = [];

const receiptUpdatesInFlight = new Set();


/* =========================================================
   EXTRA STYLES
   ========================================================= */

function installChatStyles() {
    if (document.getElementById("pd-chat-extra-styles")) return;

    const style = document.createElement("style");
    style.id = "pd-chat-extra-styles";

    style.textContent = `
        .pd-presence-status {
            display: block;
            margin-top: 3px;
            font-size: 11px;
            line-height: 1.4;
            font-weight: 500;
            color: #b9a8d9;
        }

        .pd-presence-status.is-online {
            color: #42df91;
        }

        .pd-presence-status.is-offline {
            color: #b9a8d9;
        }

        .pd-message-footer {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 5px;
            margin-top: 4px;
            font-size: 10px;
            line-height: 1.2;
        }

        .pd-message-receipt {
            display: inline-block;
            font-size: 12px;
            white-space: nowrap;
        }

        .pd-message-receipt.receipt-read {
            color: #42c8ff;
        }

        .pd-message-receipt.receipt-delivered,
        .pd-message-receipt.receipt-sent {
            color: #b9a8d9;
        }

        /* Message action area */
        .message {
            position: relative;
            overflow-wrap: anywhere;
        }

        .pd-message-actions {
            display: flex;
            justify-content: flex-end;
            margin-top: 5px;
        }

        .pd-reply-trigger {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            min-width: 30px;
            min-height: 27px;
            padding: 4px 9px;
            border: 1px solid rgba(180, 130, 255, .25);
            border-radius: 14px;
            background: rgba(130, 80, 180, .12);
            color: inherit;
            font: inherit;
            font-size: 11px;
            cursor: pointer;
            opacity: .8;
            transition: background .2s, opacity .2s, transform .2s;
        }

        .pd-reply-trigger:hover,
        .pd-reply-trigger:focus-visible {
            opacity: 1;
            background: rgba(180, 100, 255, .22);
            transform: translateY(-1px);
            outline: none;
        }

        /* Quoted message inside a reply */
        .pd-message-quote {
            display: block;
            width: 100%;
            box-sizing: border-box;
            margin: 0 0 8px;
            padding: 8px 10px;
            border: 0;
            border-left: 3px solid #c16cff;
            border-radius: 8px;
            background: rgba(120, 70, 160, .13);
            color: inherit;
            text-align: left;
            cursor: pointer;
            overflow: hidden;
        }

        .pd-message-quote:hover {
            background: rgba(150, 90, 200, .2);
        }

        .pd-message-quote-sender {
            display: block;
            margin-bottom: 3px;
            color: #d9a1ff;
            font-size: 11px;
            font-weight: 700;
        }

        .pd-message-quote-text {
            display: -webkit-box;
            overflow: hidden;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            font-size: 12px;
            line-height: 1.4;
            opacity: .9;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
        }

        .pd-message-highlight {
            outline: 2px solid rgba(206, 130, 255, .9);
            box-shadow: 0 0 18px rgba(185, 90, 255, .35);
            transition: outline .2s, box-shadow .2s;
        }

        /* Reply preview above the typing area */
        .pd-reply-composer {
            display: none;
            flex: 0 0 100%;
            width: 100%;
            min-width: 0;
            box-sizing: border-box;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
            padding: 8px 10px;
            border: 1px solid rgba(190, 130, 255, .24);
            border-radius: 12px;
            background: rgba(100, 55, 140, .12);
        }

        .chat-input.is-replying .pd-reply-composer {
            display: flex;
        }

        .pd-reply-accent {
            width: 3px;
            min-width: 3px;
            align-self: stretch;
            border-radius: 5px;
            background: linear-gradient(180deg, #f238a9, #a85cff);
        }

        .pd-reply-content {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 3px;
        }

        .pd-reply-label {
            color: #d9a1ff;
            font-size: 11px;
            font-weight: 700;
        }

        .pd-reply-text {
            overflow: hidden;
            color: inherit;
            font-size: 12px;
            line-height: 1.4;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .pd-reply-cancel {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex: 0 0 30px;
            width: 30px;
            height: 30px;
            border: 0;
            border-radius: 50%;
            background: rgba(160, 100, 200, .16);
            color: inherit;
            cursor: pointer;
        }

        .pd-reply-cancel:hover {
            background: rgba(220, 80, 140, .22);
        }

        /* Multiline typing */
        .phone-app.chat-app .chat-input {
            height: auto !important;
            max-height: 200px !important;
            flex: 0 0 auto !important;
            flex-wrap: wrap;
            align-items: flex-end;
        }

        .phone-app.chat-app #messageInput {
            min-width: 0;
            min-height: 42px;
            max-height: 120px;
            height: 42px;
            resize: none;
            overflow-y: hidden;
            box-sizing: border-box;
            line-height: 1.45;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
        }

        .phone-app.chat-app .chat-input .send-message,
        .phone-app.chat-app .chat-input .attach-button {
            flex-shrink: 0;
            align-self: flex-end;
        }

        .chat-date-separator {
            display: flex;
            justify-content: center;
            margin: 14px auto;
            width: 100%;
        }

        .chat-date-separator span {
            padding: 5px 12px;
            border-radius: 14px;
            background: rgba(100, 60, 130, .16);
            color: inherit;
            font-size: 11px;
        }
    `;

    document.head.appendChild(style);
}


/* =========================================================
   PROFILE SETUP
   ========================================================= */

async function setupProfile(user) {
    const email = user.email?.toLowerCase();
    const profile = PD_PROFILES[email];

    if (!profile) {
        console.error("PD: No profile configured for:", email);
        return false;
    }

    currentProfile = {
        uid: user.uid,
        email,
        name: profile.name,
        displayName: profile.displayName
    };

    recipientUID = null;

    updatePDInterface();

    setDoc(
        doc(db, "users", user.uid),
        {
            uid: user.uid,
            email,
            name: profile.name,
            displayName: profile.displayName,
            updatedAt: serverTimestamp()
        },
        { merge: true }
    ).catch(error => {
        console.error("PD profile update error:", error);
    });

    return true;
}


function updatePDInterface() {
    if (!currentProfile) return;

    document.querySelectorAll("[data-user-name]").forEach(element => {
        element.textContent = currentProfile.displayName;
    });

    document.querySelectorAll("[data-chat-person-name]").forEach(element => {
        element.textContent =
            currentProfile.name === "Deib"
                ? "My Princess 💜"
                : "My Deib ❤️";
    });
}


/* =========================================================
   PARTNER ACCOUNT LOOKUP
   ========================================================= */

function getPartnerEmail() {
    if (!currentProfile) return null;

    return currentProfile.email === "princess@gmail.com"
        ? "deib@gmail.com"
        : "princess@gmail.com";
}


async function findPartnerUID() {
    if (recipientUID) return recipientUID;
    if (!currentProfile) return null;

    const partnerEmail = getPartnerEmail();
    if (!partnerEmail) return null;

    try {
        const partnerQuery = query(
            collection(db, "users"),
            where("email", "==", partnerEmail),
            limit(1)
        );

        const result = await getDocs(partnerQuery);

        if (result.empty) {
            console.warn("PD: Partner profile not found yet.");
            return null;
        }

        recipientUID = result.docs[0].id;
        return recipientUID;

    } catch (error) {
        console.error("PD: Partner lookup failed:", error);
        return null;
    }
}


/* =========================================================
   PRESENCE — ONLINE / LAST SEEN
   ========================================================= */

function ensurePresenceElement() {
    let element = document.getElementById("pd-presence-status");

    if (element) return element;

    const nameElement = document.querySelector(
        "[data-chat-person-name]"
    );

    if (!nameElement) return null;

    element = document.createElement("div");
    element.id = "pd-presence-status";
    element.className = "pd-presence-status";
    element.textContent = "Checking status…";

    nameElement.insertAdjacentElement("afterend", element);

    return element;
}


function showPartnerStatus(text, online = false) {
    const element = ensurePresenceElement();
    if (!element) return;

    element.textContent = text;
    element.classList.toggle("is-online", online);
    element.classList.toggle("is-offline", !online);
}


function formatLastSeen(timestamp) {
    if (timestamp === null || timestamp === undefined) {
        return "Last seen unavailable";
    }

    const date = new Date(Number(timestamp));

    if (Number.isNaN(date.getTime())) {
        return "Last seen unavailable";
    }

    const difference = Math.max(0, Date.now() - date.getTime());

    if (difference < 60_000) {
        return "Last seen just now";
    }

    if (difference < 3_600_000) {
        return `Last seen ${Math.floor(difference / 60_000)} min ago`;
    }

    const time = date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    });

    if (difference < 86_400_000) {
        return `Last seen today at ${time}`;
    }

    return `Last seen ${date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
    })} at ${time}`;
}


function watchPartnerPresence(uid) {
    if (activePartnerUID === uid && partnerPresenceUnsubscribe) return;

    if (partnerPresenceUnsubscribe) {
        partnerPresenceUnsubscribe();
        partnerPresenceUnsubscribe = null;
    }

    if (lastChangedUnsubscribe) {
        lastChangedUnsubscribe();
        lastChangedUnsubscribe = null;
    }

    activePartnerUID = uid;

    const statusRef = databaseRef(presenceDB, `status/${uid}`);

    partnerPresenceUnsubscribe = onValue(
        statusRef,
        snapshot => {
            const status = snapshot.val() || {};
            const connections = status.connections || {};
            const online = Object.keys(connections).length > 0;

            if (online) {
                showPartnerStatus("● Online", true);
            } else {
                showPartnerStatus(
                    formatLastSeen(status.lastChanged),
                    false
                );
            }
        },
        error => {
            console.error("PD presence read error:", error);
            showPartnerStatus("Status unavailable", false);
        }
    );
}


function startOwnPresence(uid) {
    if (activePresenceUID === uid && connectedUnsubscribe) return;

    if (connectedUnsubscribe) {
        connectedUnsubscribe();
        connectedUnsubscribe = null;
    }

    activePresenceUID = uid;

    const connectedRef = databaseRef(presenceDB, ".info/connected");
    const connectionsRef = databaseRef(
        presenceDB,
        `status/${uid}/connections`
    );
    const lastChangedRef = databaseRef(
        presenceDB,
        `status/${uid}/lastChanged`
    );

    connectedUnsubscribe = onValue(
        connectedRef,
        async snapshot => {
            if (snapshot.val() !== true) return;

            try {
                const connectionRef = push(connectionsRef);

                await onDisconnect(connectionRef).remove();
                await onDisconnect(lastChangedRef).set(
                    databaseServerTimestamp()
                );

                await set(connectionRef, true);
                await set(lastChangedRef, databaseServerTimestamp());

            } catch (error) {
                console.error("PD presence setup failed:", error);
            }
        },
        error => {
            console.error("PD connection monitor error:", error);
        }
    );
}


async function initializePresence() {
    if (!currentProfile) return;

    ensurePresenceElement();
    showPartnerStatus("Checking status…");

    startOwnPresence(currentProfile.uid);

    const partnerUID = await findPartnerUID();

    if (partnerUID) {
        watchPartnerPresence(partnerUID);
    } else {
        showPartnerStatus("Waiting for partner 💜");
    }
}


/* =========================================================
   MESSAGE RECEIPTS
   ========================================================= */

function createReceipt(data, mine) {
    if (!mine) return null;

    const receipt = document.createElement("span");
    receipt.className = "pd-message-receipt";

    const status = data.status || "sent";

    if (status === "read") {
        receipt.textContent = "💜";
        receipt.classList.add("receipt-read");
        receipt.title = "Read";
    } else if (status === "delivered") {
        receipt.textContent = "🤍";
        receipt.classList.add("receipt-delivered");
        receipt.title = "Delivered";
    } else {
        receipt.textContent = "💘";
        receipt.classList.add("receipt-sent");
        receipt.title = "Sent";
    }

    return receipt;
}


async function updateIncomingReceipts(messageDocs) {
    if (!currentProfile) return;

    const visible = document.visibilityState === "visible";

    for (const messageDoc of messageDocs) {
        const data = messageDoc.data();

        if (data.senderUID === currentProfile.uid) continue;
        if (data.recipientUID !== currentProfile.uid) continue;

        const status = data.status || "sent";

        if (status === "read") continue;
        if (status === "delivered" && !visible) continue;

        if (receiptUpdatesInFlight.has(messageDoc.id)) continue;

        receiptUpdatesInFlight.add(messageDoc.id);

        try {
            const nextStatus = visible ? "read" : "delivered";
            const changes = { status: nextStatus };

            if (!data.deliveredAt) {
                changes.deliveredAt = serverTimestamp();
            }

            if (nextStatus === "read" && !data.readAt) {
                changes.readAt = serverTimestamp();
            }

            await updateDoc(
                doc(db, "messages", messageDoc.id),
                changes
            );

        } catch (error) {
            console.error("PD receipt update failed:", error);
        } finally {
            receiptUpdatesInFlight.delete(messageDoc.id);
        }
    }
}


/* =========================================================
   MULTILINE INPUT — ENTER ADDS A NEW LINE
   ========================================================= */

function resizeMessageInput() {
    const input = document.getElementById("messageInput");
    if (!input) return;

    input.style.height = "auto";

    const maxHeight = 120;
    input.style.height = Math.min(input.scrollHeight, maxHeight) + "px";
    input.style.overflowY =
        input.scrollHeight > maxHeight ? "auto" : "hidden";
}


function setupMultilineInput() {
    const input = document.getElementById("messageInput");
    if (!input || input.dataset.pdMultilineBound === "true") return;

    input.dataset.pdMultilineBound = "true";

    input.addEventListener("input", resizeMessageInput);

    // Do not prevent Enter's default behavior:
    // Enter inserts a newline in a textarea.
    // Sending happens only from the Send button/form submit.
    input.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.stopPropagation();
        }
    });

    resizeMessageInput();
}


/* =========================================================
   REPLY-TO-MESSAGE FEATURE
   ========================================================= */

function ensureReplyComposer() {
    const form = document.getElementById("chatForm");
    if (!form) return null;

    let composer = document.getElementById("pdReplyComposer");
    if (composer) return composer;

    composer = document.createElement("div");
    composer.className = "pd-reply-composer";
    composer.id = "pdReplyComposer";
    composer.setAttribute("aria-live", "polite");

    const accent = document.createElement("div");
    accent.className = "pd-reply-accent";

    const content = document.createElement("div");
    content.className = "pd-reply-content";

    const label = document.createElement("span");
    label.className = "pd-reply-label";
    label.id = "pdReplyLabel";
    label.textContent = "Replying to";

    const preview = document.createElement("span");
    preview.className = "pd-reply-text";
    preview.id = "pdReplyText";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "pd-reply-cancel";
    cancel.id = "pdCancelReply";
    cancel.setAttribute("aria-label", "Cancel reply");
    cancel.innerHTML = '<i class="fa-solid fa-xmark"></i>';

    content.append(label, preview);
    composer.append(accent, content, cancel);

    // Place the preview above the typing controls.
    form.insertBefore(composer, form.firstChild);

    cancel.addEventListener("click", clearReplyMode);

    return composer;
}


function setReplyMode(messageId, data) {
    if (!messageId || !data || !currentProfile) return;

    const isVoice = data.type === "voice";

    currentReply = {
        messageId,
        senderUID: data.senderUID || null,
        senderName:
            data.senderDisplayName ||
            data.senderName ||
            "My love",
        text: isVoice
            ? "🎙️ Voice message"
            : String(data.text || ""),
        type: data.type || "text"
    };

    const form = document.getElementById("chatForm");
    const composer = ensureReplyComposer();

    if (!composer || !form) return;

    form.classList.add("is-replying");

    const label = document.getElementById("pdReplyLabel");
    const preview = document.getElementById("pdReplyText");

    if (label) {
        label.textContent =
            currentReply.senderUID === currentProfile.uid
                ? "Replying to yourself"
                : `Replying to ${currentReply.senderName}`;
    }

    if (preview) {
        preview.textContent = currentReply.text || "Message";
    }

    const input = document.getElementById("messageInput");
    if (input) input.focus();
}


function clearReplyMode() {
    currentReply = null;

    const form = document.getElementById("chatForm");
    if (form) form.classList.remove("is-replying");

    const label = document.getElementById("pdReplyLabel");
    const preview = document.getElementById("pdReplyText");

    if (label) label.textContent = "Replying to";
    if (preview) preview.textContent = "";
}


function jumpToMessage(messageId) {
    if (!messageId) return;

    const original = document.getElementById(`pd-message-${messageId}`);

    if (!original) {
        console.warn("PD: Original message is not loaded.");
        return;
    }

    original.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

    original.classList.add("pd-message-highlight");

    setTimeout(() => {
        original.classList.remove("pd-message-highlight");
    }, 1800);
}


function createQuotedMessage(replyTo) {
    if (!replyTo || !replyTo.messageId) return null;

    const quote = document.createElement("button");
    quote.type = "button";
    quote.className = "pd-message-quote";
    quote.setAttribute("aria-label", "Jump to original message");

    const sender = document.createElement("span");
    sender.className = "pd-message-quote-sender";
    sender.textContent = replyTo.senderName || "Message";

    const text = document.createElement("span");
    text.className = "pd-message-quote-text";
    text.textContent =
        replyTo.text ||
        (replyTo.type === "voice" ? "🎙️ Voice message" : "Message");

    quote.append(sender, text);

    quote.addEventListener("click", event => {
        event.stopPropagation();
        jumpToMessage(replyTo.messageId);
    });

    return quote;
}


function createReplyButton(messageId, data) {
    const actions = document.createElement("div");
    actions.className = "pd-message-actions";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "pd-reply-trigger";
    button.setAttribute("aria-label", "Reply to this message");
    button.title = "Reply to this message";
    button.innerHTML =
        '<i class="fa-solid fa-reply"></i><span>Reply</span>';

    button.addEventListener("click", event => {
        event.stopPropagation();
        setReplyMode(messageId, data);
    });

    actions.appendChild(button);
    return actions;
}


/* =========================================================
   SEND TEXT MESSAGE — INCLUDES REPLY METADATA
   ========================================================= */

async function sendMessage() {
    if (!currentProfile) return;

    const input = document.getElementById("messageInput");
    const button = document.querySelector(".send-message");

    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    if (button) button.disabled = true;

    try {
        const partnerUID = await findPartnerUID();

        const replyTo = currentReply
            ? {
                messageId: currentReply.messageId,
                senderUID: currentReply.senderUID,
                senderName: currentReply.senderName,
                text: currentReply.text,
                type: currentReply.type
            }
            : null;

        await addDoc(collection(db, "messages"), {
            type: "text",
            text,

            senderUID: currentProfile.uid,
            senderName: currentProfile.name,
            senderDisplayName: currentProfile.displayName,

            recipientUID: partnerUID,

            replyTo,

            status: "sent",
            deliveredAt: null,
            readAt: null,

            createdAt: serverTimestamp()
        });

        input.value = "";
        resizeMessageInput();
        clearReplyMode();
        input.focus();

    } catch (error) {
        console.error("PD: Message failed:", error);
        alert("Your message could not be sent. Please try again.");
    } finally {
        if (button) button.disabled = false;
    }
}


/* =========================================================
   DATE HELPERS
   ========================================================= */

function getDateKey(date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
}


function formatChatDate(date) {
    const today = new Date();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const key = getDateKey(date);

    if (key === getDateKey(today)) return "Today";
    if (key === getDateKey(yesterday)) return "Yesterday";

    return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}


function addDateSeparator(container, date) {
    const separator = document.createElement("div");
    separator.className = "chat-date-separator";

    const span = document.createElement("span");
    span.textContent = formatChatDate(date);

    separator.appendChild(span);
    container.appendChild(separator);
}


/* =========================================================
   MESSAGE FOOTER
   ========================================================= */

function makeMessageFooter(data, date, mine) {
    const footer = document.createElement("div");
    footer.className = "pd-message-footer";

    const time = document.createElement("span");
    time.className = "message-time";

    if (date) {
        time.textContent = date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    footer.appendChild(time);

    const receipt = createReceipt(data, mine);
    if (receipt) footer.appendChild(receipt);

    return footer;
}


/* =========================================================
   DISPLAY TEXT MESSAGE — REPLY QUOTES INCLUDED
   ========================================================= */

function displayTextMessage(container, data, date, messageId) {
    const message = document.createElement("div");

    const mine = data.senderUID === currentProfile.uid;

    message.id = `pd-message-${messageId}`;
    message.dataset.messageId = messageId;
    message.className = mine ? "message sent" : "message received";

    const quote = createQuotedMessage(data.replyTo);
    if (quote) message.appendChild(quote);

    const text = document.createElement("div");
    text.className = "message-text";

    // textContent keeps user-sent messages safe and preserves line breaks.
    text.textContent = data.text || "";

    message.appendChild(text);
    message.appendChild(makeMessageFooter(data, date, mine));
    message.appendChild(createReplyButton(messageId, data));

    container.appendChild(message);
}


/* =========================================================
   DISPLAY VOICE MESSAGE — CAN ALSO BE REPLIED TO
   ========================================================= */

function displayVoiceMessage(container, data, date, messageId) {
    if (!data.audioURL) return;

    const message = document.createElement("div");
    const mine = data.senderUID === currentProfile.uid;

    message.id = `pd-message-${messageId}`;
    message.dataset.messageId = messageId;
    message.className = mine
        ? "message sent voice-message"
        : "message received voice-message";

    const quote = createQuotedMessage(data.replyTo);
    if (quote) message.appendChild(quote);

    const box = document.createElement("div");
    box.className = "voice-message-box";

    const icon = document.createElement("div");
    icon.className = "voice-icon";
    icon.innerHTML = '<i class="fa-solid fa-microphone"></i>';

    const audio = document.createElement("audio");
    audio.controls = true;
    audio.preload = "metadata";
    audio.src = data.audioURL;

    box.append(icon, audio);

    message.appendChild(box);
    message.appendChild(makeMessageFooter(data, date, mine));
    message.appendChild(createReplyButton(messageId, data));

    container.appendChild(message);
}


/* =========================================================
   LOADER
   ========================================================= */

function removeChatLoader() {
    const loader = document.getElementById("pd-chat-loader");
    if (!loader) return;

    loader.classList.add("pd-loaded");
    setTimeout(() => loader.remove(), 150);
}


/* =========================================================
   START CHAT — SINGLE FIRESTORE LISTENER
   ========================================================= */

function startChat() {
    const container = document.getElementById("chatMessages");

    if (!container) {
        console.error("PD: #chatMessages was not found.");
        removeChatLoader();
        return;
    }

    if (chatUnsubscribe) {
        chatUnsubscribe();
        chatUnsubscribe = null;
    }

    const messagesQuery = query(
        collection(db, "messages"),
        orderBy("createdAt", "asc")
    );

    chatUnsubscribe = onSnapshot(
        messagesQuery,
        snapshot => {
            latestMessageDocs = snapshot.docs;

            const isFirstLoad = !firstMessagesLoaded;
            firstMessagesLoaded = true;

            const wasNearBottom =
                container.scrollHeight -
                container.scrollTop -
                container.clientHeight < 150;

            const previousScrollTop = container.scrollTop;

            container.innerHTML = "";

            let previousDateKey = null;

            snapshot.forEach(messageDoc => {
                const data = messageDoc.data();
                let date = null;

                if (data.createdAt?.toDate) {
                    date = data.createdAt.toDate();
                }

                if (date) {
                    const dateKey = getDateKey(date);

                    if (dateKey !== previousDateKey) {
                        addDateSeparator(container, date);
                        previousDateKey = dateKey;
                    }
                }

                if (data.type === "voice") {
                    displayVoiceMessage(
                        container,
                        data,
                        date,
                        messageDoc.id
                    );
                } else {
                    displayTextMessage(
                        container,
                        data,
                        date,
                        messageDoc.id
                    );
                }
            });

            removeChatLoader();

            requestAnimationFrame(() => {
                if (isFirstLoad || wasNearBottom) {
                    container.scrollTop = container.scrollHeight;
                } else {
                    container.scrollTop = Math.min(
                        previousScrollTop,
                        container.scrollHeight
                    );
                }
            });

            updateIncomingReceipts(snapshot.docs);
        },
        error => {
            console.error("PD Firestore chat error:", error);
            removeChatLoader();
        }
    );
}


/* =========================================================
   VOICE RECORDING
   ========================================================= */

async function startRecording() {
    if (recording) return;

    if (!navigator.mediaDevices?.getUserMedia) {
        alert("Voice recording requires HTTPS or localhost.");
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

        const mimeType = [
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/mp4"
        ].find(type => MediaRecorder.isTypeSupported(type));

        mediaRecorder = mimeType
            ? new MediaRecorder(stream, { mimeType })
            : new MediaRecorder(stream);

        audioChunks = [];
        recording = true;

        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            stream.getTracks().forEach(track => track.stop());

            const blob = new Blob(audioChunks, {
                type: mediaRecorder.mimeType || "audio/webm"
            });

            if (blob.size > 0) await uploadVoice(blob);
        };

        mediaRecorder.start();
        updateVoiceButton(true);

    } catch (error) {
        console.error("PD microphone error:", error);
        alert("Please allow microphone access for PD ❤️");
    }
}


function stopRecording() {
    if (!mediaRecorder || !recording) return;

    recording = false;
    mediaRecorder.stop();
    updateVoiceButton(false);
}


/* =========================================================
   UPLOAD VOICE NOTE
   ========================================================= */

async function uploadVoice(audioBlob) {
    if (!currentProfile) return;

    const button = document.getElementById("voiceButton");
    if (button) button.classList.add("uploading");

    try {
        const partnerUID = await findPartnerUID();

        const extension = audioBlob.type.includes("mp4") ? "m4a" : "webm";
        const fileName = `voice_${Date.now()}.${extension}`;

        const fileRef = storageRef(
            storage,
            `voice-messages/${currentProfile.uid}/${fileName}`
        );

        await uploadBytes(fileRef, audioBlob);

        const audioURL = await getDownloadURL(fileRef);

        await addDoc(collection(db, "messages"), {
            type: "voice",
            audioURL,

            senderUID: currentProfile.uid,
            senderName: currentProfile.name,
            senderDisplayName: currentProfile.displayName,

            recipientUID: partnerUID,

            replyTo: null,

            status: "sent",
            deliveredAt: null,
            readAt: null,

            createdAt: serverTimestamp()
        });

    } catch (error) {
        console.error("PD voice upload error:", error);
        alert("Voice note failed to send.");
    } finally {
        if (button) button.classList.remove("uploading");
    }
}


function updateVoiceButton(active) {
    const button = document.getElementById("voiceButton");
    if (!button) return;

    if (active) {
        button.classList.add("recording");
        button.innerHTML = '<i class="fa-solid fa-stop"></i>';
        button.title = "Stop recording";
    } else {
        button.classList.remove("recording");
        button.innerHTML = '<i class="fa-solid fa-microphone"></i>';
        button.title = "Record voice note";
    }
}


function setupVoiceButton() {
    const button = document.getElementById("voiceButton");
    if (!button || button.dataset.pdBound === "true") return;

    button.dataset.pdBound = "true";

    button.addEventListener("click", async () => {
        if (recording) {
            stopRecording();
        } else {
            await startRecording();
        }
    });
}


/* =========================================================
   PAGE EVENTS
   ========================================================= */

function setupPageEvents() {
    const form = document.getElementById("chatForm");

    if (form && form.dataset.pdBound !== "true") {
        form.dataset.pdBound = "true";

        form.addEventListener("submit", event => {
            event.preventDefault();
            sendMessage();
        });
    }

    setupMultilineInput();
    ensureReplyComposer();
    setupVoiceButton();
}


/* =========================================================
   RECEIPTS WHEN RETURNING TO THE TAB
   ========================================================= */

document.addEventListener("visibilitychange", () => {
    if (
        document.visibilityState === "visible" &&
        currentProfile &&
        latestMessageDocs.length
    ) {
        updateIncomingReceipts(latestMessageDocs);
    }
});


/* =========================================================
   AUTHENTICATION AND STARTUP
   ========================================================= */

function initializePage() {
    installChatStyles();
    setupPageEvents();

    onAuthStateChanged(auth, async user => {
        if (!user) {
            window.location.href = "login.html";
            return;
        }

        const ready = await setupProfile(user);

        if (!ready) {
            removeChatLoader();
            return;
        }

        await initializePresence();
        startChat();
    });
}


if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializePage, {
        once: true
    });
} else {
    initializePage();
}
