// Firebase for the Polar Fur Lab.
// Reuses the same Firebase project and Google OAuth as the P1 maths games.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  setDoc,
  doc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

// The real web config is deliberately NOT committed. The GitHub Actions Pages
// build writes src/firebase-config.js from the FIREBASE_CONFIG repository
// secret. For local sign-in, copy src/firebase-config.example.js to
// src/firebase-config.js and fill it in (that file is gitignored).
let firebaseConfig = null;
try {
  const mod = await import('./firebase-config.js');
  const cfg = mod?.FIREBASE_CONFIG;
  if (cfg && typeof cfg.apiKey === 'string' && !cfg.apiKey.includes('REPLACE_WITH')) {
    firebaseConfig = cfg;
  }
} catch (err) {
  console.warn('Firebase config not installed. Google sign-in is disabled; ?dev and ?guest still work.');
}

export const app = firebaseConfig ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
const provider = app ? new GoogleAuthProvider() : null;
if (provider) provider.setCustomParameters({ prompt: 'select_account' });

/** SHA-256 of each teacher's lower-case email. The address is never committed. */
export const TEACHER_EMAIL_HASHES = [
  '852963690b9bd30bbef93e579151028d4f027e008ff1233c27ff8dd9b5ee6d22',
];

export async function isTeacherEmail(email) {
  if (!email || !crypto.subtle) return false;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.trim().toLowerCase()));
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return TEACHER_EMAIL_HASHES.includes(hex);
}

const NOT_CONFIGURED = 'Firebase is not configured on this copy. Add src/firebase-config.js locally, or set the FIREBASE_CONFIG GitHub secret for deployment.';

function friendlyAuthError(err) {
  const code = err?.code || '';
  if (code === 'auth/unauthorized-domain') {
    return 'This website is not yet allowed in Firebase sign-in. Add its domain in Firebase Console → Authentication → Settings → Authorized domains.';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Sign-in was closed. Please try again.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network problem. Check the internet connection and try again.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google sign-in is not enabled for this Firebase project.';
  }
  return 'Google sign-in failed. Please try again, or ask your teacher.';
}

/** Popup first; fall back to redirect when the browser blocks popups. */
export async function signIn() {
  if (!auth || !provider) throw new Error(NOT_CONFIGURED);
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (err?.code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw new Error(friendlyAuthError(err));
  }
}

export async function completeRedirectSignIn() {
  if (!auth) return;
  try {
    await getRedirectResult(auth);
  } catch (err) {
    console.warn('redirect sign-in', err);
  }
}

export async function signOutUser() {
  if (!auth) return;
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('sign out failed', err);
  }
}

/**
 * cb(user) after Firebase restores a session; onSignedOut() when there is none.
 * user has { uid, name, email, photoURL }.
 */
export function onUser(cb, onSignedOut = () => {}) {
  if (!auth) {
    onSignedOut();
    return;
  }
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      onSignedOut();
      return;
    }
    cb({
      uid: user.uid,
      name: user.displayName || (user.email ? user.email.split('@')[0] : 'Student'),
      email: user.email || '',
      photoURL: user.photoURL || '',
    });
  });
}

export async function savePolarSession(record) {
  if (!db) throw new Error(NOT_CONFIGURED);
  const payload = { ...record, createdAt: serverTimestamp() };
  // Deterministic id = retry-safe (no duplicate if the first response was lost).
  const id = String(record.sessionId || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120);
  if (!id) throw new Error('Missing session id');
  await setDoc(doc(db, 'polarSessions', id), payload);
  return id;
}

export async function loadPolarSessions(max = 400) {
  if (!db) throw new Error(NOT_CONFIGURED);
  const q = query(collection(db, 'polarSessions'), orderBy('finishedAtMs', 'desc'), limit(max));
  const snap = await getDocs(q);
  const rows = [];
  snap.forEach((docSnap) => rows.push({ id: docSnap.id, ...docSnap.data() }));
  return rows;
}

export function firestoreHelp() {
  return 'Firestore refused the read. Publish the updated rules from firestore.rules (see docs/firebase-setup.md).';
}
