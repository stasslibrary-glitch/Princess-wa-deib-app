
/* =========================================================
   PRINCESS WA DEIB — notification.js
   Foreground + Background Notifications
   Unread Counter + Popup + Sound + Firebase Cloud Messaging
   ========================================================= */

import { app, auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    collection,
    query,
    orderBy,
    onSnapshot,
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import {
    getMessaging,
    getToken,
    isSupported,
    onMessage
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging.js";


/* ================= SETTINGS ================= */

// IMPORTANT: Replace this with your REAL deployed Worker URL.
const PD_WORKER_URL = "https://pd-notifications.stasslibrary.workers.dev";

const PD_VAPID_KEY =
    "BIXOKrV58L1gLD618OUPv9Qq0AddRv-O5mhtOlGQQPDzhueRa-PczLbbM2GwUuT23Lw0cdAOJIHeMjg6c9nsGqg";

let currentUser = null;
let firstLoad = true;
let knownMessages = new Set();
let messagingInstance = null;
let foregroundHandlerRegistered = false;
let listenerStarted = false;
let unsubscribeMessages = null;
let soundUnlocked = false;
let popupTimer = null;

let unreadCount = Number(
    localStorage.getItem("pdUnreadMessages") || 0
);


/* ================= SOUND ================= */

const notificationSound = new Audio("sounds/message.mp3");
notificationSound.preload = "auto";
notificationSound.volume = 1;

function unlockSound() {
    if (soundUnlocked) return;

    notificationSound.play()
        .then(() => {
            notificationSound.pause();
            notificationSound.currentTime = 0;
            soundUnlocked = true;
        })
        .catch(() => {
            // Browsers require a user interaction before audio playback.
        });
}

document.addEventListener("click", unlockSound);
document.addEventListener("touchstart", unlockSound, { passive: true });

function playSound() {
    try {
        notificationSound.pause();
        notificationSound.currentTime = 0;

        notificationSound.play().catch(error => {
            console.warn("PD sound blocked by browser:", error);
        });
    } catch (error) {
        console.warn("PD sound could not play:", error);
    }
}


/* ================= UNREAD BADGE ================= */

function updateChatBadge() {
    document.querySelectorAll("#chatNotification").forEach(badge => {
        badge.textContent = String(unreadCount);
        badge.style.display = unreadCount > 0 ? "flex" : "none";
    });

    localStorage.setItem("pdUnreadMessages", String(unreadCount));
}

function clearUnreadMessages() {
    unreadCount = 0;
    updateChatBadge();
}

document.addEventListener("DOMContentLoaded", updateChatBadge);


/* ================= IN-APP POPUP ================= */

function createPopup() {
    if (document.getElementById("pd-notification-container")) return;

    const container = document.createElement("div");
    container.id = "pd-notification-container";

    container.innerHTML = `
        <div id="pd-message-popup" class="pd-message-popup">
            <div class="pd-popup-icon">
                <i class="fa-solid fa-heart"></i>
            </div>

            <div class="pd-popup-text">
                <strong id="pd-popup-title">New message ❤️</strong>
                <span id="pd-popup-body">You have a new message</span>
            </div>

            <button id="pd-popup-close" type="button"
                    aria-label="Close notification">×</button>
        </div>
    `;

    document.body.appendChild(container);

    document.getElementById("pd-popup-close")
        ?.addEventListener("click", hidePopup);
}

function showPopup(sender, message) {
    createPopup();

    const popup = document.getElementById("pd-message-popup");
    const title = document.getElementById("pd-popup-title");
    const body = document.getElementById("pd-popup-body");

    if (!popup || !title || !body) return;

    title.textContent = `${sender} ❤️`;
    body.textContent = message;

    popup.classList.remove("show");

    requestAnimationFrame(() => {
        popup.classList.add("show");
    });

    clearTimeout(popupTimer);
    popupTimer = setTimeout(hidePopup, 5000);
}

function hidePopup() {
    document.getElementById("pd-message-popup")
        ?.classList.remove("show");
}


/* ================= MESSAGE DETAILS ================= */

function getMessageText(data) {
    if (data.type === "voice") return "🎙️ Sent you a voice note";
    if (data.type === "image") return "📷 Sent you a photo";
    if (data.type === "video") return "🎥 Sent you a video";

    return data.text || "You have a new message 💕";
}

function getSenderName() {
    return currentUser?.email?.toLowerCase() === "deib@gmail.com"
        ? "Ernest ❤️"
        : "Jaris ❤️";
}

function isIncomingMessage(data) {
    if (!currentUser || !data) return false;

    // Never notify for your own messages.
    if (data.senderUID === currentUser.uid) return false;

    // If the message specifies its recipient, make sure it is for this user.
    if (data.recipientUID && data.recipientUID !== currentUser.uid) {
        return false;
    }

    if (data.receiverUID && data.receiverUID !== currentUser.uid) {
        return false;
    }

    return true;
}

function handleNewMessage(data) {
    if (!isIncomingMessage(data)) return;

    unreadCount++;
    updateChatBadge();

    // The in-app popup and sound are for the open website.
    showPopup(getSenderName(), getMessageText(data));
    playSound();

    console.log("💌 New PD message", {
        unreadCount,
        senderUID: data.senderUID
    });
}


/* ================= FIRESTORE LISTENER ================= */

function startNotificationListener() {
    if (listenerStarted || !currentUser) return;

    listenerStarted = true;
    firstLoad = true;
    knownMessages = new Set();

    const messagesQuery = query(
        collection(db, "messages"),
        orderBy("createdAt", "asc")
    );

    unsubscribeMessages = onSnapshot(
        messagesQuery,
        snapshot => {
            if (firstLoad) {
                snapshot.forEach(message => {
                    knownMessages.add(message.id);
                });

                firstLoad = false;
                updateChatBadge();

                console.log("🔔 PD foreground notification listener ready.");
                return;
            }

            snapshot.docChanges().forEach(change => {
                if (change.type !== "added") return;

                const messageId = change.doc.id;

                if (knownMessages.has(messageId)) return;

                knownMessages.add(messageId);
                handleNewMessage(change.doc.data());
            });
        },
        error => {
            listenerStarted = false;
            unsubscribeMessages = null;

            console.error("❌ PD notification listener failed:", error);
        }
    );
}


/* ================= ENABLE BACKGROUND PUSH ================= */

export async function enablePDBackgroundNotifications() {
    if (!auth.currentUser) {
        throw new Error("Please sign in to PD first.");
    }

    if (
        !("Notification" in window) ||
        !("serviceWorker" in navigator) ||
        !(await isSupported())
    ) {
        throw new Error(
            "This browser does not support PD push notifications."
        );
    }

    if (PD_WORKER_URL.includes("YOUR-WORKER-NAME")) {
        throw new Error(
            "Set your real Cloudflare Worker URL in notification.js first."
        );
    }

    // Permission should be requested following a user action.
    let permission = Notification.permission;

    if (permission === "default") {
        permission = await Notification.requestPermission();
    }

    if (permission !== "granted") {
        throw new Error(
            "Notifications are blocked. Allow notifications for your PD website in browser settings."
        );
    }

    const registration = await navigator.serviceWorker.register(
        "./firebase-messaging-sw.js"
    );

    await navigator.serviceWorker.ready;

    if (!messagingInstance) {
        messagingInstance = getMessaging(app);
    }

    const token = await getToken(messagingInstance, {
        vapidKey: PD_VAPID_KEY,
        serviceWorkerRegistration: registration
    });

    if (!token) {
        throw new Error(
            "Firebase could not register this device for push notifications."
        );
    }

    const user = auth.currentUser;

    await setDoc(
        doc(
            db,
            "users",
            user.uid,
            "fcmTokens",
            encodeURIComponent(token)
        ),
        {
            token,
            platform: /Android/i.test(navigator.userAgent)
                ? "android-chrome"
                : /iPhone|iPad|iPod/i.test(navigator.userAgent)
                    ? "ios"
                    : "web",
            updatedAt: serverTimestamp()
        },
        { merge: true }
    );

    console.log("💜 PD background push registration successful.");

    return true;
}


/* ================= FOREGROUND FCM ================= */

async function initializeForegroundPush() {
    if (foregroundHandlerRegistered) return;

    if (!(await isSupported())) {
        console.warn(
            "Firebase Messaging is not supported in this browser."
        );
        return;
    }

    if (!messagingInstance) {
        messagingInstance = getMessaging(app);
    }

    onMessage(messagingInstance, payload => {
        console.log("💌 PD foreground push received:", payload);

        // Firestore handles the existing popup and sound.
        // Avoid duplicate popups for the same message.
    });

    foregroundHandlerRegistered = true;
}


/* ================= CLOUDFLARE PUSH SENDER ================= */

/*
Call this AFTER saving the message to Firestore.

Example in chat.js:

const saved = await addDoc(
    collection(db, "messages"),
    messageData
);

await sendPDMessagePush(saved.id);

The deployed Worker must:
1. Verify the Firebase ID token.
2. Verify the caller is authorized to use PD.
3. Read the saved message and find its recipient.
4. Send Firebase Cloud Messaging push notifications
   to that recipient's registered tokens.
*/

export async function sendPDMessagePush(messageId) {
    if (!auth.currentUser) {
        throw new Error("Please sign in before sending a notification.");
    }

    if (!messageId) {
        throw new Error("A saved Firestore message ID is required.");
    }

    if (PD_WORKER_URL.includes("YOUR-WORKER-NAME")) {
        throw new Error(
            "Add your deployed Cloudflare Worker URL to notification.js."
        );
    }

    const idToken = await auth.currentUser.getIdToken();

    const response = await fetch(PD_WORKER_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ messageId })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        console.error(
            "PD Cloudflare push failed:",
            response.status,
            result
        );

        throw new Error(
            result.error || "Cloudflare could not send the notification."
        );
    }

    console.log("💌 PD push request completed.", result);

    return result;
}


