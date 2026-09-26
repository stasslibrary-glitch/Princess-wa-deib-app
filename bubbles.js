/* =========================================
   PD — MANY FLOATING BUBBLES
   ========================================= */

document.addEventListener("DOMContentLoaded", () => {

    const container = document.getElementById("click-bubbles");

    if (!container) return;

    document.addEventListener("click", (event) => {

        // Create MANY small bubbles
        for (let i = 0; i < 25; i++) {

            const bubble = document.createElement("span");

            bubble.className = "click-bubble";

            // Much smaller bubbles
            const size = Math.random() * 12 + 5;

            // Spread widely left and right
            const moveX =
                (Math.random() - 0.5) * 500;

            // Rise a long distance
            const moveY =
                -(Math.random() * 500 + 250);

            // Different speeds
            const duration =
                Math.random() * 1.8 + 1.8;

            bubble.style.width = `${size}px`;
            bubble.style.height = `${size}px`;

            bubble.style.left = `${event.clientX}px`;
            bubble.style.top = `${event.clientY}px`;

            bubble.style.setProperty(
                "--move-x",
                `${moveX}px`
            );

            bubble.style.setProperty(
                "--move-y",
                `${moveY}px`
            );

            bubble.style.setProperty(
                "--duration",
                `${duration}s`
            );

            // Slight delay so they don't all move together
            bubble.style.animationDelay =
                `${Math.random() * 0.35}s`;

            container.appendChild(bubble);

            setTimeout(() => {
                bubble.remove();
            }, (duration + 0.5) * 1000);
        }

    });

});