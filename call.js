
/* =========================================================
   PRINCESS WA DEIB — VOICE CALL ENGINE
   WebRTC • Firebase Firestore signaling • Voice calls
   Incoming calls • Mute • Timer • Safe cleanup
   ========================================================= */

import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    collection,
    doc,
    addDoc,
    setDoc,
    updateDoc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    where,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

/* =========================================================
   CONFIGURATION
   ========================================================= */

// STUN helps devices discover a route between each other.
// Some networks also require a TURN server for reliable calls.
const RTC_CONFIG = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
    ]
};

const CALL_COLLECTION = "calls";
const USERS_COLLECTION = "users";

const PD_CALL_PROFILES = {
    "princess@gmail.com": {
        name: "Princess",
        displayName: "Jaris ❤️"
    },
    "deib@gmail.com": {
        name: "Deib",
        displayName: "Ernest ❤️"
    }
};

/* =========================================================
   STATE
   ========================================================= */

let currentUser = null;
let otherUser = null;
let currentCallId = null;

let peerConnection = null;
let localStream = null;
let remoteStream = null;

let incomingCallsUnsubscribe = null;
let callUnsubscribe = null;
let candidateUnsubscribe = null;

let isCaller = false;
let isMuted = false;
let isCleaningUp = false;
let remoteDescriptionReady = false;

let callTimerInterval = null;
let callSeconds = 0;

let pendingCandidates = [];
let processedCandidateIds = new Set();
let processedIncomingCallIds = new Set();

/* =========================================================
   HTML ELEMENTS — KEEP THESE IDS IN chat.html
   ========================================================= */

const $ = (selector) => document.querySelector(selector);

const overlay = $("#pdCallOverlay");
const callName = $("#pdCallName");
const callStatus = $("#pdCallStatus");
const callTimer = $("#pdCallTimer");
const remoteAudio = $("#pdRemoteAudio");

const voiceCallButton = $("#voiceCallButton");
const acceptButton = $("#pdAcceptIncoming");
const declineButton = $("#pdDeclineIncoming");
const endButton = $("#pdEndCall");
const muteButton = $("#pdMuteButton");

/* =========================================================
   SMALL HELPERS
   ========================================================= */

function setStatus(message) {
    if (callStatus) callStatus.textContent = message;
}

function getProfile(email) {
    const normalizedEmail = (email || "").toLowerCase();

    return PD_CALL_PROFILES[normalizedEmail] || {
        name: "My Love",
        displayName: "My Love ❤️"
    };
}

function getFriendlyError(error) {
    if (error?.name === "NotAllowedError" ||
        error?.name === "PermissionDeniedError") {
        return "Please allow microphone access in your browser settings.";
    }

    if (error?.name === "NotFoundError" ||
        error?.name === "DevicesNotFoundError") {
        return "No microphone was found on this device.";
    }

    if (error?.name === "NotReadableError") {
        return "Your microphone may be in use by another application.";
    }

    if (error?.name === "InvalidStateError") {
        return "The call is no longer active. Please try again.";
    }

    if (error?.code === "permission-denied") {
        return "Firebase denied access to the call. Check your Firestore rules.";
    }

    return error?.message || "Something went wrong with the call.";
}

function showCallScreen(mode, name, status) {
    if (!overlay) {
        console.error("Missing #pdCallOverlay in chat.html.");
        return;
    }

    if (callName) {
        callName.textContent = name || "My Love ❤️";
    }

    if (callTimer) {
        callTimer.textContent = "00:00";
    }

    setStatus(status || "");

    overlay.classList.remove("incoming", "calling", "active");
    overlay.classList.add("active");

    if (mode === "incoming") {
        overlay.classList.add("incoming");
    } else if (mode === "calling") {
        overlay.classList.add("calling");
    }
}

function hideCallScreen() {
    if (!overlay) return;

    overlay.classList.remove("active", "incoming", "calling");
}

function setCallButtonsEnabled(enabled) {
    if (voiceCallButton) {
        voiceCallButton.disabled = !enabled;
    }
}

function setIncomingButtonsVisible(visible) {
    const incoming = $("#pdIncomingControls");
    const active = $("#pdActiveControls");

    if (incoming) incoming.hidden = !visible;
    if (active) active.hidden = visible;
}

