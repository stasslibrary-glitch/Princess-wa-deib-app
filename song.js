
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
        title: "Ordinary",
        artist: "Alex Warren",
        file: "songs/Alex Warren - Ordinary.mp3"
    },
    {
        title: "For My Hand",
        artist: "Burna Boy feat. Ed Sheeran",
        file: "songs/Burna Boy - For My Hand feat. Ed Sheeran.mp3"
    },
    {
        title: "Written in the Stars",
        artist: "Westlife",
        file: "songs/Westlife - Written in the Stars.mp3"
    },
    {
        title: "Ordinary",
        artist: "Alex Warren",
        file: "songs/Alex Warren - Ordinary.mp3"
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
   GET LYRIC ELEMENT
   ========================================================= */

const pdCurrentLyric =
    document.getElementById("pdCurrentLyric");


/* =========================================================
   GET AUDIO
   ========================================================= */

const songAudio =
    document.getElementById("songAudio");



/* =========================================================
   PD — I WANNA GROW OLD WITH YOU
   SYNCHRONIZED LYRICS
   ========================================================= */

const I_WANNA_GROW_OLD_LYRICS = [

    /* INTRO */
    { time: 12.0, text: "Another day without your smile" },
    { time: 20.0, text: "Another day just passes by" },
    { time: 27.0, text: "And now I know" },
    { time: 30.2, text: "How much it means" },
    { time: 34.5, text: "For you to stay right here with me" },

    /* VERSE 2 */
    { time: 40.0, text: "The time we spent apart" },
    { time: 42.0, text: "Will make our love grow stronger" },
    { time: 48.0, text: "But it hurts so bad" },
    { time: 50.5, text: "I can't take it any longer" },

    /* CHORUS */
    { time: 54.0, text: "I wanna grow old with you" },
    { time: 57.0, text: "I wanna die lying in your arms" },
    { time: 60.0, text: "I wanna grow old with you" },
    { time: 57.0, text: "I wanna be looking in your eyes" },
    { time: 61.0, text: "I wanna be there for you" },
    { time: 65.0, text: "Sharing in everything you do" },
    { time: 69.0, text: "I wanna grow old with you" },

    /* SECOND VERSE */
    { time: 78.0, text: "A thousand miles between us now" },
    { time: 82.0, text: "It causes me to wonder how" },
    { time: 86.0, text: "Our love tonight remains so strong" },
    { time: 91.0, text: "It makes our risk right all along" },

    /* PRE-CHORUS */
    { time: 96.0, text: "The time we spent apart" },
    { time: 100.0, text: "Will make our love grow stronger" },
    { time: 104.0, text: "But it hurts so bad" },
    { time: 107.0, text: "I can't take it any longer" },

    /* CHORUS */
    { time: 112.0, text: "I wanna grow old with you" },
    { time: 116.0, text: "I wanna die lying in your arms" },
    { time: 120.0, text: "I wanna grow old with you" },
    { time: 124.0, text: "I wanna be looking in your eyes" },
    { time: 128.0, text: "I wanna be there for you" },
    { time: 132.0, text: "Sharing in everything you do" },
    { time: 136.0, text: "I wanna grow old with you" },

    /* BRIDGE */
    { time: 145.0, text: "Things can come and go" },
    { time: 149.0, text: "I know but" },
    { time: 151.5, text: "Baby I believe" },
    { time: 154.5, text: "Something's burning strong between us" },
    { time: 159.0, text: "Makes it clear to me" },

    /* FINAL CHORUS */
    { time: 165.0, text: "I wanna grow old with you" },
    { time: 169.0, text: "I wanna die lying in your arms" },
    { time: 173.0, text: "I wanna grow old with you" },
    { time: 177.0, text: "I wanna be looking in your eyes" },
    { time: 181.0, text: "I wanna be there for you" },
    { time: 185.0, text: "Sharing in everything you do" },

    /* FINAL REPEAT */
    { time: 191.0, text: "I wanna grow old with you" },
    { time: 195.0, text: "I wanna die lying in your arms" },
    { time: 199.0, text: "I wanna grow old with you" },
    { time: 203.0, text: "I wanna be looking in your eyes" },
    { time: 207.0, text: "I wanna be there for you" },
    { time: 211.0, text: "Sharing in everything you do" },
    { time: 215.0, text: "I wanna grow old with you" }

];













    

/* =========================================================
   FIND THE CURRENT LYRIC
   ========================================================= */

function updateGrowOldLyrics() {

    if (!songAudio || !pdCurrentLyric) {
        return;
    }

    const currentTime =
        songAudio.currentTime;


    /*
       Find the LAST lyric whose starting time
       has already been reached.
    */

    let currentLyric = null;

    for (
        let i = 0;
        i < I_WANNA_GROW_OLD_LYRICS.length;
        i++
    ) {

        if (
            currentTime >=
            I_WANNA_GROW_OLD_LYRICS[i].time
        ) {

            currentLyric =
                I_WANNA_GROW_OLD_LYRICS[i];

        } else {

            break;

        }

    }


    /* =====================================================
       DISPLAY CURRENT LYRIC
       ===================================================== */

    if (currentLyric) {

        if (
            pdCurrentLyric.textContent !==
            currentLyric.text
        ) {

            pdCurrentLyric.style.opacity = "0";

            setTimeout(() => {

                pdCurrentLyric.textContent =
                    currentLyric.text;

                pdCurrentLyric.style.opacity = "1";

            }, 120);

        }

    } else {

        pdCurrentLyric.textContent =
            "♪ Our song is playing... ♪";

    }

}


/* =========================================================
   SYNCHRONIZE WITH AUDIO
   ========================================================= */

if (songAudio) {

    songAudio.addEventListener(
        "timeupdate",
        updateGrowOldLyrics
    );


    /*
       When the user moves the progress bar,
       immediately find the correct lyric.
    */

    songAudio.addEventListener(
        "seeked",
        updateGrowOldLyrics
    );


    /*
       When a new song is loaded, reset the lyric.
    */

    songAudio.addEventListener(
        "loadedmetadata",
        () => {

            pdCurrentLyric.textContent =
                "♪ Our song is playing... ♪";

        }
    );


    /*
       When the song finishes.
    */

    songAudio.addEventListener(
        "ended",
        () => {

            pdCurrentLyric.textContent =
                "♥ I wanna grow old with you ♥";

        }
    );

}


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
/* =========================================================
   PD — TOUCH THE MUSIC EFFECT
   ========================================================= */

document.addEventListener("pointerdown", function (event) {

    /* Only work inside the song page */
    const songApp = document.querySelector(".song-app");

    if (!songApp) return;

    /* Create main ripple */
    const ripple = document.createElement("div");

    ripple.className = "pd-touch-ripple";

    ripple.style.left = event.clientX + "px";
    ripple.style.top = event.clientY + "px";

    document.body.appendChild(ripple);


    /* Create little glowing particles */

    const particleCount = 8;

    for (let i = 0; i < particleCount; i++) {

        const particle = document.createElement("div");

        particle.className = "pd-touch-particle";

        particle.style.left = event.clientX + "px";
        particle.style.top = event.clientY + "px";

        const angle =
            (Math.PI * 2 * i) / particleCount;

        const distance =
            25 + Math.random() * 45;

        const x =
            Math.cos(angle) * distance;

        const y =
            Math.sin(angle) * distance;

        particle.style.setProperty(
            "--move-x",
            x + "px"
        );

        particle.style.setProperty(
            "--move-y",
            y + "px"
        );

        document.body.appendChild(particle);


        /* Remove particle */
        setTimeout(() => {
            particle.remove();
        }, 1000);
    }


    /* Remove ripple */
    setTimeout(() => {
        ripple.remove();
    }, 1200);

});
