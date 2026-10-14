
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

const STORAGE_KEY = "pdLittleWorldDemo";

const demoEntries = [
  {
    id: "demo-1",
    type: "note",
    title: "A little reminder for my Princess 💗",
    body: "No matter how busy life gets, never forget that you have someone who is proud of you, believes in you, and is always happy to call you his Princess. You make my world softer and sweeter.",
    author: "Deib",
    visibility: "private",
    pinned: true,
    createdAt: Date.now() - 1000 * 60 * 40,
    read: false,
    demo: true
  },
  {
    id: "demo-2",
    type: "reminder",
    title: "Our next little moment 🗓️",
    body: "Let's make time for a proper call, put our phones aside, and enjoy each other's company. Even the simplest moments with you mean a lot to me.",
    author: "Princess",
    visibility: "shared",
    pinned: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 5,
    reminderAt: "",
    read: true,
    demo: true
  },
  {
    id: "demo-3",
    type: "wish",
    title: "One of our little dreams ✨",
    body: "More laughter, more memories, more honest conversations, more adventures, and a love that keeps growing as we grow together.",
    author: "Deib",
    visibility: "shared",
    pinned: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    read: true,
    demo: true
  }
];

let entries = loadEntries();
let currentTab = "board";

/* -----------------------------------------
   SPECIAL MESSAGE SAVER SELECTOR
   This is inserted automatically into the form.
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
   STORAGE
----------------------------------------- */

function loadEntries() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (error) {
    console.warn("Could not load demo entries:", error);
  }

  return demoEntries;
}

function saveEntries() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error("Could not save Little World entries:", error);
    alert("This item could not be saved in this browser.");
  }
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

  const date = new Date(timestamp);

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

    return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
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
            👑 For Remeberance
          </div>

        <div class="note-actions">
          <button
            type="button"
            class="note-pin"
            data-pin="${escapeHTML(entry.id)}"
            aria-label="${entry.pinned ? "Unpin" : "Pin"} special message"
            title="${entry.pinned ? "Unpin message" : "Pin message"}"
          >${entry.pinned ? "📌" : "♡"}</button>

          <button
            type="button"
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
            <button
              type="button"
              class="note-pin"
              data-pin="${escapeHTML(entry.id)}"
              aria-label="${entry.pinned ? "Unpin" : "Pin"} note"
              title="${entry.pinned ? "Unpin note" : "Pin note"}"
            >${entry.pinned ? "📌" : "♡"}</button>

            <button
              type="button"
              class="note-delete"
              data-delete="${escapeHTML(entry.id)}"
              aria-label="Delete ${escapeHTML(entry.title)}"
              title="Delete this item"
            >🗑️</button>
          </div>
        </div>

        <h3>${escapeHTML(entry.title)}</h3>
        <p class="note-body">${escapeHTML(entry.body)}</p>

        ${reminderText}

        <div class="note-meta">
          <span>♡ ${escapeHTML(entry.author || "Us")} · ${
            escapeHTML(relativeDate(entry.createdAt))
          }</span>
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

document.getElementById("open-create").addEventListener(
  "click",
  openCreateForm
);

document.getElementById("footer-create").addEventListener(
  "click",
  openCreateForm
);

document.getElementById("close-dialog").addEventListener(
  "click",
  () => dialog.close()
);

entryType.addEventListener("change", updateFormOptions);

/* -----------------------------------------
   PIN AND DELETE
----------------------------------------- */

noticeList.addEventListener("click", event => {
  const deleteButton = event.target.closest("[data-delete]");

  if (deleteButton) {
    const id = deleteButton.dataset.delete;
    const entry = entries.find(item => String(item.id) === String(id));

    if (!entry) return;

    const confirmed = window.confirm(
      `Delete "${entry.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    entries = entries.filter(
      item => String(item.id) !== String(id)
    );

    saveEntries();
    renderEntries();
    return;
  }

  const pinButton = event.target.closest("[data-pin]");

  if (pinButton) {
    const id = pinButton.dataset.pin;
    const entry = entries.find(item => String(item.id) === String(id));

    if (!entry) return;

    entry.pinned = !entry.pinned;

    saveEntries();
    renderEntries();
  }
});

/* -----------------------------------------
   SAVE NEW ENTRIES
----------------------------------------- */

createForm.addEventListener("submit", event => {
  event.preventDefault();

  const type = entryType.value;
  const title = entryTitle.value.trim();
  const body = entryBody.value.trim();

  if (!title || !body) return;

  const now = Date.now();

  const newEntry = {
    id: `local-${now}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    body,

    author: type === "special" ? savedBySelect.value : "You",
    savedBy: type === "special" ? savedBySelect.value : "You",
    savedAt: new Date(now).toISOString(),

    visibility: type === "note" ? entryRecipient.value : "shared",
    pinned: false,
    createdAt: now,
    reminderAt: type === "reminder" ? entryDate.value : "",
    read: false,
    demo: false
  };

  entries.push(newEntry);
  saveEntries();

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

  renderEntries();
  dialog.close();

  noticeList.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

/* -----------------------------------------
   START
----------------------------------------- */

updateFormOptions();
renderEntries();
