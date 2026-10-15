
/* =========================================================
   PRINCESS WA DEIB 💜 — REALTIME CHAT
   Text • Replies • Voice Notes • Receipts • Presence
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


/* ================= CONFIG ================= */

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
let replyTarget = null;
let mediaRecorder = null;
let recordingChunks = [];
let recordingStartedAt = 0;
let isRecording = false;
let isSending = false;
let isUploadingVoice = false;
let watchedPartnerUid = null;

const receiptsInFlight = new Set();

const $ = (selector, parent = document) =>
    parent.querySelector(selector);


/* ================= DOM ================= */

function elements() {
    return {
        messages: $("#chatMessages"),
        form: $("#chatForm"),
        input: $("#messageInput"),
        send: $(".send-message"),
        voice: $("#voiceButton"),
        loader: $("#pd-chat-loader"),
        presence: $("#pd-presence-status")
    };
}

function hideLoader() {
    const loader = elements().loader;
    if (!loader) return;

    loader.style.display = "none";
    loader.style.opacity = "0";
    loader.style.pointerEvents = "none";
    loader.setAttribute("aria-hidden", "true");
}

function showLoader() {
    const loader = elements().loader;
    if (!loader) return;

    loader.style.display = "flex";
    loader.style.opacity = "1";
    loader.style.pointerEvents = "auto";
    loader.setAttribute("aria-hidden", "false");
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

        const messages = elements().messages;

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

    if (code.includes("permission-denied")) {
        return "Firebase access was denied. Check your Firestore or Storage security rules.";
    }

    if (code.includes("resource-exhausted")) {
        return "A Firebase quota or resource limit was reached. Please try again later.";
    }

    if (
        code.includes("unavailable") ||
        code.includes("deadline-exceeded") ||
        code.includes("network-request-failed")
    ) {
        return "Connection problem. Check your internet and try again.";
    }

    return error?.message || "Something went wrong. Please try again.";
}


/* ================= PROFILE ================= */

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


/* ================= DATES ================= */

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


/* ================= REPLIES ================= */

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

        const textBox = document.createElement("div");
        textBox.style.flex = "1";
        textBox.style.minWidth = "0";

        const name = document.createElement("strong");
        name.dataset.replyName = "true";
        name.style.display = "block";

        const text = document.createElement("div");
        text.dataset.replyText = "true";
        text.style.fontSize = "12px";
        text.style.overflowWrap = "anywhere";

        textBox.append(name, text);

        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.textContent = "×";
        cancel.setAttribute("aria-label", "Cancel reply");

        Object.assign(cancel.style, {
            fontSize: "22px",
            background: "transparent",
            color: "white",
            border: "0",
            cursor: "pointer"
        });

        cancel.addEventListener("click", clearReply);

        preview.append(textBox, cancel);

        const form = elements().form;
        form?.parentElement?.insertBefore(preview, form);
    }

    $("[data-reply-name]", preview).textContent =
        `Replying to ${replyTarget.senderName}`;

    $("[data-reply-text]", preview).textContent =
        replyTarget.text || "Message";

    elements().input?.focus();
}

function makeQuote(reply) {
    if (!reply) return null;

    const quote = document.createElement("div");
    quote.className = "message-reply-quote";

    const name = document.createElement("strong");
    name.textContent = reply.senderName || "Message";

    const text = document.createElement("span");
    text.textContent = reply.type === "voice"
        ? "🎤 Voice message"
        : String(reply.text || "Original message");

    quote.append(name, text);

    quote.addEventListener("click", () => {
        document.getElementById(`pd-message-${reply.messageId}`)
            ?.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
    });

    return quote;
}


/* ================= RECEIPTS ================= */

async function updateReceipts(messageId, data) {
    if (!currentUser || !messageId) return;
    if (data.senderUID === currentUser.uid) return;

    const readBy = Array.isArray(data.readBy) ? data.readBy : [];
    const deliveredTo = Array.isArray(data.deliveredTo)
        ? data.deliveredTo
        : [];

    const needsDelivery = !deliveredTo.includes(currentUser.uid);
    const needsRead =
        document.visibilityState === "visible" &&
        !readBy.includes(currentUser.uid);

    if (!needsDelivery && !needsRead) return;

    const key = `${messageId}:${currentUser.uid}`;

    if (receiptsInFlight.has(key)) return;
    receiptsInFlight.add(key);

    try {
        const changes = {};

        if (needsDelivery) {
            changes.deliveredTo = arrayUnion(currentUser.uid);
        }

        if (needsRead) {
            changes.readBy = arrayUnion(currentUser.uid);
        }

        await updateDoc(doc(db, CHAT_COLLECTION, messageId), changes);
    } catch (error) {
        console.warn("[PD Chat] Receipt update failed:", error?.code || error?.message);
    } finally {
        receiptsInFlight.delete(key);
    }
}

