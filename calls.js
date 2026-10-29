
/* =====================================================
   PRINCESS WA DEIB — CALL CENTER
   calls.js
   Firebase Auth + Firestore call history
   ===================================================== */

import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const $ = (selector) => document.querySelector(selector);

const callsList = $("#callsList");
const callNotice = $("#callNotice");
const myNameElement = $("#myName");
const partnerNameElement = $("#partnerName");

const PROFILES = {
  "princess@gmail.com": {
    name: "Baby",
    partnerEmail: "deib@gmail.com",
    partnerName: "Hubby"
  },
  "deib@gmail.com": {
    name: "Hubby",
    partnerEmail: "princess@gmail.com",
    partnerName: "Baby"
  }
};

let currentUser = null;
let myProfile = null;
let partnerUID = null;
let allCalls = [];
let activeFilter = "all";
let unsubscribeCalls = null;
let currentQueryVersion = 0;

function showNotice(message, isError = false) {
  if (!callNotice) return;

  callNotice.textContent = message;
  callNotice.style.color = isError ? "#ff82a6" : "#e4c9ff";
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatTime(timestamp) {
  if (!timestamp) return "Just now";

  const date = typeof timestamp.toDate === "function"
    ? timestamp.toDate()
    : new Date(timestamp);

  if (Number.isNaN(date.getTime())) return "Just now";

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return date.toLocaleDateString([], {
    day: "numeric",
    month: "short"
  });
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) return `${remainingSeconds}s`;

  return `${minutes}m ${remainingSeconds}s`;
}

async function findPartner() {
  if (!myProfile?.partnerEmail) return null;

  const usersRef = collection(db, "users");
  const partnerQuery = query(
    usersRef,
    where("email", "==", myProfile.partnerEmail)
  );

  const snapshot = await getDocs(partnerQuery);

  if (snapshot.empty) return null;

  const partnerDoc = snapshot.docs.find(
    document => document.id !== currentUser.uid
  );

  return partnerDoc ? partnerDoc.id : null;
}

function getCallDetails(call) {
  const isOutgoing = call.callerUID === currentUser.uid;
  const type = call.callType === "video" ? "Video call" : "Voice call";
  const status = call.status || "unknown";

  let direction = isOutgoing ? "Outgoing" : "Incoming";
  let icon = isOutgoing
    ? "fa-phone-arrow-up-right"
    : "fa-phone-arrow-down-left";
  let kindClass = isOutgoing ? "outgoing" : "incoming";

  // Font Awesome 6.5.2 fallback icons.
  if (isOutgoing) icon = "fa-phone";
  else icon = "fa-phone-volume";

  if (status === "missed") {
    direction = isOutgoing ? "Unanswered" : "Missed call";
    kindClass = "missed";
    icon = "fa-phone-slash";
  } else if (status === "declined") {
    direction = isOutgoing ? "Declined by partner" : "You declined";
    kindClass = "missed";
    icon = "fa-phone-slash";
  } else if (status === "call_requested") {
    direction = "Call request";
    kindClass = "outgoing";
    icon = "fa-phone";
  } else if (status === "completed") {
    direction = isOutgoing ? "Outgoing" : "Incoming";
  }

  return {
    isOutgoing,
    type,
    status,
    direction,
    icon,
    kindClass
  };
}

