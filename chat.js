
/* =========================================================
   PRINCESS WA DEIB — COMPLETE CHAT SYSTEM
   Text • Replies • Voice Notes • Dates • Presence
   Sent / Delivered / Read Receipts
   ========================================================= */

import { auth, db, storage, presenceDB } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    doc, setDoc, collection, addDoc, query, orderBy,
    onSnapshot, serverTimestamp, getDocs, where, limit,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import {
    ref as storageRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";

import {
    ref as databaseRef, onValue, onDisconnect, set, push,
    serverTimestamp as databaseServerTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";


/* =========================================================
   PROFILES
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
   JUMP TO LATEST MESSAGE — WHATSAPP STYLE
   ========================================================= */

let pdJumpButton = null;
let pdNewMessageCount = 0;
let pdLastSeenMessageId = null;
let pdWasAtBottom = true;

function setupJumpToLatest() {
    const container = document.getElementById("chatMessages");

    if (!container) return;

    if (pdJumpButton) return;

    pdJumpButton = document.createElement("button");
    pdJumpButton.type = "button";
    pdJumpButton.id = "pdJumpToLatest";
    pdJumpButton.setAttribute(
        "aria-label",
        "Jump to latest message"
    );
    pdJumpButton.title = "Jump to latest message";

    pdJumpButton.innerHTML = `
    <span style="font-size:17px;">👇</span>
    <span class="pd-new-message-count">0</span>
`;

    document.body.appendChild(pdJumpButton);

    pdJumpButton.addEventListener("click", () => {
        container.scrollTo({
            top: container.scrollHeight,
            behavior: "smooth"
        });

        pdNewMessageCount = 0;
        updateJumpToLatest();
    });

    container.addEventListener("scroll", updateJumpToLatest, {
        passive: true
    });

    updateJumpToLatest();
}

function updateJumpToLatest() {
    const container = document.getElementById("chatMessages");

    if (!container || !pdJumpButton) return;

    const distanceFromBottom =
        container.scrollHeight -
        container.scrollTop -
        container.clientHeight;

    pdWasAtBottom = distanceFromBottom < 100;

    pdJumpButton.classList.toggle(
        "pd-arrow-visible",
        distanceFromBottom > 180
    );

    pdJumpButton.classList.toggle(
        "has-new-messages",
        pdNewMessageCount > 0
    );

    const count = pdJumpButton.querySelector(
        ".pd-new-message-count"
    );

    if (count) {
        count.textContent =
            pdNewMessageCount > 99
                ? "99+"
                : String(pdNewMessageCount);
    }
}
/* =========================================================
   GLOBAL STATE
   ========================================================= */

let chatUnsubscribe = null;
let partnerPresenceUnsubscribe = null;
let connectedUnsubscribe = null;

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
   CHAT STYLES
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
        /* 💜 Small cute jump-to-latest button */
#pdJumpToLatest {
    position: fixed;
    right: max(18px, calc((100vw - 440px) / 2 + 18px));
    bottom: 95px;
    z-index: 9999;

    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;

    border: 1px solid rgba(255,255,255,0.35);
    border-radius: 50%;
    background: linear-gradient(135deg, #c77dff, #8e35d4);
    color: white;

    font-size: 17px;
    box-shadow: 0 3px 12px rgba(142,53,212,0.3);

    cursor: pointer;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transform: translateY(5px);
    transition: all 0.2s ease;
}

#pdJumpToLatest.pd-arrow-visible {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transform: translateY(0);
}

#pdJumpToLatest .pd-new-message-count {
    position: absolute;
    top: -5px;
    right: -5px;
    min-width: 15px;
    height: 15px;
    padding: 0 3px;
    display: none;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: #ff3d9a;
    color: white;
    font-size: 9px;
    font-weight: bold;
}

