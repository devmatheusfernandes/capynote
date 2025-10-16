import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Firestore and export reference
export const db = getFirestore(app);

// Enable offline persistence (IndexedDB) with graceful fallback
// Only run in browser environments
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err: any) => {
    const code = err?.code || "unknown";
    if (code === "failed-precondition") {
      // Multiple tabs open, persistence can only be enabled in one tab at a time
      console.warn(
        "Firestore persistence não habilitada: já ativa em outra aba."
      );
    } else if (code === "unimplemented") {
      // The current browser does not support all features required to enable persistence
      console.warn(
        "Firestore persistence não suportada neste navegador (IndexedDB)."
      );
    } else {
      console.error(
        "Falha ao habilitar Firestore offline persistence:",
        err
      );
    }
  });
}

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

// Configure Google provider
googleProvider.setCustomParameters({
  prompt: "select_account",
});

export default app;
