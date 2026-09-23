
/* =========================================================
   PD — OUR JOURNEY CALENDAR
   FINAL FIRESTORE VERSION
   ========================================================= */

import { db } from "./firebase.js";

import {
    collection,
    addDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp
} from
"https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


/* =========================================================
   SETTINGS
   ========================================================= */

const RELATIONSHIP_START = "2026-06-26";

let calendarDate = new Date();

let memories = [];

let selectedDate = null;


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupCalendar();

        setupMemoryPopup();

        loadMemories();

    }
);


/* =========================================================
   FIRESTORE — REAL TIME
   ========================================================= */

function loadMemories() {

    const memoriesRef =
        collection(
            db,
            "calendarMemories"
        );


    const memoriesQuery =
        query(
            memoriesRef,
            orderBy("date", "asc")
        );


    onSnapshot(
        memoriesQuery,

        snapshot => {

            memories = [];

            snapshot.forEach(
                item => {

                    memories.push({
                        id: item.id,
                        ...item.data()
                    });

                }
            );


            updateMemoryCount();

            renderCalendar();

            renderMemoryList();


            console.log(
                "❤️ Calendar memories:",
                memories.length
            );

        },

        error => {

            console.error(
                "❌ Calendar error:",
                error
            );

        }
    );

}


/* =========================================================
   CALENDAR SETUP
   ========================================================= */

function setupCalendar() {

    document
        .querySelector(
            "[data-calendar-prev]"
        )
        ?.addEventListener(
            "click",
            () => {

                calendarDate.setMonth(
                    calendarDate.getMonth() - 1
                );

                renderCalendar();

            }
        );


    document
        .querySelector(
            "[data-calendar-next]"
        )
        ?.addEventListener(
            "click",
            () => {

                calendarDate.setMonth(
                    calendarDate.getMonth() + 1
                );

                renderCalendar();

            }
        );


    document
        .querySelector(
            "#addMemoryBtn"
        )
        ?.addEventListener(
            "click",
            () => {

                const today =
                    new Date();

                const date =
                    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

                openMemoryForm(date);

            }
        );

}


/* =========================================================
   RENDER CALENDAR
   ========================================================= */

