 
/* =========================================================
   PRINCESS WA DEIB — COMPLETE CHAT SYSTEM
   Text + Voice + Dates + Online + Last Seen
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
   PD PROFILES — YOUR EXISTING NAMES
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
   GLOBAL LISTENER REFERENCES
   ========================================================= */

let chatUnsubscribe = null;
let partnerPresenceUnsubscribe = null;
let connectedUnsubscribe = null;

let activePresenceUID = null;
let activePartnerUID = null; 

let latestMessageDocs = [];
let firstMessagesLoaded = false;

const receiptUpdatesInFlight = new Set();


/* =========================================================
   STYLES — ADDED WITHOUT EDITING YOUR CSS FILES
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
            transition: color .2s ease;
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

        .pd-message-footer .message-time {
            display: inline-block;
        }

        .pd-message-receipt {
            display: inline-block;
            color: #b9a8d9;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: -2px;
            white-space: nowrap;
        }

        .pd-message-receipt.receipt-read {
            color: #42c8ff;
        }

        .pd-message-receipt.receipt-delivered {
            color: #b9a8d9;
        }

        .pd-message-receipt.receipt-sent {
            color: #b9a8d9;
        }

        .pd-message-footer .message-time {
            color: inherit;
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

    // Save the profile without blocking chat startup.
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


/* =========================================================
   UPDATE PROFILE NAMES IN THE INTERFACE
   ========================================================= */

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
   Both users must have signed in at least once.
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
            console.warn(
                "PD: Partner profile not found. Ask the other account to sign in once."
            );
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
   PRESENCE UI
   ========================================================= */

function ensurePresenceElement() {
    let element = document.getElementById("pd-presence-status");

    if (element) return element;

    const nameElement = document.querySelector(
        "[data-chat-person-name]"
    );

    if (!nameElement) {
        console.warn(
            "PD: No [data-chat-person-name] element found for status."
        );
        return null;
    }

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

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
        return "Last seen unavailable";
    }

    const difference = Math.max(0, Date.now() - date.getTime());

    if (difference < 60_000) {
    const time = date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    });

    return `Last seen today at ${time}`;
}

    if (difference < 3_600_000) {
        const minutes = Math.floor(difference / 60_000);
        return `Last seen ${minutes} min ago`;
    }

    if (difference < 86_400_000) {
        return `Last seen today at ${date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        })}`;
    }

    return `Last seen ${date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
    })} at ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    })}`;
}


/* =========================================================
   WATCH PARTNER ONLINE / OFFLINE STATUS
   ========================================================= */

