
import {
    auth,
    db
} from "./firebase.js";
import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
/* =========================================================
   PD AUTH GUARD
   ========================================================= */

onAuthStateChanged(auth, (user) => {

    if (!user) {

        window.location.replace("login.html");

        return;

    }

    console.log("❤️ PD user authenticated:", user.email);

});

console.log("❤️ PD Firebase connected!");
console.log("Firebase Auth:", auth);
console.log("Firestore:", db);
import {
    db
} from "./firebase.js";
import {
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    doc,
    updateDoc,
    deleteDoc,
    where
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
/* =========================================================
  
PRINCESS WA DEIB — PD
   MAIN JAVASCRIPT
   ========================================================= */


/* =========================================================
   1. PD SETTINGS
   ========================================================= */

const PD = {

    relationshipStart: "2026-06-26",

    names: {
        deib: "Deib",
        princess: "Princess"
    },

    songs: [
        {
            title: "Your Love Amazes Me",
            artist: "John Berry"
        },
        {
            title: "Perfect",
            artist: "Ed Sheeran"
        },
        {
            title: "A Thousand Years",
            artist: "Christina Perri"
        },
        {
            title: "All of Me",
            artist: "John Legend"
        },
        {
            title: "Until I Found You",
            artist: "Stephen Sanchez"
        },
        {
            title: "Adore You",
            artist: "Harry Styles"
        },
        {
            title: "Die With A Smile",
            artist: "Lady Gaga & Bruno Mars"
        },
        {
            title: "Just the Way You Are",
            artist: "Bruno Mars"
        },
        {
            title: "At Last",
            artist: "Etta James"
        },
        {
            title: "I Won't Give Up",
            artist: "Jason Mraz"
        }
    ]

};


/* =========================================================
   2. START APP
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    initializeApp();

});


function initializeApp() {

    updateDatingCounter();
    initializeNotifications();
    
    initializeChat();

    initializeSettings();

    initializeMemorySystem();

    initializeCalendar();

    initializeNavigation();

    updateCurrentDate();

    setInterval(updateDatingCounter, 60000);

}


/* =========================================================
   3. DATING DAY COUNTER
   ========================================================= */

function calculateDatingDays() {

    const startDate = new Date(PD.relationshipStart + "T00:00:00");

    const today = new Date();

    startDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const difference =
        today.getTime() - startDate.getTime();

    const days =
        Math.floor(
            difference / (1000 * 60 * 60 * 24)
        );

    return Math.max(days, 0);

}

/* =========================================================
   DAYS TOGETHER + SPECIAL MEMORIES
   ========================================================= */

function updateDatingCounter() {

    const startDate =
        new Date("2026-06-26T00:00:00");

    const today =
        new Date();

    startDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);


    const difference =
        today.getTime() -
        startDate.getTime();


    const days =
        Math.max(
            0,
            Math.floor(
                difference /
                (1000 * 60 * 60 * 24)
            )
        );


    /* DAYS TOGETHER */

    document
        .querySelectorAll(
            "[data-days-together], #daysTogether"
        )
        .forEach(element => {

            element.textContent =
                days;

        });


    /* TEXT VERSION */

    document
        .querySelectorAll(
            ".days-together"
        )
        .forEach(element => {

            element.textContent =
                `${days} days, loving each other`;

        });


    /* START DATE */

    document
        .querySelectorAll(
            "[data-start-date]"
        )
        .forEach(element => {

            element.textContent =
                "26 June 2026";

        });


    /*
       Refresh special-memory count
       from Firestore.
    */

    loadSpecialMemoryCount();

}


/* =========================================================
   SPECIAL MEMORY COUNT
   ========================================================= */

async function loadSpecialMemoryCount() {

    const counters =
        document.querySelectorAll(
            "[data-special-memories], #specialMemories"
        );


    if (!counters.length)
        return;


    try {

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "calendarMemories"
                )
            );


        const count =
            snapshot.size;


        counters.forEach(
            element => {

                element.textContent =
                    count;

            }
        );


        console.log(
            "❤️ Special memories:",
            count
        );


    } catch (error) {

        console.error(
            "❌ Could not count memories:",
            error
        );

    }

}

/* =========================================================
   4. DATE FORMAT
   ========================================================= */

