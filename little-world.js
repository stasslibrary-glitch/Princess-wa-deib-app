
/* =========================================================
   PD — LITTLE WORLD
   Firebase Firestore • Live sync • Shared entries
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

/* -----------------------------------------
   PAGE ELEMENTS
----------------------------------------- */

const noticeList = document.getElementById("notice-list");
const tabs = [...document.querySelectorAll(".tab")];
const sectionTitle = document.getElementById("section-title");
const sectionKicker = document.getElementById("section-kicker");
const itemCount = document.getElementById("item-count");

const dialog = document.getElementById("create-dialog");
const createForm = document.getElementById("create-form");
const entryType = document.getElementById("entry-type");
const entryTitle = document.getElementById("entry-title");
const entryBody = document.getElementById("entry-body");
const entryRecipient = document.getElementById("entry-recipient");
const recipientWrap = document.getElementById("recipient-wrap");
const reminderWrap = document.getElementById("reminder-wrap");
const entryDate = document.getElementById("entry-date");

const ENTRIES_COLLECTION = "littleWorldEntries";

let currentUser = null;
let entries = [];
let currentTab = "board";
let unsubscribeListeners = [];

/* -----------------------------------------
   SPECIAL MESSAGE SAVER SELECTOR
----------------------------------------- */

const savedByWrap = document.createElement("div");
savedByWrap.id = "saved-by-wrap";
savedByWrap.className = "form-field";
savedByWrap.hidden = true;

savedByWrap.innerHTML = `
  <label for="saved-by">Who is saving this message?</label>
  <select id="saved-by" name="savedBy">
    <option value="Deib">Deib ❤️</option>
    <option value="Princess">Princess 💜</option>
  </select>
  <small>Choose who is keeping this special memory.</small>
`;

const submitButton = createForm.querySelector(
  'button[type="submit"], button:not([type])'
);

if (submitButton) {
  createForm.insertBefore(savedByWrap, submitButton);
} else {
  createForm.appendChild(savedByWrap);
}

const savedBySelect = document.getElementById("saved-by");

/* -----------------------------------------
   ACCOUNT NAME
----------------------------------------- */


function getAccountName() {
  const email = (currentUser?.email || "").toLowerCase();

  if (email === "princess@gmail.com") return "Deib";
  if (email === "deib@gmail.com") return "Princess";

  return currentUser?.displayName || "PD Member";
}


