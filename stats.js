/* =========================================================
   PRINCESS WA DEIB — OUR STATS
   stats.js
   ========================================================= */


/* =========================================================
   1. RELATIONSHIP START DATE
   ========================================================= */

const relationshipStart = new Date("2026-06-26T00:00:00");


/* =========================================================
   2. CALCULATE DAYS TOGETHER
   ========================================================= */

function calculateDaysTogether() {

    const today = new Date();

    const difference =
        today.getTime() -
        relationshipStart.getTime();

    const days =
        Math.floor(
            difference /
            (1000 * 60 * 60 * 24)
        );

    return Math.max(days, 0);
}


/* =========================================================
   3. ANIMATE NUMBER
   ========================================================= */

function animateNumber(
    element,
    target,
    duration = 1600
) {

    if (!element)
        return;

    const startTime = performance.now();

    function update(currentTime) {

        const elapsed =
            currentTime - startTime;

        const progress =
            Math.min(
                elapsed / duration,
                1
            );

        /* Smooth easing */

        const eased =
            1 -
            Math.pow(
                1 - progress,
                3
            );

        const currentValue =
            Math.floor(
                eased * target
            );

        element.textContent =
            currentValue.toLocaleString();

        if (progress < 1) {

            requestAnimationFrame(
                update
            );

        } else {

            element.textContent =
                target.toLocaleString();

        }

    }

    requestAnimationFrame(
        update
    );
}


/* =========================================================
   4. UPDATE DAYS
   ========================================================= */

function updateDaysTogether() {

    const days =
        calculateDaysTogether();

    const element =
        document.getElementById(
            "daysTogether"
        );

    animateNumber(
        element,
        days,
        1800
    );

    return days;
}


/* =========================================================
   5. UPDATE TODAY JOURNEY
   ========================================================= */

function updateTodayJourney(days) {

    const element =
        document.getElementById(
            "todayJourney"
        );

    if (!element)
        return;


    if (days === 0) {

        element.textContent =
            "Our story begins today... ♥";

        return;

    }


    if (days === 1) {

        element.textContent =
            "Our first day together... ♥";

        return;

    }


    element.textContent =
        `${days} days into our beautiful story... ♥`;

}


/* =========================================================
   6. SPECIAL MEMORY COUNT
   ========================================================= */

function updateMemoryCount() {

    const element =
        document.getElementById(
            "memoryCount"
        );

    if (!element)
        return;


    /*
       For now this is a simple
       romantic placeholder.

       Later we can connect this
       directly to Firebase memories.
    */

    const memories = 8;


    animateNumber(
        element,
        memories,
        1200
    );

}


/* =========================================================
   7. SONG OF THE DAY
   ========================================================= */

function updateSongOfTheDay() {

    const songElement =
        document.getElementById(
            "songTitle"
        );

    if (!songElement)
        return;


    const songs = [

        "Your Love Amazes Me",

        "Queen of My Heart",

        "My Love",

        "Written in the Stars",

        "Beautiful in White",

        "Puzzle of My Heart",

        "I Wanna Grow Old with You"

    ];


    const today =
        new Date();

    const dayNumber =
        Math.floor(
            today.getTime() /
            (1000 * 60 * 60 * 24)
        );


    const songIndex =
        dayNumber %
        songs.length;


    songElement.textContent =
        songs[songIndex];

}


/* =========================================================
   8. CURRENT DATE
   ========================================================= */

function updateCurrentDate() {

    const today =
        new Date();

    console.log(
        "PD Stats loaded:",
        today.toLocaleDateString()
    );

}


/* =========================================================
   9. START STATS
   ========================================================= */

function initializeStats() {

    const days =
        updateDaysTogether();

    updateTodayJourney(days);

    updateMemoryCount();

    updateSongOfTheDay();

    updateCurrentDate();

}


/* =========================================================
   10. PAGE READY
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeStats
    );

} else {

    initializeStats();

}


/* =========================================================
   11. REFRESH DAYS AUTOMATICALLY
   ========================================================= */

/*
   Check every minute so the page
   doesn't need to be refreshed
   when a new day begins.
*/

setInterval(() => {

    const days =
        updateDaysTogether();

    updateTodayJourney(days);

}, 60000);

// ======================================
// PD — 200 DAYS TOGETHER COUNTDOWN
// ======================================

function initPDAnniversaryCountdown() {
    const daysEl = document.getElementById("pdDaysLeft");
    const hoursEl = document.getElementById("pdHoursLeft");
    const minutesEl = document.getElementById("pdMinutesLeft");
    const secondsEl = document.getElementById("pdSecondsLeft");

    if (!daysEl || !hoursEl || !minutesEl || !secondsEl) {
        return;
    }

    // 26 June 2026 = Day 1.
    // Day 200 = 11 January 2027.
    // Use local midnight to avoid UTC date-boundary surprises.
    const anniversaryDate = new Date(2027, 0, 11, 0, 0, 0);

    function updateCountdown() {
        const now = new Date();
        const difference = anniversaryDate.getTime() - now.getTime();

        if (difference <= 0) {
            daysEl.textContent = "00";
            hoursEl.textContent = "00";
            minutesEl.textContent = "00";
            secondsEl.textContent = "00";

            const card = document.querySelector(".pd-anniversary-card");

            if (card) {
                const title = card.querySelector("h2");
                const message = card.querySelector(".anniversary-footer");

                if (title) title.textContent = "Happy 200 Days, My Love! ❤️";
                if (message) message.textContent =
                    "200 beautiful days together, and many more to come. 💜";
            }

            return;
        }

        const totalSeconds = Math.floor(difference / 1000);

        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        daysEl.textContent = String(days).padStart(2, "0");
        hoursEl.textContent = String(hours).padStart(2, "0");
        minutesEl.textContent = String(minutes).padStart(2, "0");
        secondsEl.textContent = String(seconds).padStart(2, "0");
    }

    updateCountdown();
    setInterval(updateCountdown, 1000);
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initPDAnniversaryCountdown,
        { once: true }
    );
} else {
    initPDAnniversaryCountdown();
}
