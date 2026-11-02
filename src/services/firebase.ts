import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

/**
 * Munna Readymade Garments — Firebase Modular SDK Configuration
 * Uses environment variables when available with production project fallback.
 */
export const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || 'AIzaSyBiHIN7wanEWDrCmvyxkjgKrbgvxzgzHwc',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || 'munnagarments-9fb61.firebaseapp.com',
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL       || 'https://munnagarments-9fb61-default-rtdb.firebaseio.com',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || 'munnagarments-9fb61',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || 'munnagarments-9fb61.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '422188785051',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || '1:422188785051:web:6a2058145f4de9134b153e',
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID     || 'G-X7LQD8X85H',
};

// Initialize Firebase as singleton
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Firebase modular services
export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const rtdb    = getDatabase(app);
export const storage = getStorage(app);
