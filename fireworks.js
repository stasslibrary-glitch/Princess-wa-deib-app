
(() => {
    "use strict";

    const canvas = document.getElementById("fireworksCanvas");
    if (!canvas) {
        console.error("Missing canvas: fireworksCanvas");
        return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Change the names here.
    const NAMES = ["Jaris", "wa", "Ernest"];

    const GOLD = "#ffbd22";
    const PURPLE = "#ffffff";
    const PINK = "#ff0000";
    const WHITE = "#00ffea";

    let W, H, DPR;
    let rockets = [];
    let sparks = [];
    let letters = [];
    let stars = [];
    let hearts = [];

    let nameIndex = 0;
    let phase = "waiting";
    let phaseTime = 0;
    let lastTime = 0;
    let lastBurst = 0;
    let touchLock = false;

    const MAX_SPARKS = 650;
    const MAX_LETTERS = 1400;

    const rand = (a, b) => Math.random() * (b - a) + a;
    const choose = a => a[Math.floor(Math.random() * a.length)];

    // ------------------------------------------------
    // CANVAS
    // ------------------------------------------------

    function resize() {
        W = innerWidth;
        H = innerHeight;
        DPR = Math.min(devicePixelRatio || 1, 1.5);

        canvas.width = Math.round(W * DPR);
        canvas.height = Math.round(H * DPR);
        canvas.style.width = W + "px";
        canvas.style.height = H + "px";

        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

        stars = Array.from(
            { length: Math.min(70, Math.floor(W * H / 9000)) },
            () => ({
                x: rand(0, W),
                y: rand(0, H),
                r: rand(0.5, 1.5),
                phase: rand(0, 6.28)
            })
        );

        hearts = Array.from({ length: 7 }, () => ({
            x: rand(10, W - 10),
            y: rand(0, H),
            size: rand(7, 12),
            speed: rand(8, 18),
            phase: rand(0, 6.28)
        }));

        clearBackground();
    }

    function clearBackground() {
        ctx.fillStyle = "#090411";
        ctx.fillRect(0, 0, W, H);

        const glow = ctx.createRadialGradient(
            W / 2, H / 2, 0,
            W / 2, H / 2, Math.max(W, H) * 0.75
        );
        glow.addColorStop(0, "#211033");
        glow.addColorStop(0.65, "#10081b");
        glow.addColorStop(1, "#090411");

        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);
    }

    addEventListener("resize", resize);

    function drawHeart(x, y, s) {
        ctx.beginPath();
        ctx.moveTo(x, y + s * 0.3);
        ctx.bezierCurveTo(x - s, y - s * 0.3, x - s * 0.6, y - s, x, y - s * 0.45);
        ctx.bezierCurveTo(x + s * 0.6, y - s, x + s, y - s * 0.3, x, y + s * 0.3);
        ctx.fill();
    }

    function background(time, dt) {
        // The names are drawn separately and never erased by this fade.
        ctx.fillStyle = "rgba(9, 4, 17, 0.20)";
        ctx.fillRect(0, 0, W, H);

        for (const s of stars) {
            ctx.globalAlpha = 0.25 + (Math.sin(time * 0.002 + s.phase) + 1) * 0.22;
            ctx.fillStyle = WHITE;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        }

        for (const h of hearts) {
            h.y -= h.speed * dt;
            if (h.y < -25) {
                h.y = H + 20;
                h.x = rand(10, W - 10);
            }

            ctx.globalAlpha = 0.13 + (Math.sin(time * 0.0015 + h.phase) + 1) * 0.06;
            ctx.fillStyle = PINK;
            drawHeart(h.x, h.y, h.size);
        }

        ctx.globalAlpha = 1;
    }

    // ------------------------------------------------
    // REAL FIREWORK ROCKETS
    // ------------------------------------------------

    function launchRocket(targetX, targetY, color, purpose) {
        rockets.push({
            x: rand(W * 0.30, W * 0.70),
            y: H + 5,
            targetX,
            targetY,
            color,
            purpose,
            speed: rand(380, 510),
            trail: [],
            trailClock: 0
        });
    }

    function addSpark(p) {
        if (sparks.length < MAX_SPARKS) sparks.push(p);
    }

    function explode(x, y, color, amount = 100, force = 4.8) {
        const count = Math.min(amount, MAX_SPARKS - sparks.length);

        // Radial explosion, like a real firework.
        for (let i = 0; i < count; i++) {
            const angle = Math.PI * 2 * i / count + rand(-0.035, 0.035);
            const speed = rand(force * 0.35, force);
            const life = rand(1.0, 2.2);

            addSpark({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                gravity: rand(0.025, 0.07),
                drag: rand(0.982, 0.994),
                size: rand(1, 2.5),
                life,
                maxLife: life,
                color: Math.random() < 0.13 ? WHITE : color,
                twinkle: Math.random() < 0.6
            });
        }

        // A second, smaller ring gives the explosion depth.
        if (sparks.length < MAX_SPARKS - 25) {
            for (let i = 0; i < 25; i++) {
                const angle = Math.PI * 2 * i / 25;
                const speed = rand(1.1, 2.0);
                const life = rand(0.6, 1.2);

                addSpark({
                    x, y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    gravity: 0.025,
                    drag: 0.99,
                    size: rand(1.2, 2),
                    life,
                    maxLife: life,
                    color: GOLD,
                    twinkle: true
                });
            }
        }
    }

    function updateRockets(dt) {
        for (let i = rockets.length - 1; i >= 0; i--) {
            const r = rockets[i];

            const dx = r.targetX - r.x;
            const dy = r.targetY - r.y;
            const distance = Math.hypot(dx, dy) || 1;
            const step = r.speed * dt;

            r.trailClock += dt;

            // Leave a glowing, dotted trail behind the rocket.
            if (r.trailClock > 0.018) {
                r.trailClock = 0;

                addSpark({
                    x: r.x + rand(-1.5, 1.5),
                    y: r.y + rand(-1.5, 1.5),
                    vx: rand(-0.5, 0.5),
                    vy: rand(0.4, 1.8),
                    gravity: 0.02,
                    drag: 0.96,
                    size: rand(1, 2.4),
                    life: rand(0.25, 0.65),
                    maxLife: 0.65,
                    color: Math.random() < 0.4 ? GOLD : r.color,
                    twinkle: true
                });
            }

            ctx.globalAlpha = 1;
            ctx.shadowBlur = 18;
            ctx.shadowColor = r.color;
            ctx.fillStyle = WHITE;
            ctx.beginPath();
            ctx.arc(r.x, r.y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            if (distance <= step + 3) {
                const x = r.targetX;
                const y = r.targetY;
                const color = r.color;
                const purpose = r.purpose;

                rockets.splice(i, 1);

                if (purpose === "name") {
                    // The rocket explodes FIRST, then the name forms.
                    explode(x, y, color, 135, 5.2);
                    explode(x, y, WHITE, 35, 3.1);
                    beginLetterFormation();
                } else {
                    explode(x, y, color, 100, 4.7);
                    explode(x, y, GOLD, 25, 2.8);
                }

                continue;
            }

            r.x += dx / distance * step;
            r.y += dy / distance * step;
        }

        ctx.globalAlpha = 1;
    }

    function updateSparks(dt) {
        for (let i = sparks.length - 1; i >= 0; i--) {
            const p = sparks[i];

            p.life -= dt;
            p.vx *= Math.pow(p.drag, dt * 60);
            p.vy = p.vy * Math.pow(p.drag, dt * 60) + p.gravity * dt * 60;
            p.x += p.vx * dt * 60;
            p.y += p.vy * dt * 60;

            if (p.life <= 0) {
                sparks.splice(i, 1);
                continue;
            }

            ctx.globalAlpha = Math.min(1, p.life / (p.maxLife * 0.24));
            ctx.fillStyle = p.color;
            ctx.shadowBlur = p.twinkle ? 9 : 3;
            ctx.shadowColor = p.color;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    }

    // ------------------------------------------------
    // BUILD THE NAME AFTER THE ROCKET EXPLODES
    // ------------------------------------------------

    function getNameY(index) {
        const gap = Math.min(H * 0.20, 112);
        return H / 2 + (index - (NAMES.length - 1) / 2) * gap;
    }

    function sampleName(name, centerY) {
        const off = document.createElement("canvas");
        const octx = off.getContext("2d");

        const fontSize = Math.max(23, Math.min(W * 0.14, 62, H * 0.085));

        off.width = Math.ceil(W);
        off.height = Math.ceil(fontSize * 1.8);

        octx.font = `bold ${fontSize}px Georgia, serif`;
        octx.textAlign = "center";
        octx.textBaseline = "middle";
        octx.fillStyle = "#fd1d1d";
        octx.fillText(name, W / 2, off.height / 2, W * 0.9);

        const data = octx.getImageData(0, 0, off.width, off.height).data;
        const points = [];
        const step = 3;

        for (let y = 0; y < off.height; y += step) {
            for (let x = 0; x < off.width; x += step) {
                if (data[(y * off.width + x) * 4 + 3] > 100) {
                    points.push({
                        x,
                        y: centerY + y - off.height / 2
                    });
                }
            }
        }

        // Keep a safe number of letter particles for phones.
        const max = Math.floor(MAX_LETTERS / (NAMES.length * 2));

        for (let i = points.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [points[i], points[j]] = [points[j], points[i]];
        }

        points.length = Math.min(points.length, max);
        return points;
    }

    function beginLetterFormation() {
        const name = NAMES[nameIndex];
        const y = getNameY(nameIndex);
        const targets = sampleName(name, y);

        // Gold sparks travel from the explosion to the letter positions.
        for (const t of targets) {
            if (letters.length >= MAX_LETTERS) break;

            const angle = rand(0, Math.PI * 2);
            const radius = rand(15, 95);

            letters.push({
                x: W / 2 + Math.cos(angle) * radius,
                y: y + Math.sin(angle) * radius,
                tx: t.x,
                ty: t.y,
                color: GOLD,
                size: rand(1.2, 2.2),
                phase: rand(0, 6.28),
                progress: 0,
                duration: rand(0.9, 1.6),
                delay: rand(0, 0.35)
            });
        }

        // Purple sparks form a second layer to thicken the letters.
        for (const t of targets) {
            if (letters.length >= MAX_LETTERS) break;

            letters.push({
                x: W / 2 + rand(-90, 90),
                y: y + rand(-70, 70),
                tx: t.x + rand(-1.2, 1.2),
                ty: t.y + rand(-1.2, 1.2),
                color: PURPLE,
                size: rand(1.3, 2.5),
                phase: rand(0, 6.28),
                progress: 0,
                duration: rand(1.1, 1.8),
                delay: rand(0.15, 0.55)
            });
        }

        phase = "forming";
        phaseTime = performance.now();
    }

    function updateLetters(dt, time) {
        let allFinished = true;

        for (const p of letters) {
            p.progress += dt;

            const t = Math.max(
                0,
                Math.min(1, (p.progress - p.delay) / p.duration)
            );

            if (t < 1) {
                allFinished = false;
                const eased = 1 - Math.pow(1 - t, 3);

                // Spark particles travel into the shape of each letter.
                p.x += (p.tx - p.x) * Math.min(1, eased * 0.24);
                p.y += (p.ty - p.y) * Math.min(1, eased * 0.24);
            } else {
                p.x = p.tx + Math.sin(time * 0.0018 + p.phase) * 0.35;
                p.y = p.ty + Math.cos(time * 0.0016 + p.phase) * 0.35;
            }

            const shimmer = 0.82 + Math.sin(time * 0.003 + p.phase) * 0.15;

            ctx.globalAlpha = shimmer;
            ctx.fillStyle = p.color;
            ctx.shadowBlur = p.color === PURPLE ? 12 : 8;
            ctx.shadowColor = p.color;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        return allFinished;
    }

    // ------------------------------------------------
    // SHOW FLOW
    // ------------------------------------------------

    function startShow() {
        rockets = [];
        sparks = [];
        letters = [];
        nameIndex = 0;
        phase = "waiting";
        phaseTime = performance.now() + 650;
        lastBurst = 0;
    }

    function updateShow(time) {
        if (phase === "waiting" && time >= phaseTime) {
            // First rocket visibly rises into the sky.
            launchRocket(W / 2, getNameY(nameIndex), GOLD, "name");
            phase = "rocket";
        }

        if (phase === "forming") {
            const done = letters.length > 0 &&
                letters.every(p => p.progress >= p.delay + p.duration);

            if (done && time - phaseTime > 1000) {
                nameIndex++;

                if (nameIndex < NAMES.length) {
                    phase = "between";
                    phaseTime = time + 1400;
                } else {
                    phase = "holding";
                }
            }
        }

        if (phase === "between" && time >= phaseTime) {
            // Each new name gets its own rocket, launch, and explosion.
            const color = nameIndex % 2 === 0 ? GOLD : PURPLE;
            launchRocket(W / 2, getNameY(nameIndex), color, "name");
            phase = "rocket";
        }

        if (phase === "rocket" && rockets.length === 0) {
            // beginLetterFormation changes phase when the rocket explodes.
            // If no rocket is present yet, wait for the next animation frame.
        }

        if (phase === "holding" && time - lastBurst > 2300) {
            lastBurst = time;

            // Small decorative fireworks around the names.
            if (sparks.length < MAX_SPARKS - 100) {
                explode(
                    random(W * 0.12, W * 0.88),
                    random(H * 0.12, H * 0.36),
                    choose([PURPLE, PINK, GOLD]),
                    45,
                    3.2
                );
            }
        }
    }

    function replay(event) {
        if (event) event.preventDefault();
        if (touchLock) return;
        touchLock = true;

        startShow();

        setTimeout(() => {
            touchLock = false;
        }, 500);
    }

    canvas.addEventListener("pointerdown", replay);

    // ------------------------------------------------
    // ANIMATION
    // ------------------------------------------------

    function animate(time) {
        const dt = Math.min((time - (lastTime || time)) / 1000, 0.033);
        lastTime = time;

        background(time, dt);
        updateShow(time);
        updateRockets(dt);
        updateSparks(dt);
        updateLetters(dt, time);

        requestAnimationFrame(animate);
    }

    resize();
    startShow();
    requestAnimationFrame(animate);
})();