/* -----------------------------------------
   HELPERS
----------------------------------------- */

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function relativeDate(timestamp) {
  const time = Number(timestamp) || Date.now();
  const elapsed = Math.max(0, Date.now() - time);
  const minutes = Math.floor(elapsed / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  return new Date(time).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function savedDate(timestamp) {
  if (!timestamp) return "Date not available";

  let date;

  if (typeof timestamp === "string") {
    date = new Date(timestamp);
  } else if (typeof timestamp === "number") {
    date = new Date(timestamp);
  } else if (typeof timestamp.toDate === "function") {
    date = timestamp.toDate();
  } else {
    return "Date not available";
  }

  if (Number.isNaN(date.getTime())) {
    return "Date not available";
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function typeInfo(type) {
  const options = {
    note: {
      label: "Love note",
      icon: "💌",
      color: "paper-pink"
    },
    reminder: {
      label: "Reminder",
      icon: "🗓️",
      color: "paper-lilac"
    },
    wish: {
      label: "Our wish",
      icon: "✨",
      color: "paper-cream"
    },
    notice: {
      label: "Noticeboard",
      icon: "📌",
      color: "paper-white"
    },
    special: {
      label: "Special message",
      icon: "💗",
      color: "paper-pink"
    }
  };

  return options[type] || options.note;
}

/* -----------------------------------------
   LIVE FIRESTORE SYNC
----------------------------------------- */

function startEntriesListener() {
  unsubscribeListeners.forEach(unsubscribe => unsubscribe());
  unsubscribeListeners = [];

  if (!currentUser) return;

  const entriesRef = collection(db, ENTRIES_COLLECTION);

  // Shared entries: visible to both signed-in accounts.
  const sharedQuery = query(
    entriesRef,
    where("visibility", "==", "shared")
  );

  // Personal entries: fetch only this account's entries.
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

    entries = [...combined.values()].map(entry => ({
      ...entry,
      // Convert Firestore timestamps into numbers for display.
      createdAt:
        Number(entry.createdAtMs) ||
        (typeof entry.createdAt?.toMillis === "function"
          ? entry.createdAt.toMillis()
          : Date.now())
    }));

    renderEntries();
  }

  function convertSnapshot(snapshot, destination) {
    destination.clear();

    snapshot.forEach(documentSnapshot => {
      const data = documentSnapshot.data();

      destination.set(documentSnapshot.id, {
        ...data,
        id: documentSnapshot.id
      });
    });

    refreshEntries();
  }

  const stopShared = onSnapshot(
    sharedQuery,
    snapshot => convertSnapshot(snapshot, sharedEntries),
    error => {
      console.error("Little World shared entries error:", error);
      showFirebaseError(error);
    }
  );

  const stopOwn = onSnapshot(
    ownQuery,
    snapshot => convertSnapshot(snapshot, ownEntries),
    error => {
      console.error("Little World personal entries error:", error);
      showFirebaseError(error);
    }
  );

  unsubscribeListeners.push(stopShared, stopOwn);
}

function showFirebaseError(error) {
  if (error.code === "permission-denied") {
    console.error(
      "Check your Firestore security rules for littleWorldEntries."
    );
  } else {
    console.error("Could not sync Little World with Firebase.");
  }
}

/* -----------------------------------------
   FILTER ENTRIES
----------------------------------------- */

function getVisibleEntries() {
  let result = [...entries];

  if (currentTab === "notes") {
    result = result.filter(entry => entry.type === "note");
  } else if (currentTab === "reminders") {
    result = result.filter(entry => entry.type === "reminder");
  } else if (currentTab === "wishes") {
    result = result.filter(entry => entry.type === "wish");
  } else if (currentTab === "special") {
    result = result.filter(entry => entry.type === "special");
  }

  return result.sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return Number(b.pinned) - Number(a.pinned);
    }

    return (Number(b.createdAt) || 0) -
           (Number(a.createdAt) || 0);
  });
}

/* -----------------------------------------
   SPECIAL MESSAGE CARD
----------------------------------------- */

function renderSpecialMessage(entry) {
  const saver = entry.savedBy || entry.author || "Unknown";
  const date = savedDate(entry.savedAt || entry.createdAt);

  return `
    <article class="special-message-card">
      <div class="special-message-top">
        <div class="special-message-label">
          👑 Special Messages
        </div>

        <div class="note-actions">
          <button type="button"
            class="note-pin"
            data-pin="${escapeHTML(entry.id)}"
            aria-label="${entry.pinned ? "Unpin" : "Pin"} special message"
            title="${entry.pinned ? "Unpin message" : "Pin message"}"
          >${entry.pinned ? "📌" : "♡"}</button>

          <button type="button"
            class="note-delete"
            data-delete="${escapeHTML(entry.id)}"
            aria-label="Delete special message"
            title="Delete this message"
          >🗑️</button>
        </div>
      </div>

      <h3 class="special-message-title">
        ${escapeHTML(entry.title || "A little reminder of us 💗")}
      </h3>

      <p class="special-message-text">${escapeHTML(entry.body || "")}</p>

      <div class="special-message-footer">
        <div class="special-saved-by">
          Saved on ${escapeHTML(date)}
          <strong>♡ Saved by ${escapeHTML(saver)}</strong>
        </div>
      </div>
    </article>
  `;
}

/* -----------------------------------------
   RENDER THE PAGE
----------------------------------------- */

