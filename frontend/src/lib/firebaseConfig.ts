// firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDmU4KmyNG8K3udgOIauQ0aJ_2PpmuT_FM",
  authDomain: "mmh2025-f6143.firebaseapp.com",
  projectId: "mmh2025-f6143",
  storageBucket: "mmh2025-f6143.firebasestorage.app",
  messagingSenderId: "421230781530",
  appId: "1:421230781530:web:5d93f2665576e4b6986463",
  measurementId: "G-PWSMSPLXM1",
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

export { db };
