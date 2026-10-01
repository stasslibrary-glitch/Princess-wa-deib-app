/* =========================================================
   PD — SONG OF THE DAY
   VERSION 3
   CONNECTED JS
   ========================================================= */


/* =========================================================
   1. SONG DATABASE
   ========================================================= */

const PD_SONGS = [

    {
        title: "_Emiliana",
        artist: "CKay_",
        file: "songs/CKay_-_Emiliana.mp3",
        cover: "images/1 (1).jpeg"
    },

    {
        title: "Running__To_You",
        artist: "Chiké___Simi",
        file: "songs/Chiké___Simi_–_Running__To_You.mp3",
        cover: "images/1 (2).jpeg"
    },

    {
        title: " Champion Gal",
        artist: "Fik Fameica ",
        file: "songs/Champion Gal by Fik Fameica.mp3",
        cover: "images/1 (3).jpeg"
    },

    {
        title: "Mr_Man",
        artist: "Fave",
        file: "songs/Fave_-_Mr_Man__Visualizer.mp3",
        cover: "images/1 (4).jpeg"
    },

    {
        title: "_Forever",
        artist: "Gyakie Omah_Lay",
        file: "songs/Gyakie___Omah_Lay_-_Forever.mp3",
        cover: "images/1 (5).jpeg"
    },

    {
        title: "Queen of my Heart",
        artist: "Westlife",
        file: "songs/queen of my heart by westlife.mp3",
        cover: "images/1 (6).jpeg"
    },

    {
        title: "World of Our Own",
        artist: "Westlife",
        file: "songs/Westlife - World of Our Own.mp3",
        cover: "images/1 (7).jpeg"
    },

    {
        title: "Your Love Amazes Me",
        artist: "Westlife",
        file: "songs/Westlife - Your Love Amazes Me.mp3",
        cover: "images/1 (8).jpeg"
    }

];


/* =========================================================
   4. GET ELEMENTS
   ========================================================= */

const songAudio =
    document.getElementById("songAudio");

const songSource =
    document.getElementById("songSource");

const songTitle =
    document.getElementById("songTitle");

const songArtist =
    document.getElementById("songArtist");

const songCover =
    document.getElementById("songCover");

const songPlay =
    document.getElementById("songPlay");

const songProgress =
    document.getElementById("songProgress");

const currentTime =
    document.getElementById("currentTime");

const songDuration =
    document.getElementById("songDuration");

const lyricBox =
    document.getElementById("pdCurrentLyric");


/* =========================================================
   5. DATE KEY
   ========================================================= */

function getTodayDateKey() {

    const today = new Date();

    return (
        today.getFullYear() +
        "-" +
        String(
            today.getMonth() + 1
        ).padStart(2, "0") +
        "-" +
        String(
            today.getDate()
        ).padStart(2, "0")
    );
}


/* =========================================================
   6. DAILY SONG
   ========================================================= */