function formatDate(dateString) {

    const date = new Date(dateString + "T00:00:00");

    return date.toLocaleDateString(
        "en-GB",
        {
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );

}


function updateCurrentDate() {

    const elements =
        document.querySelectorAll(
            "[data-current-date]"
        );

    const now = new Date();

    elements.forEach(element => {

        element.textContent =
            now.toLocaleDateString(
                "en-GB",
                {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                }
            );

    });

}


/* =========================================================
   5. SONG OF THE DAY
   ========================================================= */

function getTodayKey() {

    const today = new Date();

    return today.toISOString().split("T")[0];

}


function getSongForToday() {

    const todayKey = getTodayKey();

    let hash = 0;

    for (let i = 0; i < todayKey.length; i++) {

        hash =
            todayKey.charCodeAt(i) +
            ((hash << 5) - hash);

    }

    const index =
        Math.abs(hash) % PD.songs.length;

    return PD.songs[index];

}


function loadSongOfTheDay() {

    const song = getSongForToday();

    const titles =
        document.querySelectorAll(
            "[data-song-title]"
        );

    const artists =
        document.querySelectorAll(
            "[data-song-artist]"
        );

    titles.forEach(element => {

        element.textContent =
            song.title;

    });

    artists.forEach(element => {

        element.textContent =
            song.artist;

    });

}


/* =========================================================
   6. SONG PLAY BUTTON
   ========================================================= */

let songPlaying = false;


function initializeSongPlayer() {

    const buttons =
        document.querySelectorAll(
            ".play-btn, .big-play, [data-song-play]"
        );

    buttons.forEach(button => {

        button.addEventListener("click", () => {

            songPlaying = !songPlaying;

            button.innerHTML =
                songPlaying
                    ? '<i class="fa-solid fa-pause"></i>'
                    : '<i class="fa-solid fa-play"></i>';

        });

    });

}


/* =========================================================
   7. LIVE LOVE PIE
   ========================================================= */

/*
   The Love Pie is based on the number of messages
   sent by each person.

   Example:

   Deib = 80 messages
   Princess = 40 messages

   Total = 120

   Deib = 67%
   Princess = 33%

   Firebase updates the pie automatically whenever
   a new message is sent.
*/


let lovePieUnsubscribe = null;


/* =========================================================
   START LIVE LOVE PIE
   ========================================================= */

function initializeLovePie() {

    const pie =
        document.querySelector(".love-pie");

    if (!pie) return;


    /*
       Listen directly to the Firestore messages
       collection.
    */

    const messagesQuery =
        query(
            collection(db, "messages"),
            orderBy("createdAt", "asc")
        );


    /*
       onSnapshot makes the Love Pie LIVE.

       Whenever a message is added,
       this function runs again automatically.
    */

    lovePieUnsubscribe =
        onSnapshot(
            messagesQuery,
            snapshot => {

                let deibMessages = 0;
                let princessMessages = 0;


                snapshot.forEach(
                    documentSnapshot => {

                        const message =
                            documentSnapshot.data();


                        /*
                           Our new chat.js stores
                           senderName as either:

                           "Deib"
                           or
                           "Princess"
                        */

                        if (
                            message.senderName ===
                            "Deib"
                        ) {

                            deibMessages++;

                        }


                        if (
                            message.senderName ===
                            "Princess"
                        ) {

                            princessMessages++;

                        }

                    }
                );


                updateLiveLovePie(
                    deibMessages,
                    princessMessages
                );

            },

            error => {

                console.error(
                    "❌ Love Pie could not load messages:",
                    error
                );

            }
        );

}


/* =========================================================
   CALCULATE LOVE PERCENTAGES
   ========================================================= */

function calculateLovePercentages(
    deibMessages,
    princessMessages
) {

    const total =
        deibMessages +
        princessMessages;


    /*
       No messages yet.
    */

    if (total === 0) {

        return {
            deib: 50,
            princess: 50
        };

    }


    const deib =
        Math.round(
            (deibMessages / total) * 100
        );


    const princess =
        100 - deib;


    return {
        deib,
        princess
    };

}


/* =========================================================
   UPDATE LIVE PIE
   ========================================================= */

function updateLiveLovePie(
    deibMessages,
    princessMessages
) {

    const pie =
        document.querySelector(".love-pie");


    if (!pie) return;


    const percentages =
        calculateLovePercentages(
            deibMessages,
            princessMessages
        );


    const princessDegrees =
        percentages.princess * 3.6;


    /*
       Purple = Princess
       Pink = Deib
    */

    pie.style.background =
        `conic-gradient(
            #a85cff 0deg ${princessDegrees}deg,
            #f238a9 ${princessDegrees}deg 360deg
        )`;


    /*
       Update numbers.
    */

    const deibPercent =
        document.querySelector(
            "[data-deib-percent]"
        );


    const princessPercent =
        document.querySelector(
            "[data-princess-percent]"
        );


    if (deibPercent) {

        deibPercent.textContent =
            `${percentages.deib}%`;

    }


    if (princessPercent) {

        princessPercent.textContent =
            `${percentages.princess}%`;

    }


    /*
       Optional live statistics.
       If these elements exist in the HTML,
       they will automatically update.
    */

    const deibCount =
        document.querySelector(
            "[data-deib-messages]"
        );


    const princessCount =
        document.querySelector(
            "[data-princess-messages]"
        );


    if (deibCount) {

        deibCount.textContent =
            deibMessages;

    }


    if (princessCount) {

        princessCount.textContent =
            princessMessages;

    }


    console.log(
        "❤️ LIVE LOVE PIE:",
        {
            deibMessages,
            princessMessages,
            deibPercent:
                percentages.deib,
            princessPercent:
                percentages.princess
        }
    );

}

/* =========================================================
   8. LOVE PIE — TEXT ANALYSIS
   ========================================================= */

/*
   This is only a simple front-end estimate.

   Later Firebase will provide the actual messages
   from both people.
*/

function analyzeLoveFromMessages(messages) {

    if (!messages || messages.length === 0) {

        return getLoveData();

    }


    let deibPoints = 0;
    let princessPoints = 0;


    messages.forEach(message => {

        const text =
            message.text.toLowerCase();


        const points =
            calculateMessageLovePoints(text);


        if (message.sender === "deib") {

            deibPoints += points;

        } else {

            princessPoints += points;

        }

    });


    const total =
        deibPoints + princessPoints;


    if (total === 0) {

        return {
            deib: 50,
            princess: 50
        };

    }


    const deibPercentage =
        Math.round(
            (deibPoints / total) * 100
        );


    return {

        deib: deibPercentage,

        princess:
            100 - deibPercentage

    };

}


function calculateMessageLovePoints(text) {

    let points = 1;


    const loveWords = [

        "love",
        "baby",
        "princess",
        "deib",
        "miss you",
        "miss",
        "beautiful",
        "handsome",
        "kiss",
        "heart",
        "forever",
        "always",
        "darling",
        "sweetheart",
        "honey",
        "my love",
        "my queen",
        "my king"

    ];


    loveWords.forEach(word => {

        if (text.includes(word)) {

            points += 2;

        }

    });


    const hearts =
        (text.match(/❤️|💕|💗|💖|💓|💞|💘|💝|😍|🥰/g) || [])
            .length;


    points += hearts;


    return points;

}


/* =========================================================
   9. CHAT SYSTEM
   ========================================================= */

function initializeChat() {

    const input =
        document.querySelector(".chat-input input");

    const sendButton =
        document.querySelector(".send-message");

    if (!input || !sendButton) return;


    loadFirestoreMessages();


    sendButton.addEventListener(
        "click",
        () => sendMessage()
    );


    input.addEventListener(
        "keydown",
        event => {

            if (event.key === "Enter") {

                event.preventDefault();

                sendMessage();

            }

        }
    );

}
function loadFirestoreMessages() {

    const container =
        document.querySelector(".chat-messages");

    if (!container) return;


    const messagesQuery = query(
        collection(db, "messages"),
        orderBy("createdAt", "asc")
    );


    onSnapshot(
        messagesQuery,
        snapshot => {

            container.innerHTML = "";

            snapshot.forEach(doc => {

                const message = {
                    id: doc.id,
                    ...doc.data()
                };

                displayMessage(message);

            });

            scrollChatToBottom();

        },
        error => {

            console.error(
                "❌ Could not load messages:",
                error
            );

        }
    );

}

async function sendMessage() {

    const input =
        document.querySelector(".chat-input input");

    if (!input) return;

    const text =
        input.value.trim();

    if (!text) return;

    try {

        await addDoc(collection(db, "messages"), {

            sender: "deib",

            text: text,

            createdAt: serverTimestamp()

        });

        input.value = "";

    } catch (error) {

        console.error(
            "❌ Could not send message:",
            error
        );

    }

}


function saveLocalMessage(message) {

    const messages =
        getLocalMessages();

    messages.push(message);

    localStorage.setItem(
        "pdMessages",
        JSON.stringify(messages)
    );

}


function getLocalMessages() {

    const saved =
        localStorage.getItem(
            "pdMessages"
        );

    if (!saved) return [];

    try {

        return JSON.parse(saved);

    } catch {

        return [];

    }

}


function loadLocalMessages() {

    const messages =
        getLocalMessages();

    messages.forEach(
        message => displayMessage(message)
    );

    scrollChatToBottom();

}


function displayMessage(message) {

    const container =
        document.querySelector(
            ".chat-messages"
        );

    if (!container) return;


    const bubble =
        document.createElement("div");


    bubble.className =
        message.sender === "deib"
            ? "message sent"
            : "message received";


    const text =
        document.createElement("div");


    text.textContent =
        message.text;


    const time =
        document.createElement("span");


    if (message.createdAt) {

    const date =
        message.createdAt.toDate();

    time.textContent =
        date.toLocaleTimeString(
            [],
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );

} else {

    time.textContent = "";

}


    bubble.appendChild(text);

    bubble.appendChild(time);

    container.appendChild(bubble);

}


function scrollChatToBottom() {

    const chat =
        document.querySelector(
            ".chat-messages"
        );

    if (!chat) return;


    setTimeout(() => {

        chat.scrollTop =
            chat.scrollHeight;

    }, 50);

}


/* =========================================================
   10. EMOJI BUTTON
   ========================================================= */

function initializeEmojiButton() {

    const button =
        document.querySelector(
            "[data-emoji]"
        );

    const input =
        document.querySelector(
            ".chat-input input"
        );

    if (!button || !input) return;


    button.addEventListener(
        "click",
        () => {

            input.value += " ❤️";

            input.focus();

        }
    );

}


/* =========================================================
   11. SETTINGS
   ========================================================= */

function initializeSettings() {

    const switches =
        document.querySelectorAll(
            ".switch input"
        );


    switches.forEach(toggle => {

        toggle.addEventListener(
            "change",
            () => {

                localStorage.setItem(
                    `pdSetting_${toggle.id}`,
                    toggle.checked
                );

            }
        );


        const saved =
            localStorage.getItem(
                `pdSetting_${toggle.id}`
            );


        if (saved !== null) {

            toggle.checked =
                saved === "true";

        }

    });

}


/* =========================================================
   12. MEMORY SYSTEM
   ========================================================= */

function initializeMemorySystem() {

    loadMemories();

    const addButton =
        document.querySelector(
            ".add-memory"
        );

    const fileInput =
        document.querySelector(
            "#memoryFile"
        );


    if (!addButton || !fileInput) return;


    addButton.addEventListener(
        "click",
        () => fileInput.click()
    );


    fileInput.addEventListener(
        "change",
        event => {

            const file =
                event.target.files[0];


            if (!file) return;


            createMemory(file);

        }
    );

}


function getMemories() {

    const saved =
        localStorage.getItem(
            "pdMemories"
        );

    if (!saved) return [];

    try {

        return JSON.parse(saved);

    } catch {

        return [];

    }

}


function saveMemories(memories) {

    localStorage.setItem(
        "pdMemories",
        JSON.stringify(memories)
    );

}


function createMemory(file) {

    const reader =
        new FileReader();


    reader.onload = event => {

        const memories =
            getMemories();


        memories.push({

            id:
                Date.now(),

            image:
                event.target.result,

            title:
                "Our Memory",

            date:
                new Date().toLocaleDateString(
                    "en-GB"
                )

        });


        saveMemories(memories);

        loadMemories();

    };


    reader.readAsDataURL(file);

}


function loadMemories() {

    const grid =
        document.querySelector(
            ".memory-grid"
        );

    if (!grid) return;


    const memories =
        getMemories();


    memories.forEach(memory => {

        const card =
            document.createElement("div");


        card.className =
            "memory-card";


        card.innerHTML = `

            <div class="memory-image">

                <img
                    src="${memory.image}"
                    alt="Our memory"
                >

            </div>

            <div class="memory-caption">

                ${escapeHTML(memory.title)}

                <span>
                    ${memory.date}
                </span>

            </div>

        `;


        grid.insertBefore(
            card,
            grid.querySelector(".add-memory")
        );

    });

}

/*
   Shared relationship calendar.

   Every memory is stored in:

   Firestore
   └── calendarMemories
*/


let calendarDate = new Date();

let calendarMemories = [];

let selectedMemoryDate = null;

let calendarUnsubscribe = null;


/* =========================================================
   EVENT TYPES
   ========================================================= */

const MEMORY_ICONS = {

    love: "❤️",

    date: "🌹",

    song: "🎵",

    memory: "📸",

    gift: "🎁",

    conversation: "💬",

    celebration: "🎉",

    other: "⭐"

};


/* =========================================================
   INITIALIZE CALENDAR
   ========================================================= */

function initializeCalendar() {

    const calendar =
        document.querySelector("[data-calendar]");

    /*
       If this isn't the calendar page,
       don't run calendar code.
    */

    if (!calendar) return;


    renderCalendar();

    initializeCalendarButtons();

    initializeMemoryModal();

    startFirestoreCalendar();

    updateJourneyDays();

}


/* =========================================================
   CALENDAR BUTTONS
   ========================================================= */

function initializeCalendarButtons() {

    const previous =
        document.querySelector(
            "[data-calendar-prev]"
        );

    const next =
        document.querySelector(
            "[data-calendar-next]"
        );


    if (previous) {

        previous.addEventListener(
            "click",
            () => {

                calendarDate.setMonth(
                    calendarDate.getMonth() - 1
                );

                renderCalendar();

            }
        );

    }


    if (next) {

        next.addEventListener(
            "click",
            () => {

                calendarDate.setMonth(
                    calendarDate.getMonth() + 1
                );

                renderCalendar();

            }
        );

    }

}


/* =========================================================
   RENDER CALENDAR
   ========================================================= */

function renderCalendar() {

    const calendar =
        document.querySelector(
            "[data-calendar]"
        );


    if (!calendar) return;


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


    const monthTitle =
        document.querySelector(
            "[data-calendar-title]"
        );


    if (monthTitle) {

        monthTitle.textContent =
            new Date(
                year,
                month
            ).toLocaleDateString(
                "en-US",
                {
                    month: "long",
                    year: "numeric"
                }
            );

    }


    calendar.innerHTML = "";


    /*
       Empty spaces before day 1.
    */

    for (
        let i = 0;
        i < firstDay;
        i++
    ) {

        const blank =
            document.createElement(
                "div"
            );

        blank.className =
            "calendar-empty";

        calendar.appendChild(blank);

    }


    /*
       Actual days.
    */

    for (
        let day = 1;
        day <= daysInMonth;
        day++
    ) {

        const cell =
            document.createElement(
                "button"
            );


        cell.className =
            "calendar-day";


        const dateKey =
            formatCalendarKey(
                year,
                month,
                day
            );


        cell.dataset.date =
            dateKey;


        /*
           Relationship start.
        */

        if (
            dateKey ===
            PD.relationshipStart
        ) {

            cell.classList.add(
                "relationship-start"
            );

        }


        /*
           Today.
        */

        const today =
            new Date();


        const todayKey =
            formatCalendarKey(
                today.getFullYear(),
                today.getMonth(),
                today.getDate()
            );


        if (
            dateKey === todayKey
        ) {

            cell.classList.add(
                "today"
            );

        }


        /*
           Find memories for this date.
        */

        const memories =
            calendarMemories.filter(
                memory =>
                    memory.date === dateKey
            );


        /*
           Day number.
        */

        const number =
            document.createElement(
                "span"
            );

        number.className =
            "calendar-day-number";

        number.textContent =
            day;

        cell.appendChild(number);


        /*
           Relationship start marker.
        */

        if (
            dateKey ===
            PD.relationshipStart
        ) {

            const marker =
                document.createElement(
                    "span"
                );

            marker.className =
                "calendar-marker";

            marker.textContent =
                "💜";

            cell.appendChild(marker);

        }


        /*
           Memory markers.
        */

        memories.forEach(
            memory => {

                const marker =
                    document.createElement(
                        "span"
                    );

                marker.className =
                    "calendar-marker";

                marker.textContent =
                    MEMORY_ICONS[
                        memory.type
                    ] || "⭐";

                cell.appendChild(
                    marker
                );

            }
        );


        /*
           Clicking a day opens the
           memory form.
        */

        cell.addEventListener(
            "click",
            () => {

                openMemoryModal(
                    dateKey
                );

            }
        );


        calendar.appendChild(
            cell
        );

    }

}


/* =========================================================
   DATE KEY
   ========================================================= */

function formatCalendarKey(
    year,
    month,
    day
) {

    return `${year}-${String(
        month + 1
    ).padStart(2, "0")}-${String(
        day
    ).padStart(2, "0")}`;

}


/* =========================================================
   FIRESTORE LISTENER
   ========================================================= */

function startFirestoreCalendar() {

    const memoriesRef =
        collection(
            db,
            "calendarMemories"
        );


    const memoriesQuery =
        query(
            memoriesRef,
            orderBy(
                "date",
                "asc"
            )
        );


    calendarUnsubscribe =
        onSnapshot(
            memoriesQuery,
            snapshot => {

                calendarMemories = [];


                snapshot.forEach(
                    memoryDoc => {

                        calendarMemories.push({

                            id:
                                memoryDoc.id,

                            ...memoryDoc.data()

                        });

                    }
                );


                renderCalendar();

                renderMemoryList();

                updateMemoryCount();

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
   OPEN MEMORY MODAL
   ========================================================= */

function openMemoryModal(
    dateKey
) {

    const modal =
        document.querySelector(
            "#memoryModal"
        );


    if (!modal) return;


    selectedMemoryDate =
        dateKey;


    const dateDisplay =
        document.querySelector(
            "#selectedMemoryDate"
        );


    if (dateDisplay) {

        dateDisplay.textContent =
            formatPrettyDate(
                dateKey
            );

    }


    /*
       Clear old form values.
    */

    const title =
        document.querySelector(
            "#memoryTitle"
        );

    const note =
        document.querySelector(
            "#memoryNote"
        );

    const type =
        document.querySelector(
            "#memoryType"
        );


    if (title)
        title.value = "";

    if (note)
        note.value = "";

    if (type)
        type.value = "love";


    modal.classList.add(
        "show"
    );

}


/* =========================================================
   MEMORY MODAL CONTROLS
   ========================================================= */

function initializeMemoryModal() {

    const addButton =
        document.querySelector(
            "#addMemoryBtn"
        );

    const modal =
        document.querySelector(
            "#memoryModal"
        );

    const closeButton =
        document.querySelector(
            "#closeMemoryModal"
        );

    const saveButton =
        document.querySelector(
            "#saveMemoryBtn"
        );


    if (addButton) {

        addButton.addEventListener(
            "click",
            () => {

                /*
                   Default to today.
                */

                const today =
                    new Date();

                const todayKey =
                    formatCalendarKey(
                        today.getFullYear(),
                        today.getMonth(),
                        today.getDate()
                    );


                openMemoryModal(
                    todayKey
                );

            }
        );

    }


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            closeMemoryModal
        );

    }


    if (modal) {

        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target === modal
                ) {

                    closeMemoryModal();

                }

            }
        );

    }


    if (saveButton) {

        saveButton.addEventListener(
            "click",
            saveCalendarMemory
        );

    }

}


