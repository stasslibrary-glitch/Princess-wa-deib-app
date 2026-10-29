
/* ==========================================================
   PRINCESS WA DEIB — LIVE VOICE & VIDEO CALLS
   Firebase Firestore signaling + WebRTC
   Existing firebase.js must export: auth, db
   ========================================================== */

import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  addDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

/*
  Match these emails to the two existing PD Firebase accounts.
  The partner must have signed in at least once and have a
  users/{uid} document containing their email.
*/
const PD_PROFILES = {
  "princess@gmail.com": {
    name: "Baby",
    displayName: "Baby ❤️",
    partnerEmail: "deib@gmail.com"
  },
  "deib@gmail.com": {
    name: "Hubby",
    displayName: "Hubby 💜",
    partnerEmail: "princess@gmail.com"
  }
};

/*
  Public STUN servers can help establish direct connections.
  They are not a substitute for a TURN relay.
*/
const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ]
};

const CALL_TIMEOUT_MS = 45000;

let currentUser = null;
let currentCallId = null;
let currentCallRef = null;
let currentCallData = null;
let currentCallRole = null; // "caller" or "receiver"
let currentCallType = "voice";

let peerConnection = null;
let localStream = null;

let callUnsubscribe = null;
let candidateUnsubscribe = null;
let collectionUnsubscribers = [];

let incomingTimeout = null;
let outgoingTimeout = null;
let durationInterval = null;
let connectedAtMs = null;
let activeCandidatePath = null;
let endingCall = false;

let historyCalls = new Map();
let activeFilter = "all";
let toastTimer = null;
let partnerCache = null;

/* -------------------- BASIC HELPERS -------------------- */

function normalizedEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function getProfile(user = currentUser) {
  return PD_PROFILES[normalizedEmail(user?.email)] || {
    name: user?.displayName || "PD User",
    displayName: user?.displayName || "PD User",
    partnerEmail: null
  };
}

function getMyName() {
  return getProfile().displayName;
}

function getPartnerName() {
  const myEmail = normalizedEmail(currentUser?.email);

  if (myEmail === "princess@gmail.com") return "Hubby 💜";
  if (myEmail === "deib@gmail.com") return "Baby ❤️";

  return "Your person ❤️";
}

function showToast(message) {
  const toast = $("toast");
  if (!toast) {
    console.log("PD Calls:", message);
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3500);
}

function showCallStatus(message) {
  $("callStatusText").textContent = message;
}

