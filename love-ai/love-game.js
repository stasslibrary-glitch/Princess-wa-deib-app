import { auth, db } from "../firebase.js";

import {
    doc,
    setDoc,
    updateDoc,
    onSnapshot,
    serverTimestamp,
    arrayUnion
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

/* =========================================
   THE GREAT KEY HUNT
========================================= */

const CHALLENGE_REF = doc(db, "pdLoveHunt", "current");
const KEYS_REF = doc(db, "pdLoveHunt", "keys");

const APPROVED_ACCOUNTS = {
    "princess@gmail.com": { name: "Princess" },
    "deib@gmail.com": { name: "Deib" }
};

const GAME_INFO = [
    {
        id: "game1",
        title: "Know Me Better",
        description: "Questions only your partner should know",
        icon: "fa-brain",
        type: "questions"
    },
    {
        id: "game2",
        title: "The Mystery Box",
        description: "Unlock the secrets hidden inside",
        icon: "fa-envelope-open-text",
        type: "mystery"
    },
    {
        id: "game3",
        title: "Dare Me",
        description: "Romantic, funny and daring missions",
        icon: "fa-fire",
        type: "dare"
    },
    {
        id: "game4",
        title: "The Love Puzzle",
        description: "Put the pieces of your story together",
        icon: "fa-puzzle-piece",
        type: "puzzle"
    },
    {
        id: "game5",
        title: "The Final Mission",
        description: "Your final test before the vault",
        icon: "fa-star",
        type: "mission"
    }
];

let currentUser = null;
let currentProfile = null;
let activeChallenge = null;
let earnedKeys = [];
let storedEarnedKeys = [];

let setupGames = [];
let setupIndex = 0;
let currentAttemptGame = null;
let toastTimer = null;

const $ = id => document.getElementById(id);

const createModal = $("createModal");
const reviewModal = $("reviewModal");
const attemptModal = $("attemptModal");
const rewardModal = $("rewardModal");

/* =========================================
   GENERAL HELPERS
========================================= */

function showToast(message) {
    const toast = $("toast");
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3200);
}

function openModal(modal) {
    if (modal) modal.classList.add("show");
}

function closeModal(modal) {
    if (modal) modal.classList.remove("show");
}

document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => {
        closeModal($(button.dataset.close));
    });
});

document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", event => {
        if (event.target === modal) closeModal(modal);
    });
});

function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function normalizeAnswer(value) {
    return String(value || "")
        .trim()
        .toLocaleLowerCase()
        .replace(/\s+/g, " ");
}

function getCurrentGame() {
    if (!activeChallenge?.games) return null;

    return activeChallenge.games[
        activeChallenge.currentGameIndex || 0
    ];
}

function isValidAdventure(data) {
    return (
        data &&
        Array.isArray(data.games) &&
        data.games.length === 5 &&
        GAME_INFO.every((info, index) => {
            const game = data.games[index];

            return (
                game &&
                game.id === info.id &&
                game.type === info.type
            );
        })
    );
}

/* =========================================
   AUTHENTICATION
========================================= */

onAuthStateChanged(auth, user => {
    if (!user) {
        window.location.href = "../login.html";
        return;
    }

    const email = user.email?.toLowerCase();

    if (!APPROVED_ACCOUNTS[email]) {
        alert("This account is not approved for The Great Key Hunt.");
        window.location.href = "../home.html";
        return;
    }

    currentUser = user;
    currentProfile = APPROVED_ACCOUNTS[email];

    listenForChallenge();
    listenForKeys();
});

/* =========================================
   CHALLENGE SETUP WIZARD
========================================= */

function startSetup() {
    if (!currentUser) return;

    if (activeChallenge?.status === "published") {
        showToast("The five challenges have already been published.");
        return;
    }

    // A completed adventure can be replaced.
    // A fresh key collection begins when the new adventure is published.

    setupGames = [];
    setupIndex = 0;

    renderSetupGame();
    openModal(createModal);
}

$("openCreate").addEventListener("click", startSetup);