function renderCalendar() {

    const calendar =
        document.querySelector(
            "[data-calendar]"
        );


    if (!calendar)
        return;


    const year =
        calendarDate.getFullYear();


    const month =
        calendarDate.getMonth();


    const firstDay =
        new Date(
            year,
            month,
            1
        ).getDay();


    const daysInMonth =
        new Date(
            year,
            month + 1,
            0
        ).getDate();


    const title =
        document.querySelector(
            "[data-calendar-title]"
        );


    if (title) {

        title.textContent =
            new Date(
                year,
                month,
                1
            ).toLocaleDateString(
                "en-US",
                {
                    month: "long",
                    year: "numeric"
                }
            );

    }


    calendar.innerHTML = "";


    /* EMPTY CELLS */

    for (
        let i = 0;
        i < firstDay;
        i++
    ) {

        const empty =
            document.createElement(
                "div"
            );

        empty.className =
            "calendar-empty";

        calendar.appendChild(
            empty
        );

    }


    /* DAYS */

    for (
        let day = 1;
        day <= daysInMonth;
        day++
    ) {

        const dateString =
            `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;


        const button =
            document.createElement(
                "button"
            );


        button.type = "button";

        button.className =
            "calendar-day";


        const memory =
            memories.find(
                item =>
                    item.date ===
                    dateString
            );


        /* RELATIONSHIP START */

        if (
            dateString ===
            RELATIONSHIP_START
        ) {

            button.classList.add(
                "relationship-start"
            );

        }


        /* SPECIAL MEMORY */

        if (memory) {

            button.classList.add(
                "has-memory"
            );

        }


        const number =
            document.createElement(
                "span"
            );

        number.className =
            "calendar-number";

        number.textContent =
            day;


        button.appendChild(
            number
        );


        /* MEMORY ICON */

        if (memory) {

            const icon =
                document.createElement(
                    "span"
                );

            icon.className =
                "calendar-memory-icon";

            icon.textContent =
                getIcon(memory.type);

            button.appendChild(
                icon
            );

        }


        /* CLICK */

        button.addEventListener(
            "click",
            () => {

                const latestMemory =
                    memories.find(
                        item =>
                            item.date ===
                            dateString
                    );


                if (latestMemory) {

                    showMemory(
                        latestMemory
                    );

                } else {

                    openMemoryForm(
                        dateString
                    );

                }

            }
        );


        calendar.appendChild(
            button
        );

    }

}


/* =========================================================
   MEMORY ICON
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
   MEMORY POPUP
   ========================================================= */

function setupMemoryPopup() {

    document
        .querySelector(
            "[data-close-memory]"
        )
        ?.addEventListener(
            "click",
            closePopup
        );


    document
        .querySelector(
            "[data-cancel-memory]"
        )
        ?.addEventListener(
            "click",
            closePopup
        );


    document
        .querySelector(
            "#memoryForm"
        )
        ?.addEventListener(
            "submit",
            saveMemory
        );

}


/* =========================================================
   OPEN ADD FORM
   ========================================================= */

function openMemoryForm(date) {

    selectedDate =
        date;


    const popup =
        document.querySelector(
            ".memory-popup-overlay"
        );


    const form =
        document.querySelector(
            "#memoryForm"
        );


    const view =
        document.querySelector(
            "#memoryView"
        );


    if (!popup || !form || !view)
        return;


    form.reset();


    document
        .querySelector(
            "#memoryDate"
        )
        .textContent =
        formatDate(date);


    form.style.display =
        "block";


    view.style.display =
        "none";


    popup.classList.add(
        "active"
    );

}


/* =========================================================
   SHOW MEMORY
   ========================================================= */

function showMemory(memory) {

    const popup =
        document.querySelector(
            ".memory-popup-overlay"
        );


    const form =
        document.querySelector(
            "#memoryForm"
        );


    const view =
        document.querySelector(
            "#memoryView"
        );


    if (!popup || !view)
        return;


    form.style.display =
        "none";


    view.style.display =
        "block";


    document
        .querySelector(
            "#memoryDate"
        )
        .textContent =
        formatDate(
            memory.date
        );


    document
        .querySelector(
            "#viewMemoryIcon"
        )
        .textContent =
        getIcon(
            memory.type
        );


    document
        .querySelector(
            "#viewMemoryEvent"
        )
        .textContent =
        memory.title ||
        memory.event ||
        "Special Day ❤️";


    const note =
        document.querySelector(
            "#viewMemoryNote"
        );


    note.textContent =
        memory.note ||
        "No memory note was added.";


    note.style.display =
        "block";


    const deleteButton =
        document.querySelector(
            "[data-delete-memory]"
        );


    if (deleteButton) {

        deleteButton.onclick =
            () => deleteMemory(
                memory.id
            );

    }


    popup.classList.add(
        "active"
    );

}


/* =========================================================
   SAVE MEMORY
   ========================================================= */

async function saveMemory(event) {

    event.preventDefault();


    if (!selectedDate)
        return;


    const title =
        document
            .querySelector(
                "#memoryEvent"
            )
            .value
            .trim();


    const type =
        document
            .querySelector(
                "#memoryType"
            )
            .value;


    const note =
        document
            .querySelector(
                "#memoryNote"
            )
            .value
            .trim();


    if (!title) {

        alert(
            "Please enter what happened ❤️"
        );

        return;

    }


    try {

        const saveButton =
            document.querySelector(
                "#saveMemoryButton"
            );


        if (saveButton) {

            saveButton.disabled =
                true;

        }


        await addDoc(
            collection(
                db,
                "calendarMemories"
            ),
            {

                date:
                    selectedDate,

                title:
                    title,

                event:
                    title,

                type:
                    type,

                note:
                    note,

                createdAt:
                    serverTimestamp()

            }
        );


        closePopup();


    } catch (error) {

        console.error(
            "❌ Save failed:",
            error
        );


        alert(
            "Could not save this memory."
        );

    }

}


/* =========================================================
   DELETE MEMORY
   ========================================================= */

async function deleteMemory(id) {

    if (
        !confirm(
            "Delete this special memory? ❤️"
        )
    )
        return;


    try {

        await deleteDoc(
            doc(
                db,
                "calendarMemories",
                id
            )
        );


        closePopup();


    } catch (error) {

        console.error(
            "❌ Delete failed:",
            error
        );

    }

}


/* =========================================================
   MEMORY COUNT
   ========================================================= */

function updateMemoryCount() {

    const counter =
        document.querySelector(
            "#memoryCount"
        );


    if (counter) {

        counter.textContent =
            memories.length;

    }

}


/* =========================================================
   DAYS TOGETHER
   ========================================================= */

function updateJourneyDays() {

    const start =
        new Date(
            RELATIONSHIP_START +
            "T00:00:00"
        );


    const today =
        new Date();


    start.setHours(
        0, 0, 0, 0
    );


    today.setHours(
        0, 0, 0, 0
    );


    const difference =
        today.getTime() -
        start.getTime();


    const days =
        Math.max(
            0,
            Math.floor(
                difference /
                86400000
            )
        );


    const element =
        document.querySelector(
            "#journeyDays"
        );


    if (element) {

        element.textContent =
            days;

    }

}


/* =========================================================
   MEMORY LIST
   ========================================================= */

function renderMemoryList() {

    const list =
        document.querySelector(
            "#calendarMemoryList"
        );


    if (!list)
        return;


    list.innerHTML = "";


    if (
        memories.length === 0
    ) {

        list.innerHTML = `
            <p class="empty-memory">
                Your special moments
                will appear here ❤️
            </p>
        `;

        return;

    }


    memories
        .slice()
        .reverse()
        .forEach(
            memory => {

                const item =
                    document.createElement(
                        "button"
                    );


                item.type =
                    "button";


                item.className =
                    "calendar-memory-item";


                item.innerHTML = `

                    <span class="memory-list-icon">
                        ${getIcon(memory.type)}
                    </span>

                    <span class="memory-list-content">

                        <strong>
                            ${escapeHTML(
                                memory.title ||
                                memory.event ||
                                "Special Day"
                            )}
                        </strong>

                        <small>
                            ${formatDate(memory.date)}
                        </small>

                    </span>

                    <i class="fa-solid fa-chevron-right"></i>

                `;


                item.addEventListener(
                    "click",
                    () => {

                        showMemory(
                            memory
                        );

                    }
                );


                list.appendChild(
                    item
                );

            }
        );

}


/* =========================================================
   CLOSE
   ========================================================= */

function closePopup() {

    document
        .querySelector(
            ".memory-popup-overlay"
        )
        ?.classList.remove(
            "active"
        );

}


/* =========================================================
   DATE FORMAT
   ========================================================= */

function formatDate(date) {

    return new Date(
        date +
        "T00:00:00"
    ).toLocaleDateString(
        "en-GB",
        {
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );

}


/* =========================================================
   ESCAPE
   ========================================================= */

function escapeHTML(text) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        text;

    return div.innerHTML;

}


/* =========================================================
   UPDATE DAYS
   ========================================================= */

updateJourneyDays();

setInterval(
    updateJourneyDays,
    60000
);
const current =
    parseInt(
        localStorage.getItem(
            "pdMemoryNotifications"
        ) || "0",
        10
    );

localStorage.setItem(
    "pdMemoryNotifications",
    current + 1
);