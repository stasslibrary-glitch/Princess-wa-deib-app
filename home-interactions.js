/* =====================================================
   PD — LIVING HOME INTERACTIONS
   ===================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const phone =
        document.querySelector(".phone-app");

    const hero =
        document.querySelector(".home-cover");


    if (!phone) return;


    /* =================================================
       INTERACTIVE PURPLE LIGHT
       ================================================= */

    const glow =
        document.createElement("div");

    glow.id =
        "pd-touch-glow";

    phone.appendChild(glow);


    function moveGlow(x, y) {

        const rect =
            phone.getBoundingClientRect();

        const localX =
            x - rect.left;

        const localY =
            y - rect.top;

        glow.style.left =
            `${localX}px`;

        glow.style.top =
            `${localY}px`;

        glow.style.opacity =
            "1";

    }


    function hideGlow() {

        glow.style.opacity =
            "0";

    }


    /* Desktop */

    phone.addEventListener(
        "mousemove",
        (event) => {

            moveGlow(
                event.clientX,
                event.clientY
            );

        }
    );


    phone.addEventListener(
        "mouseleave",
        hideGlow
    );


    /* =================================================
       3D HERO TILT
       ================================================= */

    if (hero) {

        phone.addEventListener(
            "mousemove",
            (event) => {

                const rect =
                    hero.getBoundingClientRect();

                const x =
                    event.clientX - rect.left;

                const y =
                    event.clientY - rect.top;

                const centerX =
                    rect.width / 2;

                const centerY =
                    rect.height / 2;

                const rotateY =
                    ((x - centerX) /
                    centerX) * 3;

                const rotateX =
                    -((y - centerY) /
                    centerY) * 3;


                hero.style.transform =
                    `perspective(900px)
                     rotateX(${rotateX}deg)
                     rotateY(${rotateY}deg)
                     scale(1.015)`;

            }
        );


        phone.addEventListener(
            "mouseleave",
            () => {

                hero.style.transform =
                    "perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)";

            }
        );


        /* =================================================
           TOUCH — SUBTLE TILT
           ================================================= */

        phone.addEventListener(
            "touchmove",
            (event) => {

                const touch =
                    event.touches[0];

                const rect =
                    hero.getBoundingClientRect();

                if (
                    touch.clientY <
                    rect.bottom
                ) {

                    const x =
                        touch.clientX -
                        rect.left;

                    const y =
                        touch.clientY -
                        rect.top;

                    const centerX =
                        rect.width / 2;

                    const centerY =
                        rect.height / 2;

                    const rotateY =
                        ((x - centerX) /
                        centerX) * 2;

                    const rotateX =
                        -((y - centerY) /
                        centerY) * 2;


                    hero.style.transform =
                        `perspective(900px)
                         rotateX(${rotateX}deg)
                         rotateY(${rotateY}deg)
                         scale(1.01)`;

                }

            },
            { passive: true }
        );


        phone.addEventListener(
            "touchend",
            () => {

                hero.style.transform =
                    "perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)";

            }
        );

    }


    /* =================================================
       NIGHT ATMOSPHERE
       ================================================= */

    function updateNightMode() {

        const hour =
            new Date().getHours();


        /*
           18:00 → 06:00
           = night atmosphere
        */

        if (
            hour >= 18 ||
            hour < 6
        ) {

            phone.classList.add(
                "pd-night"
            );

        } else {

            phone.classList.remove(
                "pd-night"
            );

        }

    }


    updateNightMode();

    setInterval(
        updateNightMode,
        60000
    );

});