function renderSetupGame() {
    const game = GAME_INFO[setupIndex];

    $("setupEyebrow").textContent =
        `CHALLENGE SETUP · GAME ${setupIndex + 1} OF 05`;

    $("setupTitle").textContent = game.title;
    $("setupDescription").textContent = game.description;

    $("wizardProgressFill").style.width =
        `${((setupIndex + 1) / 5) * 100}%`;

    $("wizardSteps").innerHTML = GAME_INFO.map((item, index) => {
        let className = "";

        if (index < setupIndex) className = "done";
        if (index === setupIndex) className = "active";

        return `
            <span class="${className}">
                ${String(index + 1).padStart(2, "0")}
            </span>
        `;
    }).join("");

    $("previousGameButton").disabled = setupIndex === 0;

    $("nextGameButton").innerHTML =
        setupIndex === 4
            ? 'Review all five <i class="fa-solid fa-arrow-right"></i>'
            : 'Save and continue <i class="fa-solid fa-arrow-right"></i>';

    renderSetupFields(game);
}

function renderSetupFields(game) {
    const container = $("setupFields");

    container.innerHTML = "";

    const existing = setupGames[setupIndex] || {};

    if (game.type === "questions") {
        container.innerHTML = `
            <label for="questionCount">Number of questions</label>

            <input
                type="number"
                id="questionCount"
                min="1"
                max="30"
                value="${existing.questions?.length || 5}"
                required
            >

            <div id="questionBuilder" class="question-builder"></div>
        `;

        $("questionCount").addEventListener("change", () => {
            renderQuestionCreator(
                Number($("questionCount").value),
                existing.questions || []
            );
        });

        renderQuestionCreator(
            Number($("questionCount").value),
            existing.questions || []
        );
    }

    if (game.type === "mystery") {
        container.innerHTML = `
            <div class="setup-card">
                <h3>THE MYSTERY BOX</h3>

                <label for="mysteryTitle">Give your mystery a title</label>

                <input
                    id="mysteryTitle"
                    maxlength="100"
                    placeholder="e.g. The secret place"
                    value="${escapeHTML(existing.title || "")}"
                    required
                >

                <label for="mysteryClues">Write the clues</label>

                <textarea
                    id="mysteryClues"
                    maxlength="2000"
                    placeholder="Write the clues that will help your partner solve the mystery..."
                    required
                >${escapeHTML(existing.clues || "")}</textarea>

                <label for="mysteryAnswer">Correct solution</label>

                <input
                    id="mysteryAnswer"
                    maxlength="250"
                    placeholder="Enter the correct answer"
                    value="${escapeHTML(existing.answer || "")}"
                    required
                >
            </div>
        `;
    }

    if (game.type === "dare") {
        container.innerHTML = `
            <div class="setup-card">
                <h3>DARE ME</h3>

                <label for="dareTitle">Name your dare</label>

                <input
                    id="dareTitle"
                    maxlength="100"
                    placeholder="e.g. A little romantic surprise"
                    value="${escapeHTML(existing.title || "")}"
                    required
                >

                <label for="dareTask">Describe the dare</label>

                <textarea
                    id="dareTask"
                    maxlength="2000"
                    placeholder="What must your partner do?"
                    required
                >${escapeHTML(existing.task || "")}</textarea>

                <label for="dareProof">What proof should she submit?</label>

                <textarea
                    id="dareProof"
                    maxlength="1000"
                    placeholder="e.g. Send a photo, video or completion message..."
                    required
                >${escapeHTML(existing.proof || "")}</textarea>

                <p class="modal-description">
                    She will submit her proof. You must approve it before she receives the key.
                </p>
            </div>
        `;
    }

    if (game.type === "puzzle") {
        container.innerHTML = `
            <div class="setup-card">
                <h3>THE LOVE PUZZLE</h3>

                <label for="puzzleTitle">Puzzle title</label>

                <input
                    id="puzzleTitle"
                    maxlength="100"
                    placeholder="e.g. Our special memory"
                    value="${escapeHTML(existing.title || "")}"
                    required
                >

                <label for="puzzleClues">Write the puzzle or clues</label>

                <textarea
                    id="puzzleClues"
                    maxlength="2000"
                    placeholder="Describe the puzzle your partner must solve..."
                    required
                >${escapeHTML(existing.clues || "")}</textarea>

                <label for="puzzleAnswer">Correct solution</label>

                <input
                    id="puzzleAnswer"
                    maxlength="250"
                    placeholder="Enter the correct answer"
                    value="${escapeHTML(existing.answer || "")}"
                    required
                >
            </div>
        `;
    }

    if (game.type === "mission") {
        container.innerHTML = `
            <div class="setup-card">
                <h3>THE FINAL MISSION</h3>

                <label for="missionTitle">Give the final mission a title</label>

                <input
                    id="missionTitle"
                    maxlength="100"
                    placeholder="e.g. Prove our love"
                    value="${escapeHTML(existing.title || "")}"
                    required
                >

                <label for="missionTask">Describe the final mission</label>

                <textarea
                    id="missionTask"
                    maxlength="2500"
                    placeholder="Describe everything your partner must complete..."
                    required
                >${escapeHTML(existing.task || "")}</textarea>

                <label for="missionProof">What must she submit?</label>

                <textarea
                    id="missionProof"
                    maxlength="1000"
                    placeholder="Explain how she should show that she completed the mission..."
                    required
                >${escapeHTML(existing.proof || "")}</textarea>

                <p class="modal-description">
                    You will review her submission and approve it before the final key is awarded.
                </p>
            </div>
        `;
    }
}

