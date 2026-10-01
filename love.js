/* =========================================================
   PRINCESS WA DEIB — LOVE PIE
   LIVE FIREBASE MESSAGE COUNTER
   ========================================================= */


/* =========================================================
   FIREBASE
   ========================================================= */

import {
    auth,
    db
} from "./firebase.js";


import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";


import {
    collection,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";



/* =========================================================
   ELEMENTS
   ========================================================= */

const lovePie =
    document.getElementById("lovePie");


const deibPercent =
    document.getElementById("deibPercent");


const princessPercent =
    document.getElementById("princessPercent");


const deibMessages =
    document.getElementById("deibMessages");


const princessMessages =
    document.getElementById("princessMessages");


const totalMessages =
    document.getElementById("totalMessages");


const statMessages =
    document.getElementById("statMessages");


const firebaseStatus =
    document.getElementById("firebaseStatus");


const loveMessage =
    document.getElementById("loveMessage");


const messageSubtext =
    document.getElementById("messageSubtext");



/* =========================================================
   BACK TO HOME
   ========================================================= */

const backHome =
    document.getElementById("backHome");


if (backHome) {

    backHome.addEventListener(
        "click",
        () => {

            window.location.href =
                "index.html";

        }
    );

}



/* =========================================================
   LOVE DATA
   ========================================================= */

let loveData = {

    deib: 0,

    princess: 0,

    total: 0

};



/* =========================================================
   PREVIOUS VALUES
   Used for smooth number animation
   ========================================================= */

let previousDeib = 0;

let previousPrincess = 0;

let previousTotal = 0;



/* =========================================================
   AUTHENTICATION
   ========================================================= */

onAuthStateChanged(
    auth,
    user => {

        if (!user) {

            window.location.href =
                "login.html";

            return;

        }


        console.log(
            "❤️ Love Pie authenticated:",
            user.email
        );


        startLovePie();

    }
);



/* =========================================================
   START LOVE PIE
   ========================================================= */

function startLovePie() {

    if (!db) {

        console.error(
            "❌ Firebase database not available."
        );

        setStatus(
            "Firebase database unavailable",
            false
        );

        return;

    }


    setStatus(
        "Watching our messages live...",
        true
    );


    /*
       IMPORTANT:

       This is the exact same collection
       used by chat.js:

       collection(db, "messages")
    */

    const messagesRef =
        collection(
            db,
            "messages"
        );


    /*
       Listen for changes in real time.

       Whenever a message is added,
       changed or removed, this runs again.
    */

    onSnapshot(

        messagesRef,

        snapshot => {

            console.log(
                "❤️ Love Pie received:",
                snapshot.size,
                "messages"
            );


            calculateLoveData(
                snapshot
            );

        },

        error => {

            console.error(
                "❌ Love Pie Firebase error:",
                error
            );


            setStatus(
                "Unable to read our messages",
                false
            );

        }

    );

}



/* =========================================================
   CALCULATE LOVE DATA
   ========================================================= */

function calculateLoveData(snapshot) {

    let deibCount = 0;

    let princessCount = 0;


    /*
       Go through EVERY message
       in the Firebase messages collection.
    */

    snapshot.forEach(
        messageSnapshot => {

            const data =
                messageSnapshot.data();


            /*
               We count both:

               type: "text"

               AND

               type: "voice"

               because both are
               messages in your chat.
            */


            if (
                data.senderName ===
                "Deib"
            ) {

                deibCount++;

            }


            else if (
                data.senderName ===
                "Princess"
            ) {

                princessCount++;

            }

        }
    );


    const total =
        deibCount +
        princessCount;


    /*
       Save the numbers.
    */

    loveData.deib =
        deibCount;


    loveData.princess =
        princessCount;


    loveData.total =
        total;


    /*
       Update everything.
    */

    updateLovePie();


    updateMessageCounts();


    updateLoveMessage();


    setStatus(
        "Live · synced with our chat",
        true
    );

}



/* =========================================================
   UPDATE PIE
   ========================================================= */

function updateLovePie() {

    const total =
        loveData.total;


    let deibPercentage = 0;

    let princessPercentage = 0;


    /*
       Prevent division by zero.
    */

    if (total > 0) {

        deibPercentage =
            (
                loveData.deib /
                total
            ) * 100;


        princessPercentage =
            (
                loveData.princess /
                total
            ) * 100;

    }


    /*
       Round for display.
    */

    const deibRounded =
        Math.round(
            deibPercentage
        );


    const princessRounded =
        100 - deibRounded;


    /*
       Convert Deib's percentage
       into degrees.

       100% = 360 degrees
    */

    const deibDegrees =
        deibPercentage * 3.6;


    /*
       Change the actual pie.
    */

    if (lovePie) {

        lovePie.style.background = `

            conic-gradient(

                #ff2f68 0deg,

                #ff2f68
                ${deibDegrees}deg,

                #9c35ff
                ${deibDegrees}deg,

                #9c35ff
                360deg

            )

        `;


        /*
           Small glow whenever
           the pie changes.
        */

        lovePie.style.filter =
            "brightness(1.18) saturate(1.15)";


        setTimeout(
            () => {

                lovePie.style.filter =
                    "brightness(1) saturate(1)";

            },
            700
        );

    }


    /*
       Animate percentages.
    */

    animateNumber(
        deibPercent,
        previousDeib,
        deibRounded
    );


    animateNumber(
        princessPercent,
        previousPrincess,
        princessRounded
    );


    previousDeib =
        deibRounded;


    previousPrincess =
        princessRounded;

}



/* =========================================================
   UPDATE MESSAGE COUNTERS
   ========================================================= */

function updateMessageCounts() {

    const deib =
        loveData.deib;


    const princess =
        loveData.princess;


    const total =
        loveData.total;


    /*
       Animate the three numbers.
    */

    animateNumber(
        deibMessages,
        previousDeib,
        deib,
        false
    );


    animateNumber(
        princessMessages,
        previousPrincess,
        princess,
        false
    );


    animateNumber(
        totalMessages,
        previousTotal,
        total,
        false
    );


    previousDeib =
        deib;


    previousPrincess =
        princess;


    previousTotal =
        total;


    /*
       Bottom statistic.
    */

    if (statMessages) {

        statMessages.textContent =

            `${formatNumber(total)} ` +
            `${total === 1 ? "message" : "messages"} together`;

    }

}



/* =========================================================
   ANIMATE NUMBERS
   ========================================================= */

function animateNumber(
    element,
    from,
    to,
    percentage = true
) {

    if (!element)
        return;


    /*
       If nothing changed,
       simply display the value.
    */

    if (from === to) {

        element.textContent =
            percentage
                ? `${to}%`
                : formatNumber(to);

        return;

    }


    const start =
        performance.now();


    const duration =
        850;


    function frame(now) {

        const progress =
            Math.min(
                (now - start) /
                duration,
                1
            );


        /*
           Smooth ease-out.
        */

        const eased =
            1 -
            Math.pow(
                1 - progress,
                3
            );


        const value =
            Math.round(
                from +
                (
                    (to - from) *
                    eased
                )
            );


        element.textContent =
            percentage
                ? `${value}%`
                : formatNumber(value);


        if (progress < 1) {

            requestAnimationFrame(
                frame
            );

        }

    }


    requestAnimationFrame(
        frame
    );

}



/* =========================================================
   FORMAT NUMBERS
   ========================================================= */

function formatNumber(number) {

    return Number(
        number || 0
    ).toLocaleString();

}



/* =========================================================
   LOVE MESSAGE
   ========================================================= */

function updateLoveMessage() {

    const total =
        loveData.total;


    const deib =
        loveData.deib;


    const princess =
        loveData.princess;


    if (!loveMessage)
        return;


    /*
       No messages yet.
    */

    if (total === 0) {

        loveMessage.textContent =
            "Our Love Pie is waiting for its first piece... ♥";


        if (messageSubtext) {

            messageSubtext.textContent =
                "Once we start talking, our little pie will begin to grow.";

        }

        return;

    }


    /*
       Equal.
    */

    if (deib === princess) {

        loveMessage.textContent =
            "Looks like we're perfectly balanced. ♥";


        if (messageSubtext) {

            messageSubtext.textContent =
                "Both hearts are putting in the same amount of conversation.";

        }

        return;

    }


    /*
       Deib has more messages.
    */

    if (deib > princess) {

        loveMessage.textContent =
            "Deib has been doing a little more talking... ♥";


        if (messageSubtext) {

            messageSubtext.textContent =
                "But every message is another little piece of our story.";

        }

        return;

    }


    /*
       Princess has more messages.
    */

    if (princess > deib) {

        loveMessage.textContent =
            "Princess has been doing a little more talking... ♥";


        if (messageSubtext) {

            messageSubtext.textContent =
                "Someone has been keeping the conversation alive. 💜";

        }

    }

}



/* =========================================================
   FIREBASE STATUS
   ========================================================= */

function setStatus(
    text,
    connected
) {

    if (!firebaseStatus)
        return;


    firebaseStatus.textContent =
        text;


    const dot =
        document.querySelector(
            ".live-dot"
        );


    if (dot) {

        if (connected) {

            dot.style.background =
                "#ff3d86";

            dot.style.boxShadow =
                "0 0 10px #ff3d86";

        } else {

            dot.style.background =
                "#ff3030";

            dot.style.boxShadow =
                "0 0 10px #ff3030";

        }

    }

}



/* =========================================================
   FLOATING PARTICLES
   ========================================================= */

const particleContainer =
    document.getElementById(
        "loveParticles"
    );


const particleCharacters = [

    "♥",
    "✦",
    "•",
    "♡",
    "✧"

];


function createParticle() {

    if (!particleContainer)
        return;


    const particle =
        document.createElement(
            "span"
        );


    particle.className =
        "love-particle";


    particle.textContent =
        particleCharacters[
            Math.floor(
                Math.random() *
                particleCharacters.length
            )
        ];


    particle.style.left =
        `${Math.random() * 100}%`;


    const size =
        7 +
        Math.random() * 12;


    particle.style.fontSize =
        `${size}px`;


    const colors = [

        "#ff397d",
        "#ff5ca8",
        "#a83cff",
        "#c45aff",
        "#ffffff"

    ];


    particle.style.color =
        colors[
            Math.floor(
                Math.random() *
                colors.length
            )
        ];


    particle.style.setProperty(
        "--drift",
        `${-80 + Math.random() * 160}px`
    );


    const duration =
        7 +
        Math.random() * 9;


    particle.style.animationDuration =
        `${duration}s`;


    particleContainer.appendChild(
        particle
    );


    setTimeout(
        () => {

            particle.remove();

        },
        (duration + 1) * 1000
    );

}


setInterval(
    createParticle,
    650
);


for (
    let i = 0;
    i < 12;
    i++
) {

    setTimeout(
        createParticle,
        i * 180
    );

}



/* =========================================================
   CLICK HEARTS
   ========================================================= */

document.addEventListener(
    "click",
    event => {

        if (
            event.target.closest(
                "#backHome"
            )
        ) {

            return;

        }


        createClickHeart(
            event.clientX,
            event.clientY
        );

    }
);


function createClickHeart(
    x,
    y
) {

    const heart =
        document.createElement(
            "span"
        );


    heart.textContent =
        Math.random() > .5
            ? "♥"
            : "✦";


    heart.style.position =
        "fixed";


    heart.style.left =
        `${x}px`;


    heart.style.top =
        `${y}px`;


    heart.style.zIndex =
        "999";


    heart.style.pointerEvents =
        "none";


    heart.style.color =
        Math.random() > .5
            ? "#ff3c87"
            : "#a43dff";


    heart.style.fontSize =
        `${10 + Math.random() * 10}px`;


    heart.style.textShadow =
        "0 0 12px currentColor";


    document.body.appendChild(
        heart
    );


    const direction =
        Math.random() > .5
            ? 1
            : -1;


    heart.animate(

        [

            {
                transform:
                    "translate(-50%, -50%) scale(.4)",

                opacity: 0
            },

            {

                transform:
                    `translate(
                        calc(-50% + ${direction * 15}px),
                        calc(-50% - 35px)
                    ) scale(1.2)`,

                opacity: 1

            },

            {

                transform:
                    `translate(
                        calc(-50% + ${direction * 30}px),
                        calc(-50% - 75px)
                    ) scale(.7)`,

                opacity: 0

            }

        ],

        {

            duration: 900,

            easing: "ease-out"

        }

    );


    setTimeout(
        () => {

            heart.remove();

        },
        950
    );

}