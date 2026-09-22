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
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
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

    loadSongOfTheDay();

    initializeLovePie();

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


function updateDatingCounter() {

    const days = calculateDatingDays();

    const counters =
        document.querySelectorAll(
            "[data-days-together]"
        );

    counters.forEach(counter => {

        counter.textContent = days;

    });


    const textCounters =
        document.querySelectorAll(
            ".days-together"
        );

    textCounters.forEach(element => {

        element.textContent =
            `${days} days, loving each other`;

    });


    const dateElements =
        document.querySelectorAll(
            "[data-start-date]"
        );

    dateElements.forEach(element => {

        element.textContent =
            formatDate(PD.relationshipStart);

    });

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


/* =========================================================
   13. CALENDAR
   ========================================================= */

let calendarDate =
    new Date();


function initializeCalendar() {

    renderCalendar();


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


    for (
        let i = 0;
        i < firstDay;
        i++
    ) {

        const blank =
            document.createElement("div");

        blank.className =
            "calendar-empty";

        calendar.appendChild(blank);

    }


    for (
        let day = 1;
        day <= daysInMonth;
        day++
    ) {

        const cell =
            document.createElement("button");


        cell.className =
            "calendar-day";


        cell.textContent =
            day;


        cell.addEventListener(
            "click",
            () => {

                selectCalendarDate(
                    year,
                    month,
                    day
                );

            }
        );


        calendar.appendChild(cell);

    }

}


function selectCalendarDate(
    year,
    month,
    day
) {

    const date =
        new Date(
            year,
            month,
            day
        );


    const formatted =
        date.toLocaleDateString(
            "en-GB",
            {
                day: "numeric",
                month: "long",
                year: "numeric"
            }
        );


    const note =
        prompt(
            `Add a memory for ${formatted}:`
        );


    if (!note) return;


    saveCalendarMemory({

        date:
            `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,

        note:
            note

    });


    alert(
        "❤️ Memory saved!"
    );

}


function saveCalendarMemory(memory) {

    const memories =
        JSON.parse(
            localStorage.getItem(
                "pdCalendarMemories"
            ) || "[]"
        );


    memories.push(memory);


    localStorage.setItem(
        "pdCalendarMemories",
        JSON.stringify(memories)
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
   17. NOTIFICATION COUNT
   ========================================================= */

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

    saveMemories

};