function makeFooter(data, mine) {
    const footer = document.createElement("div");
    footer.className = "message-footer";

    const time = document.createElement("span");
    time.textContent = formatTime(data.createdAt);
    footer.appendChild(time);

    if (mine) {
        const read = Array.isArray(data.readBy) ? data.readBy : [];
        const delivered = Array.isArray(data.deliveredTo)
            ? data.deliveredTo
            : [];

        const ticks = document.createElement("span");
        ticks.className = "message-ticks";

        if (read.length > 1) {
            ticks.textContent = "✓✓";
            ticks.classList.add("read");
            ticks.title = "Read";
        } else if (delivered.length > 1) {
            ticks.textContent = "✓✓";
            ticks.title = "Delivered";
        } else {
            ticks.textContent = "✓";
            ticks.title = "Sent";
        }

        footer.appendChild(ticks);
    }

    return footer;
}


/* ================= MESSAGE RENDERING ================= */

function renderMessage(id, data) {
    const mine = data.senderUID === currentUser.uid;

    const row = document.createElement("div");
    row.id = `pd-message-${id}`;
    row.dataset.messageId = id;
    row.className = mine
        ? "message-row sent"
        : "message-row received";

    const stack = document.createElement("div");
    stack.className = "message-stack";

    const bubble = document.createElement("div");
    bubble.className = mine
        ? "message-bubble sent"
        : "message-bubble received";

    if (data.replyTo) {
        bubble.appendChild(makeQuote(data.replyTo));
    }

    if (data.type === "voice" || data.type === "audio") {
        const voice = document.createElement("div");
        voice.className = "voice-message";

        const audio = document.createElement("audio");
        audio.controls = true;
        audio.preload = "metadata";
        audio.src = data.audioURL || data.url || "";
        audio.setAttribute("aria-label", "Voice message");
        audio.style.maxWidth = "100%";

        const label = document.createElement("div");
        label.className = "voice-duration";
        label.textContent = `🎤 Voice message · ${durationText(data.duration)}`;

        voice.append(audio, label);
        bubble.appendChild(voice);
    } else if (data.type === "image" || data.type === "video") {
        const attachment = document.createElement("div");
        attachment.className = "message-attachment";

        if (data.type === "image") {
            const image = document.createElement("img");
            image.src = data.url || "";
            image.alt = data.fileName || "Shared photo";
            image.loading = "lazy";

            image.addEventListener("click", () => {
                if (image.src) window.open(image.src, "_blank", "noopener");
            });

            attachment.appendChild(image);
        } else {
            const video = document.createElement("video");
            video.src = data.url || "";
            video.controls = true;
            video.preload = "metadata";
            video.playsInline = true;

            attachment.appendChild(video);
        }

        bubble.appendChild(attachment);
    } else {
        const text = document.createElement("div");
        text.className = "message-text";
        text.textContent = String(data.text || "");
        bubble.appendChild(text);
    }

    bubble.appendChild(makeFooter(data, mine));
    stack.appendChild(bubble);

    const replyButton = document.createElement("button");
    replyButton.type = "button";
    replyButton.className = "pd-reply-trigger";
    replyButton.textContent = "↩";
    replyButton.title = "Reply";
    replyButton.setAttribute("aria-label", "Reply to message");

    replyButton.addEventListener("click", () => beginReply(id, data));

    row.append(stack, replyButton);

    return row;
}

