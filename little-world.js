
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

function loadEntries() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (error) {
    console.warn("Could not load demo entries:", error);
  }
  return demoEntries;
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

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
  const elapsed = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(elapsed / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  return new Date(timestamp).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function typeInfo(type) {
  const options = {
    note: { label: "Love note", icon: "💌", color: "paper-pink" },
    reminder: { label: "Reminder", icon: "🗓️", color: "paper-lilac" },
    wish: { label: "Our wish", icon: "✨", color: "paper-cream" },
    notice: { label: "Noticeboard", icon: "📌", color: "paper-white" }
  };

  return options[type] || options.note;
}

function getVisibleEntries() {
  let result = [...entries];

  if (currentTab === "notes") {
    result = result.filter(entry => entry.type === "note");
  } else if (currentTab === "reminders") {
    result = result.filter(entry => entry.type === "reminder");
  } else if (currentTab === "wishes") {
    result = result.filter(entry => entry.type === "wish");
  }

  return result.sort((a, b) => {
    if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
    return b.createdAt - a.createdAt;
  });
}

function renderEntries() {
  const filtered = getVisibleEntries();

  const headings = {
    board: ["OUR LITTLE COLLECTION", "Pinned with love"],
    notes: ["WORDS FROM THE HEART", "Our love notes"],
    reminders: ["THINGS TO REMEMBER", "Our reminders"],
    wishes: ["DREAMING TOGETHER", "Our little wishes"]
  };

  sectionKicker.textContent = headings[currentTab][0];
  sectionTitle.textContent = headings[currentTab][1];
  itemCount.textContent =
    `${String(filtered.length).padStart(2, "0")} ${filtered.length === 1 ? "ITEM" : "ITEMS"}`;

  if (!filtered.length) {
    noticeList.innerHTML = `
      <div class="empty-state">
        <strong>Our page is waiting for a little love 💜</strong>
        Nothing here just yet. Leave the first note and make it special.
      </div>`;
    return;
  }

  noticeList.innerHTML = filtered.map(entry => {
    const info = typeInfo(entry.type);
    const visibilityLabel =
      entry.visibility === "private" ? "🔒 A private surprise" : "♡ For both of us";

    const reminderText = entry.reminderAt
      ? `<div class="note-meta"><span>⏰ ${escapeHTML(
          new Date(entry.reminderAt).toLocaleString()
        )}</span></div>`
      : "";

    return `
      <article class="notice-card ${info.color}">
        <div class="note-top">
          <span class="note-category">${info.icon} ${info.label}</span>
          
<div class="note-actions">
  <button
    class="note-pin"
    data-pin="${escapeHTML(entry.id)}"
    aria-label="${entry.pinned ? "Unpin" : "Pin"} note"
    title="${entry.pinned ? "Unpin note" : "Pin note"}"
  >${entry.pinned ? "📌" : "♡"}</button>

  <button
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
          <span>♡ ${escapeHTML(entry.author || "Us")} · ${escapeHTML(relativeDate(entry.createdAt))}</span>
          <span class="note-tag">${escapeHTML(visibilityLabel)}</span>
        </div>
      </article>`;
  }).join("");
}

function openCreateForm() {
  createForm.reset();
  updateFormOptions();
  dialog.showModal();
}

function updateFormOptions() {
  const isReminder = entryType.value === "reminder";
  const isNote = entryType.value === "note";

  reminderWrap.hidden = !isReminder;
  entryDate.required = isReminder;
  recipientWrap.hidden = !isNote;

  if (!isNote) {
    entryRecipient.value = "shared";
  }
}

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    currentTab = tab.dataset.tab;
    tabs.forEach(item => item.classList.toggle("active", item === tab));
    renderEntries();
  });
});

document.getElementById("open-create").addEventListener("click", openCreateForm);
document.getElementById("footer-create").addEventListener("click", openCreateForm);
document.getElementById("close-dialog").addEventListener("click", () => dialog.close());

entryType.addEventListener("change", updateFormOptions);


noticeList.addEventListener("click", event => {
  const deleteButton = event.target.closest("[data-delete]");

  if (deleteButton) {
    const entry = entries.find(
      item => item.id === deleteButton.dataset.delete
    );

    if (!entry) return;

    const confirmed = window.confirm(
      `Delete "${entry.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    entries = entries.filter(
      item => item.id !== deleteButton.dataset.delete
    );

    saveEntries();
    renderEntries();
    return;
  }

  const pinButton = event.target.closest("[data-pin]");

  if (!pinButton) return;

  const entry = entries.find(
    item => item.id === pinButton.dataset.pin
  );

  if (!entry) return;

  entry.pinned = !entry.pinned;
  saveEntries();
  renderEntries();
});

createForm.addEventListener("submit", event => {
  event.preventDefault();

  const type = entryType.value;
  const title = entryTitle.value.trim();
  const body = entryBody.value.trim();

  if (!title || !body) return;

  const newEntry = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    body,
    author: "You",
    visibility: type === "note" ? entryRecipient.value : "shared",
    pinned: false,
    createdAt: Date.now(),
    reminderAt: type === "reminder" ? entryDate.value : "",
    read: false,
    demo: false
  };

  entries.push(newEntry);
  saveEntries();

  currentTab = type === "notice" ? "board" : type === "note" ? "notes" : type === "reminder" ? "reminders" : "wishes";
  tabs.forEach(tab => tab.classList.toggle("active", tab.dataset.tab === currentTab));

  renderEntries();
  dialog.close();
  noticeList.scrollIntoView({ behavior: "smooth", block: "start" });
});

updateFormOptions();
renderEntries();
