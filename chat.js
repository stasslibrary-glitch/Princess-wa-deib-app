
/* =========================================================
   PRINCESS WA DEIB — REALTIME CHAT
   Optimized Firebase version
   Text • Voice notes • Replies • Receipts • Presence
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
    ref as dbRef,
    onValue,
    onDisconnect,
    set,
    serverTimestamp as dbTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";


/* ================= CONFIGURATION ================= */

const CHAT_COLLECTION = "messages";

const PROFILES = {
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
let stopMessages = null;
let stopConnection = null;
let stopPartnerPresence = null;
let ownPresenceRef = null;
let replyTarget = null;
let mediaRecorder = null;
let recordingChunks = [];
let recordingStartedAt = 0;
let isRecording = false;
let isSending = false;
let isUploadingVoice = false;
let watchedPartnerUid = null;

/* Prevent simultaneous duplicate receipt writes. */
const receiptsInFlight = new Set();


/* ================= DOM HELPERS ================= */

const $ = (selector, parent = document) =>
    parent.querySelector(selector);

function chatElements() {
    return {
        messages: $("#chatMessages"),
        form: $("#chatForm"),
        input: $("#messageInput"),
        voice: $("#voiceButton"),
        send: $(".send-message"),
        presence: $("#pd-presence-status"),
        loader: $("#pd-chat-loader")
    };
}

function showError(message) {
    console.error("[PD Chat]", message);

    let notice = $("#pd-chat-error");

    if (!notice) {
        notice = document.createElement("div");
        notice.id = "pd-chat-error";
        notice.setAttribute("role", "alert");

        Object.assign(notice.style, {
            padding: "10px",
            margin: "8px",
            borderRadius: "10px",
            background: "rgba(255,60,100,.16)",
            color: "#ffdbe5",
            fontSize: "12px",
            overflowWrap: "anywhere"
        });

        const messages = chatElements().messages;

        if (messages?.parentElement) {
            messages.parentElement.insertBefore(notice, messages);
        } else {
            document.body.appendChild(notice);
        }
    }

    notice.textContent = message;
}

function clearError() {
    $("#pd-chat-error")?.remove();
}

function explainError(error) {
    console.error("[PD Chat] Firebase error:", error);

    const code = error?.code || "";

    if (code.includes("resource-exhausted")) {
        return "Firebase is rejecting requests because a quota or resource limit was exceeded. Your message may not have been sent.";
    }

    if (code.includes("permission-denied")) {
        return "Firebase denied access. Check Firestore security rules.";
    }

    if (
        code.includes("unavailable") ||
        code.includes("deadline-exceeded") ||
        code.includes("network-request-failed")
    ) {
        return "Firebase is unavailable. Check your connection and try again.";
    }

    if (code.includes("storage/unauthorized")) {
        return "Firebase Storage denied the voice note upload.";
    }

    return error?.message || "The operation failed. Please try again.";
}

function hideLoader() {
    const loader = chatElements().loader;
    if (!loader) return;

    loader.style.display = "none";
    loader.style.opacity = "0";
    loader.style.pointerEvents = "none";
    loader.setAttribute("aria-hidden", "true");
}

function showLoader() {
    const loader = chatElements().loader;
    if (!loader) return;

    loader.style.display = "flex";
    loader.style.opacity = "1";
    loader.style.pointerEvents = "auto";
    loader.setAttribute("aria-hidden", "false");
}


/* ================= USER PROFILE ================= */

function setupProfile(user) {
    const email = (user.email || "").toLowerCase();
    const profile = PROFILES[email] || {};

    currentProfile = {
        uid: user.uid,
        email,
        name: profile.name || user.displayName || DEFAULT_PROFILE.name,
        displayName:
            profile.displayName ||
            user.displayName ||
            DEFAULT_PROFILE.displayName
    };

    document.querySelectorAll("[data-user-name]").forEach(el => {
        el.textContent = currentProfile.name;
    });

    document.querySelectorAll("[data-chat-person-name]").forEach(el => {
        el.textContent = currentProfile.name;
    });

    document.querySelectorAll("[data-chat-display-name]").forEach(el => {
        el.textContent = currentProfile.displayName;
    });

    document.title = `${currentProfile.name} ❤️ | PD Chat`;
}


/* ================= DATE HELPERS ================= */

function toDate(timestamp) {
    if (!timestamp) return null;

    const date = typeof timestamp.toDate === "function"
        ? timestamp.toDate()
        : new Date(timestamp);

    return Number.isNaN(date.getTime()) ? null : date;
}

function dayKey(timestamp) {
    const date = toDate(timestamp) || new Date();

    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatTime(timestamp) {
    const date = toDate(timestamp);
    if (!date) return "Sending…";

    return date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
    });
}