function renderMessages(snapshot) {
    const box = elements().messages;
    if (!box || !currentUser) return;

    const nearBottom =
        box.scrollHeight - box.scrollTop - box.clientHeight < 150;

    const fragment = document.createDocumentFragment();
    let previousDay = null;

    snapshot.forEach(item => {
        const data = item.data();
        const key = dayKey(data.createdAt);

        if (key !== previousDay) {
            const separator = document.createElement("div");
            separator.className = "chat-date-separator";
            separator.textContent = formatDay(data.createdAt);
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

    box.replaceChildren(fragment);

    if (nearBottom) {
        requestAnimationFrame(() => {
            box.scrollTop = box.scrollHeight;
        });
    }
}


/* ================= SEND TEXT ================= */

async function sendMessage(event) {
    event?.preventDefault();

    const { input, send } = elements();

    if (!input || !currentUser || !currentProfile || isSending) return;

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

        if (replyTarget) message.replyTo = { ...replyTarget };

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
        showError("Voice recording is not supported by this browser.");
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

            const voice = elements().voice;
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

        const voice = elements().voice;
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
    const voice = elements().voice;
    if (voice) voice.disabled = true;

    try {
        const filename = `voice-${Date.now()}.webm`;
        const fileRef = storageRef(
            storage,
            `chat-voice/${currentUser.uid}/${filename}`
        );

        await uploadBytes(fileRef, blob, {
            contentType: blob.type || "audio/webm"
        });

        const audioURL = await getDownloadURL(fileRef);

        const message = {
            type: "voice",
            audioURL,
            duration,
            senderUID: currentUser.uid,
            senderName: currentProfile.name,
            senderDisplayName: currentProfile.displayName,
            createdAt: serverTimestamp(),
            deliveredTo: [currentUser.uid],
            readBy: [currentUser.uid]
        };

        if (replyTarget) message.replyTo = { ...replyTarget };

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


/* ================= PRESENCE ================= */

function stopPresence() {
    stopConnection?.();
    stopPartnerPresence?.();

    stopConnection = null;
    stopPartnerPresence = null;
}

function startOwnPresence() {
    if (!currentUser || !presenceDB) return;

    const uid = currentUser.uid;
    const ownRef = dbRef(presenceDB, `status/${uid}`);
    const connectionRef = dbRef(presenceDB, ".info/connected");

    stopConnection = onValue(connectionRef, async snapshot => {
        if (snapshot.val() !== true || currentUser?.uid !== uid) return;

        try {
            await onDisconnect(ownRef).set({
                state: "offline",
                lastChanged: dbTimestamp()
            });

            if (currentUser?.uid !== uid) return;

            await set(ownRef, {
                state: "online",
                lastChanged: dbTimestamp()
            });
        } catch (error) {
            console.warn("[PD Presence]", error);
        }
    });
}

function watchPartnerPresence(uid) {
    const status = elements().presence;

    if (!status || !presenceDB || !uid || uid === currentUser?.uid) return;

    stopPartnerPresence?.();

    stopPartnerPresence = onValue(
        dbRef(presenceDB, `status/${uid}`),
        snapshot => {
            const online = snapshot.val()?.state === "online";
            status.textContent = online
                ? "Together in PD ❤️"
                : "Offline 💜";
        },
        () => {
            status.textContent = "Presence unavailable 💜";
        }
    );
}


/* ================= REALTIME CHAT ================= */

function startChat() {
    const box = elements().messages;

    if (!box) {
        hideLoader();
        showError("The chat page is missing #chatMessages in chat.html.");
        return;
    }

    if (!db || !currentUser) {
        hideLoader();
        showError("Firebase or authentication is unavailable.");
        return;
    }

    stopMessages?.();

    const messagesQuery = query(
        collection(db, CHAT_COLLECTION),
        orderBy("createdAt", "asc")
    );

    // Prevent a permanent loading screen if Firebase does not respond.
    const loadingTimeout = setTimeout(() => {
        if (elements().loader?.style.display !== "none") {
            hideLoader();
            showError("The chat is taking too long to load. Check your connection and refresh.");
        }
    }, 12000);

    stopMessages = onSnapshot(
        messagesQuery,
        snapshot => {
            clearTimeout(loadingTimeout);
            renderMessages(snapshot);
            hideLoader();
            clearError();

            const partnerMessage = snapshot.docs.find(item =>
                item.data().senderUID &&
                item.data().senderUID !== currentUser.uid
            );

            if (partnerMessage) {
                const uid = partnerMessage.data().senderUID;

                if (uid !== watchedPartnerUid) {
                    watchedPartnerUid = uid;
                    watchPartnerPresence(uid);
                }
            }
        },
        error => {
            clearTimeout(loadingTimeout);
            hideLoader();
            showError(explainError(error));
        }
    );
}


/* ================= EVENTS ================= */

function setupEvents() {
    const { form, input, voice } = elements();

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

        // ENTER SENDS. SHIFT+ENTER ALSO SENDS.
        input.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();

                if (!event.isComposing) {
                    form?.requestSubmit();
                }
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
            const box = elements().messages;

            box?.scrollTo({
                top: box.scrollHeight,
                behavior: "smooth"
            });
        });
    }
}


/* ================= CLEANUP & STARTUP ================= */

function cleanup() {
    stopMessages?.();
    stopMessages = null;

    stopPresence();
    watchedPartnerUid = null;

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
    }
}

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
                location.replace("login.html");
            }
            return;
        }

        setupProfile(user);

        if (elements().presence) {
            elements().presence.textContent = "Connecting to PD... 💜";
        }

        // Messages start independently of the presence connection.
        startChat();
        startOwnPresence();
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
