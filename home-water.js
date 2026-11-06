
/* ===============================================
   PRINCESS WA DEIB 💜❤️
   REAL WATER BACKGROUND — SAFE LAYOUT VERSION
   Fixed video + purple/red tint + touch ripples
================================================ */

(() => {
  "use strict";

  if (window.__pdWaterBackgroundLoaded) return;
  window.__pdWaterBackgroundLoaded = true;

  const STYLE_ID = "pd-water-background-styles";

  // Remove only elements created by this script.
  document.getElementById("pd-water-background")?.remove();
  document.getElementById("pd-water-tint")?.remove();
  document.getElementById("pd-water-ripples")?.remove();

  const style = document.createElement("style");
  style.id = STYLE_ID;

  style.textContent = `
    #pd-water-background {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      height: 100dvh !important;
      object-fit: cover !important;
      object-position: center !important;
      pointer-events: none !important;
      z-index: 0 !important;
      border: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      display: block !important;
    }

   
#pd-water-tint {
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  height: 100dvh !important;
  pointer-events: none !important;
  z-index: 1 !important;

  /* Only 15% color opacity — water stays visible */
  background: rgba(128, 0, 255, 0.15) !important;

  animation: pdWaterColorFlow 10s ease-in-out infinite alternate;
}

@keyframes pdWaterColorFlow {
  0%, 100% {
    background-color: rgba(128, 0, 255, 0.15) !important;
  }

  50% {
    background-color: rgba(255, 0, 45, 0.15) !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  #pd-water-tint {
    animation: none !important;
    background-color: rgba(128, 0, 255, 0.15) !important;
  }
}


    #pd-water-ripples {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      height: 100dvh !important;
      pointer-events: none !important;
      z-index: 2 !important;
    }

  `;

  document.head.appendChild(style);

  function initialise() {
    // Use the existing background container if available.
    // Otherwise create a dedicated background layer.
    let background = document.getElementById("pd-night-sky");

    if (!background) {
      background = document.createElement("div");
      background.id = "pd-night-sky";
      document.body.prepend(background);
    }

    // Keep the background container out of normal document flow.
    Object.assign(background.style, {
      position: "fixed",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      background: "transparent"
    });

    // Hide the old decorative sky elements without changing the layout.
    ["pd-stars", "pd-moon", "pd-shooting-star"].forEach(id => {
      const element = document.getElementById(id);
      if (element) element.style.display = "none";
    });

    // Real water footage.
    const video = document.createElement("video");
    video.id = "pd-water-background";
    video.src = "water-ripples.mp4";
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.setAttribute("aria-hidden", "true");

    const tint = document.createElement("div");
    tint.id = "pd-water-tint";
    tint.setAttribute("aria-hidden", "true");

    const canvas = document.createElement("canvas");
    canvas.id = "pd-water-ripples";
    canvas.setAttribute("aria-hidden", "true");

    // Insert behind the existing site content.
    // Do not move or restyle the site's content containers.
    background.prepend(video);
    background.appendChild(tint);
    document.body.appendChild(canvas);

    // Touch ripples are decorative and never intercept clicks.
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const ripples = [];
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    function resizeCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

      canvas.width = Math.round(innerWidth * dpr);
      canvas.height = Math.round(innerHeight * dpr);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function addRipple(event) {
      if (reducedMotion.matches) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;

      ripples.push({
        x: event.clientX,
        y: event.clientY,
        time: performance.now()
      });

      if (ripples.length > 6) ripples.shift();
    }

    function animate(now) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);

      for (let i = ripples.length - 1; i >= 0; i--) {
        const ripple = ripples[i];
        const age = (now - ripple.time) / 1000;

        if (age >= 1.4) {
          ripples.splice(i, 1);
          continue;
        }

        const progress = age / 1.4;
        const radius = progress * 90;
        const opacity = (1 - progress) * 0.4;

        ctx.beginPath();
        ctx.ellipse(
          ripple.x,
          ripple.y,
          radius,
          radius * 0.55,
          0,
          0,
          Math.PI * 2
        );
        ctx.strokeStyle = `rgba(235, 190, 255, ${opacity})`;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }

      requestAnimationFrame(animate);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas, { passive: true });
    document.addEventListener("pointerdown", addRipple, { passive: true });

    video.play().catch(() => {
      document.addEventListener("pointerdown", () => {
        video.play().catch(() => {});
      }, { once: true });
    });

    requestAnimationFrame(animate);

    console.log("PD real water background ready 💜❤️");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise, {
      once: true
    });
  } else {
    initialise();
  }
})();
