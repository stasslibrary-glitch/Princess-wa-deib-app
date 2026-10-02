
/* =========================================================
   PD — SONG OF THE DAY
   CLEAN VERSION
   NO LYRICS
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
   2. GET ELEMENTS
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


/* =========================================================
   3. TODAY'S DATE KEY
   ========================================================= */

function getTodayDateKey() {

    const today = new Date();

    return (
        today.getFullYear() +
        "-" +
        String(today.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(today.getDate()).padStart(2, "0")
    );

}


/* =========================================================
   4. GET SONG OF THE DAY
   ========================================================= */

function getTodaySong() {

    const dateKey =
        getTodayDateKey();

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
   5. FORMAT TIME
   ========================================================= */

function formatTime(seconds) {

    if (
        !Number.isFinite(seconds) ||
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
   6. LOAD SONG
   ========================================================= */

function loadSong(song, autoplay = false) {

    if (!songAudio || !song)
        return;


    /* ---------------------------------------------
       Update information
       --------------------------------------------- */

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


    /* ---------------------------------------------
       Reset player
       --------------------------------------------- */

    songAudio.pause();

    songAudio.currentTime = 0;


    /* ---------------------------------------------
       Set AUDIO source directly
       --------------------------------------------- */

    songAudio.src =
        song.file;


    /* Keep source element synchronized too */

    if (songSource) {

        songSource.src =
            song.file;

    }


    /* ---------------------------------------------
       Reload audio
       --------------------------------------------- */

    songAudio.load();


    /* ---------------------------------------------
       Reset controls
       --------------------------------------------- */

    if (songProgress) {

        songProgress.value = 0;

    }


    if (currentTime) {

        currentTime.textContent =
            "0:00";

    }


    if (songDuration) {

        songDuration.textContent =
            "0:00";

    }


    /* ---------------------------------------------
       Reset play icon
       --------------------------------------------- */

    const icon =
        songPlay?.querySelector("i");

    if (icon) {

        icon.className =
            "fa-solid fa-play";

    }


    document.body.classList.remove(
        "song-playing"
    );


    /* ---------------------------------------------
       AUTOPLAY WHEN REQUESTED
       --------------------------------------------- */

    if (autoplay) {

        songAudio.play()
            .then(() => {

                console.log(
                    "🎵 Playing:",
                    song.title
                );

            })
            .catch(error => {

                console.warn(
                    "Autoplay was blocked:",
                    error
                );

            });

    }

}


/* =========================================================
   7. INITIALIZE SONG PAGE
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        if (!songAudio) {

            console.error(
                "❌ songAudio element was not found."
            );

            return;

        }


        const todaySong =
            getTodaySong();


        let currentSongIndex =
            PD_SONGS.indexOf(
                todaySong
            );


        /* ---------------------------------------------
           Load today's song
           --------------------------------------------- */

        loadSong(
            todaySong,
            false
        );


        console.log(
            "🎵 PD Song of the Day:",
            todaySong.title
        );


        /* =================================================
           PLAY / PAUSE BUTTON
           ================================================= */

        songPlay?.addEventListener(
            "click",
            async event => {

                event.preventDefault();


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
                        "❌ Audio playback failed:",
                        error
                    );

                }

            }
        );


        /* =================================================
           AUDIO PLAY
           ================================================= */

        songAudio.addEventListener(
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


                /* Start rotating cover */

                if (songCover) {

                    songCover.classList.add(
                        "is-playing"
                    );

                }

            }
        );


        /* =================================================
           AUDIO PAUSE
           ================================================= */

        songAudio.addEventListener(
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


                /* Stop cover */

                if (songCover) {

                    songCover.classList.remove(
                        "is-playing"
                    );

                }

            }
        );


        /* =================================================
           AUDIO METADATA
           ================================================= */

        songAudio.addEventListener(
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


        /* =================================================
           AUDIO TIME UPDATE
           ================================================= */

        songAudio.addEventListener(
            "timeupdate",
            () => {

                if (
                    !Number.isFinite(
                        songAudio.duration
                    )
                ) {

                    return;

                }


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


                if (songProgress) {

                    songProgress.value =
                        (
                            songAudio.currentTime /
                            songAudio.duration
                        ) * 100;

                }

            }
        );


        /* =================================================
           SEEK
           ================================================= */

        songProgress?.addEventListener(
            "input",
            () => {

                if (
                    !Number.isFinite(
                        songAudio.duration
                    )
                ) {

                    return;

                }


                songAudio.currentTime =
                    (
                        Number(
                            songProgress.value
                        ) / 100
                    ) *
                    songAudio.duration;

            }
        );


        /* =================================================
           SONG ENDED
           ================================================= */

        songAudio.addEventListener(
            "ended",
            () => {

                document.body.classList.remove(
                    "song-playing"
                );


                if (songCover) {

                    songCover.classList.remove(
                        "is-playing"
                    );

                }


                const icon =
                    songPlay?.querySelector("i");


                if (icon) {

                    icon.className =
                        "fa-solid fa-play";

                }


                if (songProgress) {

                    songProgress.value =
                        0;

                }


                if (currentTime) {

                    currentTime.textContent =
                        "0:00";

                }

            }
        );


        /* =================================================
           PREVIOUS SONG
           ================================================= */

        document
            .getElementById(
                "previousSong"
            )
            ?.addEventListener(
                "click",
                () => {

                    currentSongIndex--;

                    if (
                        currentSongIndex < 0
                    ) {

                        currentSongIndex =
                            PD_SONGS.length - 1;

                    }


                    loadSong(
                        PD_SONGS[
                            currentSongIndex
                        ],
                        true
                    );

                }
            );


        /* =================================================
           NEXT SONG
           ================================================= */

        document
            .getElementById(
                "nextSong"
            )
            ?.addEventListener(
                "click",
                () => {

                    currentSongIndex++;

                    if (
                        currentSongIndex >=
                        PD_SONGS.length
                    ) {

                        currentSongIndex = 0;

                    }


                    loadSong(
                        PD_SONGS[
                            currentSongIndex
                        ],
                        true
                    );

                }
            );


        /* =================================================
           START SLIDESHOW
           ================================================= */

        initializeSlideshow();

    }
);