/* ================= AUTH INITIALIZATION ================= */

if (window.location.pathname.toLowerCase().includes("chat.html")) {
    clearUnreadMessages();
}

onAuthStateChanged(auth, async user => {
    currentUser = user;

    if (!user) {
        if (unsubscribeMessages) {
            unsubscribeMessages();
            unsubscribeMessages = null;
        }

        listenerStarted = false;
        firstLoad = true;
        knownMessages.clear();
        foregroundHandlerRegistered = false;

        return;
    }

    startNotificationListener();
    updateChatBadge();

    initializeForegroundPush().catch(error => {
        console.warn(
            "PD foreground push initialization failed:",
            error
        );
    });

    // Re-register automatically if this browser has already granted
    // notification permission. Do not request permission automatically.
    if (
        "Notification" in window &&
        Notification.permission === "granted" &&
        "serviceWorker" in navigator
    ) {
        enablePDBackgroundNotifications().catch(error => {
            console.warn(
                "PD background push registration failed:",
                error
            );
        });
    }
});


/* ================= ENABLE BUTTON ================= */

/*
Optional HTML:

<button id="enablePDNotifications" type="button">
    Enable PD Notifications 💜
</button>
*/

document.getElementById("enablePDNotifications")
    ?.addEventListener("click", async event => {
        const button = event.currentTarget;
        const originalText = button.textContent;

        button.disabled = true;

        try {
            await enablePDBackgroundNotifications();
            button.textContent = "Notifications enabled 💜";
        } catch (error) {
            console.error("PD notification setup failed:", error);

            alert(
                error.message ||
                "Could not enable notifications."
            );

            button.textContent = originalText;
        } finally {
            button.disabled = false;
        }
    });
