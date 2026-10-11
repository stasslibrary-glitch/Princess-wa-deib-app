/* =========================================================
   PRINCESS WA DEIB — VOICE CALL
   WebRTC + Firebase Firestore signaling
   ========================================================= */

import {
    auth,
    db
} from "./firebase.js";

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
    onSnapshot,
    serverTimestamp,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


/* =========================================================
   SETTINGS
   ========================================================= */

const ICE_SERVERS = {

    iceServers: [

        {
            urls: [
                "stun:stun.l.google.com:19302",
                "stun:stun1.l.google.com:19302"
            ]
        }

    ]

};


/* =========================================================
   STATE
   ========================================================= */

let currentUser = null;

let currentCallId = null;

let peerConnection = null;

let localStream = null;

let remoteStream = null;

let callUnsubscribe = null;

let candidateUnsubscribe = null;

let incomingCandidateUnsubscribe = null;

let isCaller = false;

let isMuted = false;

let callTimerInterval = null;

let callSeconds = 0;


/* =========================================================
   ELEMENTS
   ========================================================= */

const overlay =
    document.getElementById("pdCallOverlay");

const callName =
    document.getElementById("pdCallName");

const callStatus =
    document.getElementById("pdCallStatus");

const callTimer =
    document.getElementById("pdCallTimer");

const remoteAudio =
    document.getElementById("pdRemoteAudio");

const voiceCallButton =
    document.getElementById("voiceCallButton");

const acceptButton =
    document.getElementById("pdAcceptIncoming");

const declineIncomingButton =
    document.getElementById("pdDeclineIncoming");

const endButton =
    document.getElementById("pdEndCall");

const muteButton =
    document.getElementById("pdMuteButton");


/* =========================================================
   OTHER USER
   ========================================================= */

let otherUser = null;


/*
   Your current two profiles.

   IMPORTANT:
   Replace the UID values below after we get
   them from Firebase Authentication.
*/

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
   FIND OTHER PERSON
   ========================================================= */

async function findOtherUser() {

    if (!currentUser) return null;

    const currentEmail =
        currentUser.email?.toLowerCase();

    const emails =
        Object.keys(PD_CALL_PROFILES);

    const otherEmail =
        emails.find(
            email => email !== currentEmail
        );

    if (!otherEmail) {
        console.error(
            "Could not determine other PD user."
        );

        return null;
    }

    /*
       We find the other user's Firebase Auth
       profile through Firestore users.
    */

    const usersSnapshot =
        await getDoc(
            doc(
                db,
                "users",
                otherEmail
            )
        ).catch(
            () => null
        );


    /*
       The above may not exist because your
       users collection uses UID as the document ID.

       So instead we listen to users collection
       and find the email.
    */

    return {
        email: otherEmail,
        profile: PD_CALL_PROFILES[otherEmail]
    };

}


/* =========================================================
   GET OTHER USER UID
   ========================================================= */

async function getOtherUserUID() {

    if (!currentUser) return null;

    const currentEmail =
        currentUser.email?.toLowerCase();

    const otherEmail =
        currentEmail === "deib@gmail.com"
            ? "princess@gmail.com"
            : "deib@gmail.com";


    /*
       Query users collection manually.
    */

    const usersRef =
        collection(db, "users");


    return new Promise(
        resolve => {

            let unsubscribe;

            unsubscribe =
                onSnapshot(
                    usersRef,

                    snapshot => {

                        let found = null;

                        snapshot.forEach(
                            userDoc => {

                                const data =
                                    userDoc.data();

                                if (
                                    data.email?.toLowerCase() ===
                                    otherEmail
                                ) {

                                    found = {
                                        uid:
                                            data.uid ||
                                            userDoc.id,

                                        email:
                                            data.email,

                                        displayName:
                                            data.displayName ||
                                            data.name ||
                                            "My Princess ❤️"
                                    };

                                }

                            }
                        );

                        unsubscribe();

                        resolve(found);

                    },

                    error => {

                        console.error(
                            "Could not find other user:",
                            error
                        );

                        unsubscribe();

                        resolve(null);

                    }
                );

        }
    );

}


/* =========================================================
   OPEN CALL SCREEN
   ========================================================= */

function showCallScreen(
    mode,
    name,
    status
) {

    if (!overlay) return;

    callName.textContent =
        name || "My Princess ❤️";

    callStatus.textContent =
        status || "";

    callTimer.textContent =
        "00:00";


    overlay.classList.remove(
        "incoming",
        "calling"
    );


    if (mode === "incoming") {

        overlay.classList.add(
            "active",
            "incoming"
        );

    }

    else {

        overlay.classList.add(
            "active",
            "calling"
        );

    }

}