/* =========================================================
   CLOSE MODAL
   ========================================================= */

function closeMemoryModal() {

    const modal =
        document.querySelector(
            "#memoryModal"
        );


    if (modal) {

        modal.classList.remove(
            "show"
        );

    }

}


/* =========================================================
   SAVE MEMORY
   ========================================================= */

async function saveCalendarMemory() {

    if (!selectedMemoryDate) {

        alert(
            "Please choose a date."
        );

        return;

    }


    const title =
        document.querySelector(
            "#memoryTitle"
        )?.value.trim();


    const note =
        document.querySelector(
            "#memoryNote"
        )?.value.trim();


    const type =
        document.querySelector(
            "#memoryType"
        )?.value;


    if (!title) {

        alert(
            "Please give this memory a title ❤️"
        );

        return;

    }


    const user =
        auth.currentUser;


    if (!user) {

        alert(
            "Please log in first."
        );

        return;

    }


    const saveButton =
        document.querySelector(
            "#saveMemoryBtn"
        );


    if (saveButton) {

        saveButton.disabled = true;

        saveButton.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    }


    try {

        await addDoc(
            collection(
                db,
                "calendarMemories"
            ),
            {

                date:
                    selectedMemoryDate,

                type:
                    type || "other",

                title:
                    title,

                note:
                    note || "",

                createdBy:
                    user.uid,

                createdByEmail:
                    user.email || "",

                createdAt:
                    serverTimestamp()

            }
        );


        closeMemoryModal();


    } catch (error) {

        console.error(
            "❌ Could not save memory:",
            error
        );


        alert(
            "The memory could not be saved. Please try again."
        );

    }


    if (saveButton) {

        saveButton.disabled = false;

        saveButton.innerHTML =
            '<i class="fa-solid fa-heart"></i> Save Memory';

    }

}