/* =========================================================
   8. PHOTO + VIDEO SLIDESHOW
   ========================================================= */

function initializeSlideshow() {

    const slides =
        Array.from(
            document.querySelectorAll(
                ".media-slide"
            )
        );


    const previous =
        document.getElementById(
            "previousSlide"
        );


    const next =
        document.getElementById(
            "nextSlide"
        );


    const counter =
        document.getElementById(
            "slideCounter"
        );


    const dotsContainer =
        document.getElementById(
            "slideDots"
        );


    if (!slides.length)
        return;


    let currentSlide = 0;

    let slideshowTimer = null;


    /* =====================================================
       CREATE DOTS
       ===================================================== */

    slides.forEach(
        (_, index) => {

            const dot =
                document.createElement(
                    "button"
                );


            dot.className =
                "slide-dot";


            dot.type =
                "button";


            dot.setAttribute(
                "aria-label",
                `Go to slide ${index + 1}`
            );


            dot.addEventListener(
                "click",
                () => {

                    showSlide(
                        index
                    );

                }
            );


            dotsContainer?.appendChild(
                dot
            );

        }
    );


    /* =====================================================
       STOP ALL VIDEOS
       ===================================================== */

    function stopAllVideos() {

        slides.forEach(
            slide => {

                const video =
                    slide.querySelector(
                        "video"
                    );


                if (video) {

                    video.pause();

                    video.currentTime =
                        0;

                }

            }
        );

    }


    /* =====================================================
       SHOW SLIDE
       ===================================================== */

    function showSlide(index) {

        if (
            index < 0
        ) {

            index =
                slides.length - 1;

        }


        if (
            index >=
            slides.length
        ) {

            index = 0;

        }


        currentSlide =
            index;


        clearTimeout(
            slideshowTimer
        );


        stopAllVideos();


        slides.forEach(
            (slide, i) => {

                slide.classList.toggle(
                    "active",
                    i === currentSlide
                );

            }
        );


        /* Counter */

        if (counter) {

            counter.textContent =
                `${currentSlide + 1} / ${slides.length}`;

        }


        /* Dots */

        const dots =
            dotsContainer?.querySelectorAll(
                ".slide-dot"
            );


        dots?.forEach(
            (dot, i) => {

                dot.classList.toggle(
                    "active",
                    i === currentSlide
                );

            }
        );


        /* Current video */

        const currentVideo =
            slides[
                currentSlide
            ].querySelector(
                "video"
            );


        if (currentVideo) {

            currentVideo.currentTime =
                0;


            currentVideo.muted =
                true;


            currentVideo.playsInline =
                true;


            currentVideo.play()
                .catch(
                    error => {

                        console.log(
                            "Video autoplay blocked:",
                            error
                        );

                    }
                );


            currentVideo.onended =
                () => {

                    showSlide(
                        currentSlide + 1
                    );

                };


        } else {

            slideshowTimer =
                setTimeout(
                    () => {

                        showSlide(
                            currentSlide + 1
                        );

                    },
                    5000
                );

        }

    }


    /* =====================================================
       PREVIOUS SLIDE
       ===================================================== */

    previous?.addEventListener(
        "click",
        () => {

            clearTimeout(
                slideshowTimer
            );


            showSlide(
                currentSlide - 1
            );

        }
    );


    /* =====================================================
       NEXT SLIDE
       ===================================================== */

    next?.addEventListener(
        "click",
        () => {

            clearTimeout(
                slideshowTimer
            );


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
   9. TOUCH THE MUSIC
   ========================================================= */

document.addEventListener(
    "pointerdown",
    event => {

        const songApp =
            document.querySelector(
                ".song-app"
            );


        if (!songApp)
            return;


        /* =================================================
           RIPPLE
           ================================================= */

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


        /* =================================================
           PARTICLES
           ================================================= */

        const particleCount =
            8;


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