function renderQuestionCreator(count, previousQuestions = []) {
    const builder = $("questionBuilder");

    if (!builder) return;

    if (!Number.isInteger(count) || count < 1 || count > 30) {
        showToast("Choose between 1 and 30 questions.");
        return;
    }

    builder.innerHTML = "";

    for (let index = 0; index < count; index++) {
        const previous = previousQuestions[index] || {};

        const card = document.createElement("div");
        card.className = "question-card";

        card.innerHTML = `
            <h3>QUESTION ${index + 1}</h3>

            <label>Write your question</label>

            <input
                type="text"
                class="question-text"
                maxlength="250"
                required
                placeholder="Enter question ${index + 1}"
                value="${escapeHTML(previous.question || "")}"
            >

            <label>Correct answer</label>

            <input
                type="text"
                class="correct-answer"
                maxlength="150"
                required
                placeholder="Enter the correct answer"
                value="${escapeHTML(previous.answer || "")}"
            >
        `;

        builder.appendChild(card);
    }
}

/* =========================================
   SAVE EACH GAME AND MOVE FORWARD
========================================= */

$("setupForm").addEventListener("submit", event => {
    event.preventDefault();

    const game = GAME_INFO[setupIndex];
    let data = {};

    if (game.type === "questions") {
        const cards = [
            ...document.querySelectorAll(
                "#questionBuilder .question-card"
            )
        ];

        const questions = cards.map(card => ({
            question: card.querySelector(".question-text").value.trim(),
            answer: card.querySelector(".correct-answer").value.trim()
        }));

        if (
            !questions.length ||
            questions.some(item => !item.question || !item.answer)
        ) {
            showToast("Complete every question and answer.");
            return;
        }

        data = { questions };
    }

    if (game.type === "mystery") {
        data = {
            title: $("mysteryTitle").value.trim(),
            clues: $("mysteryClues").value.trim(),
            answer: $("mysteryAnswer").value.trim()
        };
    }

    if (game.type === "dare") {
        data = {
            title: $("dareTitle").value.trim(),
            task: $("dareTask").value.trim(),
            proof: $("dareProof").value.trim()
        };
    }

    if (game.type === "puzzle") {
        data = {
            title: $("puzzleTitle").value.trim(),
            clues: $("puzzleClues").value.trim(),
            answer: $("puzzleAnswer").value.trim()
        };
    }

    if (game.type === "mission") {
        data = {
            title: $("missionTitle").value.trim(),
            task: $("missionTask").value.trim(),
            proof: $("missionProof").value.trim()
        };
    }

    if (Object.values(data).some(value => {
        if (Array.isArray(value)) return false;
        return !String(value || "").trim();
    })) {
        showToast("Complete all the required fields.");
        return;
    }

    setupGames[setupIndex] = {
        id: game.id,
        title: game.title,
        type: game.type,
        ...data
    };

    if (setupIndex < 4) {
        setupIndex++;
        renderSetupGame();
        return;
    }

    renderReview();
    closeModal(createModal);
    openModal(reviewModal);
});

