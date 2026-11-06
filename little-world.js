
/* =========================================================
   PRINCESS WA DEIB — OUR LITTLE WORLD
   Firebase Firestore • Live Sync • Love Letters
   • Special Messages • Open Record Details
   ========================================================= */

import { auth, db } from "./firebase.js";

import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import { onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";


/* =========================================================
   1. PAGE ELEMENTS
   ========================================================= */

const noticeList = document.getElementById("notice-list");
const tabs = [...document.querySelectorAll(".tab")];

const sectionTitle = document.getElementById("section-title");
const sectionKicker = document.getElementById("section-kicker");
const itemCount = document.getElementById("item-count");

const recordsView = document.getElementById("records-view");
const recordView = document.getElementById("record-view");

const recordBack = document.getElementById("record-back");
const recordCategory = document.getElementById("record-category");
const recordOpenTitle = document.getElementById("record-open-title");
const recordAuthor = document.getElementById("record-author");
const recordDate = document.getElementById("record-date");
const recordBody = document.getElementById("record-body");
const recordIcon = document.getElementById("record-icon");

const dialog = document.getElementById("create-dialog");
const createForm = document.getElementById("create-form");

const entryType = document.getElementById("entry-type");
const entryTitle = document.getElementById("entry-title");
const entryBody = document.getElementById("entry-body");
const entryRecipient = document.getElementById("entry-recipient");
const recipientWrap = document.getElementById("recipient-wrap");

const openCreate = document.getElementById("open-create");
const closeDialog = document.getElementById("close-dialog");


/* =========================================================
   2. FIREBASE CONFIGURATION
   IMPORTANT: KEEP THE ORIGINAL COLLECTION
   ========================================================= */

const ENTRIES_COLLECTION = "littleWorldEntries";

let currentUser = null;
let entries = [];
let currentTab = "board";
let currentRecordId = null;

let unsubscribeListeners = [];


/* =========================================================
   3. ACCOUNT IDENTITY
   ========================================================= */

function getAccountName() {
  const email = (currentUser?.email || "").toLowerCase();

  if (email === "princess@gmail.com") return "Deib";
  if (email === "deib@gmail.com") return "Princess";

  return currentUser?.displayName || "PD Member";
}


/* =========================================================
   4. HELPERS
   ========================================================= */

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}


function getDate(timestamp) {
  if (!timestamp) return null;

  let date;

  if (typeof timestamp.toDate === "function") {
    date = timestamp.toDate();
  } else if (typeof timestamp === "number") {
    date = new Date(timestamp);
  } else if (typeof timestamp === "string") {
    date = new Date(timestamp);
  } else {
    return null;
  }

  return Number.isNaN(date.getTime()) ? null : date;
}


function formatDate(timestamp) {
  const date = getDate(timestamp);

  if (!date) return "Date not available";

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}


