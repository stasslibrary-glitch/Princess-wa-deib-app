
/* =========================================================
   PRINCESS WA DEIB — OUR STATS
   stats.js
   ========================================================= */

import {
    db
} from "./firebase.js";

import {
    collection,
    getDocs,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


/* =========================================================
   1. RELATIONSHIP START
   ========================================================= */

const RELATIONSHIP_START = "2026-06-26";


/* =========================================================
   2. SONGS
   Keep this list the same as your Song of the Day list.
   ========================================================= */

const PD_SONGS = [

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

];


/* =========================================================
   3. START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        updateDaysTogether();

        updateTodayDate();

        loadTodaySong();

        loadMessages();

        loadMemories();

    }
);


/* =========================================================
   4. DAYS TOGETHER
   ========================================================= */

function updateDaysTogether() {

    const startDate =
        new Date(
            RELATIONSHIP_START + "T00:00:00"
        );

    const today =
        new Date();

    startDate.setHours(
        0,
        0,
        0,
        0
    );

    today.setHours(
        0,
        0,
        0,
        0
    );


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


    const element =
        document.getElementById(
            "daysTogether"
        );


    if (element) {

        element.textContent =
            days;

    }

}


/* =========================================================
   5. TODAY'S DATE
   ========================================================= */

function updateTodayDate() {

    const element =
        document.getElementById(
            "todayJourney"
        );


    if (!element) return;


    const today =
        new Date();


    element.textContent =
        today.toLocaleDateString(
            "en-GB",
            {
                day: "numeric",
                month: "long",
                year: "numeric"
            }
        );

}


/* =========================================================
   6. SONG OF THE DAY
   Same date-based system used by PD.
   ========================================================= */

function getTodayKey() {

    const today =
        new Date();


    return today
        .toISOString()
        .split("T")[0];

}


function getSongForToday() {

    const todayKey =
        getTodayKey();


    let hash = 0;


    for (
        let i = 0;
        i < todayKey.length;
        i++
    ) {

        hash =
            todayKey.charCodeAt(i) +
            ((hash << 5) - hash);

    }


    const index =
        Math.abs(hash) %
        PD_SONGS.length;


    return PD_SONGS[index];

}


function loadTodaySong() {

    const song =
        getSongForToday();


    const title =
        document.getElementById(
            "songTitle"
        );


    const artist =
        document.getElementById(
            "songArtist"
        );


    if (title) {

        title.textContent =
            song.title;

    }


    if (artist) {

        artist.textContent =
            song.artist;

    }

}


/* =========================================================
   7. LOAD FIRESTORE MESSAGES
   ========================================================= */

async function loadMessages() {

    try {

        const messagesQuery =
            query(
                collection(
                    db,
                    "messages"
                ),
                orderBy(
                    "createdAt",
                    "asc"
                )
            );


        const snapshot =
            await getDocs(
                messagesQuery
            );


        let totalMessages = 0;

        let deibMessages = 0;

        let princessMessages = 0;


        snapshot.forEach(
            messageDoc => {

                const message =
                    messageDoc.data();


                totalMessages++;


                /*
                   Your chat currently uses
                   sender: "deib".

                   We also support senderName
                   in case Princess's messages
                   use that system.
                */

                const sender =
                    String(
                        message.sender ||
                        message.senderName ||
                        ""
                    ).toLowerCase();


                if (
                    sender === "deib"
                ) {

                    deibMessages++;

                }


                if (
                    sender === "princess"
                ) {

                    princessMessages++;

                }

            }
        );


        /* TOTAL */

        const totalElement =
            document.getElementById(
                "messageCount"
            );


        if (totalElement) {

            totalElement.textContent =
                totalMessages;

        }


        /* DEIB */

        const deibElement =
            document.getElementById(
                "deibMessages"
            );


        if (deibElement) {

            deibElement.textContent =
                deibMessages;

        }


        /* PRINCESS */

        const princessElement =
            document.getElementById(
                "princessMessages"
            );


        if (princessElement) {

            princessElement.textContent =
                princessMessages;

        }


        /*
           Update bars.
        */

        updateMessageBars(
            deibMessages,
            princessMessages
        );


        console.log(
            "❤️ PD Stats messages:",
            {
                totalMessages,
                deibMessages,
                princessMessages
            }
        );


    } catch (error) {

        console.error(
            "❌ Could not load message stats:",
            error
        );

    }

}


/* =========================================================
   8. MESSAGE BARS
   ========================================================= */

function updateMessageBars(
    deibMessages,
    princessMessages
) {

    const total =
        deibMessages +
        princessMessages;


    const deibBar =
        document.getElementById(
            "deibBar"
        );


    const princessBar =
        document.getElementById(
            "princessBar"
        );


    if (
        total === 0
    ) {

        if (deibBar) {

            deibBar.style.width =
                "50%";

        }


        if (princessBar) {

            princessBar.style.width =
                "50%";

        }


        return;

    }


    const deibPercentage =
        (
            deibMessages /
            total
        ) * 100;


    const princessPercentage =
        (
            princessMessages /
            total
        ) * 100;


    if (deibBar) {

        deibBar.style.width =
            `${deibPercentage}%`;

    }


    if (princessBar) {

        princessBar.style.width =
            `${princessPercentage}%`;

    }

}


/* =========================================================
   9. LOAD SPECIAL MEMORIES
   ========================================================= */

async function loadMemories() {

    try {

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "calendarMemories"
                )
            );


        const memoryCount =
            snapshot.size;


        const element =
            document.getElementById(
                "memoryCount"
            );


        if (element) {

            element.textContent =
                memoryCount;

        }


        console.log(
            "❤️ PD Stats memories:",
            memoryCount
        );


    } catch (error) {

        console.error(
            "❌ Could not load memories:",
            error
        );

    }

}


/* =========================================================
   10. SONG COUNT
   ========================================================= */

function updateSongCount() {

    const element =
        document.getElementById(
            "songCount"
        );


    if (!element) return;


    /*
       At the moment PD has a list of
       available songs rather than a
       Firestore song-history collection.

       So this displays the number of
       songs available to the app.
    */

    element.textContent =
        PD_SONGS.length;

}


updateSongCount();


/* =========================================================
   11. EXPORT
   ========================================================= */

window.PD_STATS = {

    updateDaysTogether,

    getSongForToday,

    loadMessages,

    loadMemories

};
