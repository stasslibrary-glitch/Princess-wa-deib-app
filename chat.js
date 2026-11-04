
/* =========================================================
   PRINCESS WA DEIB — COMPLETE CHAT.JS
   Firebase • Text • Replies • Voice Notes • Presence
   Live Messages • Date Separators • Read Receipts
   ========================================================= */

import { auth, db, storage, presenceDB } from "./firebase.js";

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
import { sendPDMessagePush } from "./notification.js";
/* =========================================================
   CONFIGURATION
   ========================================================= */

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

let currentProfile = null;
let recipientUID = null;

let messageUnsubscribers = [];
let partnerPresenceUnsubscribe = null;
let connectedUnsubscribe = null;

let activePartnerUID = null;
let activePresenceUID = null;

let latestMessageDocs = [];
let firstMessagesLoaded = false;
let currentReply = null;

let mediaRecorder = null;
let recording = false;
let audioChunks = [];
let activeRecordingStream = null;

let pdSendingMessage = false;
let pdSendingVoice = false;
let pdJumpButton = null;
let pdNewMessageCount = 0;
let pdLastSeenMessageId = null;

let recordingStartedAt = 0;
let recordingTimer = null;
let recordingCancelled = false;

const receiptUpdatesInFlight = new Set();
const messageCache = new Map();

/* =========================================================
   UTILITIES
   ========================================================= */

function byId(id) {
    return document.getElementById(id);
}

function logError(label, error) {
    console.error(label, {
        code: error?.code || "unknown",
        message: error?.message || String(error)
    });
}

function showError(message) {
    alert(message);
}

function getFirebaseErrorMessage(error) {
    const code = error?.code || "";
    const message = error?.message || "";

    if (
        code === "resource-exhausted" ||
        /quota exceeded/i.test(message)
    ) {
        return "Firebase quota exceeded. Check your Firebase Console usage and billing. The chat cannot save new messages until the quota issue is resolved.";
    }

    if (
        code === "permission-denied" ||
        code === "storage/unauthorized"
    ) {
        return "Firebase denied this action. Check your Firestore or Storage security rules.";
    }

    if (
        code === "unavailable" ||
        !navigator.onLine
    ) {
        return "Connection problem. Check your internet connection and try again.";
    }

    if (/partner account.*not found/i.test(message)) {
        return "Your partner's profile was not found. Make sure both PD accounts have signed in at least once.";
    }

    return "Something went wrong. Check the browser Console for the Firebase error.";
}

function getPartnerEmail() {
    if (!currentProfile) return null;

    if (currentProfile.email === "princess@gmail.com") {
        return "deib@gmail.com";
    }

    if (currentProfile.email === "deib@gmail.com") {
        return "princess@gmail.com";
    }

    return null;
}

function getDateKey(date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
}

function getMessageDate(data) {
    if (data.createdAt?.toDate) {
        return data.createdAt.toDate();
    }

    if (data.createdAt instanceof Date) {
        return data.createdAt;
    }

    return null;
}

function formatChatDate(date) {
    const today = new Date();
    const yesterday = new Date();

    yesterday.setDate(yesterday.getDate() - 1);

    if (getDateKey(date) === getDateKey(today)) {
        return "Today";
    }

    if (getDateKey(date) === getDateKey(yesterday)) {
        return "Yesterday";
    }

    return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}