/* =========================================================
   FIND THE OTHER PD ACCOUNT
   ========================================================= */

async function getOtherUser() {
    if (!currentUser) return null;

    const myEmail = (currentUser.email || "").toLowerCase();

    const otherEmail = Object.keys(PD_CALL_PROFILES).find(
        email => email !== myEmail
    );

    if (!otherEmail) {
        throw new Error(
            "This account is not listed in PD_CALL_PROFILES. Check the two account emails."
        );
    }

    // First check whether the user's document ID is their email.
    try {
        const emailDoc = await getDoc(
            doc(db, USERS_COLLECTION, otherEmail)
        );

        if (emailDoc.exists()) {
            const data = emailDoc.data();

            return {
                uid: data.uid || emailDoc.id,
                email: (data.email || otherEmail).toLowerCase(),
                displayName:
                    data.displayName ||
                    getProfile(otherEmail).displayName
            };
        }
    } catch (error) {
        console.warn("Could not read email-based user document:", error);
    }

    // Otherwise find the user by their email field.
    const usersSnapshot = await getDocs(
        query(
            collection(db, USERS_COLLECTION),
            where("email", "==", otherEmail)
        )
    );

    if (usersSnapshot.empty) {
        throw new Error(
            `Could not find ${otherEmail} in Firestore's users collection.`
        );
    }

    const userDoc = usersSnapshot.docs[0];
    const data = userDoc.data();

    return {
        uid: data.uid || userDoc.id,
        email: (data.email || otherEmail).toLowerCase(),
        displayName:
            data.displayName ||
            getProfile(otherEmail).displayName
    };
}

/* =========================================================
   MICROPHONE
   ========================================================= */

async function getMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
            "Microphone calling requires HTTPS or localhost and a supported browser."
        );
    }

    return navigator.mediaDevices.getUserMedia({
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        },
        video: false
    });
}

/* =========================================================
   FIRESTORE ICE CANDIDATES
   ========================================================= */

async function saveIceCandidate(candidate) {
    if (!currentCallId || !candidate) return;

    const subcollection = isCaller
        ? "callerCandidates"
        : "calleeCandidates";

    try {
        await addDoc(
            collection(db, CALL_COLLECTION, currentCallId, subcollection),
            candidate.toJSON()
        );
    } catch (error) {
        console.error("Could not save ICE candidate:", error);
    }
}

async function addRemoteCandidate(candidateData) {
    if (!peerConnection || !candidateData) return;

    try {
        const candidate = new RTCIceCandidate(candidateData);

        if (!remoteDescriptionReady) {
            pendingCandidates.push(candidate);
            return;
        }

        await peerConnection.addIceCandidate(candidate);
    } catch (error) {
        console.error("Could not add remote ICE candidate:", error);
    }
}

async function flushPendingCandidates() {
    if (!peerConnection || !remoteDescriptionReady) return;

    const candidates = [...pendingCandidates];
    pendingCandidates = [];

    for (const candidate of candidates) {
        try {
            await peerConnection.addIceCandidate(candidate);
        } catch (error) {
            console.warn("Queued ICE candidate could not be added:", error);
        }
    }
}

function listenForRemoteCandidates() {
    if (!currentCallId) return;

    if (candidateUnsubscribe) {
        candidateUnsubscribe();
        candidateUnsubscribe = null;
    }

    const subcollection = isCaller
        ? "calleeCandidates"
        : "callerCandidates";

    candidateUnsubscribe = onSnapshot(
        collection(db, CALL_COLLECTION, currentCallId, subcollection),
        snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type !== "added") return;

                const candidateId = change.doc.id;
                if (processedCandidateIds.has(candidateId)) return;

                processedCandidateIds.add(candidateId);
                void addRemoteCandidate(change.doc.data());
            });
        },
        error => {
            console.error("ICE candidate listener failed:", error);
            setStatus("Network connection issue. Please try again.");
        }
    );
}

/* =========================================================
   WEBRTC CONNECTION
   ========================================================= */