function formatDay(timestamp) {
    const date = toDate(timestamp) || new Date();
    const today = new Date();
    const yesterday = new Date();

    yesterday.setDate(yesterday.getDate() - 1);

    if (dayKey(date) === dayKey(today)) return "Today";
    if (dayKey(date) === dayKey(yesterday)) return "Yesterday";

    return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: date.getFullYear() === today.getFullYear()
            ? undefined
            : "numeric"
    });
}

function durationText(seconds) {
    seconds = Math.max(0, Math.floor(Number(seconds) || 0));

    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}


/* ================= REPLY HANDLING ================= */

function clearReply() {
    replyTarget = null;
    $("#pd-reply-preview")?.remove();
}

function beginReply(id, data) {
    replyTarget = {
        messageId: id,
        senderUID: data.senderUID || "",
        senderName: data.senderName || "My Love",
        type: data.type || "text",
        text: data.type === "voice"
            ? "🎤 Voice message"
            : String(data.text || "")
    };

    let preview = $("#pd-reply-preview");

    if (!preview) {
        preview = document.createElement("div");
        preview.id = "pd-reply-preview";

        Object.assign(preview.style, {
            display: "flex",
            alignItems: "center",
            gap: "10px",
            margin: "6px 10px",
            padding: "10px",
            borderLeft: "3px solid #d9a2ff",
            borderRadius: "8px",
            background: "rgba(104,56,132,.25)",
            color: "white"
        });

        const text = document.createElement("div");
        text.style.flex = "1";
        text.style.minWidth = "0";

        const name = document.createElement("strong");
        name.textContent = `Replying to ${replyTarget.senderName}`;
        name.style.display = "block";

        const body = document.createElement("div");
        body.dataset.replyText = "true";
        body.style.fontSize = "12px";
        body.style.overflowWrap = "anywhere";

        text.append(name, body);

        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.textContent = "×";
        cancel.style.fontSize = "22px";
        cancel.style.background = "transparent";
        cancel.style.color = "white";
        cancel.style.border = "0";
        cancel.addEventListener("click", clearReply);

        preview.append(text, cancel);

        const form = chatElements().form;
        form?.parentElement?.insertBefore(preview, form);
    }

    const body = $("[data-reply-text]", preview);
    if (body) body.textContent = replyTarget.text || "Message";

    chatElements().input?.focus();
}

function makeQuote(reply) {
    if (!reply) return null;

    const quote = document.createElement("div");

    Object.assign(quote.style, {
        marginBottom: "7px",
        padding: "7px",
        borderLeft: "3px solid #e8a7ff",
        background: "rgba(0,0,0,.18)",
        borderRadius: "5px",
        fontSize: "11px"
    });

    const name = document.createElement("strong");
    name.textContent = reply.senderName || "Message";
    name.style.display = "block";

    const text = document.createElement("div");
    text.textContent = reply.type === "voice"
        ? "🎤 Voice message"
        : String(reply.text || "Original message");

    quote.append(name, text);

    quote.addEventListener("click", () => {
        const original = document.getElementById(
            `pd-message-${reply.messageId}`
        );

        original?.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    });

    return quote;
}


/* ================= OPTIMIZED RECEIPTS ================= */

/*
 * IMPORTANT:
 * Use the message data already received from onSnapshot.
 * Do not fetch the same document again with getDoc().
 *
 * Only update if the current UID is missing from the receipt.
 */

async function updateReceipts(messageId, data) {
    if (!currentUser || !messageId) return;
    if (data.senderUID === currentUser.uid) return;

    const readBy = Array.isArray(data.readBy) ? data.readBy : [];
    const deliveredTo = Array.isArray(data.deliveredTo)
        ? data.deliveredTo
        : [];

    const needsRead = !readBy.includes(currentUser.uid);
    const needsDelivery = !deliveredTo.includes(currentUser.uid);

    if (!needsRead && !needsDelivery) return;

    const key = `${messageId}:${currentUser.uid}`;

    if (receiptsInFlight.has(key)) return;
    receiptsInFlight.add(key);

    try {
        const changes = {};

        if (needsDelivery) {
            changes.deliveredTo = arrayUnion(currentUser.uid);
        }

        if (needsRead && document.visibilityState === "visible") {
            changes.readBy = arrayUnion(currentUser.uid);
        }

        if (Object.keys(changes).length) {
            await updateDoc(
                doc(db, CHAT_COLLECTION, messageId),
                changes
            );
        }
    } catch (error) {
        // Avoid flooding the console with repeated receipt errors.
        console.warn(
            "[PD Chat] Receipt update failed:",
            error?.code || error?.message
        );
    } finally {
        receiptsInFlight.delete(key);
    }
}

