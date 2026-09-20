import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: "AIzaSyBiHIN7wanEWDrCmvyxkjgKrbgvxzgzHwc",
  authDomain: "munnagarments-9fb61.firebaseapp.com",
  databaseURL: "https://munnagarments-9fb61-default-rtdb.firebaseio.com",
  projectId: "munnagarments-9fb61",
  storageBucket: "munnagarments-9fb61.firebasestorage.app",
  messagingSenderId: "422188785051",
  appId: "1:422188785051:web:6a2058145f4de9134b153e",
  measurementId: "G-X7LQD8X85H"
};

export function getFirebaseApiKey(): string {
  try {
    const saved = localStorage.getItem('mrg_firebase_api_key');
    if (saved && saved.trim().length > 10) return saved.trim();
  } catch {}
  return import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey;
}

export function setFirebaseApiKey(newKey: string) {
  if (newKey && newKey.trim()) {
    localStorage.setItem('mrg_firebase_api_key', newKey.trim());
    window.location.reload();
  }
}

// Initialize Firebase App with exact credentials
export const app = getApps().length > 0 ? getApp() : initializeApp({
  ...firebaseConfig,
  apiKey: getFirebaseApiKey()
});

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);
