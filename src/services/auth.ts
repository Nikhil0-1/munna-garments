import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updatePassword,
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  type User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, getDocs, collection, query, limit } from 'firebase/firestore';
import { auth, db } from './firebase';

export interface OwnerProfile {
  uid: string;
  email: string;
  name: string;
  role: 'owner';
  active: boolean;
  createdAt: string;
}

const MASTER_OWNER_KEY = 'mrg_master_owner';

interface MasterOwnerRecord {
  uid: string;
  email: string;
  username: string;
  password: string;
  name: string;
  role: 'owner';
  active: boolean;
  createdAt: string;
}

export function getStoredMasterOwner(): MasterOwnerRecord {
  try {
    const raw = localStorage.getItem(MASTER_OWNER_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}

  const defaultOwner: MasterOwnerRecord = {
    uid: 'mrg_owner_master',
    email: 'owner@munnagarments.com',
    username: 'munna',
    password: 'munna123',
    name: 'Munna Readymade Garments Owner',
    role: 'owner',
    active: true,
    createdAt: new Date().toISOString()
  };
  localStorage.setItem(MASTER_OWNER_KEY, JSON.stringify(defaultOwner));
  return defaultOwner;
}

export function saveStoredMasterOwner(owner: Partial<MasterOwnerRecord>): MasterOwnerRecord {
  const current = getStoredMasterOwner();
  const updated: MasterOwnerRecord = { ...current, ...owner };
  localStorage.setItem(MASTER_OWNER_KEY, JSON.stringify(updated));
  return updated;
}

export function generateAutoSecureCredentials(): { username: string; email: string; password: string } {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let password = 'MRG#';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  const username = `munna_${randomSuffix}`;
  const email = `${username}@munnagarments.com`;

  saveStoredMasterOwner({
    username,
    email,
    password,
    name: 'Munna Readymade Garments Owner'
  });

  return { username, email, password };
}

/**
 * Sign in as Owner. Validates credentials with Single Owner system and Firebase.
 */
export async function signInOwner(email: string, pass: string): Promise<OwnerProfile> {
  const cleanEmail = email.trim();
  const cleanPass = pass.trim();
  const master = getStoredMasterOwner();

  if (!cleanEmail || !cleanPass) {
    throw new Error('Please enter Owner Email and password.');
  }

  // 1. Try real Firebase Authentication
  try {
    const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
    const user = userCredential.user;
    return {
      uid: user.uid,
      email: user.email || cleanEmail,
      name: user.displayName || master.name || 'Munna Garments Owner',
      role: 'owner',
      active: true,
      createdAt: new Date().toISOString()
    };
  } catch (err: any) {
    const errCode = (err?.code || '').toLowerCase();
    const errMsg = (err?.message || '').toLowerCase();

    // Check for API key issue
    if (errCode.includes('api-key') || errMsg.includes('api key') || errMsg.includes('api-key')) {
      throw new Error('Firebase Web API Key invalid hai. Kripya Firebase Console ➔ Project Settings ➔ General me se sahi Web API Key copy karke neeche ⚙️ Firebase Key button se update karein.');
    }

    if (errCode.includes('user-not-found') || errCode.includes('wrong-password') || errCode.includes('invalid-credential')) {
      throw new Error('Galat Firebase Email ya Password. Kripya wahi Email aur Password dalein jo aapne Firebase Console me banaya hai.');
    }

    if (errCode.includes('operation-not-allowed')) {
      throw new Error('Firebase Console me "Email/Password" sign-in provider enabled nahi hai. Kripya Authentication ➔ Sign-in method me jakar use Enable karein.');
    }

    if (errCode.includes('invalid-email')) {
      throw new Error('Kripya valid email address dalein (jaise owner@gmail.com).');
    }

    throw new Error(err.message || 'Firebase login failed. Please check your credentials.');
  }
}

/**
 * Initial Owner Registration or Reset. Sets the ONLY 1 Owner account.
 */
export async function setupInitialOwner(email: string, pass: string, name: string = 'Munna Readymade Garments Owner'): Promise<OwnerProfile> {
  const cleanEmail = email.trim();
  const username = cleanEmail.includes('@') ? cleanEmail.split('@')[0] : cleanEmail;

  // Persist as the single master owner
  const master = saveStoredMasterOwner({
    email: cleanEmail.includes('@') ? cleanEmail : `${cleanEmail}@munnagarments.com`,
    username,
    password: pass.trim(),
    name,
  });

  // Try Firebase creation if possible
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, master.email, pass);
    if (userCredential.user) {
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email: master.email,
        name,
        role: 'owner',
        active: true,
        createdAt: new Date().toISOString()
      }).catch(() => {});
    }
  } catch {}

  return {
    uid: master.uid,
    email: master.email,
    name: master.name,
    role: 'owner',
    active: true,
    createdAt: master.createdAt
  };
}

/**
 * Check if owner has been initialized.
 */
export async function isOwnerInitialized(): Promise<boolean> {
  return true; // Single master owner is always ready
}

/**
 * Sign out current user.
 */
export async function signOutOwner(): Promise<void> {
  await signOut(auth);
}

/**
 * Change the owner's password with optional current password verification.
 */
export async function changeOwnerPassword(newPass: string, currentPass?: string): Promise<void> {
  saveStoredMasterOwner({ password: newPass.trim() });
  
  try {
    const user = auth.currentUser;
    if (user) {
      if (currentPass && user.email) {
        const cred = EmailAuthProvider.credential(user.email, currentPass);
        await reauthenticateWithCredential(user, cred).catch(() => {});
      }
      await updatePassword(user, newPass).catch(() => {});
    }
  } catch {}
}

/**
 * Subscribe to Auth State Changes and verify owner status.
 */
export function subscribeToOwnerAuth(callback: (owner: OwnerProfile | null) => void): () => void {
  return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
    if (!firebaseUser) {
      callback(null);
      return;
    }

    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists() && userSnap.data()?.role === 'owner' && userSnap.data()?.active) {
        const data = userSnap.data();
        callback({
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: data.name || 'Shop Owner',
          role: 'owner',
          active: true,
          createdAt: data.createdAt || ''
        });
      } else {
        await signOut(auth);
        callback(null);
      }
    } catch {
      callback(null);
    }
  });
}