function createPeerConnection() {
    if (peerConnection) return peerConnection;

    peerConnection = new RTCPeerConnection(RTC_CONFIG);
    remoteStream = new MediaStream();

    if (remoteAudio) {
        remoteAudio.srcObject = remoteStream;
        remoteAudio.autoplay = true;
        remoteAudio.playsInline = true;
    }

    peerConnection.ontrack = event => {
        const incomingStream = event.streams?.[0];

        if (incomingStream) {
            incomingStream.getTracks().forEach(track => {
                if (!remoteStream.getTracks().some(t => t.id === track.id)) {
                    remoteStream.addTrack(track);
                }
            });
        } else if (
            event.track &&
            !remoteStream.getTracks().some(t => t.id === event.track.id)
        ) {
            remoteStream.addTrack(event.track);
        }

        if (remoteAudio) {
            remoteAudio.srcObject = remoteStream;

            remoteAudio.play().catch(error => {
                console.warn("Tap the call screen to enable audio:", error);
                setStatus("Connected ❤️ Tap the screen if you cannot hear.");
            });
        }
    };

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            void saveIceCandidate(event.candidate);
        }
    };

    peerConnection.onconnectionstatechange = () => {
        if (!peerConnection) return;

        const state = peerConnection.connectionState;
        console.log("📞 PD WebRTC connection:", state);

        if (state === "connected") {
            setStatus("Connected ❤️");
            startCallTimer();
        } else if (state === "connecting") {
            setStatus("Connecting...");
        } else if (state === "disconnected") {
            setStatus("Connection interrupted…");
        } else if (state === "failed") {
            setStatus("Connection failed. Check your network.");
        } else if (state === "closed") {
            stopCallTimer();
        }
    };

    return peerConnection;
}

function addLocalTracks(stream) {
    const connection = createPeerConnection();

    stream.getTracks().forEach(track => {
        const alreadyAdded = connection
            .getSenders()
            .some(sender => sender.track?.id === track.id);

        if (!alreadyAdded) {
            connection.addTrack(track, stream);
        }
    });
}

/* =========================================================
   WATCH CALL DOCUMENT
   ========================================================= */

function listenToCall(callId, onCallUpdate) {
    if (callUnsubscribe) {
        callUnsubscribe();
        callUnsubscribe = null;
    }

    callUnsubscribe = onSnapshot(
        doc(db, CALL_COLLECTION, callId),
        snapshot => {
            if (!snapshot.exists()) {
                void finishCall(false);
                return;
            }

            void onCallUpdate(snapshot.data());
        },
        error => {
            console.error("Call listener failed:", error);
            setStatus("Lost connection to call signaling.");
        }
    );
}

/* =========================================================
   START OUTGOING CALL
   ========================================================= */

async function startVoiceCall() {
    if (!currentUser || currentCallId || isCleaningUp) return;

    setCallButtonsEnabled(false);

    try {
        otherUser = await getOtherUser();

        if (!otherUser?.uid || otherUser.uid === currentUser.uid) {
            throw new Error("The other PD account has an invalid user ID.");
        }

        isCaller = true;
        showCallScreen("calling", otherUser.displayName, "Preparing your call…");

        localStream = await getMicrophone();

        createPeerConnection();
        addLocalTracks(localStream);

        const callRef = doc(collection(db, CALL_COLLECTION));
        currentCallId = callRef.id;

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        await setDoc(callRef, {
            callerUID: currentUser.uid,
            callerEmail: (currentUser.email || "").toLowerCase(),
            callerDisplayName: getProfile(currentUser.email).displayName,

            calleeUID: otherUser.uid,
            calleeEmail: otherUser.email,
            calleeDisplayName: otherUser.displayName,

            offer: {
                type: offer.type,
                sdp: offer.sdp
            },

            status: "ringing",
            createdAt: serverTimestamp()
        });

        setStatus("Calling… 💜");

        // Start listening before the other device answers.
        listenForRemoteCandidates();

        listenToCall(currentCallId, async data => {
            if (!currentCallId || isCleaningUp) return;

            if (
                data.answer &&
                peerConnection &&
                !peerConnection.currentRemoteDescription
            ) {
                try {
                    await peerConnection.setRemoteDescription(
                        new RTCSessionDescription(data.answer)
                    );

                    remoteDescriptionReady = true;
                    await flushPendingCandidates();

                    setStatus("Connecting…");
                } catch (error) {
                    console.error("Could not apply call answer:", error);
                    setStatus("Could not connect the call.");
                }
            }

            if (data.status === "declined") {
                setStatus("Call declined 💜");
                setTimeout(() => {
                    if (currentCallId) void finishCall(false);
                }, 900);
            } else if (data.status === "ended") {
                void finishCall(false);
            }
        });

    } catch (error) {
        console.error("Could not start PD call:", error);
        alert(`Could not start the call: ${getFriendlyError(error)}`);

        if (currentCallId) {
            await finishCall(true);
        } else {
            cleanupCall();
        }
    } finally {
        setCallButtonsEnabled(true);
    }
}

