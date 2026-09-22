/* =========================================================
   PRINCESS WA DEIB
   LOGIN SYSTEM
   ========================================================= */

import {
    auth
} from "./firebase.js";

import {
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged
} from
"https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";


/* =========================================================
   ELEMENTS
   ========================================================= */

const emailInput =
    document.getElementById("email");

const passwordInput =
    document.getElementById("password");

const loginButton =
    document.getElementById("loginButton");

const googleButton =
    document.getElementById("googleButton");

const togglePassword =
    document.getElementById("togglePassword");

const loginError =
    document.getElementById("loginError");


/* =========================================================
   ERROR MESSAGE
   ========================================================= */

function showError(message) {

    loginError.textContent = message;

    loginError.classList.add("show");

}


function hideError() {

    loginError.textContent = "";

    loginError.classList.remove("show");

}


/* =========================================================
   EMAIL LOGIN
   ========================================================= */

loginButton.addEventListener(
    "click",
    async () => {

        hideError();

        const email =
            emailInput.value.trim();

        const password =
            passwordInput.value;


        if (!email) {

            showError(
                "Please enter your email."
            );

            return;

        }


        if (!password) {

            showError(
                "Please enter your password."
            );

            return;

        }


        loginButton.classList.add("loading");

        loginButton.querySelector("span")
            .textContent = "Logging in...";


        try {

            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );


            window.location.href =
                "index.html";


        } catch (error) {

            console.error(error);


            let message =
                "We couldn't log you in. Please check your details.";


            if (
                error.code ===
                "auth/invalid-credential"
            ) {

                message =
                    "Email or password is incorrect.";

            }


            if (
                error.code ===
                "auth/user-not-found"
            ) {

                message =
                    "No PD account was found with that email.";

            }


            if (
                error.code ===
                "auth/wrong-password"
            ) {

                message =
                    "The password is incorrect.";

            }


            if (
                error.code ===
                "auth/too-many-requests"
            ) {

                message =
                    "Too many attempts. Please try again later.";

            }


            showError(message);


            loginButton.classList.remove(
                "loading"
            );

            loginButton.querySelector("span")
                .textContent = "Log in";

        }

    }
);


/* =========================================================
   GOOGLE LOGIN
   ========================================================= */

googleButton.addEventListener(
    "click",
    async () => {

        hideError();

        googleButton.disabled = true;

        googleButton.querySelector("span")
            .textContent = "Connecting...";


        try {

            const provider =
                new GoogleAuthProvider();


            await signInWithPopup(
                auth,
                provider
            );


            window.location.href =
                "index.html";


        } catch (error) {

            console.error(error);


            if (
                error.code !==
                "auth/popup-closed-by-user"
            ) {

                showError(
                    "Google sign-in could not be completed."
                );

            }


            googleButton.disabled = false;

            googleButton.querySelector("span")
                .textContent =
                "Continue with Google";

        }

    }
);


/* =========================================================
   SHOW / HIDE PASSWORD
   ========================================================= */

togglePassword.addEventListener(
    "click",
    () => {

        const isPassword =
            passwordInput.type === "password";


        passwordInput.type =
            isPassword
                ? "text"
                : "password";


        togglePassword.innerHTML =
            isPassword
                ? '<i class="fa-regular fa-eye-slash"></i>'
                : '<i class="fa-regular fa-eye"></i>';

    }
);


/* =========================================================
   IF ALREADY LOGGED IN
   ========================================================= */

onAuthStateChanged(
    auth,
    user => {

        if (user) {

            console.log(
                "❤️ Already logged in:",
                user.email
            );

            /*
               Uncomment this later when the
               main app is protected.

               window.location.href = "index.html";
            */

        }

    }
);