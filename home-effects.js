/* =====================================================
   PD — CINEMATIC HOME EFFECT
   ===================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const atmosphere =
        document.getElementById("pd-atmosphere");

    const stars =
        document.getElementById("pd-stars");

    const shootingStar =
        document.getElementById("pd-shooting-star");

    const secretHeart =
        document.getElementById("pd-secret-heart");

    const reveal =
        document.getElementById("pd-love-reveal");

    const particles =
        document.getElementById("pd-particles");
/* =================================================
   CREATE STARS
   ================================================= */

const stars =
    document.getElementById("pd-stars");

for (let i = 0; i < 38; i++) {

    const star =
        document.createElement("span");

    star.className = "pd-star";

    /*
       Larger stars so they are actually
       visible on a phone screen.
    */

    const size =
        Math.random() * 3.5 + 1.5;

    star.style.width =
        `${size}px`;

    star.style.height =
        `${size}px`;

    /*
       Keep stars inside the night sky.
    */

    star.style.left =
        `${Math.random() * 100}%`;

    star.style.top =
        `${Math.random() * 100}%`;

    star.style.animationDelay =
        `${Math.random() * 5}s`;

    star.style.animationDuration =
        `${Math.random() * 4 + 3}s`;

    stars.appendChild(star);
}
/* =================================================
   WISHING STAR
   ================================================= */

const shootingStar =
    document.getElementById(
        "pd-shooting-star"
    );


function launchWishingStar() {

    shootingStar.classList.remove(
        "pd-shoot"
    );

    void shootingStar.offsetWidth;

    /*
       Start from different places near
       the upper part of the phone.
    */

    shootingStar.style.left =
        `${Math.random() * 20 - 10}%`;

    shootingStar.style.top =
        `${Math.random() * 25 - 10}%`;

    shootingStar.classList.add(
        "pd-shoot"
    );
}


/* First one */

setTimeout(() => {

    launchWishingStar();

}, 6000);


/* Random future appearances */

setInterval(() => {

    launchWishingStar();

}, 15000 + Math.random() * 15000);
    /* =================================================
       LOVE REVEAL
       ================================================= */

    function openLoveReveal() {

        reveal.classList.add(
            "pd-reveal-active"
        );

        document.body.classList.add(
            "pd-love-active"
        );


        createLoveParticles();


        // Close after 5 seconds
        setTimeout(() => {

            reveal.classList.remove(
                "pd-reveal-active"
            );

            document.body.classList.remove(
                "pd-love-active"
            );

        }, 5200);

    }


    /* =================================================
       PARTICLES
       ================================================= */

    function createLoveParticles() {

        particles.innerHTML = "";

        const symbols = [
            "✦",
            "✧",
            "·",
            "♥",
            "♡"
        ];

        for (let i = 0; i < 55; i++) {

            const particle =
                document.createElement("span");

            particle.className =
                "pd-love-particle";

            particle.textContent =
                symbols[
                    Math.floor(
                        Math.random() *
                        symbols.length
                    )
                ];

            particle.style.left =
                `${Math.random() * 100}%`;

            particle.style.bottom =
                `${Math.random() * 15}%`;

            particle.style.animationDelay =
                `${Math.random() * 1.5}s`;

            particle.style.animationDuration =
                `${Math.random() * 2 + 3}s`;

            particle.style.setProperty(
                "--particle-x",
                `${(Math.random() - 0.5) * 250}px`
            );

            particles.appendChild(
                particle
            );
        }

    }


    /* =================================================
       VERY SUBTLE MOUSE MOVEMENT
       ================================================= */

    document.addEventListener(
        "mousemove",
        (e) => {

            const x =
                (e.clientX /
                    window.innerWidth -
                    0.5) * 10;

            const y =
                (e.clientY /
                    window.innerHeight -
                    0.5) * 10;

            atmosphere.style.transform =
                `translate(${x}px, ${y}px)`;

        }
    );

});