/* =========================================================
   INCOMING CALLS
   ========================================================= */

function listenForIncomingCalls() {
    if (!currentUser || incomingCallsUnsubscribe) return;

    // Only listen to calls addressed to this account.
    // Filter status in JavaScript to avoid needing a composite index.
    const incomingQuery = query(
        collection(db, CALL_COLLECTION),
        where("calleeUID", "==", currentUser.uid)
    );

    incomingCallsUnsubscribe = onSnapshot(
        incomingQuery,
        snapshot => {
            snapshot.docChanges().forEach(change => {
                const data = change.doc.data();
                const callId = change.doc.id;

                if (data.status !== "ringing") return;
                if (data.callerUID === currentUser.uid) return;
                if (currentCallId || isCleaningUp) return;
                if (processedIncomingCallIds.has(callId)) return;

                processedIncomingCallIds.add(callId);
                receiveIncomingCall(callId, data);
            });
        },
        error => {
            console.error("Incoming call listener failed:", error);
        }
    );
}

function receiveIncomingCall(callId, data) {
    if (currentCallId || isCleaningUp) return;

    currentCallId = callId;
    isCaller = false;

    otherUser = {
        uid: data.callerUID,
        email: (data.callerEmail || "").toLowerCase(),
        displayName:
            data.callerDisplayName ||
            getProfile(data.callerEmail).displayName
    };

    showCallScreen(
        "incoming",
        otherUser.displayName,
        "Incoming voice call… 💜"
    );

    setIncomingButtonsVisible(true);

    // Listen immediately, but queue candidates until the offer is applied.
    listenForRemoteCandidates();

    // Watch for caller cancelling while the call is ringing.
    listenToCall(callId, async updatedData => {
        if (!currentCallId || isCleaningUp) return;

        if (updatedData.status === "ended" ||
            updatedData.status === "declined") {
            void finishCall(false);
        }
    });
}

/* =========================================================
   ACCEPT INCOMING CALL
   ========================================================= */

async function acceptIncomingCall() {
    if (!currentCallId || isCaller || isCleaningUp) return;

    if (acceptButton) acceptButton.disabled = true;

    try {
        const callRef = doc(db, CALL_COLLECTION, currentCallId);
        const snapshot = await getDoc(callRef);

        if (!snapshot.exists()) {
            throw new Error("This call no longer exists.");
        }

        const data = snapshot.data();

        if (data.status !== "ringing" || !data.offer) {
            throw new Error("This call is no longer available.");
        }

        localStream = await getMicrophone();

        createPeerConnection();
        addLocalTracks(localStream);

        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(data.offer)
        );

        remoteDescriptionReady = true;
        await flushPendingCandidates();

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        await updateDoc(callRef, {
            answer: {
                type: answer.type,
                sdp: answer.sdp
            },
            status: "accepted",
            acceptedAt: serverTimestamp()
        });

        showCallScreen("active", otherUser?.displayName, "Connecting…");
        setIncomingButtonsVisible(false);

    } catch (error) {
        console.error("Could not accept PD call:", error);
        alert(`Could not accept the call: ${getFriendlyError(error)}`);
        await finishCall(true);
    } finally {
        if (acceptButton) acceptButton.disabled = false;
    }
}

/* =========================================================
   DECLINE INCOMING CALL
   ========================================================= */