function formatRelativeDate(timestamp) {
  const date = getDate(timestamp);

  if (!date) return "Saved";

  const elapsed = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(elapsed / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours} hr ago`;

  const days = Math.floor(hours / 24);

  if (days < 7) return `${days} days ago`;

  return formatDate(date);
}


function getEntryDate(entry) {
  return entry.savedAt ||
    entry.createdAt ||
    entry.createdAtMs ||
    entry.updatedAt;
}


function typeInfo(type) {
  if (type === "special") {
    return {
      label: "Special Message",
      icon: "💗",
      className: "special"
    };
  }

  return {
    label: "Love Letter",
    icon: "💌",
    className: "love-letter"
  };
}


/* =========================================================
   5. FIRESTORE LIVE SYNC
   ========================================================= */

function startEntriesListener() {
  unsubscribeListeners.forEach(stop => stop());
  unsubscribeListeners = [];

  if (!currentUser) return;

  const entriesRef = collection(db, ENTRIES_COLLECTION);

  /*
    Shared records are visible to both accounts.

    Personal records are fetched using the original
    authorUID field.

    Both queries use the SAME original collection.
  */

  const sharedQuery = query(
    entriesRef,
    where("visibility", "==", "shared")
  );

  const ownQuery = query(
    entriesRef,
    where("authorUID", "==", currentUser.uid)
  );

  const sharedEntries = new Map();
  const ownEntries = new Map();

  function refreshEntries() {
    const combined = new Map([
      ...sharedEntries,
      ...ownEntries
    ]);

    entries = [...combined.values()].map(entry => {
      const createdDate = getDate(
        entry.createdAtMs || entry.createdAt || entry.savedAt
      );

      return {
        ...entry,
        createdAt: createdDate
          ? createdDate.getTime()
          : 0
      };
    });

    console.log(
      "💜 Little World records loaded:",
      entries.length,
      "| Shared:",
      sharedEntries.size,
      "| Personal:",
      ownEntries.size
    );

    renderEntries();
  }

  function processSnapshot(snapshot, destination) {
    destination.clear();

    snapshot.forEach(documentSnapshot => {
      destination.set(documentSnapshot.id, {
        ...documentSnapshot.data(),
        id: documentSnapshot.id
      });
    });

    refreshEntries();
  }

  const stopShared = onSnapshot(
    sharedQuery,
    snapshot => processSnapshot(snapshot, sharedEntries),
    error => {
      console.error("Shared records error:", error);
      showFirebaseError(error);
    }
  );

  const stopOwn = onSnapshot(
    ownQuery,
    snapshot => processSnapshot(snapshot, ownEntries),
    error => {
      console.error("Personal records error:", error);
      showFirebaseError(error);
    }
  );

  unsubscribeListeners.push(stopShared, stopOwn);
}


function showFirebaseError(error) {
  console.error("Little World Firebase error:", error);

  if (!noticeList) return;

  let message = "We could not load your saved messages.";

  if (error.code === "permission-denied") {
    message = "Firebase denied access. Check your Firestore security rules.";
  } else if (error.code === "unavailable") {
    message = "Connection problem. Please check your internet.";
  } else if (error.code === "failed-precondition") {
    message = "A Firestore query needs attention. Check the Firebase console.";
  }

  noticeList.innerHTML = `
    <div class="empty-state special-empty">
      <span class="empty-heart">💜</span>
      <strong>Unable to open our collection</strong>
      <p>${escapeHTML(message)}</p>
    </div>
  `;
}


/* =========================================================
   6. FILTER RECORDS
   ========================================================= */

function getVisibleEntries() {
  let result = entries.filter(entry =>
    entry.type === "note" || entry.type === "special"
  );

  if (currentTab === "notes") {
    result = result.filter(entry => entry.type === "note");
  }

  if (currentTab === "special") {
    result = result.filter(entry => entry.type === "special");
  }

  return result.sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) {
      return Number(Boolean(b.pinned)) -
        Number(Boolean(a.pinned));
    }

    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}


/* =========================================================
   7. TITLE-ONLY RECORD CARDS
   ========================================================= */

function renderRecordCard(entry) {
  const info = typeInfo(entry.type);

  const date = formatRelativeDate(getEntryDate(entry));

  return `
    <article
      class="notice-card ${info.className}"
      data-open-record="${escapeHTML(entry.id)}"
      tabindex="0"
      role="button"
      aria-label="Open ${escapeHTML(entry.title || info.label)}"
    >

      <div class="notice-card-icon">
        ${info.icon}
      </div>

      <div class="notice-card-info">

        <div class="notice-card-type">
          ${info.label}
        </div>

        <h3>
          ${escapeHTML(entry.title || "Untitled")}
        </h3>

        <div class="notice-card-date">
          ${escapeHTML(date)}
          ${entry.pinned ? " · 📌 Pinned" : ""}
        </div>

      </div>

      <div class="notice-card-arrow">
        <i class="fa-solid fa-chevron-right"></i>
      </div>

    </article>
  `;
}


/* =========================================================
   8. RENDER COLLECTION
   ========================================================= */

function renderEntries() {
  if (!noticeList) return;

  const filtered = getVisibleEntries();

  const headings = {
    board: [
      "OUR LITTLE COLLECTION",
      "Saved with love"
    ],
    notes: [
      "WORDS FROM THE HEART",
      "Our love letters"
    ],
    special: [
      "WORDS TO KEEP FOREVER",
      "Special messages"
    ]
  };

  const heading = headings[currentTab] || headings.board;

  if (sectionKicker) {
    sectionKicker.textContent = heading[0];
  }

  if (sectionTitle) {
    sectionTitle.textContent = heading[1];
  }

  if (itemCount) {
    itemCount.textContent =
      `${String(filtered.length).padStart(2, "0")} ${
        filtered.length === 1 ? "RECORD" : "RECORDS"
      }`;
  }

  if (!filtered.length) {
    const emptyMessages = {
      board: [
        "Our little collection is waiting 💜",
        "Save a love letter or a special message to begin."
      ],
      notes: [
        "A little space for words from the heart 💌",
        "Your saved love letters will appear here."
      ],
      special: [
        "Some words deserve to stay forever 💗",
        "Your special messages will be kept here."
      ]
    };

    const empty = emptyMessages[currentTab] || emptyMessages.board;

    noticeList.innerHTML = `
      <div class="empty-state special-empty">
        <span class="empty-heart">💌</span>
        <strong>${escapeHTML(empty[0])}</strong>
        <p>${escapeHTML(empty[1])}</p>
      </div>
    `;

    return;
  }

  noticeList.innerHTML = filtered
    .map(renderRecordCard)
    .join("");
}


/* =========================================================
   9. OPEN A FULL RECORD
   ========================================================= */

function openRecord(id) {
  const entry = entries.find(item => item.id === id);

  if (!entry) return;

  // This page only opens the two supported record types.
  if (!["note", "special"].includes(entry.type)) return;

  currentRecordId = id;

  const info = typeInfo(entry.type);

  if (recordIcon) {
    recordIcon.textContent = info.icon;
  }

  if (recordCategory) {
    recordCategory.textContent = info.label;
  }

  if (recordOpenTitle) {
    recordOpenTitle.textContent = entry.title || "Untitled";
  }

  if (recordAuthor) {
    const saver = entry.savedBy || entry.author || "Us";
    recordAuthor.textContent = `Saved by ${saver}`;
  }

  if (recordDate) {
    recordDate.textContent = formatDate(getEntryDate(entry));
  }

  if (recordBody) {
    // textContent prevents saved text from being interpreted as HTML.
    recordBody.textContent = entry.body || "";
  }

  if (recordsView) {
    recordsView.hidden = true;
  }

  if (recordView) {
    recordView.hidden = false;
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


function closeRecord() {
  currentRecordId = null;

  if (recordView) {
    recordView.hidden = true;
  }

  if (recordsView) {
    recordsView.hidden = false;
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


recordBack?.addEventListener("click", closeRecord);


/* =========================================================
   10. LIST INTERACTIONS
   ========================================================= */

noticeList?.addEventListener("click", async event => {
  const card = event.target.closest("[data-open-record]");

  if (!card) return;

  openRecord(card.dataset.openRecord);
});


noticeList?.addEventListener("keydown", event => {
  if (event.key !== "Enter" && event.key !== " ") return;

  const card = event.target.closest("[data-open-record]");

  if (!card) return;

  event.preventDefault();
  openRecord(card.dataset.openRecord);
});


/* =========================================================
   11. TABS
   ========================================================= */

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    currentTab = tab.dataset.tab;

    if (!["board", "notes", "special"].includes(currentTab)) {
      currentTab = "board";
    }

    tabs.forEach(item => {
      item.classList.toggle("active", item === tab);
    });

    renderEntries();
  });
});


/* =========================================================
   12. CREATE FORM
   ========================================================= */

function updateFormOptions() {
  if (!entryType) return;

  const isNote = entryType.value === "note";

  if (recipientWrap) {
    recipientWrap.hidden = !isNote;
  }

  if (entryRecipient && !isNote) {
    entryRecipient.value = "shared";
  }
}


function openCreateForm() {
  if (!currentUser) {
    alert("Please sign in to your PD account first. 💜");
    return;
  }

  if (!dialog || !createForm) return;

  createForm.reset();
  updateFormOptions();

  dialog.showModal();
}


openCreate?.addEventListener("click", openCreateForm);

document.getElementById("footer-create")?.addEventListener(
  "click",
  openCreateForm
);

closeDialog?.addEventListener("click", () => {
  dialog?.close();
});

entryType?.addEventListener("change", updateFormOptions);


/* =========================================================
   13. SAVE NEW RECORDS
   ========================================================= */

createForm?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentUser) {
    alert("Please sign in to PD before saving. 💜");
    return;
  }

  const type = entryType.value;
  const title = entryTitle.value.trim();
  const body = entryBody.value.trim();

  if (!["note", "special"].includes(type)) {
    alert("Please choose Love Letter or Special Message.");
    return;
  }

  if (!title || !body) return;

  const author = getAccountName();
  const now = Date.now();

  const newEntry = {
    type,
    title,
    body,

    author,
    authorUID: currentUser.uid,

    savedBy: author,
    savedAt: new Date(now).toISOString(),

    visibility: type === "note"
      ? (entryRecipient?.value || "shared")
      : "shared",

    pinned: false,

    createdAt: serverTimestamp(),
    createdAtMs: now,

    read: false,
    updatedAt: serverTimestamp()
  };

  const submitButton = createForm.querySelector(
    'button[type="submit"], button:not([type])'
  );

  const originalText = submitButton?.textContent || "Save";

  try {
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Saving… 💜";
    }

    await addDoc(
      collection(db, ENTRIES_COLLECTION),
      newEntry
    );

    currentTab = type === "note" ? "notes" : "special";

    tabs.forEach(tab => {
      tab.classList.toggle(
        "active",
        tab.dataset.tab === currentTab
      );
    });

    dialog.close();
    createForm.reset();
    updateFormOptions();

    renderEntries();

    noticeList.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

  } catch (error) {
    console.error("Could not save record:", error);

    alert(
      error.code === "permission-denied"
        ? "Firebase blocked this save. Check your Firestore security rules."
        : "Your message could not be saved. Please try again."
    );

  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  }
});


/* =========================================================
   14. START THE PAGE
   ========================================================= */

updateFormOptions();
renderEntries();

onAuthStateChanged(auth, user => {
  currentUser = user;

  unsubscribeListeners.forEach(stop => stop());
  unsubscribeListeners = [];

  entries = [];
  currentRecordId = null;

  if (recordView) recordView.hidden = true;
  if (recordsView) recordsView.hidden = false;

  if (!user) {
    console.log("Little World: waiting for authentication.");
    renderEntries();
    return;
  }

  console.log(
    "💜 Little World connected:",
    user.email,
    "| UID:",
    user.uid
  );

  startEntriesListener();
});