/* =========================================================
   HIDE CALL SCREEN
   ========================================================= */

function hideCallScreen() {

    if (!overlay) return;

    overlay.classList.remove(
        "active",
        "incoming",
        "calling"
    );

}


/* =========================================================
   CREATE PEER CONNECTION
   ========================================================= */

function createPeerConnection() {

    peerConnection =
        new RTCPeerConnection(
            ICE_SERVERS
        );


    remoteStream =
        new MediaStream();


    remoteAudio.srcObject =
        remoteStream;


    /*
       Remote audio
    */

    peerConnection.ontrack =
        event => {

            event.streams[0]
                .getTracks()
                .forEach(
                    track => {

                        remoteStream.addTrack(
                            track
                        );

                    }
                );

            remoteAudio.play()
                .catch(
                    error => {

                        console.warn(
                            "Remote audio autoplay blocked:",
                            error
                        );

                    }
                );

        };


    /*
       ICE candidates
    */

    peerConnection.onicecandidate =
        async event => {

            if (
                !event.candidate ||
                !currentCallId
            ) {
                return;
            }


            const candidateRef =
                collection(
                    db,
                    "calls",
                    currentCallId,
                    isCaller
                        ? "callerCandidates"
                        : "calleeCandidates"
                );


            await addDoc(
                candidateRef,
                event.candidate.toJSON()
            );

        };


    peerConnection.onconnectionstatechange =
        () => {

            if (!peerConnection)
                return;


            console.log(
                "📞 WebRTC state:",
                peerConnection.connectionState
            );


            if (
                peerConnection.connectionState ===
                "connected"
            ) {

                startCallTimer();

                callStatus.textContent =
                    "Connected ❤️";

            }


            if (
                peerConnection.connectionState ===
                "failed"
            ) {

                callStatus.textContent =
                    "Connection failed";

            }


            if (
                peerConnection.connectionState ===
                "disconnected"
            ) {

                callStatus.textContent =
                    "Disconnected";

            }

        };


    return peerConnection;

}


/* =========================================================
   GET MICROPHONE
   ========================================================= */

async function getMicrophone() {

    try {

        localStream =
            await navigator
                .mediaDevices
                .getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    },
                    video: false
                });


        return localStream;

    }

    catch (error) {

        console.error(
            "Microphone permission error:",
            error
        );

        alert(
            "Please allow microphone access for your PD voice call ❤️"
        );

        return null;

    }

}


/* =========================================================
   START OUTGOING CALL
   ========================================================= */

async function startVoiceCall() {

    if (
        currentCallId ||
        !currentUser
    ) {
        return;
    }


    const other =
        await getOtherUserUID();


    if (!other) {

        alert(
            "The other PD account could not be found."
        );

        return;

    }


    otherUser = other;

    isCaller = true;


    const stream =
        await getMicrophone();


    if (!stream)
        return;


    createPeerConnection();


    stream.getTracks()
        .forEach(
            track => {

                peerConnection.addTrack(
                    track,
                    stream
                );

            }
        );


    /*
       Create call document
    */

    const callRef =
        doc(
            collection(
                db,
                "calls"
            )
        );


    currentCallId =
        callRef.id;


    /*
       Create offer
    */

    const offer =
        await peerConnection.createOffer();


    await peerConnection.setLocalDescription(
        offer
    );


    await setDoc(
        callRef,
        {

            callerUID:
                currentUser.uid,

            callerEmail:
                currentUser.email,

            calleeUID:
                other.uid,

            calleeEmail:
                other.email,

            offer: {
                type:
                    offer.type,

                sdp:
                    offer.sdp
            },

            status:
                "ringing",

            createdAt:
                serverTimestamp()

        }
    );


    showCallScreen(
        "calling",
        other.displayName,
        "Calling..."
    );


    /*
       Listen for answer
    */

    callUnsubscribe =
        onSnapshot(
            callRef,
            async snapshot => {

                const data =
                    snapshot.data();


                if (!data)
                    return;


                if (
                    data.answer &&
                    !peerConnection.currentRemoteDescription
                ) {

                    await peerConnection.setRemoteDescription(
                        new RTCSessionDescription(
                            data.answer
                        )
                    );

                    callStatus.textContent =
                        "Connecting...";

                }


                if (
                    data.status ===
                    "declined"
                ) {

                    callStatus.textContent =
                        "Call declined";

                    setTimeout(
                        endCall,
                        1200
                    );

                }


                if (
                    data.status ===
                    "ended"
                ) {

                    endCall();

                }

            }
        );


    /*
       Listen for callee ICE candidates
    */

    candidateUnsubscribe =
        onSnapshot(
            collection(
                db,
                "calls",
                currentCallId,
                "calleeCandidates"
            ),
            snapshot => {

                snapshot.docChanges()
                    .forEach(
                        async change => {

                            if (
                                change.type ===
                                "added"
                            ) {

                                try {

                                    await peerConnection.addIceCandidate(
                                        new RTCIceCandidate(
                                            change.doc.data()
                                        )
                                    );

                                }

                                catch (error) {

                                    console.error(
                                        "ICE error:",
                                        error
                                    );

                                }

                            }

                        }
                    );

            }
        );

}