function getTodaySong() {

    const today = new Date();

    const dateKey =
        `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;

    let hash = 0;


    for (
        let i = 0;
        i < dateKey.length;
        i++
    ) {

        hash =
            dateKey.charCodeAt(i) +
            ((hash << 5) - hash);

    }


    const index =
        Math.abs(hash) %
        PD_SONGS.length;


    return PD_SONGS[index];
}


/* =========================================================
   7. FORMAT TIME
   ========================================================= */

function formatTime(seconds) {

    if (
        !seconds ||
        isNaN(seconds) ||
        seconds < 0
    ) {

        return "0:00";

    }


    const minutes =
        Math.floor(seconds / 60);


    const secondsLeft =
        Math.floor(seconds % 60)
            .toString()
            .padStart(2, "0");


    return `${minutes}:${secondsLeft}`;
}


/* =========================================================
   8. LYRIC LOOKUP
   ========================================================= */

function getCurrentLyric(
    lyrics,
    time
) {

    let current = null;


    for (
        let i = 0;
        i < lyrics.length;
        i++
    ) {

        if (
            time >=
            lyrics[i].time
        ) {

            current = lyrics[i];

        } else {

            break;

        }

    }


    return current;
}


/* =========================================================
   9. DISPLAY LYRIC
   ========================================================= */

function displayLyric(text) {

    if (!lyricBox) return;


    lyricBox.classList.remove("show");


    setTimeout(() => {

        lyricBox.textContent =
            text || "";


        if (text) {

            lyricBox.classList.add(
                "show"
            );

        }

    }, 120);
}


/* =========================================================
   10. INITIALIZE SONG
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const song =
            getTodaySong();


        const todayKey =
            getTodayDateKey();


        /* ==============================================
           SONG INFORMATION
           ============================================== */

        if (songTitle) {

            songTitle.textContent =
                song.title;

        }


        if (songArtist) {

            songArtist.textContent =
                song.artist;

        }


        if (songCover) {

            songCover.src =
                song.cover;

        }


        /* ==============================================
           LOAD AUDIO
           ============================================== */

        if (
            songSource &&
            songAudio
        ) {

            songSource.src =
                song.file;

            songAudio.load();

        }


        /* ==============================================
           LYRICS
           ============================================== */

        let activeLyrics = [];


        /*
         * At the moment the supplied lyrics belong
         * to I Wanna Grow Old With You.
         *
         * They will only activate when that song
         * is actually selected.
         */

        if (
            todayKey >=
            LYRICS_START_DATE &&
            song.title ===
            "I Wanna Grow Old With You"
        ) {

            activeLyrics =
                I_WANNA_GROW_OLD_LYRICS;

        }


        let currentLyricIndex = -1;


        /* ==============================================
           PLAY BUTTON
           ============================================== */

        songPlay?.addEventListener(
            "click",
            async () => {

                if (!songAudio)
                    return;


                try {

                    if (
                        songAudio.paused
                    ) {

                        await songAudio.play();

                    } else {

                        songAudio.pause();

                    }

                } catch (error) {

                    console.error(
                        "Audio playback error:",
                        error
                    );

                }

            }
        );


        /* ==============================================
           PLAY EVENT
           ============================================== */

        songAudio?.addEventListener(
            "play",
            () => {

                document.body.classList.add(
                    "song-playing"
                );


                const icon =
                    songPlay?.querySelector("i");


                if (icon) {

                    icon.className =
                        "fa-solid fa-pause";

                }

            }
        );


        /* ==============================================
           PAUSE EVENT
           ============================================== */

        songAudio?.addEventListener(
            "pause",
            () => {

                document.body.classList.remove(
                    "song-playing"
                );


                const icon =
                    songPlay?.querySelector("i");


                if (icon) {

                    icon.className =
                        "fa-solid fa-play";

                }

            }
        );


        /* ==============================================
           METADATA
           ============================================== */

        songAudio?.addEventListener(
            "loadedmetadata",
            () => {

                if (songDuration) {

                    songDuration.textContent =
                        formatTime(
                            songAudio.duration
                        );

                }

            }
        );


        /* ==============================================
           TIME UPDATE
           ============================================== */

        songAudio?.addEventListener(
            "timeupdate",
            () => {

                if (!songAudio.duration)
                    return;


                /* --------------------------------------
                   TIME
                   -------------------------------------- */

                if (currentTime) {

                    currentTime.textContent =
                        formatTime(
                            songAudio.currentTime
                        );

                }


                if (songDuration) {

                    songDuration.textContent =
                        formatTime(
                            songAudio.duration
                        );

                }


                /* --------------------------------------
                   PROGRESS
                   -------------------------------------- */

                if (songProgress) {

                    songProgress.value =
                        (
                            songAudio.currentTime /
                            songAudio.duration
                        ) * 100;

                }


                /* --------------------------------------
                   LYRICS
                   -------------------------------------- */

                if (
                    activeLyrics.length
                ) {

                    const lyric =
                        getCurrentLyric(
                            activeLyrics,
                            songAudio.currentTime
                        );


                    const index =
                        lyric
                            ? activeLyrics.indexOf(lyric)
                            : -1;


                    if (
                        index !==
                        currentLyricIndex
                    ) {

                        currentLyricIndex =
                            index;


                        displayLyric(
                            lyric?.text || ""
                        );

                    }

                }

            }
        );


        /* ==============================================
           SEEK
           ============================================== */

        songProgress?.addEventListener(
            "input",
            () => {

                if (
                    !songAudio ||
                    !songAudio.duration
                ) {

                    return;

                }


                songAudio.currentTime =
                    (
                        songProgress.value /
                        100
                    ) *
                    songAudio.duration;

            }
        );


        /* ==============================================
           ENDED
           ============================================== */

        songAudio?.addEventListener(
            "ended",
            () => {

                document.body.classList.remove(
                    "song-playing"
                );


                const icon =
                    songPlay?.querySelector("i");


                if (icon) {

                    icon.className =
                        "fa-solid fa-play";

                }


                if (songProgress) {

                    songProgress.value = 0;

                }


                if (currentTime) {

                    currentTime.textContent =
                        "0:00";

                }


                currentLyricIndex =
                    -1;


                displayLyric("");

            }
        );


        /* ==============================================
           PREVIOUS / NEXT
           
           These cycle through PD_SONGS.
           ============================================== */

        let currentSongIndex =
            PD_SONGS.indexOf(song);


        function loadSongByIndex(index) {

            currentSongIndex =
                (
                    index +
                    PD_SONGS.length
                ) %
                PD_SONGS.length;


            const newSong =
                PD_SONGS[
                    currentSongIndex
                ];


            if (songTitle) {

                songTitle.textContent =
                    newSong.title;

            }


            if (songArtist) {

                songArtist.textContent =
                    newSong.artist;

            }


            if (songCover) {

                songCover.src =
                    newSong.cover;

            }


            if (songSource) {

                songSource.src =
                    newSong.file;

            }


            if (songAudio) {

                songAudio.load();

                songAudio.play()
                    .catch(() => {});

            }


            currentLyricIndex =
                -1;


            displayLyric("");

        }


        document
            .getElementById("previousSong")
            ?.addEventListener(
                "click",
                () => {

                    loadSongByIndex(
                        currentSongIndex - 1
                    );

                }
            );


        document
            .getElementById("nextSong")
            ?.addEventListener(
                "click",
                () => {

                    loadSongByIndex(
                        currentSongIndex + 1
                    );

                }
            );


        /* ==============================================
           START SLIDESHOW
           ============================================== */

        initializeSlideshow();

    }
);


/* =========================================================
   11. PHOTO + VIDEO SLIDESHOW
   ========================================================= */

/* =========================================================
   11. PHOTO + VIDEO SLIDESHOW
   AUTO-PLAY VIDEOS
   ========================================================= */

function initializeSlideshow() {

    const slides = Array.from(
        document.querySelectorAll(".media-slide")
    );

    const previous = document.getElementById("previousSlide");
    const next = document.getElementById("nextSlide");
    const counter = document.getElementById("slideCounter");
    const dotsContainer = document.getElementById("slideDots");

    if (!slides.length) return;

    let currentSlide = 0;
    let slideshowTimer = null;


    /* =====================================================
       CREATE DOTS
       ===================================================== */

    slides.forEach((_, index) => {

        const dot = document.createElement("button");

        dot.className = "slide-dot";
        dot.type = "button";

        dot.setAttribute(
            "aria-label",
            `Go to slide ${index + 1}`
        );

        dot.addEventListener("click", () => {
            showSlide(index);
        });

        dotsContainer?.appendChild(dot);

    });


    /* =====================================================
       STOP ALL VIDEOS
       ===================================================== */

    function stopAllVideos() {

        slides.forEach(slide => {

            const video = slide.querySelector("video");

            if (video) {

                video.pause();
                video.currentTime = 0;

            }

        });

    }


    /* =====================================================
       SHOW SLIDE
       ===================================================== */

    function showSlide(index) {

        /* Loop around */

        if (index < 0) {
            index = slides.length - 1;
        }

        if (index >= slides.length) {
            index = 0;
        }

        currentSlide = index;


        /* Stop every video first */

        stopAllVideos();


        /* Remove active */

        slides.forEach((slide, i) => {

            slide.classList.toggle(
                "active",
                i === currentSlide
            );

        });


        /* =================================================
           COUNTER
           ================================================= */

        if (counter) {

            counter.textContent =
                `${currentSlide + 1} / ${slides.length}`;

        }


        /* =================================================
           DOTS
           ================================================= */

        const dots =
            dotsContainer?.querySelectorAll(".slide-dot");

        dots?.forEach((dot, i) => {

            dot.classList.toggle(
                "active",
                i === currentSlide
            );

        });


        /* =================================================
           CHECK WHETHER CURRENT SLIDE IS A VIDEO
           ================================================= */

        const currentVideo =
            slides[currentSlide].querySelector("video");


        if (currentVideo) {

            /*
             * VIDEO SLIDE
             *
             * Automatically play it.
             */

            currentVideo.currentTime = 0;

            currentVideo.muted = true;
            currentVideo.playsInline = true;

            currentVideo.play()
                .then(() => {

                    console.log(
                        "🎥 PD video playing automatically"
                    );

                })
                .catch(error => {

                    console.log(
                        "Video autoplay blocked:",
                        error
                    );

                });


            /*
             * Move to next slide when video finishes.
             */

            currentVideo.onended = () => {

                showSlide(
                    currentSlide + 1
                );

            };


        } else {

            /*
             * PHOTO SLIDE
             *
             * Stay on photo for 5 seconds.
             */

            clearTimeout(slideshowTimer);

            slideshowTimer = setTimeout(() => {

                showSlide(
                    currentSlide + 1
                );

            }, 5000);

        }

    }


    /* =====================================================
       PREVIOUS BUTTON
       ===================================================== */

    previous?.addEventListener(
        "click",
        () => {

            clearTimeout(slideshowTimer);

            showSlide(
                currentSlide - 1
            );

        }
    );


    /* =====================================================
       NEXT BUTTON
       ===================================================== */

    next?.addEventListener(
        "click",
        () => {

            clearTimeout(slideshowTimer);

            showSlide(
                currentSlide + 1
            );

        }
    );


    /* =====================================================
       START
       ===================================================== */

    showSlide(0);

}

/* =========================================================
   12. TOUCH THE MUSIC
   ========================================================= */

document.addEventListener(
    "pointerdown",
    function (event) {

        const songApp =
            document.querySelector(
                ".song-app"
            );


        if (!songApp)
            return;


        /* ------------------------------------------
           Ripple
           ------------------------------------------ */

        const ripple =
            document.createElement(
                "div"
            );


        ripple.className =
            "pd-touch-ripple";


        ripple.style.left =
            event.clientX + "px";


        ripple.style.top =
            event.clientY + "px";


        document.body.appendChild(
            ripple
        );


        /* ------------------------------------------
           Particles
           ------------------------------------------ */

        const particleCount = 8;


        for (
            let i = 0;
            i < particleCount;
            i++
        ) {

            const particle =
                document.createElement(
                    "div"
                );


            particle.className =
                "pd-touch-particle";


            particle.style.left =
                event.clientX + "px";


            particle.style.top =
                event.clientY + "px";


            const angle =
                (
                    Math.PI * 2 * i
                ) /
                particleCount;


            const distance =
                25 +
                Math.random() * 45;


            particle.style.setProperty(
                "--move-x",
                Math.cos(angle) *
                distance +
                "px"
            );


            particle.style.setProperty(
                "--move-y",
                Math.sin(angle) *
                distance +
                "px"
            );


            document.body.appendChild(
                particle
            );


            setTimeout(
                () => {

                    particle.remove();

                },
                1000
            );

        }


        setTimeout(
            () => {

                ripple.remove();

            },
            1200
        );

    }
);
