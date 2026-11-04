
/* =========================================================
   PRINCESS WA DEIB — HOME LIVE LOVE FEED
   Old messages replay + highlighted new messages
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

const NEW_MESSAGE_WINDOW = 3 * 60 * 1000; // 3 minutes
const REPLAY_INTERVAL = 2800;
const BUBBLE_DURATION = 6200;

let feedContainer;
let oldMessages = [];
let newMessages = [];
let shownIds = [];
let activeBubbles = [];
let currentUserUID = null;
let replayStarted = false;

const messagePool = new Map();

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
            background: rgba(35,16,53,.88);
            backdrop-filter: blur(18px);
            -webkit-backdrop-filter: blur(18px);
            box-shadow: 0 8px 25px rgba(0,0,0,.22);
            color: white;
            opacity: 0;
            transform: translateY(22px) scale(.94);
            animation: pdBubbleEnter .5s cubic-bezier(.2,.8,.2,1) forwards,
                       pdBubbleExit .65s ease 5.5s forwards;
        }

        .pd-live-bubble.is-new {
            border: 1px solid rgba(255,125,205,.75);
            background: linear-gradient(
                120deg,
                rgba(90,28,91,.95),
                rgba(45,19,73,.94)
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
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }

        @keyframes pdBubbleExit {
            to {
                opacity: 0;
                transform: translateY(-25px) scale(.95);
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

function createFeed() {
    if (document.getElementById("pd-live-chat-feed")) {
        feedContainer = document.getElementById("pd-live-chat-feed");
        return;
    }

    feedContainer = document.createElement("div");
    feedContainer.id = "pd-live-chat-feed";
    feedContainer.setAttribute("aria-live", "polite");

    document.body.appendChild(feedContainer);
}

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

    return time > 0 &&
        Date.now() - time <= NEW_MESSAGE_WINDOW;
}

function getMessageText(data) {
    if (data.type === "voice") return "🎙️ Sent a voice message";
    if (data.type === "image") return "📷 Sent a photo";
    if (data.type === "video") return "🎬 Sent a video";

    return String(data.text || "Sent a message");
}

function addToPool(id, data, isNew = false) {
    if (!data || !data.senderUID) return;

    const item = {
        id,
        data,
        isNew: isNew || isRecentMessage(data)
    };

    messagePool.set(id, item);
    refreshPools();
}

function refreshPools() {
    oldMessages = [];
    newMessages = [];

    for (const item of messagePool.values()) {
        // New messages eventually become memories.
        if (item.isNew && isRecentMessage(item.data)) {
            newMessages.push(item);
        } else {
            item.isNew = false;
            oldMessages.push(item);
        }
    }
}

function chooseMessage() {
    refreshPools();

    if (!oldMessages.length && !newMessages.length) return null;

    // Mostly replay old messages: 80% old, 20% new.
    const chooseNew =
        newMessages.length > 0 &&
        (oldMessages.length === 0 || Math.random() < 0.20);

    const pool = chooseNew ? newMessages : oldMessages;

    let candidates = pool.filter(item =>
        !shownIds.includes(item.id)
    );

    // Allow old messages to replay after the pool has been used.
    if (!candidates.length) {
        shownIds = [];
        candidates = pool;
    }

    if (!candidates.length) {
        candidates = [...oldMessages, ...newMessages];
    }

    if (!candidates.length) return null;

    return candidates[Math.floor(Math.random() * candidates.length)];
}

function displayBubble(item) {
    if (!item || !feedContainer) return;

    const data = item.data;
    const isMine = data.senderUID === currentUserUID;
    const isNew = item.isNew && isRecentMessage(data);

    const bubble = document.createElement("div");

    bubble.className =
        "pd-live-bubble" + (isNew ? " is-new" : "");

    const avatar = document.createElement("div");
    avatar.className = "pd-live-avatar";
    avatar.textContent = isMine ? "💜" : "❤️";

    const copy = document.createElement("div");
    copy.className = "pd-live-copy";

    const topLine = document.createElement("div");
    topLine.className = "pd-live-topline";

    const name = document.createElement("span");
    name.className = "pd-live-name";
    name.textContent =
        data.senderDisplayName ||
        data.senderName ||
        (isMine ? "Hubby 💜" : "Baby ❤️");

    const label = document.createElement("span");
    label.className =
        "pd-live-label " + (isNew ? "new" : "memory");

    label.textContent = isNew ? "NEW" : "MEMORY";

    const message = document.createElement("span");
    message.className = "pd-live-text";
    message.textContent = getMessageText(data);

    topLine.append(name, label);
    copy.append(topLine, message);
    bubble.append(avatar, copy);

    bubble.style.pointerEvents = "auto";
    bubble.style.cursor = "pointer";

    bubble.addEventListener("click", () => {
        window.location.href = "chat.html";
    });

    feedContainer.appendChild(bubble);
    activeBubbles.push(bubble);

    while (activeBubbles.length > 3) {
        const oldest = activeBubbles.shift();
        oldest.remove();
    }

    shownIds.push(item.id);

    setTimeout(() => {
        bubble.remove();
        activeBubbles = activeBubbles.filter(el => el !== bubble);
    }, BUBBLE_DURATION);
}

function startReplay() {
    if (replayStarted) return;

    replayStarted = true;

    // Wait briefly for both Firestore listeners to load history.
    setTimeout(() => {
        displayBubble(chooseMessage());
    }, 1000);

    setInterval(() => {
        displayBubble(chooseMessage());
    }, REPLAY_INTERVAL);
}

function listenToMessages(uid, direction) {
    const messagesRef = collection(db, "messages");

    const field = direction === "sent"
        ? "senderUID"
        : "recipientUID";

    const messageQuery = query(
        messagesRef,
        where(field, "==", uid),
        orderBy("createdAt", "desc"),
        limit(100)
    );

    let firstSnapshot = true;

    return onSnapshot(messageQuery, snapshot => {
        snapshot.docChanges().forEach(change => {
            const id = change.doc.id;
            const data = change.doc.data();

            if (change.type === "removed") {
                messagePool.delete(id);
                return;
            }

            if (change.type === "added") {
                if (firstSnapshot) {
                    // Existing chat history: replay as MEMORY,
                    // except messages sent within the last 3 minutes.
                    addToPool(id, data, false);
                } else {
                    // Messages arriving while home is open.
                    addToPool(id, data, true);
                }
            }
        });

        if (firstSnapshot) {
            firstSnapshot = false;
            refreshPools();
        }

    }, error => {
        console.error("PD home feed listener error:", error);
    });
}

createFeed();
installStyles();

onAuthStateChanged(auth, user => {
    if (!user || currentUserUID === user.uid) return;

    currentUserUID = user.uid;

    listenToMessages(user.uid, "sent");
    listenToMessages(user.uid, "received");

    startReplay();
});
