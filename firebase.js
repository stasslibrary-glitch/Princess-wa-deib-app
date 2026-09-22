import { initializeApp } from
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import { getAuth } from
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import { getFirestore } from
    "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


const firebaseConfig = {
    apiKey: "AIzaSyBqmqVQCvgPpary3GOCLks3IBsoeerqGHs",
    authDomain: "princess-wa-deib.firebaseapp.com",
    projectId: "princess-wa-deib",
    storageBucket: "princess-wa-deib.firebasestorage.app",
    messagingSenderId: "802098476214",
    appId: "1:802098476214:web:80f8ed04a82bd53e236217"
};


const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);


export {
    app,
    auth,
    db
};