$("previousGameButton").addEventListener("click", () => {
    if (setupIndex <= 0) return;

    setupIndex--;
    renderSetupGame();
});

/* =========================================
   REVIEW ALL FIVE GAMES
========================================= */

function renderReview() {
    $("reviewList").innerHTML = setupGames.map((game, index) => {
        let summary = "";

        if (game.type === "questions") {
            summary = `${game.questions.length} questions configured`;
        }

        if (game.type === "mystery") {
            summary = `Mystery: ${game.title} · Clues added`;
        }

        if (game.type === "dare") {
            summary = `Dare: ${game.title} · Approval required`;
        }

        if (game.type === "puzzle") {
            summary = `Puzzle: ${game.title} · Solution configured`;
        }

        if (game.type === "mission") {
            summary = `Mission: ${game.title} · Approval required`;
        }

        return `
            <div class="review-item">
                <strong>
                    ${String(index + 1).padStart(2, "0")} ·
                    ${escapeHTML(game.title)}
                </strong>

                <p>${escapeHTML(summary)}</p>

                <button
                    type="button"
                    class="secondary-button edit-game-button"
                    data-edit-game="${index}"
                    style="margin-top:10px;min-height:34px;padding:7px 12px"
                >
                    Edit this game
                </button>
            </div>
        `;
    }).join("");

    document.querySelectorAll("[data-edit-game]").forEach(button => {
        button.addEventListener("click", () => {
            setupIndex = Number(button.dataset.editGame);

            closeModal(reviewModal);
            renderSetupGame();
            openModal(createModal);
        });
    });
}

/* =========================================
   PUBLISH ALL FIVE AT ONCE
========================================= */

$("publishAllButton").addEventListener("click", async () => {
    if (!currentUser || !currentProfile) return;

    if (
        setupGames.length !== 5 ||
        setupGames.some(game => !game)
    ) {
        showToast("You must configure all five games first.");
        return;
    }

    const button = $("publishAllButton");

    button.disabled = true;
    button.textContent = "Publishing all five games...";

    try {
        const games = setupGames.map(game => ({
            ...game,
            status: "pending",
            submission: null,
            submittedAt: null,
            completedAt: null
        }));

        /*
         * IMPORTANT:
         * Every new adventure starts with zero keys.
         * This reset happens only when publishing a new adventure.
         */

        await setDoc(KEYS_REF, {
            earned: [],
            updatedAt: serverTimestamp()
        });

        await setDoc(CHALLENGE_REF, {
            status: "published",
            createdByUID: currentUser.uid,
            createdByEmail: currentUser.email.toLowerCase(),
            createdByName: currentProfile.name,
            playerUID: null,
            playerName: null,
            currentGameIndex: 0,
            games,
            publishedAt: serverTimestamp(),
            completedAt: null
        });

        closeModal(reviewModal);

        showToast("All five challenges have been published! 💜");

    } catch (error) {
        console.error("Publishing all challenges failed:", error);

        showToast(
            `Publish failed: ${error.code || error.message}`
        );

    } finally {
        button.disabled = false;

        button.innerHTML =
            '<i class="fa-solid fa-key"></i> Publish all five challenges';
    }
});

/* =========================================
   FIRESTORE CHALLENGE LISTENER
========================================= */

function listenForChallenge() {
    onSnapshot(CHALLENGE_REF, snapshot => {

        if (!snapshot.exists()) {
            activeChallenge = null;
            earnedKeys = [];

        } else {
            const data = snapshot.data();

            /*
             * FIX:
             * Old single-game records do not contain five valid games.
             * Ignore them instead of treating them as completed adventures.
             */

            if (!isValidAdventure(data)) {
                console.warn(
                    "Old or incomplete challenge record detected. " +
                    "Waiting for a new five-game adventure."
                );

                activeChallenge = null;
                earnedKeys = [];
                storedEarnedKeys = [];

            } else {
                activeChallenge = data;
                earnedKeys = [...storedEarnedKeys];
            }
        }

        updateKeyInterface();
        updateChallengeInterface();

    }, error => {
        console.error("Challenge listener failed:", error);

        showToast(
            "Could not load challenges. Check Firebase permissions."
        );
    });
}

