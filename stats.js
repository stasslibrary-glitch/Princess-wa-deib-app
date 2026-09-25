/* =========================================================
   PD — OUR STATS
   stats.js
   ========================================================= */

import { auth, db } from "./firebase.js";
import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    collection,
    getDocs,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


/* =========================================================
   PD SETTINGS
   ========================================================= */

const RELATIONSHIP_START = new Date("2026-06-26T00:00:00");


/* =========================================================
   DAYS TOGETHER
   ========================================================= */

function updateDaysTogether() {

    const today = new Date();

    const start = new Date(RELATIONSHIP_START);

    start.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const difference = today - start;

    const days = Math.floor(
        difference / (1000 * 60 * 60 * 24)
    );

    const element = document.getElementById("daysTogether");

    if (element) {
        element.textContent = Math.max(days, 0);
    }

    /* Update Today in the journey */

    const todayJourney =
        document.getElementById("todayJourney");

    if (todayJourney) {

        todayJourney.textContent =
            today.toLocaleDateString(
                "en-GB",
                {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                }
            );
    }
}


/* =========================================================
   LOAD SPECIAL MEMORIES
   ========================================================= */

async function loadMemoryCount() {

    const memoryElement =
        document.getElementById("memoryCount");

    if (!memoryElement) return;

    try {

        const memoriesRef =
            collection(db, "memories");

        const snapshot =
            await getDocs(memoriesRef);

        memoryElement.textContent =
            snapshot.size;

    } catch (error) {

        console.error(
            "Could not load memories:",
            error
        );

        memoryElement.textContent = "0";
    }
}


/* =========================================================
   LOAD MESSAGE COUNT
   ========================================================= */

async function loadMessageCount() {

    const messageElement =
        document.getElementById("messageCount");

    if (!messageElement) return;

    try {

        const messagesRef =
            collection(db, "messages");

        const snapshot =
            await getDocs(messagesRef);

        messageElement.textContent =
            snapshot.size;

    } catch (error) {

        console.error(
            "Could not load messages:",
            error
        );

        messageElement.textContent = "0";
    }
}


/* =========================================================
   SONG OF THE DAY
   ========================================================= */

const songs = [

    "Your Love Amazes Me — John Berry",

    "Perfect — Ed Sheeran",

    "A Thousand Years — Christina Perri",

    "All of Me — John Legend",

    "Until I Found You — Stephen Sanchez",

    "Adore You — Harry Styles",

    "Die With A Smile — Lady Gaga & Bruno Mars",

    "Just the Way You Are — Bruno Mars",

    "At Last — Etta James",

    "I Won’t Give Up — Jason Mraz"

];


function loadSongOfTheDay() {

    const songElement =
        document.getElementById("songTitle");

    if (!songElement) return;

    const today = new Date();

    const dateNumber =
        today.getFullYear() * 10000 +
        (today.getMonth() + 1) * 100 +
        today.getDate();

    const index =
        dateNumber % songs.length;

    songElement.textContent =
        songs[index];
}


/* =========================================================
   INITIALISE STATS
   ========================================================= */

async function initialiseStats() {

    updateDaysTogether();

    loadSongOfTheDay();

    await loadMemoryCount();

    await loadMessageCount();
}


/* =========================================================
   AUTH
   ========================================================= */

onAuthStateChanged(auth, (user) => {

    if (!user) {

        console.log(
            "PD Stats: No authenticated user."
        );

        return;
    }

    console.log(
        "❤️ PD Stats loaded for:",
        user.email
    );

    initialiseStats();

});


/* =========================================================
   UPDATE DAYS EVERY MINUTE
   ========================================================= */

setInterval(
    updateDaysTogether,
    60000
);