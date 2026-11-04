
/* =========================================================
   PRINCESS WA DEIB — HOME LIVE LOVE FEED
   Correct sender identities • Memory replay • New messages
   Glass bubbles • Smooth fade-out • Mobile-first
========================================================= */

import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

/* ===================== SETTINGS ===================== */

const NEW_MESSAGE_WINDOW = 3 * 60 * 1000;
const REPLAY_INTERVAL = 2800;
const BUBBLE_DURATION = 6200;
const MAX_BUBBLES = 3;
const MAX_MESSAGES = 100;

/* ===================== ACCOUNT NAMES ===================== */

const PD_ACCOUNT_NAMES = {
    "princess@gmail.com": {
        own: "Hubby 💜",
        partner: "Baby ❤️"
    },

    "deib@gmail.com": {
        own: "Baby ❤️",
        partner: "Hubby 💜"
    }
};

/* ===================== STATE ===================== */

let feedContainer = null;
let currentUserUID = null;
let currentUserEmail = null;

let oldMessages = [];
let newMessages = [];

let shownIds = [];
let activeBubbles = [];
let messagePool = new Map();

let unsubscribers = [];
let replayInterval = null;
let startupTimeout = null;

/* ===================== IDENTITY ===================== */

function getSenderName(data) {
    const account = PD_ACCOUNT_NAMES[currentUserEmail];

    if (!account) {
        return data.senderDisplayName ||
            data.senderName ||
            "Your love ❤️";
    }

    // Always identify the sender using senderUID.
    // Do not trust potentially incorrect display-name fields.
    if (data.senderUID === currentUserUID) {
        return account.own;
    }

    return account.partner;
}

/* ===================== STYLES ===================== */

function installStyles() {
    if (document.getElementById("pd-live-chat-styles")) return;

    const style = document.createElement("style");
    style.id = "pd-live-chat-styles";

    style.textContent = `
        #pd-live-chat-feed {
            position: fixed;
            left: max(12px, calc((100vw - 440px) / 2 + 12px));
            bottom: 88px;
            width: min(310px, calc(100vw - 32px));
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 9px;
            z-index: 9998;
            pointer-events: none;
        }

        .pd-live-bubble {
            display: flex;
            align-items: center;
            gap: 9px;
            width: fit-content;
            max-width: 100%;
            padding: 9px 12px 9px 9px;

            border: 1px solid rgba(255,255,255,.17);
            border-radius: 17px 17px 17px 5px;

            background: rgba(35,16,53,.90);
            backdrop-filter: blur(18px);
            -webkit-backdrop-filter: blur(18px);

            box-shadow: 0 8px 25px rgba(0,0,0,.22);
            color: white;

            opacity: 0;
            transform: translateY(18px) scale(.96);

            animation:
                pdBubbleEnter .45s cubic-bezier(.2,.8,.2,1) forwards,
                pdBubbleExit .85s ease-in 5.15s forwards;

            will-change: opacity, transform;
        }

        .pd-live-bubble.is-new {
            border: 1px solid rgba(255,125,205,.75);

            background: linear-gradient(
                120deg,
                rgba(90,28,91,.96),
                rgba(45,19,73,.95)
            );

            box-shadow:
                0 0 16px rgba(255,90,190,.28),
                0 8px 25px rgba(0,0,0,.28);
        }

        .pd-live-avatar {
            flex: 0 0 32px;
            width: 32px;
            height: 32px;

            display: grid;
            place-items: center;

            border-radius: 50%;
            background: linear-gradient(135deg,#e8a4ff,#8539c7);

            font-size: 14px;
        }

        .pd-live-bubble.is-new .pd-live-avatar {
            background: linear-gradient(135deg,#ff9acb,#a33c91);
            box-shadow: 0 0 12px rgba(255,125,205,.45);
        }

        .pd-live-copy {
            flex: 1;
            min-width: 0;

            display: flex;
            flex-direction: column;
            gap: 3px;
        }

        .pd-live-topline {
            display: flex;
            align-items: center;
            gap: 7px;
            flex-wrap: wrap;
        }

        .pd-live-name {
            color: #e4b9ff;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: .3px;
        }

        .pd-live-bubble.is-new .pd-live-name {
            color: #ffc4e5;
        }

        .pd-live-label {
            font-size: 8px;
            font-weight: 900;
            letter-spacing: .7px;
            padding: 3px 6px;
            border-radius: 10px;
        }

        .pd-live-label.new {
            color: #fff;
            background: linear-gradient(90deg,#f03e9d,#a33be0);
            box-shadow: 0 0 10px rgba(255,75,180,.3);
        }

        .pd-live-label.memory {
            color: #d4b7e9;
            background: rgba(190,140,220,.15);
        }

        .pd-live-text {
            color: #fff;
            font-size: 12px;
            font-weight: 500;
            line-height: 1.4;
            overflow-wrap: anywhere;

            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        @keyframes pdBubbleEnter {
            from {
                opacity: 0;
                transform: translateY(18px) scale(.96);
            }

            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }

        @keyframes pdBubbleExit {
            from {
                opacity: 1;
                transform: translateY(0) scale(1);
            }

            to {
                opacity: 0;
                transform: translateY(-18px) scale(.94);
            }
        }

        @media(max-width:380px) {
            #pd-live-chat-feed {
                bottom: 82px;
                width: min(275px, calc(100vw - 28px));
            }
        }

        @media(prefers-reduced-motion:reduce) {
            .pd-live-bubble {
                animation: none;
                opacity: 1;
                transform: none;
            }
        }
    `;

    document.head.appendChild(style);
}