function renderEntries() {
  const filtered = getVisibleEntries();

  const headings = {
    board: ["OUR LITTLE COLLECTION", "Pinned with love"],
    notes: ["WORDS FROM THE HEART", "Our love notes"],
    reminders: ["THINGS TO REMEMBER", "Our reminders"],
    wishes: ["DREAMING TOGETHER", "Our little wishes"],
    special: ["MEMORIES TO KEEP", "Special messages 💌"]
  };

  const heading = headings[currentTab] || headings.board;

  sectionKicker.textContent = heading[0];
  sectionTitle.textContent = heading[1];

  itemCount.textContent =
    `${String(filtered.length).padStart(2, "0")} ${
      filtered.length === 1 ? "ITEM" : "ITEMS"
    }`;

  if (!filtered.length) {
    const emptyMessages = {
      board: [
        "Our page is waiting for a little love 💜",
        "Nothing here just yet. Leave the first note and make it special."
      ],
      notes: [
        "A blank page for love letters 💌",
        "Add a sweet note to brighten someone's day."
      ],
      reminders: [
        "Nothing to remember just yet 🗓️",
        "Add a little reminder for something important to both of you."
      ],
      wishes: [
        "What shall we dream of next? ✨",
        "Save a wish for your little world together."
      ],
      special: [
        "Keep your favourite words close 💗",
        "Save a special text here so you can come back to it whenever you miss each other."
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

  noticeList.innerHTML = filtered.map(entry => {
    if (entry.type === "special") {
      return renderSpecialMessage(entry);
    }

    const info = typeInfo(entry.type);

    const visibilityLabel =
      entry.visibility === "private"
        ? "🔒 A private surprise"
        : "♡ For both of us";

    const reminderText = entry.reminderAt
      ? `<div class="note-meta">
           <span>⏰ ${escapeHTML(
             new Date(entry.reminderAt).toLocaleString()
           )}</span>
         </div>`
      : "";

    return `
      <article class="notice-card ${info.color}">
        <div class="note-top">
          <span class="note-category">
            ${info.icon} ${info.label}
          </span>

          <div class="note-actions">
            <button type="button"
              class="note-pin"
              data-pin="${escapeHTML(entry.id)}"
              aria-label="${entry.pinned ? "Unpin" : "Pin"} note"
              title="${entry.pinned ? "Unpin note" : "Pin note"}"
            >${entry.pinned ? "📌" : "♡"}</button>

            <button type="button"
              class="note-delete"
              data-delete="${escapeHTML(entry.id)}"
              aria-label="Delete ${escapeHTML(entry.title)}"
              title="Delete this item"
            >🗑️</button>
          </div>
        </div>

        <h3>${escapeHTML(entry.title || "")}</h3>
        <p class="note-body">${escapeHTML(entry.body || "")}</p>

        ${reminderText}

        <div class="note-meta">
          <span>♡ ${escapeHTML(entry.author || "Us")} ·
            ${escapeHTML(relativeDate(entry.createdAt))}
          </span>
          <span class="note-tag">${escapeHTML(visibilityLabel)}</span>
        </div>
      </article>
    `;
  }).join("");
}

/* -----------------------------------------
   CREATE FORM
----------------------------------------- */

function openCreateForm() {
  if (!currentUser) {
    alert("Please sign in to your PD account first. 💜");
    return;
  }

  createForm.reset();
  updateFormOptions();
  dialog.showModal();
}

function updateFormOptions() {
  const isReminder = entryType.value === "reminder";
  const isNote = entryType.value === "note";
  const isSpecial = entryType.value === "special";

  reminderWrap.hidden = !isReminder;
  entryDate.required = isReminder;

  recipientWrap.hidden = !isNote;
  savedByWrap.hidden = !isSpecial;
  savedBySelect.required = isSpecial;

  if (!isNote) {
    entryRecipient.value = "shared";
  }
}

/* -----------------------------------------
   TABS
----------------------------------------- */

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    currentTab = tab.dataset.tab;

    tabs.forEach(item => {
      item.classList.toggle("active", item === tab);
    });

    renderEntries();
  });
});

/* -----------------------------------------
   OPEN AND CLOSE DIALOG
----------------------------------------- */

document.getElementById("open-create")?.addEventListener(
  "click",
  openCreateForm
);

document.getElementById("footer-create")?.addEventListener(
  "click",
  openCreateForm
);

