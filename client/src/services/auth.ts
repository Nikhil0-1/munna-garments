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
import { doc, getDoc, setDoc, collection, getDocs, query, where, limit } from 'firebase/firestore';
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
// SIGN IN — real Firebase Auth with Owner Role Verification
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

    // Load and verify Owner role from Firestore
    let name = user.displayName || 'Shop Owner';
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        const data = snap.data();
        if (data.role !== 'owner' || data.active === false) {
          await signOut(auth);
          throw new Error('Unauthorized account. Only the designated shop owner can access this panel.');
        }
        name = data.name || name;
      } else {
        // Provision owner profile for first authenticated user if none exists
        const ownerDoc: OwnerProfile = {
          uid: user.uid,
          email: user.email || cleanEmail,
          name: name,
          role: 'owner',
          active: true,
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, 'users', user.uid), ownerDoc);
      }
    } catch (checkErr: any) {
      if (checkErr.message?.includes('Unauthorized')) {
        throw checkErr;
      }
    }

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
        'Firebase Web API Key is invalid. Please check your Firebase configuration.'
      );
    }
    if (
      code.includes('user-not-found') ||
      code.includes('wrong-password')  ||
      code.includes('invalid-credential') ||
      code.includes('invalid-login-credentials')
    ) {
      throw new Error('Incorrect email or password. If you have not created your owner account yet, click "First time? Set up owner account" below.');
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
// FIRST-TIME OWNER SETUP — creates initial Owner account
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

    // Persist role in Firestore
    await setDoc(doc(db, 'users', user.uid), profile);

    // Record setup completed in showroom info
    try {
      await setDoc(doc(db, 'publicCatalogue/store/shopInfo', 'general'), {
        owner_setup_completed: true,
        shop_name: 'Munna Readymade Garments',
        shop_location: 'Dhobwal Bazzar',
      }, { merge: true });
    } catch {}

    return profile;
  } catch (err: any) {
    const code = (err?.code || '').toLowerCase();
    if (code.includes('email-already-in-use')) {
      // Account already exists in Firebase Auth — sign in
      return signInOwner(email, pass);
    }
    if (code.includes('weak-password')) {
      throw new Error('Password is too weak. Use at least 8 characters including letters and numbers.');
    }
    throw new Error(err.message || 'Failed to create owner account.');
  }
}

// ---------------------------------------------------------------------------
// AUTH STATE CHANGE — persists session across refreshes & enforces owner-only
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
        if (data?.role === 'owner' && data?.active !== false) {
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
      // If user profile doc is not found yet, default to allow current user
      callback({
        uid:       firebaseUser.uid,
        email:     firebaseUser.email || '',
        name:      firebaseUser.displayName || 'Shop Owner',
        role:      'owner',
        active:    true,
        createdAt: new Date().toISOString(),
      });
    } catch {
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
// CHANGE PASSWORD
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

  if (currentPass && user.email) {
    const cred = EmailAuthProvider.credential(user.email, currentPass);
    await reauthenticateWithCredential(user, cred);
  }

  await updatePassword(user, newPass);
}

// ---------------------------------------------------------------------------
// PASSWORD RESET
// ---------------------------------------------------------------------------

export async function sendPasswordReset(email: string): Promise<void> {
  if (!email.trim()) throw new Error('Please provide your email address.');
  await sendPasswordResetEmail(auth, email.trim());
}

// ---------------------------------------------------------------------------
// CHECK INITIALIZATION
// ---------------------------------------------------------------------------

export async function isOwnerInitialized(): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'publicCatalogue/store/shopInfo', 'general'));
    if (snap.exists() && snap.data()?.owner_setup_completed) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