async function declineIncomingCall() {
    if (!currentCallId) return;

    const callId = currentCallId;

    try {
        await updateDoc(doc(db, CALL_COLLECTION, callId), {
            status: "declined",
            endedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Could not decline call:", error);
    }

    await finishCall(false);
}

/* =========================================================
   MUTE / UNMUTE
   ========================================================= */

function toggleMute() {
    if (!localStream) return;

    const tracks = localStream.getAudioTracks();
    if (!tracks.length) return;

    isMuted = !isMuted;

    tracks.forEach(track => {
        track.enabled = !isMuted;
    });

    if (muteButton) {
        muteButton.classList.toggle("muted", isMuted);
        muteButton.setAttribute(
            "aria-label",
            isMuted ? "Unmute microphone" : "Mute microphone"
        );

        muteButton.innerHTML = isMuted
            ? '<i class="fa-solid fa-microphone-slash"></i>'
            : '<i class="fa-solid fa-microphone"></i>';
    }
}

/* =========================================================
   CALL TIMER
   ========================================================= */

function startCallTimer() {
    if (callTimerInterval) return;

    callSeconds = 0;

    callTimerInterval = setInterval(() => {
        callSeconds += 1;

        const minutes = String(Math.floor(callSeconds / 60)).padStart(2, "0");
        const seconds = String(callSeconds % 60).padStart(2, "0");

        if (callTimer) {
            callTimer.textContent = `${minutes}:${seconds}`;
        }
    }, 1000);
}

function stopCallTimer() {
    if (callTimerInterval) {
        clearInterval(callTimerInterval);
        callTimerInterval = null;
    }
}

/* =========================================================
   END CALL
   ========================================================= */

async function endCall() {
    await finishCall(true);
}

async function finishCall(notifyOtherPerson) {
    if (isCleaningUp) return;

    isCleaningUp = true;

    const callId = currentCallId;

    // Clear the local call ID first so a remote update cannot
    // trigger a second competing cleanup.
    currentCallId = null;

    if (notifyOtherPerson && callId) {
        try {
            await updateDoc(doc(db, CALL_COLLECTION, callId), {
                status: "ended",
                endedAt: serverTimestamp()
            });
        } catch (error) {
            console.warn("Could not notify the other caller:", error);
        }
    }

    cleanupCall();
    isCleaningUp = false;
}

function cleanupCall() {
    if (callUnsubscribe) {
        callUnsubscribe();
        callUnsubscribe = null;
    }

    if (candidateUnsubscribe) {
        candidateUnsubscribe();
        candidateUnsubscribe = null;
    }

    if (peerConnection) {
        peerConnection.ontrack = null;
        peerConnection.onicecandidate = null;
        peerConnection.onconnectionstatechange = null;

        try {
            peerConnection.close();
        } catch (error) {
            console.warn("Peer connection cleanup:", error);
        }

        peerConnection = null;
    }

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        remoteStream = null;
    }

    if (remoteAudio) {
        remoteAudio.pause();
        remoteAudio.srcObject = null;
    }

    stopCallTimer();

    otherUser = null;
    isCaller = false;
    isMuted = false;
    remoteDescriptionReady = false;
    pendingCandidates = [];
    processedCandidateIds.clear();

    if (muteButton) {
        muteButton.classList.remove("muted");
        muteButton.innerHTML =
            '<i class="fa-solid fa-microphone"></i>';
        muteButton.setAttribute("aria-label", "Mute microphone");
    }

    if (acceptButton) acceptButton.disabled = false;

    setIncomingButtonsVisible(false);
    hideCallScreen();
    setCallButtonsEnabled(true);
}

/* =========================================================
   BUTTON EVENTS
   ========================================================= */

voiceCallButton?.addEventListener("click", startVoiceCall);
acceptButton?.addEventListener("click", acceptIncomingCall);
declineButton?.addEventListener("click", declineIncomingCall);
endButton?.addEventListener("click", endCall);
muteButton?.addEventListener("click", toggleMute);

/* =========================================================
   AUTHENTICATION
   ========================================================= */

onAuthStateChanged(auth, user => {
    currentUser = user;

    if (!user) {
        if (incomingCallsUnsubscribe) {
            incomingCallsUnsubscribe();
            incomingCallsUnsubscribe = null;
        }

        if (currentCallId) {
            void finishCall(false);
        } else {
            cleanupCall();
        }

        return;
    }

    console.log("📞 PD voice calling ready:", user.email);

    listenForIncomingCalls();
});
