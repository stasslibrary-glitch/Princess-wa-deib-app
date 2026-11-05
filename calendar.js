/* =========================================================
   PRINCESS WA DEIB — OUR JOURNEY CALENDAR
   Complete Firebase Firestore Version
   Shared Memories • Real-time Sync • Save • Delete
========================================================= */

import { db, auth } from "./firebase.js";

import {
    collection,
    addDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


/* =========================================================
   SETTINGS
========================================================= */

const RELATIONSHIP_START = "2026-06-26";

const ALLOWED_PD_EMAILS = [
    "princess@gmail.com",
    "deib@gmail.com"
];

const MEMORIES_COLLECTION = "calendarMemories";

let calendarDate = new Date();
let memories = [];
let selectedDate = null;
let currentUser = null;
let unsubscribeMemories = null;
let isSavingMemory = false;


/* =========================================================
   START APPLICATION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    setupCalendar();
    setupMemoryPopup();
    updateJourneyDays();

    setInterval(updateJourneyDays, 60000);

    auth.onAuthStateChanged(user => {

        if (!user) {
            currentUser = null;

            memories = [];

            renderCalendar();
            renderMemoryList();
            updateMemoryCount();

            console.warn("PD Calendar: User is not signed in.");
            return;
        }

        const email = (user.email || "").toLowerCase();

        if (!ALLOWED_PD_EMAILS.includes(email)) {
            currentUser = null;

            memories = [];

            renderCalendar();
            renderMemoryList();
            updateMemoryCount();

            console.warn("PD Calendar: Unauthorized account.");
            return;
        }

        currentUser = user;

        console.log("❤️ PD Calendar authenticated:", email);

        loadMemories();

    });

});


/* =========================================================
   FIRESTORE — REAL-TIME MEMORY LISTENER
========================================================= */

function loadMemories() {

    if (!currentUser) return;

    if (unsubscribeMemories) {
        unsubscribeMemories();
        unsubscribeMemories = null;
    }

    const memoriesRef = collection(
        db,
        MEMORIES_COLLECTION
    );

    const memoriesQuery = query(
        memoriesRef,
        orderBy("date", "asc")
    );

    unsubscribeMemories = onSnapshot(
        memoriesQuery,

        snapshot => {

            memories = [];

            snapshot.forEach(item => {

                memories.push({
                    id: item.id,
                    ...item.data()
                });

            });

            updateMemoryCount();
            renderCalendar();
            renderMemoryList();

            console.log(
                "❤️ PD memories synchronized:",
                memories.length
            );

        },

        error => {

            console.error(
                "❌ PD Calendar Firestore error:",
                error
            );

            showFormMessage(
                "Unable to load memories: " + error.message,
                true
            );

            const list = document.querySelector("#calendarMemoryList");

            if (list) {
                list.innerHTML = `
                    <p class="empty-memory">
                        We couldn't load your memories. Please refresh and try again.
                    </p>
                `;
            }

        }
    );

}


/* =========================================================
   CALENDAR CONTROLS
========================================================= */

function setupCalendar() {

    document.querySelector("[data-calendar-prev]")
        ?.addEventListener("click", () => {

            calendarDate.setMonth(
                calendarDate.getMonth() - 1
            );

            renderCalendar();

        });


    document.querySelector("[data-calendar-next]")
        ?.addEventListener("click", () => {

            calendarDate.setMonth(
                calendarDate.getMonth() + 1
            );

            renderCalendar();

        });


    document.querySelector("#addMemoryBtn")
        ?.addEventListener("click", () => {

            const today = getLocalDateString(new Date());

            openMemoryForm(today);

        });

}


/* =========================================================
   RENDER CALENDAR
========================================================= */

function renderCalendar() {

    const calendar = document.querySelector("[data-calendar]");

    if (!calendar) return;

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay();

    const daysInMonth = new Date(
        year,
        month + 1,
        0
    ).getDate();

    const title = document.querySelector("[data-calendar-title]");

    if (title) {

        title.textContent = new Date(
            year,
            month,
            1
        ).toLocaleDateString("en-US", {
            month: "long",
            year: "numeric"
        });

    }

    calendar.innerHTML = "";


    /* EMPTY DAYS */

    for (let i = 0; i < firstDay; i++) {

        const empty = document.createElement("div");

        empty.className = "calendar-empty";

        calendar.appendChild(empty);

    }


    /* CALENDAR DAYS */

    for (let day = 1; day <= daysInMonth; day++) {

        const dateString =
            `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        const button = document.createElement("button");

        button.type = "button";
        button.className = "calendar-day";

        const dayMemories = memories.filter(
            item => item.date === dateString
        );

        if (dateString === RELATIONSHIP_START) {
            button.classList.add("relationship-start");
        }

        if (dayMemories.length > 0) {
            button.classList.add("has-memory");
        }

        if (dateString === getLocalDateString(new Date())) {
            button.classList.add("today");
        }

        const number = document.createElement("span");

        number.className = "calendar-number";
        number.textContent = day;

        button.appendChild(number);


        /* MEMORY ICON */

        if (dayMemories.length > 0) {

            const icon = document.createElement("span");

            icon.className = "calendar-memory-icon";
            icon.textContent = getIcon(dayMemories[0].type);

            button.appendChild(icon);

            if (dayMemories.length > 1) {

                const count = document.createElement("small");

                count.className = "calendar-memory-count";
                count.textContent = dayMemories.length;

                button.appendChild(count);

            }

        }


        /* OPEN DATE */

        button.addEventListener("click", () => {

            const latestMemories = memories.filter(
                item => item.date === dateString
            );

            if (latestMemories.length > 0) {

                showMemory(latestMemories[0]);

            } else {

                openMemoryForm(dateString);

            }

        });

        calendar.appendChild(button);

    }

}


/* =========================================================
   MEMORY ICONS
========================================================= */

function getIcon(type) {

    const icons = {

        love: "❤️",
        date: "🌹",
        song: "🎵",
        memory: "📸",
        gift: "🎁",
        conversation: "💬",
        celebration: "🎉",
        other: "⭐"

    };

    return icons[type] || "❤️";

}


/* =========================================================
   MEMORY POPUP EVENTS
========================================================= */

function setupMemoryPopup() {

    document.querySelector("[data-close-memory]")
        ?.addEventListener("click", closePopup);

    document.querySelector("[data-cancel-memory]")
        ?.addEventListener("click", closePopup);

    document.querySelector("#memoryForm")
        ?.addEventListener("submit", saveMemory);

    document.querySelector(".memory-popup-overlay")
        ?.addEventListener("click", event => {

            if (
                event.target.classList.contains(
                    "memory-popup-overlay"
                )
            ) {
                closePopup();
            }

        });

}


/* =========================================================
   OPEN MEMORY FORM
========================================================= */

function openMemoryForm(date) {

    selectedDate = date;

    const popup = document.querySelector(
        ".memory-popup-overlay"
    );

    const form = document.querySelector("#memoryForm");

    const view = document.querySelector("#memoryView");

    if (!popup || !form || !view) {
        console.error("PD Calendar: Memory popup elements missing.");
        return;
    }

    form.reset();

    const dateElement = document.querySelector("#memoryDate");

    if (dateElement) {
        dateElement.textContent = formatDate(date);
    }

    form.style.display = "block";
    view.style.display = "none";

    showFormMessage("");

    const saveButton = document.querySelector("#saveMemoryButton");

    if (saveButton) {
        saveButton.disabled = false;
    }

    popup.classList.add("active");

}


/* =========================================================
   SHOW EXISTING MEMORY
========================================================= */

function showMemory(memory) {

    const popup = document.querySelector(
        ".memory-popup-overlay"
    );

    const form = document.querySelector("#memoryForm");

    const view = document.querySelector("#memoryView");

    if (!popup || !form || !view) return;

    selectedDate = memory.date;

    form.style.display = "none";
    view.style.display = "block";

    const dateElement = document.querySelector("#memoryDate");

    if (dateElement) {
        dateElement.textContent = formatDate(memory.date);
    }

    const icon = document.querySelector("#viewMemoryIcon");

    if (icon) {
        icon.textContent = getIcon(memory.type);
    }

    const eventElement = document.querySelector("#viewMemoryEvent");

    if (eventElement) {
        eventElement.textContent =
            memory.title || memory.event || "Special Day ❤️";
    }

    const note = document.querySelector("#viewMemoryNote");

    if (note) {
        note.textContent = memory.note || "No memory note was added.";
        note.style.display = "block";
    }

    const deleteButton = document.querySelector(
        "[data-delete-memory]"
    );

    if (deleteButton) {

        deleteButton.onclick = () => {
            deleteMemory(memory.id);
        };

    }

    popup.classList.add("active");

}


/* =========================================================
   SAVE MEMORY — FIRESTORE
========================================================= */

async function saveMemory(event) {

    event.preventDefault();

    if (isSavingMemory) return;

    if (!selectedDate) {
        showFormMessage("Please select a date first ❤️", true);
        return;
    }

    if (!currentUser || !auth.currentUser) {
        showFormMessage("Please sign in before saving a memory.", true);
        return;
    }

    const email = (currentUser.email || "").toLowerCase();

    if (!ALLOWED_PD_EMAILS.includes(email)) {
        showFormMessage("This account is not authorized.", true);
        return;
    }

    const titleInput = document.querySelector("#memoryEvent");
    const typeInput = document.querySelector("#memoryType");
    const noteInput = document.querySelector("#memoryNote");

    if (!titleInput || !typeInput || !noteInput) {
        showFormMessage("Some memory form fields are missing.", true);
        console.error("PD Calendar: Check #memoryEvent, #memoryType and #memoryNote.");
        return;
    }

    const title = titleInput.value.trim();
    const type = typeInput.value || "memory";
    const note = noteInput.value.trim();

    if (!title) {
        showFormMessage("Please enter what happened ❤️", true);
        titleInput.focus();
        return;
    }

    const saveButton = document.querySelector("#saveMemoryButton");

    try {

        isSavingMemory = true;

        if (saveButton) {
            saveButton.disabled = true;
            saveButton.innerHTML =
                '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        }

        showFormMessage("Saving our special memory... ❤️");

        const memoryData = {

            date: selectedDate,

            title: title,

            event: title,

            type: type,

            note: note,

            createdBy: currentUser.uid,

            createdByEmail: email,

            createdAt: serverTimestamp()

        };

        const result = await addDoc(
            collection(db, MEMORIES_COLLECTION),
            memoryData
        );

        console.log(
            "❤️ Memory saved successfully:",
            result.id
        );

        showFormMessage("Memory saved successfully! ❤️");

        closePopup();

    } catch (error) {

        console.error(
            "❌ PD MEMORY SAVE ERROR:",
            error.code,
            error.message
        );

        let message = "Could not save this memory.";

        if (error.code === "permission-denied") {
            message = "Permission denied. Check your Firestore security rules.";
        } else if (error.code === "unauthenticated") {
            message = "Your session has expired. Please sign in again.";
        } else if (error.code === "unavailable") {
            message = "Firebase is unavailable. Check your internet connection.";
        } else {
            message = error.message || message;
        }

        showFormMessage(message, true);

        alert("Memory saving failed:\n\n" + message);

    } finally {

        isSavingMemory = false;

        if (saveButton) {

            saveButton.disabled = false;

            saveButton.innerHTML =
                '<i class="fa-solid fa-heart"></i> Save Memory';

        }

    }

}


/* =========================================================
   DELETE MEMORY
========================================================= */

async function deleteMemory(id) {

    if (!currentUser || !auth.currentUser) {
        alert("Please sign in first.");
        return;
    }

    if (!confirm("Delete this special memory? ❤️")) {
        return;
    }

    try {

        await deleteDoc(
            doc(db, MEMORIES_COLLECTION, id)
        );

        console.log("❤️ Memory deleted:", id);

        closePopup();

    } catch (error) {

        console.error(
            "❌ Memory deletion failed:",
            error
        );

        alert(
            "Could not delete this memory.\n" +
            error.message
        );

    }

}


/* =========================================================
   MEMORY COUNT
========================================================= */

function updateMemoryCount() {

    const counter = document.querySelector("#memoryCount");

    if (counter) {
        counter.textContent = memories.length;
    }

}


/* =========================================================
   DAYS TOGETHER
========================================================= */

function updateJourneyDays() {

    const start = new Date(
        RELATIONSHIP_START + "T00:00:00"
    );

    const today = new Date();

    start.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const difference = today.getTime() - start.getTime();

    const days = Math.max(
        0,
        Math.floor(difference / 86400000)
    );

    const element = document.querySelector("#journeyDays");

    if (element) {
        element.textContent = days;
    }

}


/* =========================================================
   MEMORY LIST
========================================================= */

function renderMemoryList() {

    const list = document.querySelector("#calendarMemoryList");

    if (!list) return;

    list.innerHTML = "";

    if (memories.length === 0) {

        list.innerHTML = `
            <p class="empty-memory">
                Your special moments will appear here ❤️
            </p>
        `;

        return;

    }

    memories
        .slice()
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
        .forEach(memory => {

            const item = document.createElement("button");

            item.type = "button";
            item.className = "calendar-memory-item";

            const icon = document.createElement("span");
            icon.className = "memory-list-icon";
            icon.textContent = getIcon(memory.type);

            const content = document.createElement("span");
            content.className = "memory-list-content";

            const title = document.createElement("strong");
            title.textContent =
                memory.title || memory.event || "Special Day";

            const date = document.createElement("small");
            date.textContent = formatDate(memory.date);

            const arrow = document.createElement("i");
            arrow.className = "fa-solid fa-chevron-right";

            content.appendChild(title);
            content.appendChild(date);

            item.appendChild(icon);
            item.appendChild(content);
            item.appendChild(arrow);

            item.addEventListener("click", () => {
                showMemory(memory);
            });

            list.appendChild(item);

        });

}


/* =========================================================
   FORM MESSAGE
========================================================= */

function showFormMessage(message, isError = false) {

    const element = document.querySelector("#form-message");

    if (!element) return;

    element.textContent = message;

    element.style.color = isError ? "#d34d72" : "#8052a1";

}


/* =========================================================
   CLOSE POPUP
========================================================= */

function closePopup() {

    document.querySelector(".memory-popup-overlay")
        ?.classList.remove("active");

}


/* =========================================================
   DATE HELPERS
========================================================= */

function getLocalDateString(date) {

    const year = date.getFullYear();

    const month = String(
        date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;

}


function formatDate(date) {

    if (!date) return "";

    const parsed = new Date(date + "T00:00:00");

    return parsed.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });

}


/* =========================================================
   CLEANUP
========================================================= */

window.addEventListener("beforeunload", () => {

    if (unsubscribeMemories) {
        unsubscribeMemories();
    }

});


/* =========================================================
   PD MEMORY NOTIFICATION COUNTER
========================================================= */

try {

    const current = parseInt(
        localStorage.getItem("pdMemoryNotifications") || "0",
        10
    );

    localStorage.setItem(
        "pdMemoryNotifications",
        String(current + 1)
    );

} catch (error) {

    console.warn(
        "PD memory notification counter unavailable:",
        error
    );

}


/* =========================================================
   READY
========================================================= */

console.log("💜 Princess wa Deib Journey Calendar ready.");