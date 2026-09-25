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
        title: "Flying Without Wings",
        artist: "Westlife",
        file: "songs/flying-without-wings.mp3"
    },
    {
        title: "Swear It Again",
        artist: "Westlife",
        file: "songs/swear-it-again.mp3"
    },
    {
        title: "Beautiful in White",
        artist: "Westlife Singapore version",
        file: "Westlife Singapore version.mp3"
    },
    {
        title: "Puzzle of my Heart",
        artist: "Westlife",
        file: "songs/Puzzle_of_my_heart.mp3"
    },
    {
        title: "Anaconda",
        artist: "Lutty Neika ft. Bravion Emcee ",
        file: "songs/Anaconda.mp3"
    }
];


/* =========================================================
   GET TODAY'S SONG
   Same song for both phones on the same day
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

    const title =
        document.getElementById("songTitle");

    const artist =
        document.getElementById("songArtist");

    const audio =
        document.getElementById("songAudio");

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


    /* SONG DETAILS */

    if (title) {
        title.textContent = song.title;
    }

    if (artist) {
        artist.textContent = song.artist;
    }


    /* AUDIO */

    if (source) {
        source.src = song.file;
    }

    if (audio) {
        audio.load();
    }


    /* =====================================================
       PLAY / PAUSE
       ===================================================== */

    playButton?.addEventListener("click", () => {

        if (!audio) return;

        if (audio.paused) {

            audio.play()
                .then(() => {

                    playIcon.className =
                        "fa-solid fa-pause";

                    document.body.classList.add(
                        "song-playing"
                    );

                })
                .catch(error => {

                    console.error(
                        "Could not play song:",
                        error
                    );

                });

        } else {

            audio.pause();

            playIcon.className =
                "fa-solid fa-play";

            document.body.classList.remove(
                "song-playing"
            );

        }

    });


    /* =====================================================
       PROGRESS
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


    audio?.addEventListener(
        "timeupdate",
        () => {

            if (!audio.duration) return;

            const percent =
                (audio.currentTime /
                    audio.duration) * 100;

            if (progress) {
                progress.value = percent;
            }

            if (currentTime) {

                currentTime.textContent =
                    formatTime(audio.currentTime);

            }

        }
    );


    /* =====================================================
       CLICK PROGRESS BAR
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

            playIcon.className =
                "fa-solid fa-play";

            document.body.classList.remove(
                "song-playing"
            );

            if (progress) {
                progress.value = 0;
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