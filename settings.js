
/* =====================================================
   PD — SETTINGS & BACKGROUND NOTIFICATIONS
   ===================================================== */

import { auth, db } from "./firebase.js";

import { enablePDBackgroundNotifications } from "./notifications.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.getElementById("pd-notifications-toggle");
    const status = document.getElementById("pd-notification-status");

    if (!toggle) {
        console.error("PD notification switch was not found.");
        return;
    }

    let currentUser = null;
    let updating = false;

    function showStatus(message) {
        if (status) status.textContent = message;
    }

    onAuthStateChanged(auth, async (user) => {
        currentUser = user;

        if (!user) {
            toggle.disabled = true;
            showStatus("Please sign in to PD.");
            return;
        }

        try {
            const { getDoc } = await import(
                "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js"
            );

            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            // Default to ON if no preference has been saved yet.
            toggle.checked =
                userSnap.exists() &&
                userSnap.data().notificationsEnabled === false
                    ? false
                    : true;

            toggle.disabled = false;
            showStatus(
                toggle.checked
                    ? "Notifications enabled 💜"
                    : "Notifications are off"
            );
        } catch (error) {
            console.error("Could not load PD notification settings:", error);
            toggle.disabled = false;
            showStatus("Could not load notification settings.");
        }
    });

    toggle.addEventListener("change", async () => {
        if (!currentUser || updating) return;

        updating = true;
        toggle.disabled = true;

        const enabled = toggle.checked;

        try {
            if (enabled) {
                // Must be called from the user's switch interaction.
                await enablePDBackgroundNotifications();
            }

            await setDoc(
                doc(db, "users", currentUser.uid),
                {
                    notificationsEnabled: enabled,
                    updatedAt: serverTimestamp()
                },
                { merge: true }
            );

            showStatus(
                enabled
                    ? "Notifications enabled 💜"
                    : "Notifications turned off."
            );
        } catch (error) {
            console.error("PD notification settings error:", error);

            toggle.checked = !enabled;
            showStatus(error.message || "Could not update notifications.");
        } finally {
            updating = false;
            toggle.disabled = false;
        }
    });
});