/* =========================================================
   INCOMING CALL LISTENER
   ========================================================= */

function listenForIncomingCalls() {

    if (!currentUser)
        return;


    const callsRef =
        collection(
            db,
            "calls"
        );


    onSnapshot(
        callsRef,

        snapshot => {

            snapshot.docChanges()
                .forEach(
                    change => {

                        if (
                            change.type !==
                            "added"
                        ) {
                            return;
                        }


                        const data =
                            change.doc.data();


                        /*
                           Only calls directed
                           to this user.
                        */

                        if (
                            data.calleeUID !==
                            currentUser.uid
                        ) {
                            return;
                        }


                        if (
                            data.status !==
                            "ringing"
                        ) {
                            return;
                        }


                        /*
                           Don't interrupt an
                           active call.
                        */

                        if (
                            currentCallId
                        ) {
                            return;
                        }


                        receiveIncomingCall(
                            change.doc.id,
                            data
                        );

                    }
                );

        },

        error => {

            console.error(
                "Incoming call listener error:",
                error
            );

        }
    );

}


/* =========================================================
   RECEIVE CALL
   ========================================================= */

async function receiveIncomingCall(
    callId,
    data
) {

    currentCallId =
        callId;

    isCaller = false;


    otherUser = {

        uid:
            data.callerUID,

        email:
            data.callerEmail,

        displayName:
            data.callerEmail ===
            "deib@gmail.com"
                ? "Ernest ❤️"
                : "Jaris ❤️"

    };


    showCallScreen(
        "incoming",
        otherUser.displayName,
        "Incoming voice call..."
    );


    const callRef =
        doc(
            db,
            "calls",
            callId
        );


    /*
       Watch for caller ICE candidates
    */

    incomingCandidateUnsubscribe =
        onSnapshot(
            collection(
                db,
                "calls",
                callId,
                "callerCandidates"
            ),
            snapshot => {

                snapshot.docChanges()
                    .forEach(
                        async change => {

                            if (
                                change.type ===
                                "added" &&
                                peerConnection
                            ) {

                                try {

                                    await peerConnection.addIceCandidate(
                                        new RTCIceCandidate(
                                            change.doc.data()
                                        )
                                    );

                                }

                                catch (error) {

                                    console.error(
                                        "Incoming ICE error:",
                                        error
                                    );

                                }

                            }

                        }
                    );

            }
        );

}


/* =========================================================
   ACCEPT CALL
   ========================================================= */

async function acceptIncomingCall() {

    if (!currentCallId)
        return;


    const callRef =
        doc(
            db,
            "calls",
            currentCallId
        );


    const snapshot =
        await getDoc(
            callRef
        );


    const data =
        snapshot.data();


    if (!data || !data.offer) {

        console.error(
            "No call offer found."
        );

        return;

    }


    const stream =
        await getMicrophone();


    if (!stream) {

        await declineIncomingCall();

        return;

    }


    createPeerConnection();


    stream.getTracks()
        .forEach(
            track => {

                peerConnection.addTrack(
                    track,
                    stream
                );

            }
        );


    /*
       Set caller offer
    */

    await peerConnection.setRemoteDescription(
        new RTCSessionDescription(
            data.offer
        )
    );


    /*
       Create answer
    */

    const answer =
        await peerConnection.createAnswer();


    await peerConnection.setLocalDescription(
        answer
    );


    await updateDoc(
        callRef,
        {

            answer: {

                type:
                    answer.type,

                sdp:
                    answer.sdp

            },

            status:
                "accepted"

        }
    );


    showCallScreen(
        "active",
        otherUser.displayName,
        "Connecting..."
    );


    /*
       Watch call status
    */

    callUnsubscribe =
        onSnapshot(
            callRef,
            snapshot => {

                const data =
                    snapshot.data();


                if (
                    data?.status ===
                    "ended"
                ) {

                    endCall();

                }

            }
        );

}


