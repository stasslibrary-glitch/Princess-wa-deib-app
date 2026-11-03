
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

    console.log("PD Home controller ready 💜");

})();