#pdJumpToLatest.has-new-messages .pd-new-message-count {
    display: flex;
}


        .pd-presence-status.is-online {
            color: #fae101;
        }

        .pd-presence-status.is-offline {
            color: #bb4ad1;
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

        /* Each message group contains a quote and a message row. */
        .pd-message-group {
            display: flex;
            flex-direction: column;
            width: fit-content;
            max-width: 94%;
            min-width: 0;
            margin: 7px 0;
            box-sizing: border-box;
        }

        .pd-message-group.sent {
            align-self: flex-end;
            align-items: flex-end;
        }

        .pd-message-group.received {
            align-self: flex-start;
            align-items: flex-start;
        }

        /* Bubble and reply button share the same horizontal row. */
        .pd-message-row {
            display: flex;
            align-items: center;
            gap: 6px;
            width: fit-content;
            max-width: 100%;
            min-width: 0;
        }

        /*
         * Sent: bubble on the right, reply button on the left.
         * Received: bubble on the left, reply button on the right.
         */
        .pd-message-group.sent .pd-message-row {
            flex-direction: row-reverse;
        }

        .pd-message-group.received .pd-message-row {
            flex-direction: row;
        }

        .pd-message-group .message {
            position: relative;
            flex: 0 1 auto;
            min-width: 0;
            max-width: calc(100% - 36px);
            box-sizing: border-box;
            overflow-wrap: anywhere;
        }

        .pd-message-group .message-text {
            white-space: pre-wrap;
            overflow-wrap: anywhere;
        }

        /* Reply controls sit OUTSIDE the message bubble. */
        .pd-message-actions {
            display: flex;
            flex: 0 0 auto;
            align-items: center;
            justify-content: center;
            margin: 0;
        }

        .pd-reply-trigger {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            min-width: 29px;
            min-height: 28px;
            padding: 4px 6px;
            border: 1px solid rgba(180, 130, 255, .22);
            border-radius: 14px;
            background: rgba(130, 80, 180, .12);
            color: inherit;
            font: inherit;
            font-size: 10px;
            cursor: pointer;
            opacity: .82;
            transition: background .2s, opacity .2s;
        }

        .pd-reply-trigger:hover,
        .pd-reply-trigger:focus-visible {
            opacity: 1;
            background: rgba(180, 100, 255, .22);
            outline: none;
        }

        .pd-reply-trigger i {
            font-size: 12px;
        }

        .pd-reply-trigger span {
            font-size: 10px;
        }

        /* Original message quoted ABOVE the bubble and reply row. */
        .pd-message-quote {
            display: block;
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
            margin: 0 0 5px;
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
        }

        /* Reply preview above the typing controls. */
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

        /* Multiline typing — preserve the phone layout. */
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

        @media (max-width: 380px) {
            .pd-message-group {
                max-width: 97%;
            }

            .pd-reply-trigger {
                min-width: 27px;
                padding: 4px;
            }

            .pd-reply-trigger span {
                font-size: 9px;
            }

            .pd-message-row {
                gap: 4px;
            }
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

    setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email,
        name: profile.name,
        displayName: profile.displayName,
        updatedAt: serverTimestamp()
    }, { merge: true }).catch(error => {
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

    const nameElement = document.querySelector("[data-chat-person-name]");

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

    if (difference < 60000) return "Last seen just now";

    if (difference < 3600000) {
        return `Last seen ${Math.floor(difference / 60000)} min ago`;
    }

    const time = date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    });

    if (difference < 86400000) {
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
                showPartnerStatus(formatLastSeen(status.lastChanged), false);
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
    const connectionsRef = databaseRef(presenceDB, `status/${uid}/connections`);
    const lastChangedRef = databaseRef(presenceDB, `status/${uid}/lastChanged`);

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

    try {
        const partnerUID = await findPartnerUID();

        if (partnerUID) {
            watchPartnerPresence(partnerUID);
        } else {
            showPartnerStatus("Waiting for partner 💜");
        }
    } catch (error) {
        console.error("PD presence initialization error:", error);
        showPartnerStatus("Status unavailable", false);
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

            await updateDoc(doc(db, "messages", messageDoc.id), changes);

        } catch (error) {
            console.error("PD receipt update failed:", error);
        } finally {
            receiptUpdatesInFlight.delete(messageDoc.id);
        }
    }
}


/* =========================================================
   MULTILINE INPUT
   ========================================================= */

function resizeMessageInput() {
    const input = document.getElementById("messageInput");

    if (!input) return;

    input.style.height = "auto";

    const maxHeight = 120;

    input.style.height =
        Math.min(input.scrollHeight, maxHeight) + "px";

    input.style.overflowY =
        input.scrollHeight > maxHeight ? "auto" : "hidden";
}