function makeFooter(data, mine) {
    const footer = document.createElement("div");

    Object.assign(footer.style, {
        display: "flex",
        justifyContent: "flex-end",
        gap: "5px",
        marginTop: "5px",
        fontSize: "10px",
        opacity: ".8"
    });

    const time = document.createElement("span");
    time.textContent = formatTime(data.createdAt);
    footer.appendChild(time);

    if (mine) {
        const read = Array.isArray(data.readBy) ? data.readBy : [];
        const delivered = Array.isArray(data.deliveredTo)
            ? data.deliveredTo
            : [];

        const receipt = document.createElement("span");

        // Both users' UIDs should be present for a delivered/read pair.
        if (read.length > 1) {
            receipt.textContent = "✓✓";
            receipt.style.color = "#8ee8ff";
            receipt.title = "Read";
        } else if (delivered.length > 1) {
            receipt.textContent = "✓✓";
            receipt.title = "Delivered";
        } else {
            receipt.textContent = "✓";
            receipt.title = "Sent";
        }

        footer.appendChild(receipt);
    }

    return footer;
}


/* ================= RENDER MESSAGES ================= */

function renderMessage(id, data) {
    const mine = data.senderUID === currentUser.uid;

    const row = document.createElement("div");
    row.id = `pd-message-${id}`;
    row.dataset.messageId = id;
    row.className = mine ? "message sent" : "message received";

    const bubble = document.createElement("div");
    bubble.className = "pd-message-bubble";

    Object.assign(bubble.style, {
        width: "fit-content",
        maxWidth: "min(78%, 340px)",
        minWidth: "0",
        padding: "10px 12px 7px",
        borderRadius: "15px",
        overflowWrap: "anywhere",
        wordBreak: "break-word",
        boxSizing: "border-box",
        color: "white",
        background: mine
            ? "linear-gradient(140deg,#9c48ed,#7134bc)"
            : "#30203f"
    });

    const quote = makeQuote(data.replyTo);
    if (quote) bubble.appendChild(quote);

    if (data.type === "voice" || data.type === "audio") {
        const player = document.createElement("div");

        const audio = document.createElement("audio");
        audio.controls = true;
        audio.preload = "metadata";
        audio.src = data.audioURL || data.url || "";
        audio.style.maxWidth = "100%";

        const duration = document.createElement("div");
        duration.textContent = `🎤 Voice message · ${durationText(data.duration)}`;
        duration.style.fontSize = "11px";

        player.append(duration, audio);
        bubble.appendChild(player);
    } else {
        const text = document.createElement("div");
        text.className = "pd-message-text";
        text.style.whiteSpace = "pre-wrap";
        text.style.lineHeight = "1.45";
        text.textContent = String(data.text || "");
        bubble.appendChild(text);
    }

    bubble.appendChild(makeFooter(data, mine));

    const reply = document.createElement("button");
    reply.type = "button";
    reply.className = "pd-reply-trigger";
    reply.title = "Reply";
    reply.setAttribute("aria-label", "Reply to message");
    reply.textContent = "↩";
    reply.style.margin = "0 5px";
    reply.style.cursor = "pointer";
    reply.addEventListener("click", () => beginReply(id, data));

    row.style.display = "flex";
    row.style.alignItems = "flex-end";
    row.style.justifyContent = mine ? "flex-end" : "flex-start";
    row.style.gap = "4px";
    row.style.width = "100%";
    row.style.boxSizing = "border-box";
    row.style.padding = "3px";

    if (mine) {
        row.append(reply, bubble);
    } else {
        row.append(bubble, reply);
    }

    return row;
}