function formatTime(date) {
    if (!date) return "";

    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function getMessagePreview(data) {
    if (data.type === "voice") {
        return "🎙️ Voice message";
    }

    return String(data.text || "Message");
}

/* =========================================================
   CHAT STYLES
   ========================================================= */

function installChatStyles() {
    if (byId("pd-chat-extra-styles")) return;

    const style = document.createElement("style");
    style.id = "pd-chat-extra-styles";

    style.textContent = `
        .pd-presence-status {
            display: block;
            margin-top: 3px;
            font-size: 11px;
            color: #b9a8d9;
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
        }

        .pd-message-receipt {
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

        .pd-message-row {
            display: flex;
            align-items: center;
            gap: 6px;
            width: fit-content;
            max-width: 100%;
            min-width: 0;
        }

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

        .pd-message-actions {
            display: flex;
            flex: 0 0 auto;
            align-items: center;
            justify-content: center;
        }

        .pd-reply-trigger {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            min-width: 29px;
            min-height: 28px;
            padding: 4px 6px;
            border: 1px solid rgba(180,130,255,.22);
            border-radius: 14px;
            background: rgba(130,80,180,.12);
            color: inherit;
            font: inherit;
            font-size: 10px;
            cursor: pointer;
        }

        .pd-reply-trigger i {
            font-size: 12px;
        }

        .pd-message-quote {
            display: block;
            width: 100%;
            min-width: 0;
            box-sizing: border-box;
            margin: 0 0 5px;
            padding: 8px 10px;
            border: 0;
            border-left: 3px solid #c16cff;
            border-radius: 8px;
            background: rgba(120,70,160,.13);
            color: inherit;
            text-align: left;
            cursor: pointer;
            overflow: hidden;
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
            white-space: pre-wrap;
            overflow-wrap: anywhere;
        }

        .pd-message-highlight {
            outline: 2px solid rgba(206,130,255,.9);
            box-shadow: 0 0 18px rgba(185,90,255,.35);
        }

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
            border: 1px solid rgba(190,130,255,.24);
            border-radius: 12px;
            background: rgba(100,55,140,.12);
        }

        .chat-input.is-replying .pd-reply-composer {
            display: flex;
        }

        .pd-reply-accent {
            width: 3px;
            min-width: 3px;
            align-self: stretch;
            border-radius: 5px;
            background: linear-gradient(180deg,#f238a9,#a85cff);
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
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .pd-reply-cancel {
            width: 30px;
            height: 30px;
            border: 0;
            border-radius: 50%;
            background: rgba(160,100,200,.16);
            color: inherit;
            cursor: pointer;
        }

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
            background: rgba(100,60,130,.16);
            font-size: 11px;
        }

        #pdJumpToLatest {
            position: fixed;
            right: max(18px,calc((100vw - 440px)/2 + 18px));
            bottom: 95px;
            z-index: 9999;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid rgba(255,255,255,.35);
            border-radius: 50%;
            background: linear-gradient(135deg,#c77dff,#8e35d4);
            color: white;
            box-shadow: 0 3px 12px rgba(142,53,212,.3);
            cursor: pointer;
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
            transform: translateY(5px);
            transition: all .2s ease;
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

        @media(max-width:380px) {
            .pd-message-group { max-width: 97%; }
            .pd-message-row { gap: 4px; }
            .pd-reply-trigger { min-width: 27px; padding: 4px; }
        }
    `;

    document.head.appendChild(style);
}

/* =========================================================
   ACCOUNT PROFILE
   ========================================================= */

async function setupProfile(user) {
    const email = user.email?.toLowerCase();
    const profile = PD_PROFILES[email];

    if (!profile) {
        currentProfile = null;
        console.error("PD: Account is not configured:", email);
        showError("This account is not configured for Princess wa Deib chat.");
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

    try {
        await setDoc(
            doc(db, "users", user.uid),
            {
                uid: user.uid,
                email,
                name: profile.name,
                displayName: profile.displayName,
                updatedAt: serverTimestamp()
            },
            { merge: true }
        );
    } catch (error) {
        // A profile write may be blocked by rules. Continue and report
        // it in the console; partner lookup still needs a readable profile.
        logError("PD profile write failed:", error);
    }

    return true;
}

function updatePDInterface() {
    if (!currentProfile) return;

    document.querySelectorAll("[data-user-name]").forEach(element => {
        element.textContent = currentProfile.displayName;
    });

    document.querySelectorAll("[data-chat-person-name]").forEach(element => {
        element.textContent =
            currentProfile.email === "princess@gmail.com"
                ? "My Deib ❤️"
                : "My Princess 💜";
    });
}

/* =========================================================
   FIND PARTNER
   ========================================================= */

async function findPartnerUID() {
    if (!currentProfile) {
        throw new Error("Your PD account is not ready.");
    }

    if (recipientUID && recipientUID !== currentProfile.uid) {
        return recipientUID;
    }

    const partnerEmail = getPartnerEmail();

    if (!partnerEmail) {
        throw new Error("The partner email is not configured.");
    }

    const partnerQuery = query(
        collection(db, "users"),
        where("email", "==", partnerEmail),
        limit(1)
    );

    const result = await getDocs(partnerQuery);

    if (result.empty) {
        throw new Error(`Partner account ${partnerEmail} was not found.`);
    }

    const partnerDoc = result.docs[0];
    const partnerData = partnerDoc.data();

    if (partnerDoc.id === currentProfile.uid) {
        throw new Error("You cannot send a message to yourself.");
    }

    if (
        partnerData.uid &&
        partnerData.uid !== partnerDoc.id
    ) {
        throw new Error("Partner profile UID does not match its document ID.");
    }

    recipientUID = partnerDoc.id;
    return recipientUID;
}

/* =========================================================
   ONLINE STATUS / LAST SEEN
   ========================================================= */

function ensurePresenceElement() {
    let element = byId("pd-presence-status");
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
    if (timestamp == null) return "Last seen unavailable";

    const date = new Date(Number(timestamp));
    if (Number.isNaN(date.getTime())) return "Last seen unavailable";

    const elapsed = Math.max(0, Date.now() - date.getTime());

    if (elapsed < 60000) return "Last seen just now";

    if (elapsed < 3600000) {
        return `Last seen ${Math.floor(elapsed / 60000)} min ago`;
    }

    const time = date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
    });

    if (elapsed < 86400000) {
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

    partnerPresenceUnsubscribe?.();
    activePartnerUID = uid;

    partnerPresenceUnsubscribe = onValue(
        databaseRef(presenceDB, `status/${uid}`),
        snapshot => {
            const status = snapshot.val() || {};
            const connections = status.connections || {};
            const online = Object.keys(connections).length > 0;

            showPartnerStatus(
                online ? "● Online" : formatLastSeen(status.lastChanged),
                online
            );
        },
        error => {
            logError("PD presence listener failed:", error);
            showPartnerStatus("Status unavailable");
        }
    );
}

function startOwnPresence(uid) {
    if (activePresenceUID === uid && connectedUnsubscribe) return;

    connectedUnsubscribe?.();
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
                logError("PD presence setup failed:", error);
            }
        },
        error => logError("PD connection monitor failed:", error)
    );
}

async function initializePresence() {
    if (!currentProfile) return;

    ensurePresenceElement();
    showPartnerStatus("Checking status…");
    startOwnPresence(currentProfile.uid);

    try {
        const partnerUID = await findPartnerUID();
        watchPartnerPresence(partnerUID);
    } catch (error) {
        logError("PD partner presence setup failed:", error);
        showPartnerStatus("Status unavailable");
    }
}

/* =========================================================
   SENT / DELIVERED / READ RECEIPTS
   ========================================================= */

function createReceipt(data, mine) {
    if (!mine) return null;

    const receipt = document.createElement("span");
    receipt.className = "pd-message-receipt";

    const status = data.status || "sent";

    if (status === "read") {
        receipt.textContent = "💜";
        receipt.title = "Read";
        receipt.classList.add("receipt-read");
    } else if (status === "delivered") {
        receipt.textContent = "🤍";
        receipt.title = "Delivered";
        receipt.classList.add("receipt-delivered");
    } else {
        receipt.textContent = "💘";
        receipt.title = "Sent";
        receipt.classList.add("receipt-sent");
    }

    return receipt;
}

async function updateIncomingReceipts(messageDocs) {
    if (
        !currentProfile ||
        document.visibilityState !== "visible"
    ) return;

    const chatIsOpen = location.pathname.endsWith("chat.html");

    for (const messageDoc of messageDocs) {
        const data = messageDoc.data();

        if (data.senderUID === currentProfile.uid) continue;
        if (data.recipientUID !== currentProfile.uid) continue;
        if (data.status === "read") continue;

        const nextStatus = chatIsOpen ? "read" : "delivered";

        if (
            data.status === "delivered" &&
            nextStatus === "delivered"
        ) continue;

        if (receiptUpdatesInFlight.has(messageDoc.id)) continue;

        receiptUpdatesInFlight.add(messageDoc.id);

        try {
            const changes = { status: nextStatus };

            if (!data.deliveredAt) {
                changes.deliveredAt = serverTimestamp();
            }

            if (nextStatus === "read" && !data.readAt) {
                changes.readAt = serverTimestamp();
            }

            await updateDoc(doc(db, "messages", messageDoc.id), changes);
        } catch (error) {
            logError(`PD receipt update failed: ${messageDoc.id}`, error);
        } finally {
            receiptUpdatesInFlight.delete(messageDoc.id);
        }
    }
}

