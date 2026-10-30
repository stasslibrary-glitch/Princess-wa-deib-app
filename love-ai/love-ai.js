
import { app, auth, db } from "../firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    limit,
    serverTimestamp,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import {
    getAI,
    getGenerativeModel,
    GoogleAIBackend,
    ThinkingLevel
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-ai.js";


/* =========================================
   PD LOVE AI CONFIGURATION
========================================= */

const APPROVED_ACCOUNTS = {
    "princess@gmail.com": {
        name: "Princess",
        displayName: "Deib 💜"
    },

    "deib@gmail.com": {
        name: "Deib",
        displayName: "Princess ❤️"
    }
};

const CHAT_ROOM = "shared";
const MESSAGE_LIMIT = 40;

const ai = getAI(app, {
    backend: new GoogleAIBackend()
});

const model = getGenerativeModel(ai, {
    model: "gemini-3.8-flash",

    systemInstruction: `
You are PD Love AI, also called Our Little AI.

You are a lovely, warm, playful and thoughtful AI companion
for two people in a relationship: Deib and Princess.

YOUR PERSONALITY:
- Sweet, romantic, caring and natural.
- Playful when the situation allows.
- Respectful, mature and emotionally intelligent.
- Use emojis naturally, especially hearts and purple hearts.
- Never sound robotic or overly formal.
- Keep ordinary replies reasonably short.
- Give detailed answers when asked for advice, ideas or writing.

YOUR RELATIONSHIP:
- The two people are Deib and Princess.
- They started their relationship on 26 June 2026.
- They are building a private relationship website called
  Princess wa Deib, shortened to PD.
- They enjoy romantic messages, music, surprises and
  making beautiful memories together.

IMPORTANT:
- You are an AI companion, not Deib or Princess.
- Never pretend to be either person.
- Never claim to know an event that has not been shared with you.
- Use saved memories as context, not as unquestionable facts.
- Do not invent personal details.
- Never encourage manipulation, jealousy or controlling behaviour.
- Help them communicate honestly and kindly.
- Both Deib and Princess can use this shared conversation.
- Treat both users equally.
- Do not reveal secrets or claim to access their private
  messages outside the memories deliberately shared here.

Your purpose is to help Deib and Princess create more
beautiful moments together.
`
});


/* =========================================
   PAGE ELEMENTS
========================================= */

const chatMessages = document.getElementById("chatMessages");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const typingIndicator = document.getElementById("typingIndicator");

const memoryForm = document.getElementById("memoryForm");
const memoryInput = document.getElementById("memoryInput");
const memoryList = document.getElementById("memoryList");
const saveMemoryButton = document.getElementById("saveMemoryButton");

const memoryToggle = document.getElementById("memoryToggle");
const memoryContent = document.getElementById("memoryContent");
const memoryArrow = document.getElementById("memoryArrow");

const toast = document.getElementById("toast");


/* =========================================
   APPLICATION STATE
========================================= */

let currentUser = null;
let currentProfile = null;
let chatSession = null;

let sharedMemories = [];

let isSending = false;
let hasSentMessage = false;
let conversationLoaded = false;


/* =========================================
   FIRESTORE REFERENCES
========================================= */

const messagesRef = collection(
    db,
    "pdLoveAIChats",
    CHAT_ROOM,
    "messages"
);

const memoriesRef = collection(
    db,
    "pdLoveAIMemories"
);


/* =========================================
   UTILITIES
========================================= */

function showToast(message) {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}


function scrollToBottom() {
    if (!chatMessages) return;

    chatMessages.scrollTop = chatMessages.scrollHeight;
}


function setLoading(loading) {
    isSending = loading;

    if (sendButton) {
        sendButton.disabled = loading;

        sendButton.innerHTML = loading
            ? '<i class="fa-solid fa-spinner fa-spin"></i>'
            : '<i class="fa-solid fa-paper-plane"></i>';
    }

    if (messageInput) {
        messageInput.disabled = loading;
    }

    if (typingIndicator) {
        typingIndicator.hidden = !loading;
    }
}


function formatDate(timestamp) {
    if (!timestamp) return "Just now";

    const date = timestamp.toDate
        ? timestamp.toDate()
        : new Date(timestamp);

    return date.toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short"
    });
}