document.getElementById("close-dialog")?.addEventListener(
  "click",
  () => dialog.close()
);

entryType.addEventListener("change", updateFormOptions);

/* -----------------------------------------
   PIN AND DELETE IN FIRESTORE
----------------------------------------- */

noticeList.addEventListener("click", async event => {
  const deleteButton = event.target.closest("[data-delete]");
  const pinButton = event.target.closest("[data-pin]");

  if (deleteButton) {
    const id = deleteButton.dataset.delete;
    const entry = entries.find(item => item.id === id);

    if (!entry || !currentUser) return;

    // Only the creator may delete their entry.
    if (entry.authorUID !== currentUser.uid) {
      alert("Only the person who saved this item can delete it. 💜");
      return;
    }

    if (!window.confirm(`Delete "${entry.title}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, ENTRIES_COLLECTION, id));
    } catch (error) {
      console.error("Could not delete Little World entry:", error);
      alert("Could not delete this item. Check your connection and Firebase rules.");
    }

    return;
  }

  if (pinButton) {
    const id = pinButton.dataset.pin;
    const entry = entries.find(item => item.id === id);

    if (!entry || !currentUser) return;

    try {
      await updateDoc(doc(db, ENTRIES_COLLECTION, id), {
        pinned: !entry.pinned,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Could not update pin:", error);
      alert("Could not update the pin. Check your Firebase rules.");
    }
  }
});

/* -----------------------------------------
   SAVE NEW ENTRIES TO FIRESTORE
----------------------------------------- */

createForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentUser) {
    alert("Please sign in to PD before saving. 💜");
    return;
  }

  const type = entryType.value;
  const title = entryTitle.value.trim();
  const body = entryBody.value.trim();

  if (!title || !body) return;

  const now = Date.now();
  const author = getAccountName();

  const newEntry = {
    type,
    title,
    body,

    // Identity comes from the signed-in Firebase account.
    author,
    authorUID: currentUser.uid,

    // Retains your special-message saver selector.
    savedBy: type === "special" ? savedBySelect.value : author,
    savedAt: new Date(now).toISOString(),

    visibility: type === "note"
      ? entryRecipient.value
      : "shared",

    pinned: false,
    createdAt: serverTimestamp(),
    createdAtMs: now,
    reminderAt: type === "reminder" ? entryDate.value : "",
    read: false,
    updatedAt: serverTimestamp()
  };

  const originalButton = createForm.querySelector(
    'button[type="submit"], button:not([type])'
  );

  try {
    if (originalButton) {
      originalButton.disabled = true;
      originalButton.textContent = "Saving… 💜";
    }

    await addDoc(collection(db, ENTRIES_COLLECTION), newEntry);

    if (type === "special") {
      currentTab = "special";
    } else if (type === "note") {
      currentTab = "notes";
    } else if (type === "reminder") {
      currentTab = "reminders";
    } else if (type === "wish") {
      currentTab = "wishes";
    } else {
      currentTab = "board";
    }

    tabs.forEach(tab => {
      tab.classList.toggle("active", tab.dataset.tab === currentTab);
    });

    dialog.close();
    createForm.reset();
    updateFormOptions();

    // Firestore's real-time listener refreshes both accounts.
    noticeList.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

  } catch (error) {
    console.error("Could not save Little World entry:", error);

    alert(
      error.code === "permission-denied"
        ? "Firebase blocked this save. Check your Firestore security rules."
        : "Your entry could not be saved. Check your internet connection and try again."
    );

  } finally {
    if (originalButton) {
      originalButton.disabled = false;
      originalButton.textContent = "Save";
    }
  }
});

/* -----------------------------------------
   START PD LITTLE WORLD
----------------------------------------- */

updateFormOptions();
renderEntries();

onAuthStateChanged(auth, user => {
  currentUser = user;

  if (!user) {;
    unsubscribeListeners.forEach(unsubscribe => unsubscribe());
    unsubscribeListeners = [];
    entries = [];
    renderEntries();
    return;
  }

  console.log("💜 Little World connected:", user.email);
  startEntriesListener();
});