/* =========================================================
   JUMP TO LATEST
   ========================================================= */

function setupJumpToLatest() {
    const container = byId("chatMessages");
    if (!container || pdJumpButton) return;

    pdJumpButton = document.createElement("button");
    pdJumpButton.type = "button";
    pdJumpButton.id = "pdJumpToLatest";
    pdJumpButton.title = "Jump to latest message";
    pdJumpButton.setAttribute("aria-label", "Jump to latest message");

    pdJumpButton.innerHTML = `
        <span>👇</span>
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
    const container = byId("chatMessages");
    if (!container || !pdJumpButton) return;

    const distance =
        container.scrollHeight -
        container.scrollTop -
        container.clientHeight;

    pdJumpButton.classList.toggle(
        "pd-arrow-visible",
        distance > 180
    );

    pdJumpButton.classList.toggle(
        "has-new-messages",
        pdNewMessageCount > 0
    );

    const count = pdJumpButton.querySelector(".pd-new-message-count");

    if (count) {
        count.textContent = pdNewMessageCount > 99
            ? "99+"
            : String(pdNewMessageCount);
    }
}

/* =========================================================
   REPLY COMPOSER
   ========================================================= */

function ensureReplyComposer() {
    const form = byId("chatForm");
    if (!form) return null;

    let composer = byId("pdReplyComposer");
    if (composer) return composer;

    composer = document.createElement("div");
    composer.className = "pd-reply-composer";
    composer.id = "pdReplyComposer";

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
    cancel.textContent = "✕";

    content.append(label, preview);
    composer.append(accent, content, cancel);
    form.insertBefore(composer, form.firstChild);

    cancel.addEventListener("click", clearReplyMode);

    return composer;
}

function setReplyMode(messageId, data) {
    if (!messageId || !data || !currentProfile) return;

    currentReply = {
        messageId,
        senderUID: data.senderUID || null,
        senderName: data.senderDisplayName || data.senderName || "My love",
        text: getMessagePreview(data),
        type: data.type || "text"
    };

    const form = byId("chatForm");
    if (!form) return;

    ensureReplyComposer();
    form.classList.add("is-replying");

    const label = byId("pdReplyLabel");
    const preview = byId("pdReplyText");

    if (label) {
        label.textContent =
            currentReply.senderUID === currentProfile.uid
                ? "Replying to yourself"
                : `Replying to ${currentReply.senderName}`;
    }

    if (preview) preview.textContent = currentReply.text;

    byId("messageInput")?.focus();
}

function clearReplyMode() {
    currentReply = null;

    byId("chatForm")?.classList.remove("is-replying");

    if (byId("pdReplyLabel")) {
        byId("pdReplyLabel").textContent = "Replying to";
    }

    if (byId("pdReplyText")) {
        byId("pdReplyText").textContent = "";
    }
}

function jumpToMessage(messageId) {
    const element = byId(`pd-message-${messageId}`);
    if (!element) return;

    element.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

    element.classList.add("pd-message-highlight");

    setTimeout(() => {
        element.classList.remove("pd-message-highlight");
    }, 1800);
}

function createQuotedMessage(replyTo) {
    if (!replyTo?.messageId) return null;

    const quote = document.createElement("button");
    quote.type = "button";
    quote.className = "pd-message-quote";
    quote.setAttribute("aria-label", "Jump to original message");

    const sender = document.createElement("span");
    sender.className = "pd-message-quote-sender";
    sender.textContent = replyTo.senderName || "Message";

    const text = document.createElement("span");
    text.className = "pd-message-quote-text";
    text.textContent = replyTo.text ||
        (replyTo.type === "voice" ? "🎙️ Voice message" : "Message");

    quote.append(sender, text);

    quote.addEventListener("click", () => {
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
    button.title = "Reply to this message";
    button.innerHTML = '<i class="fa-solid fa-reply"></i><span>Reply</span>';

    button.addEventListener("click", () => {
        setReplyMode(messageId, data);
    });

    actions.appendChild(button);
    return actions;
}

/* =========================================================
   MESSAGE FOOTER AND DISPLAY
   ========================================================= */

function makeMessageFooter(data, date, mine) {
    const footer = document.createElement("div");
    footer.className = "pd-message-footer";

    const time = document.createElement("span");
    time.className = "message-time";
    time.textContent = formatTime(date);
    footer.appendChild(time);

    const receipt = createReceipt(data, mine);
    if (receipt) footer.appendChild(receipt);

    return footer;
}

function displayTextMessage(container, data, date, messageId) {
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
    message.className = mine ? "message sent" : "message received";

    const text = document.createElement("div");
    text.className = "message-text";
    text.textContent = data.text || "";

    message.append(text, makeMessageFooter(data, date, mine));

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
   TOAST (small, non-blocking messages)
   ========================================================= */

function showToast(message) {
    let toast = byId("pdToast");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "pdToast";
        toast.className = "pd-toast";
        toast.setAttribute("role", "status");
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2800);
}

/* =========================================================
   VOICE NOTE PLAYER
   The <audio> objects live in memory (never inside the message
   list), so re-drawing the chat can no longer cut a note off.
   ========================================================= */

const pdVoicePlayers = new Map();

function formatClock(seconds) {
    const total = Math.max(0, Math.round(seconds || 0));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function hashString(text) {
    let hash = 2166136261;

    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
}

// A stable, pretty bar pattern per message (same note, same bars).
function waveHeights(id, count = 32) {
    let seed = hashString(String(id)) || 1;
    const heights = [];

    for (let i = 0; i < count; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;

        const random = seed / 4294967296;
        const envelope = 0.55 + 0.45 * Math.sin((i / (count - 1)) * Math.PI);

        heights.push(Math.round(Math.min(100, 20 + random * 80 * envelope)));
    }

    return heights;
}

function voiceDuration(player) {
    const length = player.audio.duration;

    if (Number.isFinite(length) && length > 0) return length;

    // Recordings made in the browser often report "Infinity".
    // Fall back to the length saved with the message.
    return player.known || player.real || 0;
}

// Some browsers cannot tell the length of a fresh recording until
// the end has been "visited". This reads it once, then rewinds.
function fixInfiniteDuration(player) {
    const audio = player.audio;

    if (player.fixing) return;
    player.fixing = true;

    const finish = () => {
        audio.removeEventListener("timeupdate", finish);

        if (Number.isFinite(audio.duration)) {
            player.real = audio.duration;
        }

        audio.currentTime = 0;
        player.fixing = false;
        syncVoiceUI(player);
    };

    audio.addEventListener("timeupdate", finish);
    audio.currentTime = 1e101;
}

function syncVoiceUI(player) {
    const ui = player.ui;
    if (!ui) return;

    const audio = player.audio;
    const total = voiceDuration(player);
    const playing = !audio.paused && !audio.ended;
    const current = player.fixing ? 0 : audio.currentTime;
    const ratio = total > 0 ? Math.min(1, current / total) : 0;
    const filled = Math.round(ratio * ui.bars.length);

    ui.root.classList.toggle("is-playing", playing);
    ui.root.classList.toggle("is-error", player.failed || player.unsupported);

    ui.icon.className = playing ? "fa-solid fa-pause" : "fa-solid fa-play";

    ui.btn.setAttribute(
        "aria-label",
        playing ? "Pause voice message" : "Play voice message"
    );

    ui.time.textContent =
        playing || current > 0.05
            ? formatClock(current)
            : formatClock(total);

    ui.bars.forEach((bar, index) => {
        bar.classList.toggle("on", index < filled);
        bar.classList.toggle("now", playing && index === filled);
    });

    ui.wave.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
}

function getVoicePlayer(id, data) {
    const existing = pdVoicePlayers.get(id);

    if (existing && existing.url === data.audioURL) return existing;

    if (existing) existing.audio.pause();

    const audio = new Audio();
    audio.preload = "metadata";
    audio.src = data.audioURL;

    const player = {
        id,
        url: data.audioURL,
        audio,
        known: Number(data.duration) || 0,
        real: 0,
        rate: 1,
        ui: null,
        failed: false,
        unsupported: false,
        fixing: false
    };

    audio.addEventListener("loadedmetadata", () => {
        if (audio.duration === Infinity) fixInfiniteDuration(player);
        syncVoiceUI(player);
    });

    ["timeupdate", "play", "pause", "durationchange", "seeked"].forEach(name => {
        audio.addEventListener(name, () => syncVoiceUI(player));
    });

    audio.addEventListener("ended", () => {
        audio.currentTime = 0;
        syncVoiceUI(player);
    });

    audio.addEventListener("error", () => {
        player.failed = true;
        syncVoiceUI(player);
    });

    pdVoicePlayers.set(id, player);
    return player;
}

async function toggleVoice(player) {
    const audio = player.audio;

    if (player.unsupported || player.failed) {
        showToast("This phone can't play that voice note. Tap Open instead.");
        return;
    }

    if (!audio.paused) {
        audio.pause();
        return;
    }

    // Only one voice note plays at a time.
    pdVoicePlayers.forEach(other => {
        if (other !== player && !other.audio.paused) other.audio.pause();
    });

    try {
        audio.playbackRate = player.rate;
        await audio.play();
    } catch (error) {
        logError("PD voice playback failed:", error);

        if (error?.name === "NotSupportedError") {
            player.failed = true;
            syncVoiceUI(player);
        }

        showToast("Couldn't play the voice note. Please try again.");
    }
}

function createVoicePlayer(id, data) {
    const player = getVoicePlayer(id, data);

    const root = document.createElement("div");
    root.className = "pd-voice";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pd-voice-play";
    btn.innerHTML = '<i class="fa-solid fa-play"></i>';

    const body = document.createElement("div");
    body.className = "pd-voice-body";

    const wave = document.createElement("div");
    wave.className = "pd-voice-wave";
    wave.setAttribute("role", "slider");
    wave.setAttribute("aria-label", "Voice message position");
    wave.setAttribute("aria-valuemin", "0");
    wave.setAttribute("aria-valuemax", "100");
    wave.tabIndex = 0;

    const bars = waveHeights(id).map(height => {
        const bar = document.createElement("span");
        bar.style.setProperty("--h", `${height}%`);
        wave.appendChild(bar);
        return bar;
    });

    const meta = document.createElement("div");
    meta.className = "pd-voice-meta";

    const time = document.createElement("span");
    time.className = "pd-voice-time";
    time.textContent = "0:00";

    const speed = document.createElement("button");
    speed.type = "button";
    speed.className = "pd-voice-speed";
    speed.textContent = `${player.rate}×`;
    speed.setAttribute("aria-label", "Change playback speed");

    const problem = document.createElement("span");
    problem.className = "pd-voice-problem";
    problem.textContent = "Can't play here · ";

    const open = document.createElement("a");
    open.className = "pd-voice-open";
    open.href = data.audioURL;
    open.target = "_blank";
    open.rel = "noopener";
    open.textContent = "Open";
    problem.appendChild(open);

    meta.append(time, problem, speed);
    body.append(wave, meta);
    root.append(btn, body);

    const icon = btn.querySelector("i");

    player.ui = { root, btn, icon, wave, bars, time, speed };

    // Some phones cannot play the format the other phone recorded.
    const type = data.audioContentType || "";
    player.unsupported = Boolean(type) && !player.audio.canPlayType(type);

    btn.addEventListener("click", () => toggleVoice(player));

    speed.addEventListener("click", () => {
        const rates = [1, 1.5, 2];
        player.rate = rates[(rates.indexOf(player.rate) + 1) % rates.length];
        player.audio.playbackRate = player.rate;
        speed.textContent = `${player.rate}×`;
    });

    // Tap or drag the bars to jump around.
    let dragging = false;

    const seekTo = event => {
        const rect = wave.getBoundingClientRect();
        const total = voiceDuration(player);

        if (!total || !rect.width) return;

        const ratio = Math.min(
            1,
            Math.max(0, (event.clientX - rect.left) / rect.width)
        );

        player.audio.currentTime = ratio * total;
        syncVoiceUI(player);
    };

    wave.addEventListener("pointerdown", event => {
        dragging = true;
        wave.setPointerCapture?.(event.pointerId);
        seekTo(event);
    });

    wave.addEventListener("pointermove", event => {
        if (dragging) seekTo(event);
    });

    ["pointerup", "pointercancel"].forEach(name => {
        wave.addEventListener(name, () => {
            dragging = false;
        });
    });

    wave.addEventListener("keydown", event => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

        event.preventDefault();

        const step = event.key === "ArrowRight" ? 5 : -5;
        const total = voiceDuration(player) || Infinity;

        player.audio.currentTime = Math.min(
            total,
            Math.max(0, player.audio.currentTime + step)
        );
    });

    syncVoiceUI(player);

    return root;
}

/* =========================================================
   MESSAGE NODE REUSE
   A message is only rebuilt when something about it changed,
   so nothing re-animates or restarts on every update.
   ========================================================= */

const pdNodeCache = new Map();
const pdSeparatorCache = new Map();

function getSeparatorNode(key, date) {
    let node = pdSeparatorCache.get(key);

    if (!node) {
        const holder = document.createDocumentFragment();
        addDateSeparator(holder, date);
        node = holder.firstElementChild;
        pdSeparatorCache.set(key, node);
    }

    return node;
}

function getMessageNode(id, data, date) {
    const signature = JSON.stringify([
        data.type || "text",
        data.text || "",
        data.audioURL || "",
        data.duration || 0,
        data.status || "sent",
        date ? date.getTime() : 0,
        data.replyTo?.messageId || "",
        data.replyTo?.text || ""
    ]);

    const cached = pdNodeCache.get(id);

    if (cached && cached.signature === signature) return cached.node;

    const holder = document.createDocumentFragment();

    if (data.type === "voice") {
        displayVoiceMessage(holder, data, date, id);
    } else {
        displayTextMessage(holder, data, date, id);
    }

    const node = holder.firstElementChild;

    if (!node) {
        pdNodeCache.delete(id);
        return null;
    }

    // Only brand-new, recent messages get the pop-in animation.
    const isFresh =
        !cached && (!date || Date.now() - date.getTime() < 15000);

    if (isFresh) {
        node.classList.add("pd-new");
        setTimeout(() => node.classList.remove("pd-new"), 900);
    }

    pdNodeCache.set(id, { signature, node });

    return node;
}

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

    const player = createVoicePlayer(messageId, data);
    message.append(player, makeMessageFooter(data, date, mine));

    const replyButton = createReplyButton(messageId, data);

    if (mine) {
        row.append(replyButton, message);
    } else {
        row.append(message, replyButton);
    }

    group.appendChild(row);
    container.appendChild(group);
}

function addDateSeparator(container, date) {
    const separator = document.createElement("div");
    separator.className = "chat-date-separator";

    const span = document.createElement("span");
    span.textContent = formatChatDate(date);

    separator.appendChild(span);
    container.appendChild(separator);
}

function removeChatLoader() {
    const loader = byId("pd-chat-loader");
    if (!loader) return;

    loader.classList.add("pd-loaded");
    setTimeout(() => loader.remove(), 150);
}

/* =========================================================
   RENDER MESSAGES
   ========================================================= */

function renderMessages() {
    const container = byId("chatMessages");
    if (!container || !currentProfile) return;

    const distanceFromBottom =
        container.scrollHeight -
        container.scrollTop -
        container.clientHeight;

    const wasNearBottom = distanceFromBottom < 150;
    const previousScrollTop = container.scrollTop;

    const docs = [...messageCache.entries()]
        .map(([id, data]) => ({ id, data }))
        .filter(({ data }) =>
            data.senderUID === currentProfile.uid ||
            data.recipientUID === currentProfile.uid
        )
        .sort((a, b) => {
            const da = getMessageDate(a.data);
            const db = getMessageDate(b.data);

            if (!da && !db) return 0;
            if (!da) return 1;
            if (!db) return -1;

            return da.getTime() - db.getTime();
        });

    const newest = docs.length ? docs[docs.length - 1].id : null;

    if (
        firstMessagesLoaded &&
        newest &&
        pdLastSeenMessageId &&
        newest !== pdLastSeenMessageId &&
        !wasNearBottom
    ) {
        pdNewMessageCount++;
    }

    pdLastSeenMessageId = newest;
    firstMessagesLoaded = true;

    const nodes = [];
    const liveIds = new Set();
    let previousDateKey = null;

    for (const { id, data } of docs) {
        const date = getMessageDate(data);

        if (date) {
            const key = getDateKey(date);

            if (key !== previousDateKey) {
                nodes.push(getSeparatorNode(key, date));
                previousDateKey = key;
            }
        }

        liveIds.add(id);

        const node = getMessageNode(id, data, date);
        if (node) nodes.push(node);
    }

    for (const id of [...pdNodeCache.keys()]) {
        if (!liveIds.has(id)) pdNodeCache.delete(id);
    }

    // Only touch the page when the list really changed.
    const unchanged =
        container.children.length === nodes.length &&
        nodes.every((node, index) => container.children[index] === node);

    if (!unchanged) container.replaceChildren(...nodes);

    updateJumpToLatest();
    removeChatLoader();

    requestAnimationFrame(() => {
        if (!firstMessagesLoaded || wasNearBottom) {
            container.scrollTop = container.scrollHeight;
        } else {
            container.scrollTop = Math.min(
                previousScrollTop,
                container.scrollHeight
            );
        }

        updateJumpToLatest();
    });
}

/* =========================================================
   REALTIME FIRESTORE LISTENERS
   Only query messages involving this signed-in account.
   ========================================================= */


function startChat() {
    const container = byId("chatMessages");

    if (!container) {
        console.error("PD: #chatMessages was not found in chat.html.");
        removeChatLoader();
        return;
    }

    if (!currentProfile?.uid) {
        console.error("PD: Cannot start chat — current user profile is missing.");
        removeChatLoader();
        return;
    }

    // Stop previous listeners before starting new ones.
    messageUnsubscribers.forEach(unsubscribe => unsubscribe());
    messageUnsubscribers = [];

    messageCache.clear();
    latestMessageDocs = [];
    firstMessagesLoaded = false;
    pdLastSeenMessageId = null;
    pdNewMessageCount = 0;

    setupJumpToLatest();

    const messagesRef = collection(db, "messages");
    const uid = currentProfile.uid;

    const sentQuery = query(
        messagesRef,
        where("senderUID", "==", uid),
        orderBy("createdAt", "asc")
    );

    const receivedQuery = query(
        messagesRef,
        where("recipientUID", "==", uid),
        orderBy("createdAt", "asc")
    );

    // Keep track of each query's complete current result.
    const queryResults = {
        sent: new Map(),
        received: new Map()
    };

    function applySnapshot(snapshot, queryName) {
        console.log(
            `PD: ${queryName} listener received ${snapshot.size} messages.`
        );

        const currentResults = queryResults[queryName];
        currentResults.clear();

        snapshot.forEach(messageDoc => {
            currentResults.set(messageDoc.id, messageDoc.data());
        });

        // Merge both query results without duplicates.
        messageCache.clear();

        for (const results of Object.values(queryResults)) {
            for (const [id, data] of results) {
                messageCache.set(id, data);
            }
        }

        latestMessageDocs = [...messageCache.entries()].map(
            ([id, data]) => ({
                id,
                data,
                ref: doc(db, "messages", id)
            })
        );

        // Sort messages chronologically.
        latestMessageDocs.sort((a, b) => {
            const aTime = a.data.createdAt?.toMillis?.() ?? 0;
            const bTime = b.data.createdAt?.toMillis?.() ?? 0;
            return aTime - bTime;
        });

        console.log(
            "PD: Rendering messages:",
            latestMessageDocs.map(item => ({
                id: item.id,
                text: item.data.text,
                senderUID: item.data.senderUID,
                recipientUID: item.data.recipientUID
            }))
        );

        renderMessages();

        firstMessagesLoaded = true;
        removeChatLoader();

        updateIncomingReceipts(
            latestMessageDocs.map(item => ({
                id: item.id,
                data: () => item.data
            }))
        );
    }

    function listenerError(error) {
        console.error("PD: Chat listener failed.", {
            code: error?.code,
            message: error?.message,
            error
        });

        removeChatLoader();
    }

    messageUnsubscribers.push(
        onSnapshot(
            sentQuery,
            snapshot => applySnapshot(snapshot, "sent"),
            listenerError
        ),
        onSnapshot(
            receivedQuery,
            snapshot => applySnapshot(snapshot, "received"),
            listenerError
        )
    );
}

/* =========================================================
   SEND TEXT MESSAGE
   ========================================================= */

async function sendMessage() {
    if (!currentProfile || pdSendingMessage) return;

    const input = byId("messageInput");
    const button = document.querySelector(".send-message");

    if (!input) {
        console.error("PD: #messageInput was not found.");
        return;
    }

    const text = input.value.trim();
    if (!text) return;

    pdSendingMessage = true;

    if (button) button.disabled = true;

    try {
        const partnerUID = await findPartnerUID();

        if (!partnerUID || partnerUID === currentProfile.uid) {
            throw new Error("A valid recipient account was not found.");
        }

        const replyTo = currentReply
            ? {
                messageId: currentReply.messageId,
                senderUID: currentReply.senderUID,
                senderName: currentReply.senderName,
                text: currentReply.text,
                type: currentReply.type
            }
            : null;

        const messageData = {
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
        };

   
const sentRef = await addDoc(
    collection(db, "messages"),
    messageData
);

console.log("PD: Message sent:", sentRef.id);

// Trigger the recipient's background push notification.
// A push failure must NOT mark the already-saved message as failed.
try {
    await sendPDMessagePush(sentRef.id);
    console.log("💌 PD background notification request completed.");
} catch (pushError) {
    console.error(
        "⚠️ Message saved, but push notification failed:",
        pushError
    );
}

// Continue normal chat cleanup.
input.value = "";
resizeMessageInput();
clearReplyMode();

pdSendingMessage = false;
if (button) button.disabled = false;


input.value = "";
resizeMessageInput();
clearReplyMode();

// Allow the next message to be sent.
pdSendingMessage = false;
if (button) button.disabled = false;

    } catch (error) {
        logError("PD message send failed:", error);
        showError(
    `Message failed to send.\n\nError: ${error?.code || "unknown"}\n${error?.message || String(error)}`
);
        pdSendingMessage = false;

        if (button) button.disabled = false;

        input.focus();
    }
}

/* =========================================================
   MULTILINE TEXT INPUT
   ========================================================= */

/* =========================================================
   COMPOSER STATE: mic and send swap places while you type
   ========================================================= */

function updateComposerState() {
    const form = byId("chatForm");
    const input = byId("messageInput");

    if (!form || !input) return;

    const hasText = input.value.trim().length > 0;

    form.classList.toggle("has-text", hasText);

    const send = form.querySelector(".send-message");
    const mic = byId("voiceButton");

    // Keep the hidden button out of the keyboard tab order.
    if (send) send.tabIndex = hasText ? 0 : -1;
    if (mic) mic.tabIndex = hasText ? -1 : 0;
}

/* =========================================================
   TAP EFFECTS: ripple, gold shine, sparkles, paper plane
   ========================================================= */

function installChatEffects() {
    if (window.__pdChatEffects) return;
    window.__pdChatEffects = true;

    const reduceMotion =
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const selector = [
        ".chat-header > a:first-child",
        ".call-button",
        ".video-call-button",
        ".chat-more-button",
        ".attach-button",
        "#voiceButton",
        ".send-message",
        ".pd-reply-trigger",
        ".pd-voice-play",
        ".pd-voice-speed",
        ".pd-rec-cancel",
        ".pd-call-control",
        "#pdJumpToLatest"
    ].join(",");

    const colors = ["#f4c95d", "#ffe9a8", "#cdb4ff", "#e0334f", "#ffffff"];
    const rand = (min, max) => min + Math.random() * (max - min);

    function ensureLayer(el) {
        let layer = el.querySelector(":scope > .pd-fx-layer");

        if (!layer) {
            if (getComputedStyle(el).position === "static") {
                el.style.position = "relative";
            }

            layer = document.createElement("span");
            layer.className = "pd-fx-layer";
            layer.setAttribute("aria-hidden", "true");
            el.appendChild(layer);
        }

        return layer;
    }

    function ripple(el, x, y) {
        const layer = ensureLayer(el);
        const box = el.getBoundingClientRect();
        const size = Math.max(box.width, box.height) * 2.2;

        const dot = document.createElement("span");
        dot.className = "pd-ripple";
        dot.style.width = dot.style.height = `${size}px`;
        dot.style.left = `${x - box.left - size / 2}px`;
        dot.style.top = `${y - box.top - size / 2}px`;

        layer.appendChild(dot);
        dot.addEventListener("animationend", () => dot.remove(), { once: true });

        layer.classList.remove("sweep");
        void layer.offsetWidth;
        layer.classList.add("sweep");
    }

    function sparkle(x, y, count = 6) {
        for (let i = 0; i < count; i++) {
            const star = document.createElement("span");
            const angle = rand(0, Math.PI * 2);
            const distance = rand(20, 50);

            star.className = "pd-spark";
            star.style.setProperty("--x", `${x}px`);
            star.style.setProperty("--y", `${y}px`);
            star.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
            star.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
            star.style.setProperty("--rot", `${rand(-180, 180)}deg`);
            star.style.setProperty("--sz", `${rand(6, 11)}px`);
            star.style.setProperty(
                "--col",
                colors[Math.floor(Math.random() * colors.length)]
            );

            document.body.appendChild(star);
            setTimeout(() => star.remove(), 800);
        }
    }

    document.addEventListener("pointerdown", event => {
        const target = event.target.closest(selector);
        if (!target) return;

        ripple(target, event.clientX, event.clientY);

        if (!reduceMotion) sparkle(event.clientX, event.clientY);

        if (target.matches(".send-message")) {
            target.classList.add("pd-fx-fly");
            setTimeout(() => target.classList.remove("pd-fx-fly"), 750);
        }
    }, { passive: true });
}

function resizeMessageInput() {
    const input = byId("messageInput");
    if (!input) return;

    input.style.height = "auto";

    const maxHeight = 120;
    input.style.height = Math.min(input.scrollHeight, maxHeight) + "px";

    input.style.overflowY =
        input.scrollHeight > maxHeight ? "auto" : "hidden";

    updateComposerState();
}

function setupMultilineInput() {
    const input = byId("messageInput");

    if (!input || input.dataset.pdMultilineBound === "true") return;

    input.dataset.pdMultilineBound = "true";
    input.addEventListener("input", resizeMessageInput);

    input.addEventListener("keydown", event => {
        // Enter sends; Shift+Enter adds a new line.
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.stopPropagation();

            const form = byId("chatForm");

            if (form?.requestSubmit) {
                form.requestSubmit();
            } else {
                sendMessage();
            }
        }
    });

    resizeMessageInput();
}

/* =========================================================
   VOICE NOTES
   ========================================================= */

const MAX_VOICE_SECONDS = 300;
const MIN_VOICE_MS = 800;

function updateVoiceButton(active) {
    const button = byId("voiceButton");
    if (!button) return;

    let icon = button.querySelector("i");

    if (!icon) {
        icon = document.createElement("i");
        button.prepend(icon);
    }

    button.classList.toggle("recording", active);
    byId("chatForm")?.classList.toggle("is-recording", active);

    icon.className = active
        ? "fa-solid fa-stop"
        : "fa-solid fa-microphone";

    button.title = active ? "Stop and send" : "Record voice note";

    button.setAttribute(
        "aria-label",
        active ? "Stop and send voice note" : "Record voice note"
    );
}

function ensureRecordingBar() {
    let bar = byId("pdRecBar");
    if (bar) return bar;

    const form = byId("chatForm");
    const input = byId("messageInput");
    if (!form || !input) return null;

    bar = document.createElement("div");
    bar.id = "pdRecBar";
    bar.className = "pd-rec-bar";
    bar.setAttribute("role", "status");

    bar.innerHTML =
        '<span class="pd-rec-dot"></span>' +
        '<span class="pd-rec-time" id="pdRecTime">0:00</span>' +
        '<span class="pd-rec-hint">Recording… tap ■ to send</span>';

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "pd-rec-cancel";
    cancel.setAttribute("aria-label", "Cancel recording");
    cancel.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    cancel.addEventListener("click", cancelRecording);

    bar.appendChild(cancel);
    form.insertBefore(bar, input);

    return bar;
}

function startRecordingTimer() {
    stopRecordingTimer();

    recordingStartedAt = Date.now();

    const label = byId("pdRecTime");
    if (label) label.textContent = "0:00";

    recordingTimer = setInterval(() => {
        const seconds = (Date.now() - recordingStartedAt) / 1000;
        const time = byId("pdRecTime");

        if (time) time.textContent = formatClock(seconds);

        if (seconds >= MAX_VOICE_SECONDS) {
            showToast("Voice notes can be up to 5 minutes long.");
            stopRecording();
        }
    }, 250);
}

function stopRecordingTimer() {
    if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
    }
}

async function startRecording() {
    if (recording || pdSendingVoice) return;

    if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
    ) {
        showError(
            "Voice recording requires HTTPS and a browser that supports audio recording."
        );
        return;
    }

    try {
        activeRecordingStream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

        // MP4/AAC first: it plays on iPhones AND Android.
        // WebM only plays on some iPhones, so it is the fallback.
        const types = [
            "audio/mp4;codecs=mp4a.40.2",
            "audio/mp4",
            "audio/webm;codecs=opus",
            "audio/webm",
            "audio/ogg;codecs=opus"
        ];

        const mimeType = types.find(type =>
            MediaRecorder.isTypeSupported(type)
        );

        mediaRecorder = mimeType
            ? new MediaRecorder(activeRecordingStream, { mimeType })
            : new MediaRecorder(activeRecordingStream);

        audioChunks = [];
        recordingCancelled = false;

        mediaRecorder.ondataavailable = event => {
            if (event.data?.size) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onerror = event => {
            logError("PD recorder error:", event.error || event);
            stopRecordingTimer();
            recording = false;
            updateVoiceButton(false);
            activeRecordingStream?.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.onstop = async () => {
            const chunks = [...audioChunks];
            audioChunks = [];

            const heldMs = Date.now() - recordingStartedAt;

            const blob = new Blob(chunks, {
                type: mediaRecorder?.mimeType || "audio/webm"
            });

            activeRecordingStream?.getTracks().forEach(track => track.stop());
            activeRecordingStream = null;

            stopRecordingTimer();
            recording = false;
            updateVoiceButton(false);

            if (recordingCancelled) {
                recordingCancelled = false;
                return;
            }

            if (heldMs < MIN_VOICE_MS) {
                showToast("Hold on a little longer to record a voice note.");
                return;
            }

            if (!blob.size) {
                showError("No audio was recorded. Please try again.");
                return;
            }

            await uploadVoice(blob, Math.round(heldMs / 1000));
        };

        ensureRecordingBar();
        mediaRecorder.start(250);
        recording = true;
        updateVoiceButton(true);
        startRecordingTimer();

        console.log("PD: Voice recording started.");

    } catch (error) {
        logError("PD microphone access failed:", error);

        activeRecordingStream?.getTracks().forEach(track => track.stop());
        activeRecordingStream = null;
        stopRecordingTimer();
        recording = false;
        updateVoiceButton(false);

        showError(
            error.name === "NotAllowedError"
                ? "Please allow microphone access for Princess wa Deib."
                : "Could not start recording. Check your microphone and try again."
        );
    }
}

function stopRecording() {
    if (!mediaRecorder || !recording) return;

    recording = false;
    updateVoiceButton(false);

    if (mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
    }
}

function cancelRecording() {
    if (!mediaRecorder || !recording) return;

    recordingCancelled = true;
    stopRecording();
}

async function uploadVoice(audioBlob, durationSeconds = 0) {
    if (!currentProfile || pdSendingVoice) return;

    pdSendingVoice = true;

    const button = byId("voiceButton");

    if (button) {
        button.disabled = true;
        button.classList.add("uploading");
        button.title = "Sending voice note…";
    }

    try {
        const partnerUID = await findPartnerUID();

        if (!partnerUID || partnerUID === currentProfile.uid) {
            throw new Error("A valid recipient account was not found.");
        }

        const contentType =
            audioBlob.type.split(";")[0] || "audio/webm";

        let extension = "webm";

        if (contentType.includes("mp4")) extension = "m4a";
        else if (contentType.includes("ogg")) extension = "ogg";
        else if (contentType.includes("wav")) extension = "wav";

        const fileName =
            `voice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`;

        const fileRef = storageRef(
            storage,
            `voice-messages/${currentProfile.uid}/${fileName}`
        );

        const uploaded = await uploadBytes(fileRef, audioBlob, {
            contentType
        });

        const audioURL = await getDownloadURL(uploaded.ref);

        const replyTo = currentReply
            ? {
                messageId: currentReply.messageId,
                senderUID: currentReply.senderUID,
                senderName: currentReply.senderName,
                text: currentReply.text,
                type: currentReply.type
            }
            : null;

        const messageRef = await addDoc(collection(db, "messages"), {
            type: "voice",
            audioURL,
            audioContentType: contentType,
            duration: durationSeconds,
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

        console.log("PD: Voice note sent:", messageRef.id);

        // Notify the partner. A push failure must not mark the saved note as failed.
        try {
            await sendPDMessagePush(messageRef.id);
        } catch (pushError) {
            console.error("Voice note saved, but push notification failed:", pushError);
        }

        clearReplyMode();

    } catch (error) {
        logError("PD voice note send failed:", error);
        showError(getFirebaseErrorMessage(error));
    } finally {
        pdSendingVoice = false;

        if (button) {
            button.disabled = false;
            button.classList.remove("uploading");
            button.title = "Record voice note";
        }
    }
}

function setupVoiceButton() {
    const button = byId("voiceButton");

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
    const form = byId("chatForm");
    const sendButton = document.querySelector(".send-message");

    if (form && form.dataset.pdBound !== "true") {
        form.dataset.pdBound = "true";

        form.addEventListener("submit", event => {
            event.preventDefault();
            sendMessage();
        });
    }

    // Explicitly handle the send-button click.
    // Prevent the default form submission so the message
    // is not submitted twice.
    if (sendButton && sendButton.dataset.pdBound !== "true") {
        sendButton.dataset.pdBound = "true";
        sendButton.addEventListener("click", event => {
            event.preventDefault();
            sendMessage();
        });
    }

    setupMultilineInput();
    ensureReplyComposer();
    setupVoiceButton();
    ensureRecordingBar();
    updateComposerState();
}


/* =========================================================
   CLEANUP / TAB VISIBILITY
   ========================================================= */

document.addEventListener("visibilitychange", () => {
    if (
        document.visibilityState === "visible" &&
        currentProfile &&
        latestMessageDocs.length
    ) {
        updateIncomingReceipts(
            latestMessageDocs.map(item => ({
                id: item.id,
                data: () => item.data
            }))
        );
    }
});

window.addEventListener("beforeunload", () => {
    messageUnsubscribers.forEach(unsubscribe => unsubscribe());
    partnerPresenceUnsubscribe?.();
    connectedUnsubscribe?.();
});

/* =========================================================
   AUTHENTICATION AND STARTUP
   ========================================================= */

let pdAuthInitialized = false;

function initializePage() {
    if (pdAuthInitialized) return;
    pdAuthInitialized = true;

    installChatStyles();
    installChatEffects();
    setupPageEvents();
    setupJumpToLatest();

    onAuthStateChanged(auth, async user => {
        if (!user) {
            window.location.href = "login.html";
            return;
        }

        try {
            const ready = await setupProfile(user);

            if (!ready) {
                removeChatLoader();
                return;
            }

            console.log("PD authenticated:", user.email);

            startChat();

            initializePresence().catch(error => {
                logError("PD presence initialization failed:", error);
            });

        } catch (error) {
            logError("PD chat initialization failed:", error);
            removeChatLoader();
        }
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializePage, {
        once: true
    });
} else {
    initializePage();
}
