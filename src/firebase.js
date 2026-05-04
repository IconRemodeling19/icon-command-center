import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, update, remove, push } from "firebase/database";
import { getAuth, signInAnonymously } from "firebase/auth";

// Shares the icon-work-orders Firebase project. Command Center data lives
// under the commandCenter/* namespace so it can't collide with work-orders
// data. Top-level RTDB rules require auth != null, so we sign in
// anonymously on load — the same pattern as icon-portal.
const firebaseConfig = {
  apiKey: "AIzaSyDwSR8OG2WOJAXn45DPI5jy0dmZhkRylEY",
  authDomain: "icon-work-orders.firebaseapp.com",
  databaseURL: "https://icon-work-orders-default-rtdb.firebaseio.com",
  projectId: "icon-work-orders",
  storageBucket: "icon-work-orders.firebasestorage.app",
  messagingSenderId: "398209180761",
  appId: "1:398209180761:web:9a820bf3f4be2c88bc7d48"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

const authReady = signInAnonymously(auth)
  .then((cred) => cred)
  .catch((err) => {
    console.error("[command-center firebase] anon auth FAILED:", err);
    throw err;
  });

export { app, db, auth, authReady, ref, onValue, set, update, remove, push };
