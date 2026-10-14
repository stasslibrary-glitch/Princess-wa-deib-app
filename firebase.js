
import { initializeApp } from
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import { getAuth } from
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import { getStorage } from
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";

// NEW: Realtime Database for online status and last seen
import { getDatabase } from
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";


const firebaseConfig = {
    apiKey: "AIzaSyBqmqVQCvgPpary3GOCLks3IBsoeerqGHs",
    authDomain: "princess-wa-deib.firebaseapp.com",
    projectId: "princess-wa-deib",
    storageBucket: "princess-wa-deib.firebasestorage.app",
    messagingSenderId: "802098476214",
    appId: "1:802098476214:web:80f8ed04a82bd53e236217",

    // NEW: Your Realtime Database URL
    databaseURL: "https://princess-wa-deib-default-rtdb.firebaseio.com"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);


// Existing Authentication — unchanged
const auth = getAuth(app);


// Existing Firestore — unchanged
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});


// Existing Storage — unchanged
const storage = getStorage(app);


// NEW: Realtime Database
const presenceDB = getDatabase(app);


// Export everything
export {
    app,
    auth,
    db,
    storage,
    presenceDB
};
