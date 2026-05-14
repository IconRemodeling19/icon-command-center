import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, get, set, update, remove, push } from "firebase/database";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

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
const storage = getStorage(app);

const authReady = signInAnonymously(auth)
  .then((cred) => cred)
  .catch((err) => {
    console.error("[command-center firebase] anon auth FAILED:", err);
    throw err;
  });

// Secondary Firebase app for icon-timeclock-8f75a (crew time entries +
// active work orders). Read-only from this app — used by Dashboard.
//
// Note: this project does NOT have Firebase Auth (Identity Platform) set up
// — the icon-timeclock-app itself never calls signInAnonymously on its own
// project, only on the cross-project orders app. Calling signInAnonymously
// here produces "auth/configuration-not-found". We therefore skip auth and
// expose a pre-resolved `timeclockAuthReady` so downstream code can keep
// the same `authReady.then(() => onValue(...))` shape.
const timeclockConfig = {
  apiKey: "AIzaSyAIlZvU_5Mjdf3oFG4zM63kSTQOvYjip8g",
  authDomain: "icon-timeclock-8f75a.firebaseapp.com",
  databaseURL: "https://icon-timeclock-8f75a-default-rtdb.firebaseio.com",
  projectId: "icon-timeclock-8f75a",
  storageBucket: "icon-timeclock-8f75a.firebasestorage.app",
  messagingSenderId: "969024137570",
  appId: "1:969024137570:web:07476a2111a3951b44e43b",
};

const timeclockApp = initializeApp(timeclockConfig, "timeclock");
const timeclockDb = getDatabase(timeclockApp);
const timeclockAuthReady = Promise.resolve();

export {
  app, db, auth, authReady,
  ref, onValue, get, set, update, remove, push,
  storage, storageRef, uploadBytes, getDownloadURL, deleteObject,
  timeclockDb, timeclockAuthReady,
};
