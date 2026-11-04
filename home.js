
/* ==================================================
   PRINCESS WA DEIB — HOME CONTROLLER
   Date • Slideshow • Navigation • Button animations
================================================== */

(() => {
    "use strict";

    if (window.__pdHomeController) return;
    window.__pdHomeController = true;

    /* --------------------------------
       1. LIVE DATE
    -------------------------------- */

    const dateElement = document.getElementById("pdHomeDate");

    function updateDate() {
        if (!dateElement) return;

        const now = new Date();

        dateElement.textContent = new Intl.DateTimeFormat("en-UG", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric"
        }).format(now);
    }

    updateDate();

    // Refresh date periodically in case the page stays open overnight.
    setInterval(updateDate, 60000);


    /* --------------------------------
       2. PHOTO SLIDESHOW
    -------------------------------- */

    const slides = Array.from(
        document.querySelectorAll(".pd-slide")
    );

    const dots = Array.from(
        document.querySelectorAll(".pd-slide-dot")
    );

    let currentSlide = 0;
    let slideshowTimer = null;

    function showSlide(index) {
        if (!slides.length) return;

        currentSlide = (index + slides.length) % slides.length;

        slides.forEach((slide, i) => {
            slide.classList.toggle("active", i === currentSlide);
        });

        dots.forEach((dot, i) => {
            dot.classList.toggle("active", i === currentSlide);
        });
    }

    function stopSlideshow() {
        if (slideshowTimer) {
            clearInterval(slideshowTimer);
            slideshowTimer = null;
        }
    }

    function startSlideshow() {
        stopSlideshow();

        if (slides.length < 2 || document.hidden) return;

        slideshowTimer = setInterval(() => {
            showSlide(currentSlide + 1);
        }, 7000);
    }

    showSlide(0);
    startSlideshow();

    // Allow the dots to change the photo when tapped.
    dots.forEach((dot, index) => {
        dot.addEventListener("click", () => {
            showSlide(index);
            startSlideshow();
        });
    });

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            stopSlideshow();
        } else {
            startSlideshow();
        }
    });


    /* --------------------------------
       3. BOTTOM NAVIGATION
    -------------------------------- */

    const tabs = Array.from(
        document.querySelectorAll(".pd-tab")
    );

    const currentPage = window.location.pathname
        .split("/")
        .pop()
        .toLowerCase() || "home.html";

    tabs.forEach(tab => {
        const destination = (tab.getAttribute("href") || "")
            .split("/")
            .pop()
            .toLowerCase();

        if (destination === currentPage) {
            tab.classList.add("active");
            tab.setAttribute("aria-current", "page");
        }
    });


    /* --------------------------------
       4. BUTTON POP EFFECTS
    -------------------------------- */

    const popSelectors = [
        ".pd-tab",
        ".pd-special-card",
        ".pd-song-card",
        ".pd-forever-button"
    ].join(",");

    document.addEventListener("click", event => {
        const button = event.target.closest(popSelectors);

        if (!button) return;

        button.classList.remove("is-popping");

        // Restart the animation on repeated taps.
        void button.offsetWidth;

        button.classList.add("is-popping");

        button.addEventListener("animationend", () => {
            button.classList.remove("is-popping");
        }, { once: true });
    });


    /* --------------------------------
       5. TOUCH-FRIENDLY SLIDESHOW SWIPE
    -------------------------------- */

    const slideshow = document.querySelector(".pd-slideshow");

    if (slideshow) {
        let touchStartX = 0;
        let touchEndX = 0;

        slideshow.addEventListener("touchstart", event => {
            touchStartX = event.changedTouches[0].screenX;
        }, { passive: true });

        slideshow.addEventListener("touchend", event => {
            touchEndX = event.changedTouches[0].screenX;

            const distance = touchEndX - touchStartX;

            if (Math.abs(distance) < 45) return;

            if (distance < 0) {
                showSlide(currentSlide + 1);
            } else {
                showSlide(currentSlide - 1);
            }

            startSlideshow();
        }, { passive: true });
    }

    /* --------------------------------
       6. EFFECTS: ripples • sparkles • hearts • entrance
    -------------------------------- */

    const fxReduceMotion =
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const fxSaveData = navigator.connection?.saveData === true;

    const fxSelector = [
        ".pd-tab",
        ".pd-special-card",
        ".pd-song-card",
        ".pd-forever-button"
    ].join(",");

    const fxSparkColors = ["#f4c95d", "#ffe9a8", "#cdb4ff", "#e0334f", "#ffffff"];
    const fxHeartColors = ["#e0334f", "#cdb4ff", "#f4c95d", "#a477f5"];

    const fxRand = (min, max) => min + Math.random() * (max - min);
    const fxPick = list => list[Math.floor(Math.random() * list.length)];

    // A clipped layer that holds the gold shine and the tap ripple,
    // so the button itself never needs overflow:hidden.
    function fxEnsureLayer(el) {
        let layer = el.querySelector(":scope > .pd-fx-layer");

        if (!layer) {
            if (getComputedStyle(el).position === "static") {
                el.style.position = "relative";
            }

            layer = document.createElement("span");
            layer.className = "pd-fx-layer";
            layer.setAttribute("aria-hidden", "true");
            el.appendChild(layer);
        }

        return layer;
    }

    function fxRipple(el, x, y) {
        const layer = fxEnsureLayer(el);
        const box = el.getBoundingClientRect();
        const size = Math.max(box.width, box.height) * 2.2;

        const dot = document.createElement("span");
        dot.className = "pd-ripple";
        dot.style.width = dot.style.height = `${size}px`;
        dot.style.left = `${x - box.left - size / 2}px`;
        dot.style.top = `${y - box.top - size / 2}px`;

        layer.appendChild(dot);

        dot.addEventListener("animationend", () => dot.remove(), {
            once: true
        });

        // Restart the gold shine sweep on every tap.
        layer.classList.remove("sweep");
        void layer.offsetWidth;
        layer.classList.add("sweep");
    }

    function fxSparkle(x, y, count = 7) {
        if (fxReduceMotion) return;

        for (let i = 0; i < count; i++) {
            const star = document.createElement("span");
            const angle = fxRand(0, Math.PI * 2);
            const distance = fxRand(22, 56);

            star.className = "pd-spark";
            star.style.setProperty("--x", `${x}px`);
            star.style.setProperty("--y", `${y}px`);
            star.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
            star.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
            star.style.setProperty("--rot", `${fxRand(-180, 180)}deg`);
            star.style.setProperty("--sz", `${fxRand(6, 12)}px`);
            star.style.setProperty("--col", fxPick(fxSparkColors));

            document.body.appendChild(star);
            setTimeout(() => star.remove(), 800);
        }
    }

    function fxHeartBurst(x, y, count = 9) {
        if (fxReduceMotion) return;

        for (let i = 0; i < count; i++) {
            const heart = document.createElement("span");

            heart.className = "pd-burst-heart";
            heart.textContent = "♥";
            heart.style.setProperty("--x", `${x}px`);
            heart.style.setProperty("--y", `${y}px`);
            heart.style.setProperty("--dx", `${fxRand(-70, 70)}px`);
            heart.style.setProperty("--dy", `${fxRand(-150, -60)}px`);
            heart.style.setProperty("--rot", `${fxRand(-35, 35)}deg`);
            heart.style.setProperty("--sz", `${fxRand(14, 28)}px`);
            heart.style.setProperty("--col", fxPick(fxHeartColors));

            document.body.appendChild(heart);
            setTimeout(() => heart.remove(), 1200);
        }
    }

    // Ripple + sparkles on every tap of a main button.
    document.addEventListener("pointerdown", event => {
        const target = event.target.closest(fxSelector);

        if (!target) return;

        fxRipple(target, event.clientX, event.clientY);
        fxSparkle(event.clientX, event.clientY);
    }, { passive: true });

    // Gentle floating hearts behind the content.
    function fxFloatingHearts() {
        if (fxReduceMotion || fxSaveData) return;

        const wrap = document.createElement("div");
        wrap.className = "pd-fx-hearts";
        wrap.setAttribute("aria-hidden", "true");

        for (let i = 0; i < 9; i++) {
            const heart = document.createElement("span");

            heart.className = "pd-fx-heart";
            heart.textContent = "♥";
            heart.style.setProperty("--x", `${fxRand(4, 94)}%`);
            heart.style.setProperty("--s", `${fxRand(11, 24)}px`);
            heart.style.setProperty("--c", fxPick(fxHeartColors));
            heart.style.setProperty("--d", `${fxRand(11, 20)}s`);
            heart.style.setProperty("--delay", `${fxRand(0, 12)}s`);

            wrap.appendChild(heart);
        }

        document.body.prepend(wrap);
    }

    // One staggered reveal when the page opens.
    function fxEntrance() {
        if (fxReduceMotion) return;

        const items = [
            document.querySelector(".pd-header"),
            ...document.querySelectorAll(".pd-main > *"),
            document.querySelector(".pd-bottom-nav")
        ].filter(Boolean);

        items.forEach((el, index) => {
            el.style.setProperty("--i", index);
            el.classList.add("pd-fx-in");

            el.addEventListener("animationend", event => {
                if (event.target !== el) return;
                el.classList.remove("pd-fx-in");
            }, { once: true });
        });
    }

    // Double-tap the slideshow for a burst of hearts.
    function fxDoubleTapHearts() {
        const frame = document.querySelector(".pd-slideshow");

        if (!frame) return;

        let lastTap = 0;

        frame.addEventListener("pointerup", event => {
            if (event.target.closest("a, .pd-slide-dot")) return;

            const now = Date.now();

            if (now - lastTap < 320) {
                fxHeartBurst(event.clientX, event.clientY);
                lastTap = 0;
            } else {
                lastTap = now;
            }
        }, { passive: true });
    }

    document.querySelectorAll(".pd-forever-button").forEach(fxEnsureLayer);

    fxFloatingHearts();
    fxEntrance();
    fxDoubleTapHearts();

