import {
    auth
} from "./firebase.js";

import {
    onAuthStateChanged
} from
"https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";


onAuthStateChanged(auth, (user) => {

    if (!user) {

        window.location.replace("login.html");

        return;

    }

    console.log(
        "❤️ PD authenticated:",
        user.email
    );

});