function renderMessages(snapshot) {
    const messages = chatElements().messages;
    if (!messages || !currentUser) return;

    const nearBottom =
        messages.scrollHeight - messages.scrollTop -
        messages.clientHeight < 150;

    const fragment = document.createDocumentFragment();
    let previousDay = null;

    snapshot.forEach(item => {
        const data = item.data();
        const key = dayKey(data.createdAt);

        if (key !== previousDay) {
            const separator = document.createElement("div");
            separator.className = "pd-date-separator";
            separator.textContent = formatDay(data.createdAt);

            Object.assign(separator.style, {
                alignSelf: "center",
                margin: "12px auto",
                padding: "5px 12px",
                borderRadius: "18px",
                fontSize: "11px",
                color: "#ead6ff",
                background: "rgba(111,72,140,.25)"
            });

            fragment.appendChild(separator);
            previousDay = key;
        }

        fragment.appendChild(renderMessage(item.id, data));

        if (
            data.senderUID !== currentUser.uid &&
            document.visibilityState === "visible"
        ) {
            void updateReceipts(item.id, data);
        }
    });

    messages.replaceChildren(fragment);

    if (nearBottom) {
        requestAnimationFrame(() => {
            messages.scrollTop = messages.scrollHeight;
        });
    }
}


/* ================= SEND TEXT ================= */

async function sendMessage(event) {
    event?.preventDefault();

    const { input, send } = chatElements();

    if (!input || !currentUser || !currentProfile) return;
    if (isSending) return;

    const text = input.value.trim();
    if (!text) return;

    isSending = true;
    if (send) send.disabled = true;

    try {
        const message = {
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
            message.replyTo = { ...replyTarget };
        }

        await addDoc(collection(db, CHAT_COLLECTION), message);

        input.value = "";
        input.style.height = "auto";

        clearReply();
        clearError();
    } catch (error) {
        showError(explainError(error));
    } finally {
        isSending = false;
        if (send) send.disabled = false;
        input.focus();
    }
}


/* ================= VOICE NOTES ================= */

async function startRecording() {
    if (!storage) {
        showError("Firebase Storage is not configured.");
        return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        showError("Voice recording is not supported in this browser.");
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

        recordingChunks = [];

        const options = {};
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
            options.mimeType = "audio/webm;codecs=opus";
        }

        mediaRecorder = new MediaRecorder(stream, options);

        mediaRecorder.addEventListener("dataavailable", event => {
            if (event.data?.size) recordingChunks.push(event.data);
        });

        mediaRecorder.addEventListener("stop", async () => {
            stream.getTracks().forEach(track => track.stop());

            const duration = Math.round(
                (Date.now() - recordingStartedAt) / 1000
            );

            const blob = new Blob(recordingChunks, {
                type: mediaRecorder?.mimeType || "audio/webm"
            });

            recordingChunks = [];
            mediaRecorder = null;
            isRecording = false;

            const voice = chatElements().voice;
            if (voice) {
                voice.textContent = "🎤";
                voice.classList.remove("pd-recording-active");
            }

            if (!blob.size || duration < 1) {
                showError("The recording was too short.");
                return;
            }

            await uploadVoice(blob, duration);
        });

        recordingStartedAt = Date.now();
        isRecording = true;
        mediaRecorder.start();

        const voice = chatElements().voice;
        if (voice) {
            voice.textContent = "■";
            voice.classList.add("pd-recording-active");
        }
    } catch (error) {
        console.error("[PD Chat] Microphone:", error);
        showError("Allow microphone access, then try recording again.");
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
    }
}

async function uploadVoice(blob, duration) {
    if (!currentUser || !currentProfile || isUploadingVoice) return;

    isUploadingVoice = true;

    const voice = chatElements().voice;
    if (voice) voice.disabled = true;

    try {
        const filename =
            `voice-${Date.now()}-${currentUser.uid}.webm`;

        const file = storageRef(
            storage,
            `chat-voice/${currentUser.uid}/${filename}`
        );

        await uploadBytes(file, blob, {
            contentType: blob.type || "audio/webm"
        });

        const audioURL = await getDownloadURL(file);

        const message = {
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
            message.replyTo = { ...replyTarget };
        }

        await addDoc(collection(db, CHAT_COLLECTION), message);

        clearReply();
        clearError();
    } catch (error) {
        showError(explainError(error));
    } finally {
        isUploadingVoice = false;
        if (voice) voice.disabled = false;
    }
}


/* ================= ONLINE PRESENCE ================= */

function stopPresence() {
    if (stopConnection) {
        stopConnection();
        stopConnection = null;
    }

    if (stopPartnerPresence) {
        stopPartnerPresence();
        stopPartnerPresence = null;
    }
}