/* ==================================================
   7. DELAYED 3D BUTTON ENTRANCE + MAGNETIC PHYSICS
================================================== */

function pd3DButtonExperience() {

    const selectors = [
        ".pd-tab",
        ".pd-special-card",
        ".pd-song-card",
        ".pd-forever-button"
    ];

    const buttons = Array.from(
        document.querySelectorAll(selectors.join(","))
    );

    if (!buttons.length) return;

    const reduceMotion =
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* --------------------------------
       A. DELAYED ELASTIC ENTRANCE
    -------------------------------- */

    if (!reduceMotion) {

        buttons.forEach(button => {
            button.classList.add("pd-button-pending");
        });

        // Wait until the home page has settled.
        setTimeout(() => {

            buttons.forEach((button, index) => {

                button.style.setProperty(
                    "--button-delay",
                    `${index * 110}ms`
                );

                button.classList.remove("pd-button-pending");

                // Restart entrance animation reliably.
                void button.offsetWidth;

                button.classList.add("pd-button-revealed");

                button.addEventListener("animationend", event => {

                    if (event.target !== button) return;

                    button.classList.remove("pd-button-revealed");

                    button.style.removeProperty("--button-delay");

                }, { once: true });

            });

        }, 2200);

    }

    /* --------------------------------
       B. MAGNETIC HOVER
       Desktop / mouse devices only
    -------------------------------- */

    const canMagnet =
        window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    if (!canMagnet || reduceMotion) return;

    buttons.forEach(button => {

        let frame = null;

        let currentX = 0;
        let currentY = 0;

        let targetX = 0;
        let targetY = 0;

        function animateMagnet() {

            // Smooth spring-like movement.
            currentX += (targetX - currentX) * 0.16;
            currentY += (targetY - currentY) * 0.16;

            button.style.setProperty(
                "--mag-x",
                `${currentX.toFixed(2)}px`
            );

            button.style.setProperty(
                "--mag-y",
                `${currentY.toFixed(2)}px`
            );

            const stillMoving =
                Math.abs(targetX - currentX) > .1 ||
                Math.abs(targetY - currentY) > .1;

            if (stillMoving) {
                frame = requestAnimationFrame(animateMagnet);
            } else {
                frame = null;
            }
        }

        button.addEventListener("pointermove", event => {

            const rect = button.getBoundingClientRect();

            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            // Small, controlled magnetic pull.
            targetX = ((x - centerX) / centerX) * 5;
            targetY = ((y - centerY) / centerY) * 5;

            if (!frame) {
                frame = requestAnimationFrame(animateMagnet);
            }

        });

        button.addEventListener("pointerleave", () => {

            targetX = 0;
            targetY = 0;

            if (!frame) {
                frame = requestAnimationFrame(animateMagnet);
            }

        });

    });

}

pd3DButtonExperience();

    console.log("PD Home controller ready 💜");

})();