function listenForKeys() {
    onSnapshot(KEYS_REF, snapshot => {

        storedEarnedKeys =
            snapshot.exists() &&
            Array.isArray(snapshot.data().earned)
                ? snapshot.data().earned.filter(id =>
                    GAME_INFO.some(game => game.id === id)
                )
                : [];

        /*
         * Do not display old keys when there is no valid
         * five-game adventure.
         */

        earnedKeys = activeChallenge
            ? [...storedEarnedKeys]
            : [];

        updateKeyInterface();
        updateChallengeInterface();

    }, error => {
        console.error("Key listener failed:", error);

        showToast(
            "Could not load your keys. Check Firebase permissions."
        );
    });
}

/* =========================================
   UPDATE DASHBOARD
========================================= */

function updateChallengeInterface() {
    const attemptButton = $("attemptButton");
    const createButton = $("openCreate");
    const waitingCard = $("waitingCard");
    const approvalCard = $("approvalCard");

    attemptButton.hidden = true;
    waitingCard.hidden = true;
    approvalCard.hidden = true;

    if (!activeChallenge) {
        createButton.hidden = false;

        renderGameList();
        return;
    }

    const isCreator =
        activeChallenge.createdByUID === currentUser.uid;

    const isPublished =
        activeChallenge.status === "published";

    const isCompleted =
        activeChallenge.status === "completed";

    /*
     * A completed adventure can be replaced by either partner.
     */

    createButton.hidden = isPublished;

    if (isCompleted) {
        waitingCard.hidden = false;

        $("waitingTitle").textContent = "Adventure completed!";

        $("waitingText").textContent =
            "All five challenges have been completed. The Grand Vault is ready.";
    }

    if (isPublished && isCreator) {
        const pendingApproval = activeChallenge.games.find(
            game => game.status === "awaiting_approval"
        );

        if (pendingApproval) {
            showApprovalCard(pendingApproval);

        } else {
            waitingCard.hidden = false;

            $("waitingTitle").textContent =
                "Your challenges are live!";

            $("waitingText").textContent =
                "Your partner is working through the five games. " +
                "You will be notified when an approval is needed.";
        }
    }

    if (isPublished && !isCreator) {
        const game = getCurrentGame();

        if (game && game.status === "pending") {
            attemptButton.hidden = false;

            $("attemptButtonTitle").textContent =
                `Play Game ${activeChallenge.currentGameIndex + 1}`;

            $("challengeHint").textContent =
                `${activeChallenge.createdByName} has a challenge for you.`;
        }

        if (game?.status === "awaiting_approval") {
            waitingCard.hidden = false;

            $("waitingTitle").textContent =
                "Submission sent!";

            $("waitingText").textContent =
                "Your partner needs to approve your mission before you receive the key.";
        }
    }

    renderGameList();
}

/* =========================================
   GAME LIST
========================================= */

function renderGameList() {
    const list = $("gameList");

    list.innerHTML = GAME_INFO.map((info, index) => {
        const game = activeChallenge?.games?.[index];

        const earned = earnedKeys.includes(info.id);

        let status = "NOT SET";
        let className = "";

        if (game) {
            status = "WAITING";

            if (game.status === "pending") {
                status = "READY";
            }

            if (game.status === "awaiting_approval") {
                status = "IN REVIEW";
            }

            if (game.status === "completed") {
                status = "KEY EARNED";
                className = "completed";
            }

            if (
                game.status === "pending" &&
                index === activeChallenge.currentGameIndex
            ) {
                className = "current";
                status = "YOUR TURN";
            }
        }

        if (earned) {
            status = "KEY EARNED";
            className = "completed";
        }

        /*
         * FIX:
         * If there is no valid adventure, show NOT SET
         * unless a key belongs to the current valid adventure.
         */

        if (!activeChallenge && !earned) {
            status = "NOT SET";
            className = "";
        }

        return `
            <div class="game-item ${className}">
                <div class="game-number">
                    ${String(index + 1).padStart(2, "0")}
                </div>

                <div class="game-symbol">
                    <i class="fa-solid ${info.icon}"></i>
                </div>

                <div class="game-info">
                    <strong>${info.title}</strong>
                    <small>${info.description}</small>
                </div>

                <span class="game-status">${status}</span>
            </div>
        `;
    }).join("");
}