function startOwnPresence() {
    if (!currentUser || !presenceDB) return;

    const uid = currentUser.uid;
    ownPresenceRef = dbRef(presenceDB, `status/${uid}`);

    const connectionRef = dbRef(presenceDB, ".info/connected");

    stopConnection = onValue(connectionRef, async snapshot => {
        if (snapshot.val() !== true || currentUser?.uid !== uid) return;

        try {
            await onDisconnect(ownPresenceRef).set({
                state: "offline",
                lastChanged: dbTimestamp()
            });

            if (currentUser?.uid !== uid) return;

            await set(ownPresenceRef, {
                state: "online",
                lastChanged: dbTimestamp()
            });
        } catch (error) {
            console.warn("[PD Presence]", error);
        }
    });
}

function watchPartnerPresence(uid) {
    const element = chatElements().presence;
    if (!element || !presenceDB || !uid || uid === currentUser?.uid) return;

    if (stopPartnerPresence) stopPartnerPresence();

    stopPartnerPresence = onValue(
        dbRef(presenceDB, `status/${uid}`),
        snapshot => {
            const status = snapshot.val();
            const online = status?.state === "online";

            element.classList.toggle("is-online", online);
            element.classList.toggle("is-offline", !online);

            if (online) {
                element.textContent = "Together in PD ❤️";
            } else {
                element.textContent = "Offline 💜";
            }
        },
        error => {
            console.warn("[PD Presence]", error);
            element.textContent = "Presence unavailable 💜";
        }
    );
}


/* ================= REALTIME LISTENER ================= */

function startChat() {
    const messages = chatElements().messages;

    if (!messages) {
        hideLoader();
        showError("Missing #chatMessages in chat.html.");
        return;
    }

    if (!db || !currentUser) {
        hideLoader();
        showError("Firebase or user authentication is unavailable.");
        return;
    }

    if (stopMessages) stopMessages();

    const messagesQuery = query(
        collection(db, CHAT_COLLECTION),
        orderBy("createdAt", "asc")
    );

    stopMessages = onSnapshot(
        messagesQuery,
        snapshot => {
            renderMessages(snapshot);
            hideLoader();
            clearError();

            const partner = snapshot.docs.find(item =>
                item.data().senderUID &&
                item.data().senderUID !== currentUser.uid
            );

            if (partner) {
                const uid = partner.data().senderUID;

                if (uid !== watchedPartnerUid) {
                    watchedPartnerUid = uid;
                    watchPartnerPresence(uid);
                }
            }
        },
        error => {
            hideLoader();
            showError(explainError(error));
        }
    );
}


/* ================= PAGE EVENTS ================= */

function setupEvents() {
    const { form, input, voice } = chatElements();

    if (form && !form.dataset.pdBound) {
        form.dataset.pdBound = "true";
        form.addEventListener("submit", sendMessage);
    }

    if (input && !input.dataset.pdBound) {
        input.dataset.pdBound = "true";

        input.addEventListener("input", () => {
            input.style.height = "auto";
            input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
        });

        input.addEventListener("keydown", event => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                form?.requestSubmit();
            }
        });
    }

    if (voice && !voice.dataset.pdBound) {
        voice.dataset.pdBound = "true";
        voice.type = "button";

        voice.addEventListener("click", event => {
            event.preventDefault();

            if (isRecording) {
                stopRecording();
            } else {
                void startRecording();
            }
        });
    }

    const scrollButton = $("#scrollToBottomBtn");

    if (scrollButton && !scrollButton.dataset.pdBound) {
        scrollButton.dataset.pdBound = "true";

        scrollButton.addEventListener("click", () => {
            const box = chatElements().messages;

            box?.scrollTo({
                top: box.scrollHeight,
                behavior: "smooth"
            });
        });
    }
}


/* ================= CLEANUP ================= */

function cleanup() {
    if (stopMessages) {
        stopMessages();
        stopMessages = null;
    }

    stopPresence();
    watchedPartnerUid = null;
}


/* ================= STARTUP ================= */

function startPDChat() {
    setupEvents();
    showLoader();

    onAuthStateChanged(auth, user => {
        cleanup();

        currentUser = user;
        currentProfile = null;

        if (!user) {
            hideLoader();

            if (!location.pathname.endsWith("login.html")) {
                location.href = "login.html";
            }

            return;
        }

        setupProfile(user);

        const presence = chatElements().presence;
        if (presence) presence.textContent = "Connecting to PD... 💜";

        startOwnPresence();
        startChat();
    }, error => {
        hideLoader();
        showError(explainError(error));
    });
}

window.addEventListener("pagehide", cleanup);

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startPDChat, {
        once: true
    });
} else {
    startPDChat();
}
