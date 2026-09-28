
/* =========================================================
   PD — SONG OF THE DAY
   ========================================================= */

const PD_SONGS = [
    {
        title: "Your Love Amazes Me",
        artist: "Westlife",
        file: "songs/your-love-amazes-me.mp3"
    },
    {
        title: "Queen of My Heart",
        artist: "Westlife",
        file: "songs/queen-of-my-heart.mp3"
    },
    {
        title: "My Love",
        artist: "Westlife",
        file: "songs/my-love.mp3"
    },
    {
        title: "Written in the Stars",
        artist: "Westlife",
        file: "songs/Westlife - Written in the Stars.mp3"
    },
    {
        title: "Written in the Stars",
        artist: "Radio-and-Weasel Feat-B2C",
        file: "songs/Radio-and-Weasel-Gutamiiza-Feat-B2C.mp3"
    },
    {
        title: "Beautiful in White",
        artist: "Westlife Singapore version",
        file: "songs/Beautiful in White.mp3"
    },
    {
        title: "Puzzle of my Heart",
        artist: "Westlife",
        file: "songs/Puzzle_of_my_heart.mp3"
    },
    {
        title: "Anaconda",
        artist: "Lutty Neika ft. Bravion Emcee",
        file: "songs/Anaconda.mp3"
    }
];


/* =========================================================
   PD — SYNCHRONIZED LYRICS
   TIMINGS ARE EXACTLY AS PROVIDED
   ========================================================= */

const WRITTEN_IN_THE_STARS_LYRICS = [
    { time: 18, text: "Stay with me" },
    { time: 22, text: "Don't fall asleep too soon" },
    { time: 26, text: "The angels can wait for the moment" },
    { time: 32, text: "Come real close" },
    { time: 36, text: "Forget the world outside" },
    { time: 40, text: "Tonight we're alone" },
    { time: 45, text: "It's finally you and I" },
    { time: 50, text: "It wasn't meant to feel like this" },
    { time: 58, text: "Not without you" },

    { time: 63, text: "'Cause when I look at my life" },
    { time: 67, text: "How the pieces fall into place" },
    { time: 71, text: "It just wouldn't rhyme without you" },
    { time: 78, text: "When I see how my path" },
    { time: 82, text: "Seem to end up before your face" },
    { time: 86, text: "The state of my heart, the place where we are" },
    { time: 90, text: "Was written in the stars" },

    { time: 94, text: "Don't be afraid" },
    { time: 97, text: "I'll be right by your side" },
    { time: 102, text: "Through the laughter and pain" },
    { time: 105, text: "Together we're bound to fly" },
    { time: 112, text: "I wasn't meant to love like this" },
    { time: 116, text: "Not without you" },

    { time: 118, text: "'Cause when I look at my life" },
    { time: 124, text: "How the pieces fall into place" },
    { time: 128, text: "It just wouldn't rhyme without you" },
    { time: 136, text: "When I see how my path" },
    { time: 140, text: "Seem to end up before your face" },
    { time: 143, text: "The state of my heart, the place where we are" },
    { time: 147, text: "Was written in the stars" },

    { time: 152, text: "I made a few mistakes, yeah" },
    { time: 157, text: "Like sometimes we do" },
    { time: 160, text: "Been through lot of heartache" },
    { time: 164, text: "But I made it back to you" },

    { time: 170, text: "'Cause when I look at my life" },
    { time: 174, text: "How the pieces fall into place" },
    { time: 178, text: "It just wouldn't rhyme without you" },
    { time: 185, text: "When I see how my path" },
    { time: 189, text: "Seem to end up before your face" },
    { time: 193, text: "The state of my heart, the place where we are" },
    { time: 197, text: "Was written in the stars" },

    { time: 199, text: "When I look at my life" },
    { time: 203, text: "How the pieces fall into place" },
    { time: 207, text: "It just wouldn't rhyme without you" },
    { time: 214, text: "When I see how my path" },
    { time: 218, text: "Seem to end up before your face" },
    { time: 222, text: "The state of my heart, the place where we are" },
    { time: 226, text: "Was written in the stars" },
    { time: 230, text: "The state of my heart, the place where we are" },
    { time: 234, text: "Was written in the stars" }
];


/* =========================================================
   LYRICS ACTIVATION DATE
   =========================================================
   Lyrics are completely disabled before this date.
   They become available automatically at 12:00 AM.
   ========================================================= */

const LYRICS_START_DATE = "2026-09-28";


/* =========================================================
   GET TODAY'S DATE
   ========================================================= */

function getTodayDateKey() {

    const today = new Date();

    return `${today.getFullYear()}-${String(
        today.getMonth() + 1
    ).padStart(2, "0")}-${String(
        today.getDate()
    ).padStart(2, "0")}`;

}


/* =========================================================
   GET TODAY'S SONG
   ========================================================= */