/* =========================================================
   MEMORY LIST
   ========================================================= */

function renderMemoryList() {

    const container =
        document.querySelector(
            "#calendarMemoryList"
        );


    if (!container) return;


    container.innerHTML = "";


    if (
        calendarMemories.length === 0
    ) {

        container.innerHTML = `
            <p class="empty-memory">
                Your special moments
                will appear here ❤️
            </p>
        `;

        return;

    }


    /*
       Newest dates first.
    */

    const memories =
        [...calendarMemories]
            .sort(
                (a, b) =>
                    b.date.localeCompare(
                        a.date
                    )
            );


    memories.forEach(
        memory => {

            const card =
                document.createElement(
                    "article"
                );

            card.className =
                "journey-memory";


            const icon =
                MEMORY_ICONS[
                    memory.type
                ] || "⭐";


            card.innerHTML = `

                <div class="journey-memory-icon">
                    ${icon}
                </div>

                <div class="journey-memory-content">

                    <small>
                        ${formatPrettyDate(memory.date)}
                    </small>

                    <h4>
                        ${escapeHTML(memory.title)}
                    </h4>

                    ${
                        memory.note
                            ? `
                                <p>
                                    ${escapeHTML(memory.note)}
                                </p>
                              `
                            : ""
                    }

                </div>

            `;


            container.appendChild(
                card
            );

        }
    );

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
            calendarMemories.length;

    }

}