function renderCalls() {
  if (!callsList) return;

  let calls = [...allCalls];

  if (activeFilter === "missed") {
    calls = calls.filter(call =>
      call.status === "missed" ||
      call.status === "declined"
    );
  } else if (activeFilter === "incoming") {
    calls = calls.filter(call =>
      call.calleeUID === currentUser.uid
    );
  } else if (activeFilter === "outgoing") {
    calls = calls.filter(call =>
      call.callerUID === currentUser.uid
    );
  }

  if (!calls.length) {
    callsList.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-heart"></i>
        <p>No calls here yet.</p>
        <p>Your little call memories will appear here. ❤️</p>
      </div>
    `;
    return;
  }

  callsList.innerHTML = calls.map(call => {
    const details = getCallDetails(call);
    const personName = details.isOutgoing
      ? myProfile.partnerName
      : myProfile.partnerName;

    const time = formatTime(call.createdAt);
    const duration = formatDuration(call.durationSeconds);

    return `
      <article class="call-entry">
        <div class="call-avatar">
          <i class="fa-solid ${details.icon}"></i>
        </div>

        <div class="call-info">
          <div class="call-name">${escapeHTML(personName)}</div>

          <div class="call-meta">
            <span class="call-kind ${details.kindClass}">
              <i class="fa-solid ${details.icon}"></i>
              ${escapeHTML(details.direction)}
            </span>

            <span>·</span>
            <span>${escapeHTML(details.type)}</span>

            ${duration ? `
              <span>·</span>
              <span>${escapeHTML(duration)}</span>
            ` : ""}
          </div>
        </div>

        <div class="call-right">
          <span>${escapeHTML(time)}</span>
          <button class="call-again"
                  data-call-type="${call.callType === "video" ? "video" : "voice"}"
                  aria-label="Call ${escapeHTML(personName)}">
            <i class="fa-solid ${
              call.callType === "video" ? "fa-video" : "fa-phone"
            }"></i>
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function listenForCalls() {
  if (!currentUser) return;

  if (unsubscribeCalls) {
    unsubscribeCalls();
    unsubscribeCalls = null;
  }

  const version = ++currentQueryVersion;

  callsList.innerHTML = `
    <div class="loading-state">
      <i class="fa-solid fa-heart fa-beat"></i>
      <p>Loading your memories...</p>
    </div>
  `;

  const callsQuery = query(
    collection(db, "callLogs"),
    where("participants", "array-contains", currentUser.uid),
    orderBy("createdAt", "desc")
  );

  unsubscribeCalls = onSnapshot(
    callsQuery,
    snapshot => {
      if (version !== currentQueryVersion) return;

      allCalls = snapshot.docs.map(document => ({
        id: document.id,
        ...document.data()
      }));

      renderCalls();
    },
    error => {
      console.error("PD call history error:", error);

      callsList.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <p>We couldn't load your call history.</p>
          <p>Check your internet connection and Firestore rules.</p>
        </div>
      `;
    }
  );
}
document.getElementById("voiceCallBtn")
  ?.addEventListener("click", () => startCall("voice"));

document.getElementById("videoCallBtn")
  ?.addEventListener("click", () => startCall("video"));
async function requestCall(callType) {
  if (!currentUser || !myProfile) {
    showNotice("Please sign in to use PD Calls.", true);
    return;
  }

  if (!partnerUID) {
    showNotice(
      "Your partner's PD account was not found. Sign in to both accounts and try again.",
      true
    );
    return;
  }

  // This logs a request only. It does NOT ring the partner or
  // establish a real voice/video connection.
  const confirmed = window.confirm(
    `${callType === "video" ? "Video" : "Voice"} calling is not connected yet.\n\n` +
    "You can continue building the call system, but this button cannot place a live call yet."
  );

  if (!confirmed) return;

  showNotice("Recording your call request...");

  try {
    await addDoc(collection(db, "callLogs"), {
      callerUID: currentUser.uid,
      calleeUID: partnerUID,
      participants: [currentUser.uid, partnerUID],
      callType,
      status: "call_requested",
      durationSeconds: 0,
      createdAt: serverTimestamp()
    });

    showNotice(
      "Call request saved ❤️ Live calling still needs to be connected."
    );
  } catch (error) {
    console.error("PD call request error:", error);
    showNotice(
      "Couldn't save the call request. Check your Firebase permissions.",
      true
    );
  }
}

function setupFilters() {
  document.querySelectorAll(".filter").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".filter").forEach(item => {
        item.classList.remove("active");
      });

      button.classList.add("active");
      activeFilter = button.dataset.filter || "all";
      renderCalls();
    });
  });
}

function setupButtons() {
  $("#voiceCallBtn")?.addEventListener("click", () => {
    requestCall("voice");
  });

  $("#videoCallBtn")?.addEventListener("click", () => {
    requestCall("video");
  });

  $("#refreshCalls")?.addEventListener("click", () => {
    listenForCalls();
  });

  callsList?.addEventListener("click", event => {
    const button = event.target.closest("[data-call-type]");
    if (!button) return;

    requestCall(button.dataset.callType === "video" ? "video" : "voice");
  });
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  currentUser = user;
  myProfile = PROFILES[(user.email || "").toLowerCase()];

  if (!myProfile) {
    myProfile = {
      name: user.displayName || "You",
      partnerEmail: null,
      partnerName: "Your person"
    };
  }

  myNameElement.textContent = myProfile.name;
  partnerNameElement.textContent = myProfile.partnerName;

  setupFilters();
  setupButtons();

  try {
    partnerUID = await findPartner();
  } catch (error) {
    console.error("PD partner lookup error:", error);
    partnerUID = null;
  }

  listenForCalls();
});