/* =========================================
   SAVE MESSAGE WITHOUT BLOCKING GEMINI
========================================= */

function saveMessageInBackground(message) {
    const messageData = {
        ...message,
        createdAt: serverTimestamp()
    };

    addDoc(messagesRef, messageData)
        .catch(error => {
            console.error("PD AI message saving failed:", error);

            showToast(
                "Message could not be saved to Firebase. Check your connection."
            );
        });
}


/* =========================================
   DISPLAY CHAT MESSAGES
========================================= */

function addMessageToScreen(message) {
    if (!chatMessages) return;

    const isAI = message.role === "model";

    const wrapper = document.createElement("div");

    wrapper.className = isAI
        ? "message ai-message"
        : "message user-message";

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = isAI ? "👑" : "💜";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    const author = document.createElement("span");
    author.className = "message-author";

    author.textContent = isAI
        ? "PD Love AI"
        : (message.authorName || "PD Member");

    const text = document.createElement("p");
    text.textContent = message.text || "";

    bubble.append(author, text);
    wrapper.append(avatar, bubble);

    chatMessages.appendChild(wrapper);

    scrollToBottom();
}


/* =========================================
   FIX GEMINI CHAT HISTORY

   Gemini does not accept consecutive
   user messages or consecutive model messages.

   This function merges consecutive messages
   into one history entry.
========================================= */

function buildValidGeminiHistory(documents) {
    const history = [];

    documents.forEach(documentSnapshot => {
        const data = documentSnapshot.data();

        if (
            !data.text ||
            !["user", "model"].includes(data.role)
        ) {
            return;
        }

        const role = data.role;

        const lastEntry = history[history.length - 1];

        if (lastEntry && lastEntry.role === role) {

            // Merge consecutive messages of the same role.
            lastEntry.parts.push({
                text: "\n\n" + data.text
            });

        } else {

            history.push({
                role,
                parts: [{ text: data.text }]
            });
        }
    });


    // Gemini history must begin with a user message.
    while (
        history.length &&
        history[0].role !== "user"
    ) {
        history.shift();
    }


    // Gemini history should end with a model response.
    // An unfinished user message should not be included.
    if (
        history.length &&
        history[history.length - 1].role === "user"
    ) {
        history.pop();
    }

    return history;
}


/* =========================================
   LOAD PREVIOUS CONVERSATION
========================================= */

async function loadConversation() {
    try {
        const messagesQuery = query(
            messagesRef,
            orderBy("createdAt", "desc"),
            limit(MESSAGE_LIMIT)
        );

        const snapshot = await getDocs(messagesQuery);

        const documents = snapshot.docs.reverse();

        const history = buildValidGeminiHistory(documents);

        // Display every valid saved message.
        chatMessages.innerHTML = "";

        documents.forEach(documentSnapshot => {
            const data = documentSnapshot.data();

            if (
                !data.text ||
                !["user", "model"].includes(data.role)
            ) {
                return;
            }

            addMessageToScreen({
                role: data.role,
                text: data.text,
                authorName: data.authorName
            });
        });


        // Do not replace a session if someone has
        // already started sending messages.
        if (!hasSentMessage) {
            chatSession = model.startChat({
                history
            });
        }

        conversationLoaded = true;

        console.log(
            "PD AI conversation loaded:",
            history.length,
            "history entries"
        );

        if (documents.length === 0) {
            addMessageToScreen({
                role: "model",
                text: "Hello, Deib and Princess! 💜 I'm so happy to be part of your little world. What shall we talk about today?"
            });
        }

    } catch (error) {

        console.error(
            "PD AI conversation loading failed:",
            error
        );

        // The AI can still work without old history.
        if (!hasSentMessage) {
            chatSession = model.startChat({
                history: []
            });
        }

        conversationLoaded = false;

        showToast(
            "Your previous conversation could not load. You can still chat with PD Love AI."
        );
    }
}


/* =========================================
   LOAD SHARED MEMORIES
========================================= */