/* =========================================================
   DECLINE
   ========================================================= */

async function declineIncomingCall() {

    if (!currentCallId)
        return;


    try {

        await updateDoc(
            doc(
                db,
                "calls",
                currentCallId
            ),
            {
                status:
                    "declined"
            }
        );

    }

    catch (error) {

        console.error(
            "Decline error:",
            error
        );

    }


    cleanupCall();

}


/* =========================================================
   MUTE
   ========================================================= */

function toggleMute() {

    if (!localStream)
        return;


    const audioTracks =
        localStream.getAudioTracks();


    if (!audioTracks.length)
        return;


    isMuted =
        !isMuted;


    audioTracks.forEach(
        track => {

            track.enabled =
                !isMuted;

        }
    );


    if (muteButton) {

        muteButton.classList.toggle(
            "muted",
            isMuted
        );


        muteButton.innerHTML =
            isMuted

                ? '<i class="fa-solid fa-microphone-slash"></i>'

                : '<i class="fa-solid fa-microphone"></i>';

    }

}


/* =========================================================
   CALL TIMER
   ========================================================= */

function startCallTimer() {

    if (callTimerInterval)
        return;


    callSeconds = 0;


    callTimerInterval =
        setInterval(
            () => {

                callSeconds++;


                const minutes =
                    Math.floor(
                        callSeconds / 60
                    )
                    .toString()
                    .padStart(2, "0");


                const seconds =
                    (
                        callSeconds % 60
                    )
                    .toString()
                    .padStart(2, "0");


                if (callTimer) {

                    callTimer.textContent =
                        `${minutes}:${seconds}`;

                }

            },
            1000
        );

}


/* =========================================================
   END CALL
   ========================================================= */

async function endCall() {

    const callId =
        currentCallId;


    /*
       Tell other person first
    */

    if (callId) {

        try {

            await updateDoc(
                doc(
                    db,
                    "calls",
                    callId
                ),
                {
                    status:
                        "ended",

                    endedAt:
                        serverTimestamp()
                }
            );

        }

        catch (error) {

            console.warn(
                "Could not update call:",
                error
            );

        }

    }


    cleanupCall();

}


/* =========================================================
   CLEANUP
   ========================================================= */

function cleanupCall() {

    if (callUnsubscribe) {

        callUnsubscribe();

        callUnsubscribe =
            null;

    }


    if (candidateUnsubscribe) {

        candidateUnsubscribe();

        candidateUnsubscribe =
            null;

    }


    if (incomingCandidateUnsubscribe) {

        incomingCandidateUnsubscribe();

        incomingCandidateUnsubscribe =
            null;

    }


    if (peerConnection) {

        peerConnection.close();

        peerConnection =
            null;

    }


    if (localStream) {

        localStream
            .getTracks()
            .forEach(
                track =>
                    track.stop()
            );

        localStream =
            null;

    }


    if (remoteAudio) {

        remoteAudio.pause();

        remoteAudio.srcObject =
            null;

    }


    if (callTimerInterval) {

        clearInterval(
            callTimerInterval
        );

        callTimerInterval =
            null;

    }


    currentCallId =
        null;

    otherUser =
        null;

    isCaller =
        false;

    isMuted =
        false;


    if (muteButton) {

        muteButton.classList.remove(
            "muted"
        );

        muteButton.innerHTML =
            '<i class="fa-solid fa-microphone"></i>';

    }


    hideCallScreen();

}


/* =========================================================
   BUTTON EVENTS
   ========================================================= */

if (voiceCallButton) {

    voiceCallButton.addEventListener(
        "click",
        startVoiceCall
    );

}


if (acceptButton) {

    acceptButton.addEventListener(
        "click",
        acceptIncomingCall
    );

}


if (declineIncomingButton) {

    declineIncomingButton.addEventListener(
        "click",
        declineIncomingCall
    );

}


if (endButton) {

    endButton.addEventListener(
        "click",
        endCall
    );

}


if (muteButton) {

    muteButton.addEventListener(
        "click",
        toggleMute
    );

}


/* =========================================================
   AUTH
   ========================================================= */

onAuthStateChanged(
    auth,
    user => {

        if (!user) {
            return;
        }


        currentUser =
            user;


        console.log(
            "📞 PD voice calling ready:",
            user.email
        );


        listenForIncomingCalls();

    }
);