function watchPartnerPresence(uid) {
    if (activePartnerUID === uid && partnerPresenceUnsubscribe) {
        return;
    }

    if (partnerPresenceUnsubscribe) {
        partnerPresenceUnsubscribe();
        partnerPresenceUnsubscribe = null;
    }

    activePartnerUID = uid;

    const statusRef = databaseRef(
        presenceDB,
        `status/${uid}`
    );

    partnerPresenceUnsubscribe = onValue(
        statusRef,
        snapshot => {
            const status = snapshot.val();

            const connections = status?.connections || {};
            const online = Object.keys(connections).length > 0;

            if (online) {
                showPartnerStatus("● Online", true);
            } else {
                showPartnerStatus(
                    formatLastSeen(status?.lastChanged),
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


/* =========================================================
   TRACK OUR OWN CONNECTIONS
   Each tab has a separate connection record.
   ========================================================= */

function startOwnPresence(uid) {
    if (activePresenceUID === uid && connectedUnsubscribe) {
        return;
    }

    if (connectedUnsubscribe) {
        connectedUnsubscribe();
        connectedUnsubscribe = null;
    }

    activePresenceUID = uid;

    const connectedRef = databaseRef(
        presenceDB,
        ".info/connected"
    );

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

                // Register server-side cleanup before setting online.
                await onDisconnect(connectionRef).remove();

                await onDisconnect(lastChangedRef).set(
                    databaseServerTimestamp()
                );

                // Record this browser tab as connected.
                await set(connectionRef, true);

                await set(
                    lastChangedRef,
                    databaseServerTimestamp()
                );

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
    showPartnerStatus("Checking status…", false);

    startOwnPresence(currentProfile.uid);

    const partnerUID = await findPartnerUID();

    if (partnerUID) {
        watchPartnerPresence(partnerUID);
    } else {
        showPartnerStatus("Waiting for partner", false);
    }
}


/* =========================================================
   MESSAGE RECEIPTS
   Sent: ✓
   Delivered: ✓✓
   Read: blue ✓✓
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


/* =========================================================
   MARK INCOMING MESSAGES DELIVERED / READ
   ========================================================= */

async function updateIncomingReceipts(messageDocs) {
    if (!currentProfile) return;

    const partnerUID = await findPartnerUID();
    if (!partnerUID) return;

    const isVisible = document.visibilityState === "visible";

    for (const messageDoc of messageDocs) {
        const data = messageDoc.data();

        if (data.senderUID === currentProfile.uid) continue;
        if (data.recipientUID !== currentProfile.uid) continue;

        const currentStatus = data.status || "sent";

        if (currentStatus === "read") continue;

        // If the chat is visible, mark as read.
        // Otherwise, mark as delivered.
        const nextStatus = isVisible ? "read" : "delivered";

        if (currentStatus === "delivered" && nextStatus === "delivered") {
            continue;
        }

        if (receiptUpdatesInFlight.has(messageDoc.id)) continue;

        receiptUpdatesInFlight.add(messageDoc.id);

        try {
            const changes = {
                status: nextStatus
            };

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
            console.error(
                "PD: Receipt update failed for message",
                messageDoc.id,
                error
            );
        } finally {
            receiptUpdatesInFlight.delete(messageDoc.id);
        }
    }
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

        await addDoc(
            collection(db, "messages"),
            {
                type: "text",
                text,

                senderUID: currentProfile.uid,
                senderName: currentProfile.name,
                senderDisplayName: currentProfile.displayName,

                recipientUID: partnerUID,

                status: "sent",
                deliveredAt: null,
                readAt: null,

                createdAt: serverTimestamp()
            }
        );

        input.value = "";
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

function displayTextMessage(container, data, date) {
    const message = document.createElement("div");

    const mine = data.senderUID === currentProfile.uid;

    message.className = mine
        ? "message sent"
        : "message received";

    const text = document.createElement("div");
    text.className = "message-text";
    text.textContent = data.text || "";

    message.appendChild(text);
    message.appendChild(makeMessageFooter(data, date, mine));

    container.appendChild(message);
}


/* =========================================================
   DISPLAY VOICE MESSAGE
   ========================================================= */

function displayVoiceMessage(container, data, date) {
    if (!data.audioURL) return;

    const message = document.createElement("div");

    const mine = data.senderUID === currentProfile.uid;

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

    box.appendChild(icon);
    box.appendChild(audio);

    message.appendChild(box);
    message.appendChild(makeMessageFooter(data, date, mine));

    container.appendChild(message);
}


/* =========================================================
   CHAT LOADER
   ========================================================= */

function removeChatLoader() {
    const loader = document.getElementById("pd-chat-loader");
    if (!loader) return;

    loader.classList.add("pd-loaded");

    setTimeout(() => {
        loader.remove();
    }, 150);
}


/* =========================================================
   START CHAT — ONE FIRESTORE LISTENER ONLY
   ========================================================= */

function startChat() {
    const container = document.getElementById("chatMessages");

    if (!container) {
        console.error("PD: #chatMessages was not found in chat.html.");
        removeChatLoader();
        return;
    }

    // Prevent duplicate listeners if auth or initialization runs again.
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

            // Remove the loader on the first successful snapshot.
            if (!firstMessagesLoaded) {
                firstMessagesLoaded = true;
                removeChatLoader();
            }

            const previousScrollTop = container.scrollTop;
            const wasNearBottom =
                container.scrollHeight -
                container.scrollTop -
                container.clientHeight < 150;

            container.innerHTML = "";

            let previousDateKey = null;

            snapshot.forEach(messageDoc => {
                const data = messageDoc.data();

                let date = null;

                if (
                    data.createdAt &&
                    typeof data.createdAt.toDate === "function"
                ) {
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
                    displayVoiceMessage(container, data, date);
                } else {
                    displayTextMessage(container, data, date);
                }
            });

            requestAnimationFrame(() => {
                if (wasNearBottom || !firstMessagesLoaded) {
                    container.scrollTop = container.scrollHeight;
                } else {
                    container.scrollTop = Math.min(
                        previousScrollTop,
                        container.scrollHeight
                    );
                }
            });

            // Update receipts without creating another chat listener.
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

let mediaRecorder = null;
let audioChunks = [];
let recording = false;


async function startRecording() {
    if (recording) return;

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {
        alert("Voice recording requires HTTPS or localhost.");
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        recording = true;

        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            stream.getTracks().forEach(track => track.stop());

            const blob = new Blob(audioChunks, {
                type: mediaRecorder.mimeType || "audio/webm"
            });

            if (blob.size > 0) {
                await uploadVoice(blob);
            }
        };

        mediaRecorder.start();
        updateVoiceButton(true);

        console.log("PD: Voice recording started.");

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

        const fileName = `voice_${Date.now()}.webm`;

        const fileRef = storageRef(
            storage,
            `voice-messages/${currentProfile.uid}/${fileName}`
        );

        await uploadBytes(fileRef, audioBlob);

        const audioURL = await getDownloadURL(fileRef);

        await addDoc(
            collection(db, "messages"),
            {
                type: "voice",
                audioURL,

                senderUID: currentProfile.uid,
                senderName: currentProfile.name,
                senderDisplayName: currentProfile.displayName,

                recipientUID: partnerUID,

                status: "sent",
                deliveredAt: null,
                readAt: null,

                createdAt: serverTimestamp()
            }
        );

    } catch (error) {
        console.error("PD voice upload error:", error);
        alert("Voice note failed to send.");
    } finally {
        if (button) button.classList.remove("uploading");
    }
}


/* =========================================================
   VOICE BUTTON
   ========================================================= */

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


function updateVoiceButton(active) {
    const button = document.getElementById("voiceButton");
    if (!button) return;

    if (active) {
        button.classList.add("recording");
        button.innerHTML = '<i class="fa-solid fa-stop"></i>';
    } else {
        button.classList.remove("recording");
        button.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    }
}


/* =========================================================
   PAGE EVENTS
   ========================================================= */

function setupPageEvents() {
    const sendButton = document.querySelector(".send-message");

    if (sendButton && sendButton.dataset.pdBound !== "true") {
        sendButton.dataset.pdBound = "true";

        sendButton.addEventListener("click", sendMessage);
    }

    const input = document.getElementById("messageInput");

    if (input && input.dataset.pdBound !== "true") {
        input.dataset.pdBound = "true";

        input.addEventListener("keydown", event => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        });
    }

    setupVoiceButton();
}


/* =========================================================
   READ RECEIPTS WHEN THE USER RETURNS TO THE TAB
   Reuses the existing message listener and cached snapshot.
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

// ==========================================
// PD ONLINE / LAST SEEN PRESENCE
// ==========================================

let pdStopWatchingPartner = null;

function getPDStatusElement() {
    let element = document.getElementById("pd-presence-status");

    if (element) return element;

    const nameElement = document.querySelector("[data-chat-person-name]");

    if (!nameElement) {
        console.error("PD: Chat partner name element was not found.");
        return null;
    }

    element = document.createElement("div");
    element.id = "pd-presence-status";
    element.className = "pd-presence-status";
    element.textContent = "Connecting... 💜";

    nameElement.insertAdjacentElement("afterend", element);

    return element;
}

function formatPDLastSeen(timestamp) {
    if (timestamp === null || timestamp === undefined) {
        return "Offline";
    }

    const milliseconds = Number(timestamp);

    if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
        return "Offline";
    }

    const date = new Date(milliseconds);

    if (Number.isNaN(date.getTime())) {
        return "Offline";
    }

    const now = new Date();

    const time = date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    });

    if (date.toDateString() === now.toDateString()) {
        return `Last seen today at ${time}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === yesterday.toDateString()) {
        return `Last seen yesterday at ${time}`;
    }

    const day = date.toLocaleDateString([], {
        day: "numeric",
        month: "short"
    });

    return `Last seen ${day} at ${time}`;
}


function renderPDStatus(isOnline, lastChanged) {
    const element = getPDStatusElement();

    if (!element) return;

    element.classList.toggle("is-online", isOnline);
    element.classList.toggle("is-offline", !isOnline);

    if (isOnline) {
        element.textContent = "● Online 💜";
        element.title = "Connected to PD";
    } else {
        element.textContent = formatPDLastSeen(lastChanged);
        element.title = "Partner is currently offline";
    }
}

async function startPDPresence(user) {
    const statusElement = getPDStatusElement();

    if (statusElement) {
        statusElement.textContent = "Connecting to PD... 💜";
    }

    // Publish this account's own connection.
    const myConnections = rtdbRef(
        presenceDB,
        `status/${user.uid}/connections`
    );

    const myLastChanged = rtdbRef(
        presenceDB,
        `status/${user.uid}/lastChanged`
    );

    const connectedRef = rtdbRef(
        presenceDB,
        ".info/connected"
    );

    rtdbOnValue(connectedRef, async snapshot => {
        if (snapshot.val() !== true) return;

        try {
            const connection = rtdbPush(myConnections);

            // Register disconnect actions BEFORE publishing online.
            await rtdbOnDisconnect(connection).remove();

            await rtdbOnDisconnect(myLastChanged).set(
                rtdbServerTimestamp()
            );

            await rtdbSet(connection, true);

            console.log("PD presence: connection registered.");
        } catch (error) {
            console.error("PD presence registration failed:", error);
        }
    }, error => {
        console.error("PD connection listener failed:", error);
    });

    // Find the other account's Firebase UID.
    const email = (user.email || "").toLowerCase();

    let partnerEmail;

    if (email === "deib@gmail.com") {
        partnerEmail = "princess@gmail.com";
    } else if (email === "princess@gmail.com") {
        partnerEmail = "deib@gmail.com";
    } else {
        console.error("PD presence: account email is not configured:", email);
        if (statusElement) statusElement.textContent = "Status unavailable";
        return;
    }

    try {
        const usersQuery = query(
            collection(db, "users"),
            where("email", "==", partnerEmail),
            limit(1)
        );

        const usersSnapshot = await getDocs(usersQuery);

        if (usersSnapshot.empty) {
            console.warn(
                "PD presence: partner profile not found. Ask the partner to sign in once."
            );

            if (statusElement) {
                statusElement.textContent = "Waiting for partner 💜";
            }

            return;
        }

        const partnerUID = usersSnapshot.docs[0].id;

        if (partnerUID === user.uid) {
            console.error("PD presence: partner UID matches your own UID.");
            return;
        }

        const partnerConnections = rtdbRef(
            presenceDB,
            `status/${partnerUID}/connections`
        );

        const partnerLastChanged = rtdbRef(
            presenceDB,
            `status/${partnerUID}/lastChanged`
        );

        let connectionsValue = {};
        let lastChangedValue = null;

        const render = () => {
            const isOnline =
                connectionsValue &&
                Object.keys(connectionsValue).length > 0;

            renderPDStatus(isOnline, lastChangedValue);
        };

        const stopConnections = rtdbOnValue(
            partnerConnections,
            snapshot => {
                connectionsValue = snapshot.val() || {};
                render();
            },
            error => {
                console.error("PD partner presence read failed:", error);

                if (statusElement) {
                    statusElement.textContent = "Status unavailable";
                }
            }
        );

        const stopLastChanged = rtdbOnValue(
            partnerLastChanged,
            snapshot => {
                lastChangedValue = snapshot.val();
                render();
            },
            error => {
                console.error("PD last-seen read failed:", error);
            }
        );

        pdStopWatchingPartner = () => {
            stopConnections();
            stopLastChanged();
        };

        console.log("PD presence: watching partner", partnerUID);

    } catch (error) {
        console.error("PD could not initialize partner presence:", error);

        if (statusElement) {
            statusElement.textContent = "Status unavailable";
        }
    }
}