async function loadMemories() {
    try {
        const memoryQuery = query(
            memoriesRef,
            orderBy("createdAt", "desc"),
            limit(50)
        );

        const snapshot = await getDocs(memoryQuery);

        sharedMemories = snapshot.docs.map(documentSnapshot => ({
            id: documentSnapshot.id,
            ...documentSnapshot.data()
        }));

        renderMemories();

        console.log(
            "PD AI memories loaded:",
            sharedMemories.length
        );

    } catch (error) {

        console.error(
            "PD AI memory loading failed:",
            error
        );

        // Memory failure must not stop the AI.
        sharedMemories = [];

        renderMemories();
    }
}


/* =========================================
   RENDER MEMORIES
========================================= */

function renderMemories() {
    if (!memoryList) return;

    memoryList.innerHTML = "";

    if (sharedMemories.length === 0) {
        const empty = document.createElement("p");

        empty.className = "muted";
        empty.textContent =
            "Your shared memory book is waiting for its first story. 💜";

        memoryList.appendChild(empty);
        return;
    }

    sharedMemories.forEach(memory => {
        const item = document.createElement("div");
        item.className = "memory-item";

        const content = document.createElement("div");
        content.textContent = memory.text || "";

        const author = document.createElement("small");

        author.textContent =
            `Saved by ${memory.authorName || "A PD member"}`;

        item.append(content, author);

        if (
            currentUser &&
            memory.authorUID === currentUser.uid
        ) {
            const remove = document.createElement("button");

            remove.type = "button";
            remove.textContent = "Delete my memory";
            remove.style.marginTop = "8px";
            remove.style.padding = "6px 9px";
            remove.style.fontSize = "10px";

            remove.addEventListener("click", async () => {
                await deleteMyMemory(memory.id);
            });

            item.appendChild(remove);
        }

        memoryList.appendChild(item);
    });
}


/* =========================================
   SAVE A SHARED MEMORY
========================================= */

async function saveMemory(event) {
    event.preventDefault();

    const text = memoryInput.value.trim();

    if (!text || !currentUser || !currentProfile) {
        return;
    }

    saveMemoryButton.disabled = true;

    try {
        await addDoc(memoriesRef, {
            text,
            authorUID: currentUser.uid,
            authorName: currentProfile.displayName,
            createdAt: serverTimestamp()
        });

        memoryInput.value = "";

        await loadMemories();

        showToast("A new memory has been saved. 💜");

    } catch (error) {

        console.error(
            "PD AI memory save failed:",
            error
        );

        showToast(
            "Could not save that memory. Check Firebase permissions."
        );

    } finally {
        saveMemoryButton.disabled = false;
    }
}


/* =========================================
   DELETE YOUR OWN MEMORY
========================================= */

async function deleteMyMemory(memoryId) {
    const memory = sharedMemories.find(
        item => item.id === memoryId
    );

    if (
        !memory ||
        memory.authorUID !== currentUser.uid
    ) {
        showToast("You can only delete memories you saved.");
        return;
    }

    if (!confirm("Delete this memory from your shared memory book?")) {
        return;
    }

    try {
        await deleteDoc(
            doc(db, "pdLoveAIMemories", memoryId)
        );

        await loadMemories();

        showToast("Memory deleted.");

    } catch (error) {

        console.error(
            "PD AI memory deletion failed:",
            error
        );

        showToast("Could not delete this memory.");
    }
}


/* =========================================
   BUILD MEMORY CONTEXT
========================================= */

function buildMemoryContext() {
    if (!sharedMemories.length) {
        return "No additional shared memories have been saved yet.";
    }

    return sharedMemories
        .slice(0, 20)
        .map(memory => `- ${memory.text}`)
        .join("\n")
        .slice(0, 6000);
}


/* =========================================
   SEND MESSAGE TO GEMINI
========================================= */