function isTerminalStatus(status) {
  return [
    "completed",
    "missed",
    "declined",
    "cancelled",
    "failed"
  ].includes(String(status || "").toLowerCase());
}

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatCallDate(value) {
  const millis = timestampMillis(value);
  if (!millis) return "Time unavailable";

  const date = new Date(millis);
  const now = new Date();
  const yesterday = new Date(now);

  yesterday.setDate(now.getDate() - 1);

  const time = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });

  if (date.toDateString() === now.toDateString()) {
    return `Today · ${time}`;
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday · ${time}`;
  }

  return date.toLocaleDateString([], {
    day: "numeric",
    month: "short"
  }) + ` · ${time}`;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function clearCallTimers() {
  clearTimeout(incomingTimeout);
  clearTimeout(outgoingTimeout);
  clearInterval(durationInterval);

  incomingTimeout = null;
  outgoingTimeout = null;
  durationInterval = null;
}

function startDurationTimer() {
  if (durationInterval) return;

  if (!connectedAtMs) connectedAtMs = Date.now();

  const update = () => {
    const seconds = Math.floor((Date.now() - connectedAtMs) / 1000);
    $("callTimer").textContent = formatDuration(seconds);
  };

  update();
  durationInterval = setInterval(update, 1000);
}

function getCallRef(callId) {
  return doc(db, "calls", callId);
}

/* -------------------- PARTNER LOOKUP -------------------- */

async function findPartner() {
  if (partnerCache) return partnerCache;

  const profile = getProfile();

  if (!profile.partnerEmail) {
    throw new Error(
      "This PD account has no configured partner email in PD_PROFILES."
    );
  }

  const partnerQuery = query(
    collection(db, "users"),
    where("email", "==", profile.partnerEmail),
    limit(1)
  );

  const result = await getDocs(partnerQuery);

  if (result.empty) {
    throw new Error(
      "Your partner's Firebase profile was not found. Ask them to sign in to PD once, then try again."
    );
  }

  const partnerDoc = result.docs[0];

  if (partnerDoc.id === currentUser.uid) {
    throw new Error("The partner account resolves to your own account.");
  }

  partnerCache = {
    uid: partnerDoc.id,
    ...partnerDoc.data()
  };

  return partnerCache;
}

/* -------------------- CALL SCREEN -------------------- */

function showCallScreen({
  name,
  type,
  status,
  incoming = false
}) {
  $("callOverlay").hidden = false;
  $("callName").textContent = name || getPartnerName();

  $("callAvatar").innerHTML = type === "video"
    ? '<i class="fa-solid fa-video"></i>'
    : '<i class="fa-solid fa-heart"></i>';

  $("videoStage").hidden = type !== "video";
  $("incomingActions").hidden = !incoming;
  $("activeActions").hidden = incoming;

  $("muteBtn").disabled = true;
  $("cameraBtn").hidden = type !== "video";

  $("callTimer").textContent = "00:00";
  showCallStatus(status);
}

function setCallButtonsBusy(busy) {
  $("acceptCallBtn").disabled = busy;
  $("declineCallBtn").disabled = busy;
  $("voiceCallBtn").disabled = busy;
  $("videoCallBtn").disabled = busy;
}

function hideCallScreen() {
  $("callOverlay").hidden = true;
  $("incomingActions").hidden = true;
  $("activeActions").hidden = true;
  $("videoStage").hidden = true;
  $("callTimer").textContent = "00:00";
  $("muteBtn").innerHTML =
    '<i class="fa-solid fa-microphone"></i><span>Mute</span>';
  $("cameraBtn").innerHTML =
    '<i class="fa-solid fa-video"></i><span>Camera off</span>';
  setCallButtonsBusy(false);
}

/* -------------------- WEBRTC -------------------- */

function makePeerConnection(callId, role) {
  peerConnection = new RTCPeerConnection(RTC_CONFIG);

  const candidateCollection = role === "caller"
    ? "offerCandidates"
    : "answerCandidates";

  activeCandidatePath = candidateCollection;

  peerConnection.onicecandidate = async (event) => {
    if (!event.candidate || currentCallId !== callId) return;

    try {
      await addDoc(
        collection(db, "calls", callId, candidateCollection),
        event.candidate.toJSON()
      );
    } catch (error) {
      console.error("PD ICE candidate write failed:", error);
      showCallStatus("Network setup issue. Trying to connect…");
    }
  };

  peerConnection.ontrack = async (event) => {
    const stream = event.streams?.[0];
    if (!stream) return;

    if (currentCallType === "video") {
      $("remoteVideo").srcObject = stream;
      $("videoStage").hidden = false;

      $("remoteVideo").play().catch(() => {
        showCallStatus("Tap the screen if your browser asks to start media.");
      });
    } else {
      // An audio element keeps voice calls audible without showing a video.
      $("remoteAudio").srcObject = stream;
      $("remoteAudio").play().catch(() => {
        showCallStatus("Tap the page to allow call audio playback.");
      });
    }
  };

  peerConnection.onconnectionstatechange = async () => {
    if (!peerConnection || currentCallId !== callId) return;

    const state = peerConnection.connectionState;
    console.log("PD WebRTC connection:", state);

    if (state === "connected") {
      if (!connectedAtMs) {
        connectedAtMs = Date.now();
        startDurationTimer();
      }

      showCallStatus("Connected ❤️ You're together now.");

      try {
        await updateDoc(getCallRef(callId), {
          status: "active",
          connectedAt: serverTimestamp()
        });
      } catch (error) {
        console.warn("Could not update active call status:", error);
      }
    }

    if (state === "failed") {
      showCallStatus("Connection failed. A TURN relay may be needed.");
      showToast("Call connection failed. Check your network or TURN setup.");
      await finishCall("failed");
    }

    if (state === "disconnected") {
      showCallStatus("Connection interrupted. Trying to reconnect…");
    }
  };

  peerConnection.oniceconnectionstatechange = () => {
    console.log("PD ICE connection:", peerConnection?.iceConnectionState);
  };

  return peerConnection;
}

async function addLocalTracks(pc, stream) {
  for (const track of stream.getTracks()) {
    pc.addTrack(track, stream);
  }

  if (currentCallType === "video") {
    $("localVideo").srcObject = stream;
    $("videoStage").hidden = false;
    $("localVideo").play().catch(() => {});
  }
}

async function listenForRemoteCandidates(callId, collectionName) {
  if (candidateUnsubscribe) {
    candidateUnsubscribe();
    candidateUnsubscribe = null;
  }

  const candidatesRef = collection(db, "calls", callId, collectionName);

  candidateUnsubscribe = onSnapshot(
    candidatesRef,
    async (snapshot) => {
      if (!peerConnection || currentCallId !== callId) return;

      for (const change of snapshot.docChanges()) {
        if (change.type !== "added") continue;

        try {
          await peerConnection.addIceCandidate(
            new RTCIceCandidate(change.doc.data())
          );
        } catch (error) {
          console.error("PD could not add remote ICE candidate:", error);
        }
      }
    },
    (error) => {
      console.error("PD candidate listener error:", error);
      showCallStatus("Network setup failed. Check Firestore rules.");
    }
  );
}

/* -------------------- CALL DOCUMENT WATCHER -------------------- */

function watchCurrentCall(callId, role) {
  if (callUnsubscribe) {
    callUnsubscribe();
    callUnsubscribe = null;
  }

  callUnsubscribe = onSnapshot(
    getCallRef(callId),
    async (snapshot) => {
      if (!snapshot.exists() || currentCallId !== callId) return;

      const data = snapshot.data();
      currentCallData = data;

      if (isTerminalStatus(data.status)) {
        const status = data.status;

        if (!endingCall) {
          if (status === "missed") showToast("Missed call ❤️");
          if (status === "declined") showToast("The call was declined.");
          if (status === "cancelled") showToast("The call ended.");
          if (status === "failed") showToast("The call could not connect.");
          if (status === "completed") showToast("Call ended ❤️");
        }

        await cleanupCall();
        return;
      }

      if (
        role === "caller" &&
        data.answer &&
        peerConnection &&
        !peerConnection.currentRemoteDescription
      ) {
        try {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );

          await listenForRemoteCandidates(callId, "answerCandidates");
          showCallStatus("Connecting to your person…");
        } catch (error) {
          console.error("PD setting remote answer failed:", error);
          showToast("Could not connect the call. Check the browser console.");
          await finishCall("failed");
        }
      }

      if (data.status === "active") {
        showCallStatus("Connected ❤️");
      }
    },
    (error) => {
      console.error("PD call document listener failed:", error);
      showToast("Call signaling failed. Check Firestore security rules.");
    }
  );
}

/* -------------------- START OUTGOING CALL -------------------- */

async function startCall(type) {
  if (!currentUser) {
    showToast("Please sign in to PD first.");
    return;
  }

  if (currentCallId) {
    showToast("You already have a call in progress.");
    return;
  }

  currentCallType = type;
  setCallButtonsBusy(true);

  try {
    const partner = await findPartner();

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone/camera access requires HTTPS or localhost.");
    }

    showCallScreen({
      name: partner.displayName || partner.name || getPartnerName(),
      type,
      status: "Requesting microphone permission…"
    });

    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === "video"
        ? { facingMode: "user" }
        : false
    });

    const callRef = doc(collection(db, "calls"));
    currentCallRef = callRef;
    currentCallId = callRef.id;
    currentCallRole = "caller";
    connectedAtMs = null;
    endingCall = false;

    const initialData = {
      callerUID: currentUser.uid,
      receiverUID: partner.uid,
      callerEmail: currentUser.email || "",
      receiverEmail: partner.email || "",
      callerName: getMyName(),
      receiverName: partner.displayName || partner.name || getPartnerName(),
      type,
      status: "ringing",
      createdAt: serverTimestamp(),
      connectedAt: null,
      endedAt: null,
      durationSeconds: 0
    };

    await setDoc(callRef, initialData);
    currentCallData = initialData;

    const pc = makePeerConnection(callRef.id, "caller");
    await addLocalTracks(pc, localStream);

    showCallScreen({
      name: initialData.receiverName,
      type,
      status: "Calling…"
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await updateDoc(callRef, {
      offer: {
        type: offer.type,
        sdp: offer.sdp
      }
    });

    watchCurrentCall(callRef.id, "caller");

    outgoingTimeout = setTimeout(async () => {
      if (
        currentCallId === callRef.id &&
        !connectedAtMs &&
        currentCallData?.status === "ringing"
      ) {
        await finishCall("missed");
      }
    }, CALL_TIMEOUT_MS);

  } catch (error) {
    console.error("PD outgoing call error:", error);

    showToast(error.message || "Could not start the call.");

    await cleanupCall();
  } finally {
    setCallButtonsBusy(false);
  }
}

/* -------------------- INCOMING CALLS -------------------- */

function showIncomingCall(callId, data) {
  if (currentCallId || !data.offer) return;
  if (data.callerUID === currentUser?.uid) return;

  currentCallId = callId;
  currentCallRef = getCallRef(callId);
  currentCallData = data;
  currentCallRole = "receiver";
  currentCallType = data.type === "video" ? "video" : "voice";
  connectedAtMs = null;
  endingCall = false;

  showCallScreen({
    name: data.callerName || getPartnerName(),
    type: currentCallType,
    status: currentCallType === "video"
      ? "Incoming video call…"
      : "Incoming voice call…",
    incoming: true
  });

  watchCurrentCall(callId, "receiver");

  incomingTimeout = setTimeout(async () => {
    if (
      currentCallId === callId &&
      !connectedAtMs &&
      currentCallData?.status === "ringing"
    ) {
      await finishCall("missed");
    }
  }, CALL_TIMEOUT_MS);
}

async function acceptIncomingCall() {
  if (!currentCallId || currentCallRole !== "receiver") return;

  const callId = currentCallId;
  setCallButtonsBusy(true);

  try {
    const snapshot = await getDoc(getCallRef(callId));

    if (!snapshot.exists()) {
      throw new Error("This call no longer exists.");
    }

    const data = snapshot.data();
    currentCallData = data;

    if (data.status !== "ringing" || !data.offer) {
      throw new Error("This call has already ended or is still preparing.");
    }

    currentCallType = data.type === "video" ? "video" : "voice";

    showCallScreen({
      name: data.callerName || getPartnerName(),
      type: currentCallType,
      status: "Preparing your microphone…"
    });

    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: currentCallType === "video"
        ? { facingMode: "user" }
        : false
    });

    const pc = makePeerConnection(callId, "receiver");
    await addLocalTracks(pc, localStream);

    await pc.setRemoteDescription(
      new RTCSessionDescription(data.offer)
    );

    await listenForRemoteCandidates(callId, "offerCandidates");

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await updateDoc(getCallRef(callId), {
      answer: {
        type: answer.type,
        sdp: answer.sdp
      },
      status: "accepted",
      acceptedAt: serverTimestamp()
    });

    clearTimeout(incomingTimeout);
    incomingTimeout = null;

    $("incomingActions").hidden = true;
    $("activeActions").hidden = false;
    $("muteBtn").disabled = false;

    showCallStatus("Connecting…");

  } catch (error) {
    console.error("PD accepting call failed:", error);

    showToast(error.message || "Could not accept the call.");

    // Don't silently leave a ringing call if permissions or setup fail.
    await finishCall("failed");
  } finally {
    setCallButtonsBusy(false);
  }
}

/* -------------------- END / DECLINE / MISSED -------------------- */

async function declineIncomingCall() {
  if (!currentCallId) return;
  await finishCall("declined");
}

async function finishCall(forcedStatus = null) {
  if (!currentCallId || endingCall) return;

  endingCall = true;

  const callId = currentCallId;
  const role = currentCallRole;
  const data = currentCallData || {};
  const connected = Boolean(connectedAtMs);

  let status = forcedStatus;

  if (!status) {
    if (connected) {
      status = "completed";
    } else if (role === "caller") {
      status = "cancelled";
    } else {
      status = "declined";
    }
  }

  const durationSeconds = connected
    ? Math.max(0, Math.floor((Date.now() - connectedAtMs) / 1000))
    : 0;

  try {
    await updateDoc(getCallRef(callId), {
      status,
      endedAt: serverTimestamp(),
      durationSeconds,
      ...(status === "missed" ? { missedAt: serverTimestamp() } : {}),
      ...(status === "declined" ? { declinedAt: serverTimestamp() } : {}),
      ...(status === "cancelled" ? { cancelledAt: serverTimestamp() } : {})
    });
  } catch (error) {
    console.error("PD ending call record failed:", error);
    showToast("Could not update the call record. Check Firestore rules.");
  }

  await cleanupCall();

  if (status === "completed") showToast("Call ended ❤️");
  if (status === "declined") showToast("Call declined.");
  if (status === "missed") showToast("Call marked as missed.");
  if (status === "failed") showToast("Call failed.");
}

async function cleanupCall() {
  clearCallTimers();

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
      console.warn("PD peer connection close:", error);
    }

    peerConnection = null;
  }

  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }

  $("remoteVideo").srcObject = null;
  $("localVideo").srcObject = null;
  $("remoteAudio").srcObject = null;

  currentCallId = null;
  currentCallRef = null;
  currentCallData = null;
  currentCallRole = null;
  currentCallType = "voice";
  connectedAtMs = null;
  activeCandidatePath = null;
  endingCall = false;

  hideCallScreen();
}

/* -------------------- MUTE / CAMERA -------------------- */

function toggleMute() {
  if (!localStream) return;

  const tracks = localStream.getAudioTracks();
  if (!tracks.length) return;

  const currentlyEnabled = tracks.some((track) => track.enabled);
  tracks.forEach((track) => {
    track.enabled = !currentlyEnabled;
  });

  $("muteBtn").innerHTML = currentlyEnabled
    ? '<i class="fa-solid fa-microphone-slash"></i><span>Unmute</span>'
    : '<i class="fa-solid fa-microphone"></i><span>Mute</span>';
}

function toggleCamera() {
  if (!localStream) return;

  const tracks = localStream.getVideoTracks();
  if (!tracks.length) {
    showToast("This call has no camera track.");
    return;
  }

  const currentlyEnabled = tracks.some((track) => track.enabled);
  tracks.forEach((track) => {
    track.enabled = !currentlyEnabled;
  });

  $("cameraBtn").innerHTML = currentlyEnabled
    ? '<i class="fa-solid fa-video-slash"></i><span>Camera on</span>'
    : '<i class="fa-solid fa-video"></i><span>Camera off</span>';
}

/* -------------------- CALL HISTORY -------------------- */

function callDirection(call) {
  const status = String(call.status || "").toLowerCase();

  if (call.callerUID === currentUser?.uid) {
    return "outgoing";
  }

  if (["missed", "declined"].includes(status)) {
    return "missed";
  }

  return "incoming";
}

function callDirectionLabel(call) {
  const status = String(call.status || "").toLowerCase();
  const direction = callDirection(call);

  if (status === "missed") {
    return direction === "outgoing" ? "No answer" : "Missed call";
  }

  if (status === "declined") {
    return direction === "outgoing" ? "Call declined" : "You declined";
  }

  if (status === "cancelled") return "Cancelled";
  if (status === "failed") return "Failed";
  if (status === "completed") {
    return direction === "outgoing" ? "Outgoing call" : "Incoming call";
  }

  if (status === "ringing" || status === "accepted" || status === "active") {
    return direction === "outgoing" ? "Outgoing call" : "Incoming call";
  }

  return "Call";
}

function renderHistory() {
  const list = $("callList");
  const empty = $("emptyState");
  const status = $("callsStatus");

  if (!list || !empty || !status) return;

  const all = [...historyCalls.values()].sort((a, b) => {
    return timestampMillis(b.createdAt) - timestampMillis(a.createdAt);
  });

  const filtered = all.filter((call) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "missed") return callDirection(call) === "missed";
    return callDirection(call) === activeFilter;
  });

  $("callCount").textContent = `${all.length} ${all.length === 1 ? "call" : "calls"}`;

  list.replaceChildren();
  status.hidden = true;
  empty.hidden = filtered.length > 0;

  if (!filtered.length) {
    $("emptyTitle").textContent =
      all.length ? "Nothing in this category" : "No calls yet";

    $("emptyText").textContent =
      all.length
        ? "No calls match this filter."
        : "Your real PD call history will appear here.";

    return;
  }

  for (const call of filtered) {
    const direction = callDirection(call);
    const type = call.type === "video" ? "Video call" : "Voice call";
    const icon = call.type === "video" ? "fa-video" : "fa-phone";
    const statusLabel = callDirectionLabel(call);

    const row = document.createElement("article");
    row.className = "call-item";

    const avatar = document.createElement("div");
    avatar.className = "call-avatar";
    avatar.innerHTML = `<i class="fa-solid ${icon}"></i>`;

    const info = document.createElement("div");
    info.className = "call-info";

    const name = document.createElement("div");
    name.className = "call-name";
    name.textContent = call.callerUID === currentUser.uid
      ? (call.receiverName || getPartnerName())
      : (call.callerName || getPartnerName());

    const meta = document.createElement("div");
    meta.className = "call-meta";

    const directionEl = document.createElement("span");
    directionEl.className = `call-direction ${direction}`;
    directionEl.textContent = statusLabel;

    const date = document.createElement("span");
    date.textContent = `· ${formatCallDate(call.createdAt)}`;

    meta.append(directionEl, date);
    info.append(name, meta);

    const right = document.createElement("div");
    right.className = "call-right";

    const duration = document.createElement("div");
    duration.className = "call-time";
    duration.textContent = call.durationSeconds
      ? formatDuration(call.durationSeconds)
      : "";

    const kind = document.createElement("div");
    kind.className = "call-kind";
    kind.textContent = type;

    right.append(duration, kind);
    row.append(avatar, info, right);
    list.appendChild(row);
  }
}

function handleCallDocument(callId, data, source) {
  historyCalls.set(callId, { id: callId, ...data });
  renderHistory();

  if (currentCallId === callId && isTerminalStatus(data.status)) {
    const message = data.status === "missed"
      ? "Missed call ❤️"
      : data.status === "declined"
        ? "The call was declined."
        : data.status === "failed"
          ? "The call failed."
          : "Call ended ❤️";

    if (!endingCall) showToast(message);
    cleanupCall();
    return;
  }

  if (
    source === "receiver" &&
    data.receiverUID === currentUser?.uid &&
    data.status === "ringing" &&
    data.offer &&
    !currentCallId
  ) {
    showIncomingCall(callId, data);
  }
}

function subscribeToCallHistory() {
  collectionUnsubscribers.forEach((unsubscribe) => unsubscribe());
  collectionUnsubscribers = [];
  historyCalls.clear();

  $("callsStatus").hidden = false;
  $("callsStatus").innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i><span>Loading call history…</span>';

  const callerQuery = query(
    collection(db, "calls"),
    where("callerUID", "==", currentUser.uid)
  );

  const receiverQuery = query(
    collection(db, "calls"),
    where("receiverUID", "==", currentUser.uid)
  );

  const subscribe = (callQuery, source) => {
    const unsubscribe = onSnapshot(
      callQuery,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "removed") {
            historyCalls.delete(change.doc.id);
            renderHistory();
            return;
          }

          handleCallDocument(
            change.doc.id,
            change.doc.data(),
            source
          );
        });

        if (historyCalls.size === 0) {
          $("callsStatus").hidden = true;
          renderHistory();
        }
      },
      (error) => {
        console.error(`PD ${source} calls listener failed:`, error);

        $("callsStatus").hidden = false;
        $("callsStatus").innerHTML =
          '<i class="fa-solid fa-triangle-exclamation"></i>' +
          '<span>Could not load calls. Check your Firestore rules.</span>';
      }
    );

    collectionUnsubscribers.push(unsubscribe);
  };

  subscribe(callerQuery, "caller");
  subscribe(receiverQuery, "receiver");
}

/* -------------------- EVENTS / AUTH -------------------- */

function setupFilters() {
  $("callFilters")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;

    activeFilter = button.dataset.filter;

    document.querySelectorAll("#callFilters .filter").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    renderHistory();
  });
}

function setupButtons() {
  $("voiceCallBtn").addEventListener("click", () => startCall("voice"));
  $("videoCallBtn").addEventListener("click", () => startCall("video"));

  $("acceptCallBtn").addEventListener("click", acceptIncomingCall);
  $("declineCallBtn").addEventListener("click", declineIncomingCall);

  $("endCallBtn").addEventListener("click", () => finishCall());
  $("closeCallScreen").addEventListener("click", () => finishCall());

  $("muteBtn").addEventListener("click", toggleMute);
  $("cameraBtn").addEventListener("click", toggleCamera);

  $("refreshCalls")?.addEventListener("click", () => {
    renderHistory();
    showToast("Call history refreshed.");
  });
}

setupFilters();
setupButtons();

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  partnerCache = null;

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  $("myName").textContent = getMyName();
  $("partnerName").textContent = getPartnerName();

  subscribeToCallHistory();
});

window.addEventListener("beforeunload", () => {
  clearCallTimers();

  collectionUnsubscribers.forEach((unsubscribe) => unsubscribe());

  if (callUnsubscribe) callUnsubscribe();
  if (candidateUnsubscribe) candidateUnsubscribe();

  if (peerConnection) peerConnection.close();

  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
  }
});