/* ===================== FEED CONTAINER ===================== */

function createFeed() {
    feedContainer = document.getElementById("pd-live-chat-feed");

    if (feedContainer) return;

    feedContainer = document.createElement("div");
    feedContainer.id = "pd-live-chat-feed";
    feedContainer.setAttribute("aria-live", "polite");

    document.body.appendChild(feedContainer);
}

/* ===================== MESSAGE HELPERS ===================== */

function getMessageTime(data) {
    if (data.createdAt?.toDate) {
        return data.createdAt.toDate().getTime();
    }

    if (data.createdAt instanceof Date) {
        return data.createdAt.getTime();
    }

    return 0;
}

function isRecentMessage(data) {
    const time = getMessageTime(data);
    const age = Date.now() - time;

    return time > 0 &&
        age >= 0 &&
        age <= NEW_MESSAGE_WINDOW;
}

function getMessageText(data) {
    if (data.type === "voice") {
        return "🎙️ Sent a voice message";
    }

    if (data.type === "image") {
        return "📷 Sent a photo";
    }

    if (data.type === "video") {
        return "🎬 Sent a video";
    }

    return String(data.text || "Sent a message");
}

/* ===================== MESSAGE POOL ===================== */

function addToPool(id, data, isNew = false) {
    if (!data || !data.senderUID) return;

    const previous = messagePool.get(id);

    messagePool.set(id, {
        id,
        data,
        isNew:
            isNew ||
            previous?.isNew ||
            isRecentMessage(data)
    });

    refreshPools();
}

function refreshPools() {
    oldMessages = [];
    newMessages = [];

    for (const item of messagePool.values()) {
        if (item.isNew && isRecentMessage(item.data)) {
            newMessages.push(item);
        } else {
            item.isNew = false;
            oldMessages.push(item);
        }
    }
}

/* ===================== MESSAGE SELECTION ===================== */

function chooseMessage() {
    refreshPools();

    if (!oldMessages.length && !newMessages.length) {
        return null;
    }

    // 80% memories, 20% new messages.
    const chooseNew =
        newMessages.length > 0 &&
        (
            oldMessages.length === 0 ||
            Math.random() < 0.20
        );

    const pool = chooseNew ? newMessages : oldMessages;

    let candidates = pool.filter(item =>
        !shownIds.includes(item.id)
    );

    if (!candidates.length) {
        shownIds = [];
        candidates = pool;
    }

    if (!candidates.length) return null;

    return candidates[
        Math.floor(Math.random() * candidates.length)
    ];
}

/* ===================== DISPLAY BUBBLE ===================== */