function setupMultilineInput() {
    const input = document.getElementById("messageInput");

    if (!input || input.dataset.pdMultilineBound === "true") return;

    input.dataset.pdMultilineBound = "true";

    input.addEventListener("input", resizeMessageInput);

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
        text: isVoice ? "🎙️ Voice message" : String(data.text || ""),
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

    if (preview) preview.textContent = currentReply.text || "Message";

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
   SEND TEXT MESSAGE
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
   DISPLAY TEXT MESSAGE
   ========================================================= */

function displayTextMessage(container, data, date, messageId) {
    const mine = data.senderUID === currentProfile.uid;

    const group = document.createElement("div");
    group.className = mine
        ? "pd-message-group sent"
        : "pd-message-group received";

    const quote = createQuotedMessage(data.replyTo);

    // Quote sits above the message row.
    if (quote) group.appendChild(quote);

    const row = document.createElement("div");
    row.className = "pd-message-row";

    const message = document.createElement("div");
    message.id = `pd-message-${messageId}`;
    message.dataset.messageId = messageId;
    message.className = mine ? "message sent" : "message received";

    const text = document.createElement("div");
    text.className = "message-text";
    text.textContent = data.text || "";

    message.appendChild(text);
    message.appendChild(makeMessageFooter(data, date, mine));

    const replyButton = createReplyButton(messageId, data);

    if (mine) {
        // Sent message: bubble right, reply control left.
        row.append(replyButton, message);
    } else {
        // Received message: bubble left, reply control right.
        row.append(message, replyButton);
    }

    group.appendChild(row);
    container.appendChild(group);
}


/* =========================================================
   DISPLAY VOICE MESSAGE
   ========================================================= */

function displayVoiceMessage(container, data, date, messageId) {
    if (!data.audioURL) return;

    const mine = data.senderUID === currentProfile.uid;

    const group = document.createElement("div");
    group.className = mine
        ? "pd-message-group sent"
        : "pd-message-group received";

    const quote = createQuotedMessage(data.replyTo);

    if (quote) group.appendChild(quote);

    const row = document.createElement("div");
    row.className = "pd-message-row";

    const message = document.createElement("div");
    message.id = `pd-message-${messageId}`;
    message.dataset.messageId = messageId;
    message.className = mine
        ? "message sent voice-message"
        : "message received voice-message";

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

    const replyButton = createReplyButton(messageId, data);

    if (mine) {
        row.append(replyButton, message);
    } else {
        row.append(message, replyButton);
    }

    group.appendChild(row);
    container.appendChild(group);
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
   START CHAT — FIRESTORE REALTIME LISTENER
   ========================================================= */

function startChat() {
    const container = document.getElementById("chatMessages");
setupJumpToLatest();
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

const newestMessageId = snapshot.docs.length
    ? snapshot.docs[snapshot.docs.length - 1].id
    : null;

const hasNewMessage =
    newestMessageId &&
    pdLastSeenMessageId &&
    newestMessageId !== pdLastSeenMessageId;

if (hasNewMessage && !wasNearBottom) {
    pdNewMessageCount++;
}

pdLastSeenMessageId = newestMessageId;

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
   VOICE RECORDING — FIXED AND MORE RELIABLE
   Records audio, finalizes the Blob, then uploads it.
   ========================================================= */

async function startRecording() {
    if (recording) return;

    if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
    ) {
        alert(
            "Voice recording is not supported here. Open PD using HTTPS and a supported browser."
        );
        return;
    }

    let stream;

    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

        const supportedTypes = [
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/mp4"
        ];

        const mimeType = supportedTypes.find(type =>
            MediaRecorder.isTypeSupported(type)
        );

        // Keep a local reference so each recording has its own recorder.
        const recorder = mimeType
            ? new MediaRecorder(stream, { mimeType })
            : new MediaRecorder(stream);

        mediaRecorder = recorder;
        audioChunks = [];
        recording = true;

        recorder.ondataavailable = event => {
            if (event.data && event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        recorder.onerror = event => {
            console.error("PD recording error:", event.error || event);
            recording = false;
            updateVoiceButton(false);

            stream.getTracks().forEach(track => track.stop());

            alert("Recording failed. Please try recording again.");
        };

        recorder.onstop = async () => {
            // Wait until recording has stopped and its final chunk is received.
            recording = false;
            updateVoiceButton(false);

            try {
                const chunks = [...audioChunks];
                audioChunks = [];

                const audioType =
                    recorder.mimeType ||
                    chunks.find(chunk => chunk.type)?.type ||
                    "audio/webm";

                const audioBlob = new Blob(chunks, {
                    type: audioType
                });

                console.log(
                    "PD voice recording finished:",
                    audioBlob.size,
                    "bytes",
                    audioBlob.type
                );

                if (audioBlob.size === 0) {
                    throw new Error(
                        "The recording is empty. No audio data was captured."
                    );
                }

                await uploadVoice(audioBlob);
            } catch (error) {
                console.error("PD voice finalization error:", error);
                alert(
                    "The recording could not be prepared. Please try again."
                );
            } finally {
                stream.getTracks().forEach(track => track.stop());
            }
        };

        // A timeslice helps deliver audio chunks during longer recordings.
        recorder.start(250);

        updateVoiceButton(true);

        console.log("PD: Voice recording started.");

    } catch (error) {
        console.error("PD microphone start error:", error);

        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }

        recording = false;
        updateVoiceButton(false);

        if (error.name === "NotAllowedError") {
            alert("Please allow microphone access for PD ❤️");
        } else {
            alert("Could not start recording. Please try again.");
        }
    }
}


function stopRecording() {
    if (!mediaRecorder || !recording) return;

    const recorder = mediaRecorder;

    recording = false;
    updateVoiceButton(false);

    try {
        if (recorder.state !== "inactive") {
            recorder.stop();
            console.log("PD: Finishing voice recording...");
        }
    } catch (error) {
        console.error("PD could not stop recording:", error);
        alert("Could not finish the recording. Please try again.");
    }
}


/* =========================================================
   UPLOAD VOICE NOTE — FIREBASE STORAGE + FIRESTORE
   ========================================================= */

async function uploadVoice(audioBlob) {
    if (!currentProfile) {
        alert("Your PD account is not ready. Please reload the chat.");
        return;
    }

    const button = document.getElementById("voiceButton");

    if (button) {
        button.classList.add("uploading");
        button.disabled = true;
        button.title = "Sending voice note...";
    }

    try {
        console.log("PD: Uploading voice note...", audioBlob.size, "bytes");

        const partnerUID = await findPartnerUID();

        const contentType =
            audioBlob.type.split(";")[0] || "audio/webm";

        let extension = "webm";

        if (contentType.includes("mp4")) {
            extension = "m4a";
        } else if (contentType.includes("ogg")) {
            extension = "ogg";
        } else if (contentType.includes("wav")) {
            extension = "wav";
        }

        const fileName =
            `voice_${Date.now()}_${Math.random()
                .toString(36)
                .slice(2, 8)}.${extension}`;

        const fileRef = storageRef(
            storage,
            `voice-messages/${currentProfile.uid}/${fileName}`
        );

        // Step 1: Upload the audio file.
        const uploadResult = await uploadBytes(fileRef, audioBlob, {
            contentType
        });

        console.log("PD: Audio uploaded successfully.");

        // Step 2: Get a playable download URL.
        const audioURL = await getDownloadURL(uploadResult.ref);

        if (!audioURL) {
            throw new Error("Firebase returned no audio download URL.");
        }

        // Step 3: Save the voice message in the live chat collection.
        const messageRef = await addDoc(collection(db, "messages"), {
            type: "voice",
            audioURL,
            audioContentType: contentType,

            senderUID: currentProfile.uid,
            senderName: currentProfile.name,
            senderDisplayName: currentProfile.displayName,

            recipientUID: partnerUID,
            replyTo: currentReply
                ? {
                    messageId: currentReply.messageId,
                    senderUID: currentReply.senderUID,
                    senderName: currentReply.senderName,
                    text: currentReply.text,
                    type: currentReply.type
                }
                : null,

            status: "sent",
            deliveredAt: null,
            readAt: null,

            createdAt: serverTimestamp()
        });

        console.log("PD: Voice message saved to chat:", messageRef.id);

        clearReplyMode();

    } catch (error) {
        console.error("PD voice upload/send failed:", error);

        alert(
            "Your voice note could not be sent. Check your internet connection and Firebase permissions, then try again."
        );
    } finally {
        if (button) {
            button.classList.remove("uploading");
            button.disabled = false;
            button.title = "Record voice note";
        }
    }
}





function updateVoiceButton(active) {
    const button = document.getElementById("voiceButton");

    if (!button) return;

    if (active) {
        button.classList.add("recording");
        button.innerHTML = '<i class="fa-solid fa-stop"></i>';
        button.title = "Stop recording";
        button.setAttribute("aria-label", "Stop recording");
    } else {
        button.classList.remove("recording");
        button.innerHTML = '<i class="fa-solid fa-microphone"></i>';
        button.title = "Record voice note";
        button.setAttribute("aria-label", "Record voice note");
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

        // Start receiving messages immediately.
        // Do not wait for online-status initialization.
        startChat();

        initializePresence().catch(error => {
            console.error("PD presence initialization error:", error);
        });
    });
}


if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializePage, {
        once: true
    });
} else {
    initializePage();
}