async function sendMessage(text) {
    if (
        !text ||
        !currentUser ||
        !chatSession ||
        isSending
    ) {
        return;
    }

    hasSentMessage = true;

    setLoading(true);

    const userMessage = {
        role: "user",
        text,
        authorName: currentProfile.displayName,
        authorUID: currentUser.uid
    };


    // Show the user's message immediately.
    addMessageToScreen(userMessage);


    // Save independently; do not wait for Firestore.
    saveMessageInBackground(userMessage);


    const prompt = `
SHARED MEMORIES FROM DEIB AND PRINCESS:

${buildMemoryContext()}

CURRENT MESSAGE:

${text}

Please respond naturally as PD Love AI.
`;


    try {
        console.time("PD Gemini response time");

        console.time("PD Gemini first token");

const result = await chatSession.sendMessageStream(prompt);

let reply = "";
let firstTokenReceived = false;

for await (const chunk of result.stream) {

    const text = chunk.text();

    if (text) {

        if (!firstTokenReceived) {
            console.timeEnd("PD Gemini first token");
            firstTokenReceived = true;
        }

        reply += text;
    }
}

console.log("PD Gemini completed.");

        if (!reply || !reply.trim()) {
            throw new Error("The AI returned an empty response.");
        }

        const aiMessage = {
            role: "model",
            text: reply.trim(),
            authorName: "PD Love AI",
            authorUID: currentUser.uid
        };


        // Display AI response immediately.
        addMessageToScreen(aiMessage);


        // Save without delaying the next screen update.
        saveMessageInBackground(aiMessage);

    } catch (error) {

        console.error(
            "PD Love AI message failed:",
            error
        );

        let friendlyMessage =
            "I couldn't complete that reply. Please try again. 💜";

        const errorText = (
            error.message || ""
        ).toLowerCase();

        if (
            error.code === "permission-denied" ||
            errorText.includes("permission")
        ) {
            friendlyMessage =
                "Firebase permissions are preventing this operation.";
        } else if (
            errorText.includes("quota") ||
            errorText.includes("429")
        ) {
            friendlyMessage =
                "The AI service has reached its usage limit. Please try again later.";
        } else if (
            errorText.includes("appcheck") ||
            errorText.includes("app check")
        ) {
            friendlyMessage =
                "PD security verification failed. Please refresh and try again.";
        } else if (
            errorText.includes("network") ||
            errorText.includes("fetch")
        ) {
            friendlyMessage =
                "The AI could not connect. Please check your internet connection.";
        } else if (
            errorText.includes("invalid-content")
        ) {
            friendlyMessage =
                "The conversation history needs refreshing. Please reload PD Love AI.";
        }

        showToast(friendlyMessage);

        const warning = document.createElement("small");

        warning.className = "muted";
        warning.textContent =
            "Reply not completed. Please try again.";

        chatMessages.appendChild(warning);

    } finally {
        setLoading(false);

        messageInput.focus();

        scrollToBottom();
    }
}


/* =========================================
   MESSAGE FORM
========================================= */

messageForm.addEventListener("submit", async event => {
    event.preventDefault();

    const text = messageInput.value.trim();

    if (!text || isSending) return;

    messageInput.value = "";

    await sendMessage(text);
});


/* =========================================
   SUGGESTION BUTTONS
========================================= */

document.querySelectorAll(".suggestion").forEach(button => {
    button.addEventListener("click", async () => {
        const prompt = button.dataset.prompt;

        if (!prompt || isSending) return;

        await sendMessage(prompt);
    });
});


/* =========================================
   MEMORY SECTION TOGGLE
========================================= */

memoryToggle.addEventListener("click", () => {
    const isHidden = memoryContent.hidden;

    memoryContent.hidden = !isHidden;

    memoryArrow.classList.toggle(
        "fa-chevron-down",
        !isHidden
    );

    memoryArrow.classList.toggle(
        "fa-chevron-up",
        isHidden
    );
});


/* =========================================
   SAVE MEMORY FORM
========================================= */

memoryForm.addEventListener("submit", saveMemory);


/* =========================================
   AUTHENTICATION
========================================= */

onAuthStateChanged(auth, async user => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    const email = user.email?.toLowerCase();

    if (!APPROVED_ACCOUNTS[email]) {
        await signOut(auth);

        window.location.href = "login.html";
        return;
    }

    currentUser = user;
    currentProfile = APPROVED_ACCOUNTS[email];

    // Start an empty session immediately.
    // Firestore history will load in the background.
    chatSession = model.startChat({
        history: []
    });

    setLoading(false);

    console.log(
        "PD Love AI session started for:",
        currentProfile.displayName
    );


    // These load independently.
    // Neither one blocks the initial AI session.
    loadConversation();
    loadMemories();
});


/* =========================================
   AUTO-RESIZE MESSAGE INPUT
========================================= */

messageInput.addEventListener("input", () => {
    messageInput.style.height = "auto";

    messageInput.style.height =
        Math.min(messageInput.scrollHeight, 110) + "px";
});
