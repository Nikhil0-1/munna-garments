import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updatePassword,
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  type User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export interface OwnerProfile {
  uid: string;
  email: string;
  name: string;
  role: 'owner';
  active: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// SIGN IN — real Firebase Auth only, no localStorage bypass
// ---------------------------------------------------------------------------

export async function signInOwner(email: string, pass: string): Promise<OwnerProfile> {
  const cleanEmail = email.trim();
  const cleanPass  = pass.trim();

  if (!cleanEmail || !cleanPass) {
    throw new Error('Please enter your Email and Password.');
  }

  try {
    const credential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
    const user = credential.user;

    // Load name from Firestore users doc if available
    let name = user.displayName || 'Shop Owner';
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) name = snap.data().name || name;
    } catch { /* Firestore may be offline — name fallback is fine */ }

    return {
      uid:       user.uid,
      email:     user.email || cleanEmail,
      name,
      role:      'owner',
      active:    true,
      createdAt: new Date().toISOString(),
    };
  } catch (err: any) {
    const code = (err?.code || '').toLowerCase();
    const msg  = (err?.message || '').toLowerCase();

    if (code.includes('api-key') || msg.includes('api key') || msg.includes('invalid-api-key')) {
      throw new Error(
        'Firebase Web API Key is invalid. Go to Firebase Console → Project Settings → General and copy the correct Web API Key into your .env file.'
      );
    }
    if (
      code.includes('user-not-found') ||
      code.includes('wrong-password')  ||
      code.includes('invalid-credential')
    ) {
      throw new Error('Incorrect email or password. Please try again.');
    }
    if (code.includes('operation-not-allowed')) {
      throw new Error(
        'Email/Password sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in method.'
      );
    }
    if (code.includes('invalid-email')) {
      throw new Error('Please enter a valid email address.');
    }
    if (code.includes('too-many-requests')) {
      throw new Error('Too many failed attempts. Please wait a few minutes and try again.');
    }

    throw new Error(err.message || 'Login failed. Please check your credentials.');
  }
}

// ---------------------------------------------------------------------------
// FIRST-TIME OWNER SETUP — creates Firebase Auth account + Firestore profile
// ---------------------------------------------------------------------------

export async function setupInitialOwner(
  email: string,
  pass: string,
  name: string = 'Munna Readymade Garments Owner'
): Promise<OwnerProfile> {
  const cleanEmail = email.trim();
  const cleanPass  = pass.trim();

  if (!cleanEmail || !cleanPass) {
    throw new Error('Email and password are required to create the owner account.');
  }
  if (cleanPass.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  try {
    const credential = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPass);
    const user = credential.user;

    const profile: OwnerProfile = {
      uid:       user.uid,
      email:     cleanEmail,
      name:      name.trim() || 'Shop Owner',
      role:      'owner',
      active:    true,
      createdAt: new Date().toISOString(),
    };

    // Persist role in Firestore so subscribeToOwnerAuth can verify it
    await setDoc(doc(db, 'users', user.uid), profile);

    return profile;
  } catch (err: any) {
    const code = (err?.code || '').toLowerCase();
    if (code.includes('email-already-in-use')) {
      // Account already exists — just sign in
      return signInOwner(email, pass);
    }
    if (code.includes('weak-password')) {
      throw new Error('Password is too weak. Use at least 8 characters including letters and numbers.');
    }
    throw new Error(err.message || 'Failed to create owner account.');
  }
}

// ---------------------------------------------------------------------------
// AUTH STATE CHANGE — persists session across refreshes
// ---------------------------------------------------------------------------

export function subscribeToOwnerAuth(
  callback: (owner: OwnerProfile | null) => void
): () => void {
  return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
    if (!firebaseUser) {
      callback(null);
      return;
    }

    try {
      const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (snap.exists()) {
        const data = snap.data();
        if (data?.active !== false) {
          callback({
            uid:       firebaseUser.uid,
            email:     firebaseUser.email || '',
            name:      data.name || 'Shop Owner',
            role:      'owner',
            active:    true,
            createdAt: data.createdAt || '',
          });
          return;
        }
      }
      // User exists in Firebase Auth but no valid Firestore profile — sign out
      await signOut(auth);
      callback(null);
    } catch {
      // Firestore offline — allow session based on Firebase token alone
      callback({
        uid:       firebaseUser.uid,
        email:     firebaseUser.email || '',
        name:      firebaseUser.displayName || 'Shop Owner',
        role:      'owner',
        active:    true,
        createdAt: new Date().toISOString(),
      });
    }
  });
}

// ---------------------------------------------------------------------------
// SIGN OUT
// ---------------------------------------------------------------------------

export async function signOutOwner(): Promise<void> {
  await signOut(auth);
}

// ---------------------------------------------------------------------------
// CHANGE PASSWORD (requires current password for reauthentication)
// ---------------------------------------------------------------------------

export async function changeOwnerPassword(
  newPass: string,
  currentPass?: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user. Please sign in again.');
  if (!newPass || newPass.length < 8) {
    throw new Error('New password must be at least 8 characters long.');
  }

  // Reauthenticate first if current password provided (required by Firebase for sensitive ops)
  if (currentPass && user.email) {
    const cred = EmailAuthProvider.credential(user.email, currentPass);
    await reauthenticateWithCredential(user, cred);
  }

  await updatePassword(user, newPass);
}

// ---------------------------------------------------------------------------
// PASSWORD RESET (sends email via Firebase)
// ---------------------------------------------------------------------------

export async function sendPasswordReset(email: string): Promise<void> {
  if (!email.trim()) throw new Error('Please provide your email address.');
  await sendPasswordResetEmail(auth, email.trim());
}

// ---------------------------------------------------------------------------
// CHECK INITIALIZATION — always true since Firebase handles it
// ---------------------------------------------------------------------------

export async function isOwnerInitialized(): Promise<boolean> {
  // If Firebase Auth is configured, the owner initializes themselves on first sign-up
  return true;
}
