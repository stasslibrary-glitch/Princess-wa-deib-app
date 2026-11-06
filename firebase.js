
import { initializeApp } from
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import { getAuth } from
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import {
    initializeAppCheck,
    ReCaptchaEnterpriseProvider
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js";

import { getStorage } from
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";

import { getDatabase } from
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";


// ============================================
// FIREBASE CONFIGURATION
// ============================================

const firebaseConfig = {
    apiKey: "AIzaSyBqmqVQCvgPpary3GOCLks3IBsoeerqGHs",
    authDomain: "princess-wa-deib.firebaseapp.com",
    projectId: "princess-wa-deib",
    storageBucket: "princess-wa-deib.firebasestorage.app",
    messagingSenderId: "802098476214",
    appId: "1:802098476214:web:80f8ed04a82bd53e236217",
    databaseURL: "https://princess-wa-deib-default-rtdb.firebaseio.com"
};


// ============================================
// INITIALIZE FIREBASE
// ============================================

const app = initializeApp(firebaseConfig);


// ============================================
// APP CHECK — LOCAL + PRODUCTION
// ============================================

const isLocalhost =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";

// Enable Firebase's debug-token mode ONLY on localhost.
// Production continues using real reCAPTCHA Enterprise.
if (isLocalhost) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

export const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(
        "6LfdCQguAAAAALHoZrTi36ohQ_IiM45x9HT5reEy"
    ),
    isTokenAutoRefreshEnabled: true
});


// ============================================
// FIREBASE AUTHENTICATION
// ============================================

const auth = getAuth(app);


// ============================================
// CLOUD FIRESTORE
// ============================================

const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});


// ============================================
// FIREBASE STORAGE
// ============================================

const storage = getStorage(app);


// ============================================
// REALTIME DATABASE — PRESENCE
// ============================================

const presenceDB = getDatabase(app);


// ============================================
// EXPORT ALL SERVICES
// ============================================

export {
    app,
    auth,
    db,
    storage,
    presenceDB
};