function displayBubble(item) {
    if (!item || !feedContainer) return;

    const data = item.data;
console.log("PD FEED IDENTITY CHECK", {
    signedInEmail: currentUserEmail,
    signedInUID: currentUserUID,
    messageSenderUID: data.senderUID,
    messageSenderName: data.senderName,
    messageSenderDisplayName: data.senderDisplayName,
    isMine: data.senderUID === currentUserUID
});
    const isMine = data.senderUID === currentUserUID;
    const isNew = item.isNew && isRecentMessage(data);

    const bubble = document.createElement("div");

    bubble.className =
        "pd-live-bubble" + (isNew ? " is-new" : "");

    /* Avatar */

    const avatar = document.createElement("div");
    avatar.className = "pd-live-avatar";
    avatar.textContent = isMine ? "❤️‍🔥" : "❤️";

    /* Text container */

    const copy = document.createElement("div");
    copy.className = "pd-live-copy";

    /* Sender and label */

    const topLine = document.createElement("div");
    topLine.className = "pd-live-topline";

    const name = document.createElement("span");
    name.className = "pd-live-name";
    name.textContent = getSenderName(data);

    const label = document.createElement("span");
    label.className =
        "pd-live-label " + (isNew ? "new" : "memory");

    label.textContent = isNew ? "NEW" : "MEMORY";

    /* Message */

    const message = document.createElement("span");
    message.className = "pd-live-text";
    message.textContent = getMessageText(data);

    topLine.append(name, label);
    copy.append(topLine, message);
    bubble.append(avatar, copy);

    /* Open chat when clicked */

    bubble.style.pointerEvents = "auto";
    bubble.style.cursor = "pointer";

    bubble.addEventListener("click", () => {
        window.location.href = "chat.html";
    });

    feedContainer.appendChild(bubble);
    activeBubbles.push(bubble);

    /* Keep only three visible bubbles */

    while (activeBubbles.length > MAX_BUBBLES) {
        const oldest = activeBubbles.shift();
        oldest.remove();
    }

    shownIds.push(item.id);

    /* Remove after fade-out animation */

    setTimeout(() => {
        bubble.remove();

        activeBubbles = activeBubbles.filter(
            element => element !== bubble
        );
    }, BUBBLE_DURATION);
}

/* ===================== REPLAY SYSTEM ===================== */

function startReplay() {
    if (replayInterval) return;

    startupTimeout = setTimeout(() => {
        displayBubble(chooseMessage());
    }, 1200);

    replayInterval = setInterval(() => {
        displayBubble(chooseMessage());
    }, REPLAY_INTERVAL);
}

/* ===================== FIRESTORE LISTENERS ===================== */

function listenToMessages(uid, direction) {
    const messagesRef = collection(db, "messages");

    const field = direction === "sent"
        ? "senderUID"
        : "recipientUID";

    const messageQuery = query(
        messagesRef,
        where(field, "==", uid),
        orderBy("createdAt", "desc"),
        limit(MAX_MESSAGES)
    );

    let firstSnapshot = true;

    const unsubscribe = onSnapshot(
        messageQuery,
        snapshot => {
            snapshot.docChanges().forEach(change => {
                const id = change.doc.id;
                const data = change.doc.data();

                if (change.type === "removed") {
                    messagePool.delete(id);
                    return;
                }

                if (change.type === "added") {
                    // Initial history is replayed as MEMORY,
                    // unless it was sent within the last 3 minutes.
                    addToPool(
                        id,
                        data,
                        !firstSnapshot
                    );
                }

                if (change.type === "modified") {
                    const previous = messagePool.get(id);

                    addToPool(
                        id,
                        data,
                        previous?.isNew || false
                    );
                }
            });

            if (firstSnapshot) {
                firstSnapshot = false;
                refreshPools();
            }
        },
        error => {
            console.error(
                "PD home feed listener error:",
                error
            );
        }
    );

    unsubscribers.push(unsubscribe);
}

/* ===================== CLEANUP ===================== */

function stopFeed() {
    unsubscribers.forEach(unsubscribe => unsubscribe());
    unsubscribers = [];

    if (replayInterval) {
        clearInterval(replayInterval);
        replayInterval = null;
    }

    if (startupTimeout) {
        clearTimeout(startupTimeout);
        startupTimeout = null;
    }

    activeBubbles.forEach(bubble => bubble.remove());
    activeBubbles = [];

    messagePool.clear();
    oldMessages = [];
    newMessages = [];
    shownIds = [];

    if (feedContainer) {
        feedContainer.innerHTML = "";
    }
}

/* ===================== INITIALIZATION ===================== */

installStyles();
createFeed();

onAuthStateChanged(auth, user => {
    stopFeed();

    if (!user) {
        currentUserUID = null;
        currentUserEmail = null;
        return;
    }

    currentUserUID = user.uid;
    currentUserEmail = user.email?.toLowerCase() || null;

    listenToMessages(user.uid, "sent");
    listenToMessages(user.uid, "received");

    startReplay();
});