/* =========================================================
   JOURNEY DAYS
   ========================================================= */

function updateJourneyDays() {

    const counter =
        document.querySelector(
            "#journeyDays"
        );


    if (!counter) return;


    counter.textContent =
        calculateDatingDays();

}


/* =========================================================
   PRETTY DATE
   ========================================================= */

function formatPrettyDate(
    dateString
) {

    const date =
        new Date(
            dateString + "T00:00:00"
        );


    return date.toLocaleDateString(
        "en-GB",
        {
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );

}

/* =========================================================
   14. NAVIGATION
   ========================================================= */

function initializeNavigation() {

    const links =
        document.querySelectorAll(
            "[data-page]"
        );


    links.forEach(link => {

        link.addEventListener(
            "click",
            event => {

                const page =
                    link.dataset.page;


                if (!page) return;


                /*
                   If the element is a normal link,
                   don't interfere with it.
                */

                if (
                    link.tagName.toLowerCase() ===
                    "a"
                ) {

                    return;

                }


                event.preventDefault();

                navigateTo(page);

            }
        );

    });

}


function navigateTo(page) {

    window.location.href =
        page;

}


/* =========================================================
   15. BACK BUTTON
   ========================================================= */

function goBack() {

    if (
        window.history.length > 1
    ) {

        window.history.back();

    } else {

        window.location.href =
            "index.html";

    }

}


/* =========================================================
   16. ESCAPE HTML
   ========================================================= */

function escapeHTML(text) {

    const div =
        document.createElement("div");

    div.textContent =
        text;

    return div.innerHTML;

}

/* =========================================================
   17. PD NOTIFICATION SYSTEM
   ========================================================= */

const PD_NOTIFICATIONS = {
    chat: "pdChatNotifications",
    memories: "pdMemoryNotifications"
};


/* =========================================================
   GET NOTIFICATION COUNT
   ========================================================= */

function getNotificationCount(type) {

    return parseInt(
        localStorage.getItem(
            PD_NOTIFICATIONS[type]
        ) || "0",
        10
    );

}


/* =========================================================
   SET NOTIFICATION COUNT
   ========================================================= */

function setNotificationCount(type, count) {

    localStorage.setItem(
        PD_NOTIFICATIONS[type],
        Math.max(0, count)
    );

    updateNotificationBadges();

}


/* =========================================================
   ADD NOTIFICATION
   ========================================================= */

function addNotification(type) {

    const current =
        getNotificationCount(type);

    setNotificationCount(
        type,
        current + 1
    );

}


/* =========================================================
   CLEAR NOTIFICATIONS
   ========================================================= */

function clearNotifications(type) {

    setNotificationCount(
        type,
        0
    );

}


/* =========================================================
   UPDATE BADGES
   ========================================================= */

function updateNotificationBadges() {

    const chatCount =
        getNotificationCount("chat");

    const memoryCount =
        getNotificationCount("memories");


    /* -----------------------------
       CHAT BADGES
       ----------------------------- */

    document
        .querySelectorAll(".notification")
        .forEach(badge => {

            if (chatCount <= 0) {

                badge.style.display = "none";

            } else {

                badge.style.display = "flex";

                badge.textContent =
                    chatCount > 99
                        ? "99+"
                        : chatCount;

            }

        });


    /* -----------------------------
       MEMORY BADGES
       ----------------------------- */

    document
        .querySelectorAll("[data-memory-notification]")
        .forEach(badge => {

            if (memoryCount <= 0) {

                badge.style.display = "none";

            } else {

                badge.style.display = "flex";

                badge.textContent =
                    memoryCount > 99
                        ? "99+"
                        : memoryCount;

            }

        });

}


/* =========================================================
   CLEAR CHAT NOTIFICATIONS WHEN CHAT OPENS
   ========================================================= */

function initializeChatNotifications() {

    if (
        window.location.pathname
            .toLowerCase()
            .includes("chat.html")
    ) {

        clearNotifications("chat");

    }

}


/* =========================================================
   CLEAR MEMORY NOTIFICATIONS
   ========================================================= */

function initializeMemoryNotifications() {

    if (
        window.location.pathname
            .toLowerCase()
            .includes("calendar.html")
    ) {

        clearNotifications("memories");

    }

}


/* =========================================================
   INITIALIZE NOTIFICATIONS
   ========================================================= */

function initializeNotifications() {

    updateNotificationBadges();

    initializeChatNotifications();

    initializeMemoryNotifications();

}


/* =========================================================
   EXPOSE NOTIFICATION FUNCTIONS
   ========================================================= */

window.PD.notifications = {

    get: getNotificationCount,

    add: addNotification,

    clear: clearNotifications,

    update: updateNotificationBadges

};




function updateChatNotification(count) {

    const notification =
        document.querySelector(
            ".notification"
        );

    if (!notification) return;


    if (count <= 0) {

        notification.style.display =
            "none";

        return;

    }


    notification.style.display =
        "flex";


    notification.textContent =
        count > 99
            ? "99+"
            : count;

}





/* =========================================================
   19. INITIALIZE EXTRA FEATURES
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeSongPlayer();

        initializeEmojiButton();

        

    }
);


/* =========================================================
   20. EXPOSE USEFUL FUNCTIONS
   ========================================================= */


window.PD = {

    calculateDatingDays,
    updateDatingCounter,
    getSongForToday,

    getLoveData,
    saveLoveData,
    updateLovePie,
    analyzeLoveFromMessages,

    sendMessage,

    goBack,
    navigateTo,

    getMemories,
    saveMemories,

    notifications: {

        get: getNotificationCount,
        add: addNotification,
        clear: clearNotifications,
        update: updateNotificationBadges

    }

};

/* =========================================================
   PD CHAT NOTIFICATIONS
   ========================================================= */

import {
    collection,
    query,
    orderBy,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import {
    auth,
    db
} from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";


let lastSeenMessageTime =
    Number(localStorage.getItem("pdLastSeenMessageTime") || 0);


/* =========================================================
   WATCH NEW CHAT MESSAGES
   ========================================================= */

function startChatNotifications() {

    const notification =
        document.getElementById("chatNotification");

    if (!notification) return;


    onAuthStateChanged(auth, user => {

        if (!user) return;


        const messagesQuery =
            query(
                collection(db, "messages"),
                orderBy("createdAt", "asc")
            );


        onSnapshot(messagesQuery, snapshot => {

            let unread = 0;


            snapshot.forEach(messageDoc => {

                const message =
                    messageDoc.data();


                /* Ignore your own messages */

                if (
                    message.senderUID === user.uid
                ) {
                    return;
                }


                if (!message.createdAt) {
                    return;
                }


                const messageTime =
                    message.createdAt.toMillis();


                if (
                    messageTime >
                    lastSeenMessageTime
                ) {

                    unread++;

                }

            });


            if (unread > 0) {

                notification.textContent =
                    unread > 99
                        ? "99+"
                        : unread;

                notification.style.display =
                    "flex";

            } else {

                notification.style.display =
                    "none";

            }

        });

    });

}


/* =========================================================
   MARK CHAT AS READ
   ========================================================= */

function markChatAsRead() {

    onAuthStateChanged(auth, user => {

        if (!user) return;


        const messagesQuery =
            query(
                collection(db, "messages"),
                orderBy("createdAt", "desc")
            );


        const unsubscribe =
            onSnapshot(
                messagesQuery,
                snapshot => {

                    let newestTime =
                        lastSeenMessageTime;


                    snapshot.forEach(messageDoc => {

                        const message =
                            messageDoc.data();


                        if (!message.createdAt)
                            return;


                        const time =
                            message.createdAt.toMillis();


                        if (time > newestTime) {

                            newestTime = time;

                        }

                    });


                    if (newestTime > 0) {

                        localStorage.setItem(
                            "pdLastSeenMessageTime",
                            newestTime
                        );

                    }


                    unsubscribe();

                }
            );

    });

}


/* =========================================================
   START NOTIFICATIONS
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        startChatNotifications();

    }
);