/* =========================================
   APPROVAL CARD
========================================= */

function showApprovalCard(game) {
    $("approvalCard").hidden = false;

    $("approvalTitle").textContent =
        `${game.title} needs your approval`;

    $("approvalText").textContent =
        `${activeChallenge.playerName || "Your partner"} submitted this completion. Review it below.`;

    $("approvalSubmission").textContent =
        game.submission || "No submission text was provided.";

    $("approveButton").disabled = false;

    $("approveButton").innerHTML =
        '<i class="fa-solid fa-check"></i> Approve and award key';
}

/* =========================================
   OPEN CURRENT GAME
========================================= */

$("attemptButton").addEventListener("click", () => {

    if (
        !activeChallenge ||
        activeChallenge.status !== "published"
    ) {
        showToast("There is no published adventure yet.");
        return;
    }

    if (activeChallenge.createdByUID === currentUser.uid) {
        showToast("Your partner must play this adventure.");
        return;
    }

    const game = getCurrentGame();

    if (!game || game.status !== "pending") {
        showToast("This game is not ready to be played.");
        return;
    }

    currentAttemptGame = game;

    renderAttemptGame(game);
    openModal(attemptModal);
});

function renderAttemptGame(game) {
    $("attemptTitle").textContent =
        game.title + " 💜";

    $("attemptEyebrow").textContent =
        `GAME ${activeChallenge.currentGameIndex + 1} OF 05`;

    $("attemptResult").hidden = true;

    const fields = $("attemptFields");

    fields.innerHTML = "";

    if (game.type === "questions") {
        $("attemptDescription").textContent =
            "Answer every question correctly to earn this key.";

        fields.innerHTML = game.questions.map((item, index) => `
            <div class="question-card">
                <h3>QUESTION ${index + 1}</h3>

                <p>${escapeHTML(item.question)}</p>

                <label>Your answer</label>

                <input
                    type="text"
                    class="game-answer"
                    maxlength="250"
                    required
                    autocomplete="off"
                >
            </div>
        `).join("");
    }

    if (game.type === "mystery") {
        $("attemptDescription").textContent =
            game.title;

        fields.innerHTML = `
            <div class="setup-card">
                <h3>YOUR CLUES</h3>

                <p>${escapeHTML(game.clues).replace(/\n/g, "<br>")}</p>

                <label>Your solution</label>

                <input
                    type="text"
                    id="singleGameAnswer"
                    maxlength="250"
                    required
                    autocomplete="off"
                >
            </div>
        `;
    }

    if (game.type === "puzzle") {
        $("attemptDescription").textContent =
            game.title;

        fields.innerHTML = `
            <div class="setup-card">
                <h3>THE PUZZLE</h3>

                <p>${escapeHTML(game.clues).replace(/\n/g, "<br>")}</p>

                <label>Your solution</label>

                <input
                    type="text"
                    id="singleGameAnswer"
                    maxlength="250"
                    required
                    autocomplete="off"
                >
            </div>
        `;
    }

    if (game.type === "dare") {
        $("attemptDescription").textContent =
            "Complete the dare and submit your proof. Your partner must approve it.";

        fields.innerHTML = `
            <div class="setup-card">
                <h3>${escapeHTML(game.title)}</h3>

                <p>${escapeHTML(game.task).replace(/\n/g, "<br>")}</p>

                <label>
                    How did you complete it? Submit your proof or message.
                </label>

                <textarea
                    id="gameSubmission"
                    maxlength="2000"
                    placeholder="${escapeHTML(game.proof)}"
                    required
                ></textarea>
            </div>
        `;
    }

    if (game.type === "mission") {
        $("attemptDescription").textContent =
            "Complete the final mission and submit your work for approval.";

        fields.innerHTML = `
            <div class="setup-card">
                <h3>${escapeHTML(game.title)}</h3>

                <p>${escapeHTML(game.task).replace(/\n/g, "<br>")}</p>

                <label>Your mission submission</label>

                <textarea
                    id="gameSubmission"
                    maxlength="3000"
                    placeholder="${escapeHTML(game.proof)}"
                    required
                ></textarea>
            </div>
        `;
    }

    $("submitAttemptButton").disabled = false;

    $("submitAttemptButton").innerHTML =
        'Submit challenge <i class="fa-solid fa-arrow-right"></i>';
}

