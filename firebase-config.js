
const firebaseConfig = {
  apiKey: "AIzaSyCjar56s60Ou7burfKb3e8PzkIDHsSe22M",
  authDomain: "edex-word-portal.firebaseapp.com",
  projectId: "edex-word-portal",
  storageBucket: "edex-word-portal.firebasestorage.app",
  messagingSenderId: "646120822138",
  appId: "1:646120822138:web:cc9e94ab9afa48b665f2c3"
};

const ADMIN_UID = "7gEuOslTehRo1QaqnxBxEDSE69D2";

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