function getTodaySong() {

    const today = new Date();

    const dateKey =
        `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;

    let hash = 0;

    for (let i = 0; i < dateKey.length; i++) {

        hash =
            dateKey.charCodeAt(i) +
            ((hash << 5) - hash);

    }

    const index =
        Math.abs(hash) % PD_SONGS.length;

    return PD_SONGS[index];
}


/* =========================================================
   INITIALIZE
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const song = getTodaySong();

    const todayKey = getTodayDateKey();

    /*
       Lyrics are allowed ONLY from 28 September 2026 onward.
    */
    const lyricsDateIsActive =
        todayKey >= LYRICS_START_DATE;


    const title =
        document.getElementById("songTitle");

    const artist =
        document.getElementById("songArtist");

    const audio =
        document.getElementById("songAudio");

    const lyricBox =
        document.getElementById("pdCurrentLyric");

    const source =
        document.getElementById("songSource");

    const playButton =
        document.getElementById("songPlay");

    const playIcon =
        playButton?.querySelector("i");

    const progress =
        document.getElementById("songProgress");

    const currentTime =
        document.getElementById("currentTime");

    const duration =
        document.getElementById("songDuration");

    let currentLyricIndex = -1;


    /* =====================================================
       SONG INFORMATION
       ===================================================== */

    if (title) {
        title.textContent = song.title;
    }

    if (artist) {
        artist.textContent = song.artist;
    }


    /* =====================================================
       LOAD SONG
       ===================================================== */

    if (source) {
        source.src = song.file;
    }

    if (audio) {
        audio.load();
    }


    /* =====================================================
       LYRICS ARE HIDDEN INITIALLY
       ===================================================== */

    if (lyricBox) {

        lyricBox.textContent = "";

        lyricBox.classList.remove("show");

    }


    /* =====================================================
       PLAY / PAUSE
       ===================================================== */

    playButton?.addEventListener("click", async () => {

        if (!audio) return;

        try {

            if (audio.paused) {

                await audio.play();

            } else {

                audio.pause();

            }

        } catch (error) {

            console.error(
                "Could not play song:",
                error
            );

        }

    });


    /* =====================================================
       PLAY
       ===================================================== */

    audio?.addEventListener("play", () => {

        if (playIcon) {

            playIcon.className =
                "fa-solid fa-pause";

        }

        document.body.classList.add(
            "song-playing"
        );

    });


    /* =====================================================
       PAUSE
       ===================================================== */

    audio?.addEventListener("pause", () => {

        if (playIcon) {

            playIcon.className =
                "fa-solid fa-play";

        }

        document.body.classList.remove(
            "song-playing"
        );

    });


    /* =====================================================
       DURATION
       ===================================================== */

    audio?.addEventListener(
        "loadedmetadata",
        () => {

            if (duration) {

                duration.textContent =
                    formatTime(audio.duration);

            }

        }
    );


    /* =====================================================
       TIME UPDATE
       ===================================================== */

    audio?.addEventListener(
        "timeupdate",
        () => {

            if (!audio.duration) return;


            /* ---------------------------------------------
               PROGRESS
               --------------------------------------------- */

            const percent =
                (audio.currentTime /
                    audio.duration) * 100;

            if (progress) {

                progress.value = percent;

            }


            /* ---------------------------------------------
               CURRENT TIME
               --------------------------------------------- */

            if (currentTime) {

                currentTime.textContent =
                    formatTime(
                        audio.currentTime
                    );

            }


            /* =================================================
               LYRICS
               
               MUST MEET BOTH CONDITIONS:
               
               1. Today is 28 September 2026 or later
               2. Today's song is Written in the Stars
               ================================================= */

            if (
                lyricsDateIsActive &&
                song.title === "Written in the Stars" &&
                lyricBox
            ) {

                let lyricIndex = -1;


                for (
                    let i = 0;
                    i < WRITTEN_IN_THE_STARS_LYRICS.length;
                    i++
                ) {

                    if (
                        audio.currentTime >=
                        WRITTEN_IN_THE_STARS_LYRICS[i].time
                    ) {

                        lyricIndex = i;

                    } else {

                        break;

                    }

                }


                /* ---------------------------------------------
                   SHOW CURRENT LYRIC
                   --------------------------------------------- */

                if (
                    lyricIndex !== -1 &&
                    lyricIndex !== currentLyricIndex
                ) {

                    currentLyricIndex =
                        lyricIndex;


                    lyricBox.classList.remove(
                        "show"
                    );


                    setTimeout(() => {

                        if (
                            currentLyricIndex ===
                            lyricIndex
                        ) {

                            lyricBox.textContent =
                                WRITTEN_IN_THE_STARS_LYRICS[
                                    lyricIndex
                                ].text;

                            lyricBox.classList.add(
                                "show"
                            );

                        }

                    }, 150);

                }

            } else {

                /* ---------------------------------------------
                   NO LYRICS TODAY
                   --------------------------------------------- */

                if (lyricBox) {

                    lyricBox.textContent = "";

                    lyricBox.classList.remove(
                        "show"
                    );

                }

                currentLyricIndex = -1;

            }

        }
    );


    /* =====================================================
       PROGRESS BAR
       ===================================================== */

    progress?.addEventListener(
        "input",
        () => {

            if (!audio.duration) return;

            audio.currentTime =
                (progress.value / 100) *
                audio.duration;

        }
    );


    /* =====================================================
       SONG FINISHED
       ===================================================== */

    audio?.addEventListener(
        "ended",
        () => {

            if (playIcon) {

                playIcon.className =
                    "fa-solid fa-play";

            }

            document.body.classList.remove(
                "song-playing"
            );


            if (progress) {

                progress.value = 0;

            }


            if (currentTime) {

                currentTime.textContent =
                    "0:00";

            }


            currentLyricIndex = -1;


            if (lyricBox) {

                lyricBox.textContent = "";

                lyricBox.classList.remove(
                    "show"
                );

            }

        }
    );

});


/* =========================================================
   FORMAT TIME
   ========================================================= */

function formatTime(seconds) {

    if (!seconds || isNaN(seconds)) {

        return "0:00";

    }

    const minutes =
        Math.floor(seconds / 60);

    const remainingSeconds =
        Math.floor(seconds % 60)
            .toString()
            .padStart(2, "0");

    return `${minutes}:${remainingSeconds}`;

}