/* =========================================
   SUBMIT CURRENT GAME
========================================= */

$("attemptForm").addEventListener("submit", async event => {
    event.preventDefault();

    if (!currentUser || !activeChallenge || !currentAttemptGame) {
        return;
    }

    if (activeChallenge.status !== "published") {
        showToast("This adventure is no longer active.");
        return;
    }

    if (activeChallenge.createdByUID === currentUser.uid) {
        showToast("You cannot attempt your own challenge.");
        return;
    }

    const gameIndex = activeChallenge.currentGameIndex;
    const game = activeChallenge.games[gameIndex];

    if (!game || game.status !== "pending") {
        showToast("This game is not available.");
        return;
    }

    const button = $("submitAttemptButton");

    button.disabled = true;
    button.textContent = "Submitting...";

    try {

        /* GAME 1: KNOW ME BETTER */

        if (game.type === "questions") {
            const answers = [
                ...document.querySelectorAll(".game-answer")
            ];

            if (answers.some(input => !input.value.trim())) {
                showToast("Answer every question first.");

                button.disabled = false;
                button.textContent = "Submit challenge";

                return;
            }

            const correct = answers.every((input, index) =>
                normalizeAnswer(input.value) ===
                normalizeAnswer(game.questions[index].answer)
            );

            if (!correct) {
                $("attemptResult").hidden = false;

                $("attemptResult").textContent =
                    "Not quite! Every answer must be correct. Try again. 💜";

                button.disabled = false;
                button.textContent = "Try again";

                return;
            }

            await completeAutomaticGame(gameIndex);
            return;
        }

        /* GAME 2 AND GAME 4: ANSWER CHALLENGES */

        if (
            game.type === "mystery" ||
            game.type === "puzzle"
        ) {
            const answer = $("singleGameAnswer").value.trim();

            if (!answer) {
                showToast("Enter your answer first.");

                button.disabled = false;
                button.textContent = "Submit challenge";

                return;
            }

            if (
                normalizeAnswer(answer) !==
                normalizeAnswer(game.answer)
            ) {
                $("attemptResult").hidden = false;

                $("attemptResult").textContent =
                    "That isn't the correct solution. Have another try!";

                button.disabled = false;
                button.textContent = "Try again";

                return;
            }

            await completeAutomaticGame(gameIndex);
            return;
        }

        /* GAME 3 AND GAME 5: SUBMISSION FOR APPROVAL */

        if (
            game.type === "dare" ||
            game.type === "mission"
        ) {
            const submission =
                $("gameSubmission").value.trim();

            if (!submission) {
                showToast("Submit your completion proof first.");

                button.disabled = false;
                button.textContent = "Submit challenge";

                return;
            }

            const updatedGames = [
                ...activeChallenge.games
            ];

            updatedGames[gameIndex] = {
                ...updatedGames[gameIndex],
                status: "awaiting_approval",
                submission,
                submittedAt: new Date().toISOString()
            };

            await updateDoc(CHALLENGE_REF, {
                games: updatedGames,
                playerUID: currentUser.uid,
                playerName: currentProfile.name
            });

            $("attemptResult").hidden = false;

            $("attemptResult").textContent =
                "Your submission has been sent! Your partner must approve it before you receive the key. 💜";

            button.textContent = "Submission sent!";

            showToast("Your mission is waiting for approval.");
        }

    } catch (error) {
        console.error("Game submission failed:", error);

        showToast(
            `Submission failed: ${error.code || error.message}`
        );

        button.disabled = false;
        button.textContent = "Try again";
    }
});

/* =========================================
   COMPLETE AUTOMATIC GAMES
========================================= */

async function completeAutomaticGame(gameIndex) {
    const updatedGames = [
        ...activeChallenge.games
    ];

    updatedGames[gameIndex] = {
        ...updatedGames[gameIndex],
        status: "completed",
        completedAt: new Date().toISOString()
    };

    const nextIndex = gameIndex + 1;
    const allCompleted = nextIndex >= 5;

    await updateDoc(CHALLENGE_REF, {
        games: updatedGames,
        currentGameIndex: allCompleted ? 4 : nextIndex,
        playerUID: currentUser.uid,
        playerName: currentProfile.name,
        status: allCompleted ? "completed" : "published",
        completedAt: allCompleted ? serverTimestamp() : null
    });

    await awardKey(GAME_INFO[gameIndex].id);

    $("attemptResult").hidden = false;

    $("attemptResult").textContent =
        `Amazing! You earned the key for ${GAME_INFO[gameIndex].title}! 🔑`;

    $("submitAttemptButton").textContent = "Key earned!";

    showToast(`Key ${gameIndex + 1} earned! 💜`);

    setTimeout(() => {
        closeModal(attemptModal);
    }, 1400);
}

/* =========================================
   APPROVE DARE / FINAL MISSION
========================================= */

$("approveButton").addEventListener("click", async () => {

    if (!activeChallenge || !currentUser) return;

    if (activeChallenge.createdByUID !== currentUser.uid) {
        showToast("Only the challenge creator can approve this.");
        return;
    }

    const gameIndex = activeChallenge.games.findIndex(
        game => game.status === "awaiting_approval"
    );

    if (gameIndex < 0) {
        showToast("There is no submission waiting for approval.");
        return;
    }

    const button = $("approveButton");

    button.disabled = true;
    button.textContent = "Approving...";

    try {
        const updatedGames = [
            ...activeChallenge.games
        ];

        updatedGames[gameIndex] = {
            ...updatedGames[gameIndex],
            status: "completed",
            completedAt: new Date().toISOString()
        };

        const nextIndex = gameIndex + 1;
        const allCompleted = nextIndex >= 5;

        await updateDoc(CHALLENGE_REF, {
            games: updatedGames,
            currentGameIndex: allCompleted ? 4 : nextIndex,
            status: allCompleted ? "completed" : "published",
            completedAt: allCompleted ? serverTimestamp() : null
        });

        await awardKey(GAME_INFO[gameIndex].id);

        showToast("Mission approved! A key has been awarded. 🔑");

    } catch (error) {
        console.error("Approval failed:", error);

        showToast(
            `Approval failed: ${error.code || error.message}`
        );

        button.disabled = false;
        button.textContent = "Approve and award key";
    }
});

/* =========================================
   AWARD KEYS
========================================= */

async function awardKey(gameId) {
    await setDoc(KEYS_REF, {
        earned: arrayUnion(gameId),
        updatedAt: serverTimestamp()
    }, { merge: true });
}

/* =========================================
   KEY COLLECTION AND VAULT
========================================= */

function updateKeyInterface() {
    const count = earnedKeys.length;

    $("keyCount").textContent = `${count} / 5`;

    $("progressFill").style.width =
        `${Math.min(count / 5 * 100, 100)}%`;

    const unlocked = GAME_INFO.every(game =>
        earnedKeys.includes(game.id)
    );

    $("vaultStatus").innerHTML = unlocked
        ? '<i class="fa-solid fa-lock-open"></i> VAULT UNLOCKED'
        : '<i class="fa-solid fa-lock"></i> STILL LOCKED';

    $("vaultMessage").textContent = unlocked
        ? "You have collected all five keys. Your surprise awaits!"
        : `You have ${count} of 5 keys. Keep going to reveal your surprise.`;

    $("rewardButton").disabled = !unlocked;

    renderGameList();
}

/* =========================================
   GRAND REWARD
========================================= */

$("rewardButton").addEventListener("click", () => {

    const unlocked = GAME_INFO.every(game =>
        earnedKeys.includes(game.id)
    );

    if (!unlocked) {
        showToast("You still need more keys!");
        return;
    }

    $("rewardContent").textContent =
        "You completed The Great Key Hunt and collected all five keys. " +
        "Your special reward is ready to be revealed! 💜";

    openModal(rewardModal);
});