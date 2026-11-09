// Local development template.
//   cp src/firebase-config.example.js src/firebase-config.js
// then fill in the values from Firebase Console -> Project settings -> Your apps.
// The real src/firebase-config.js is gitignored and must never be committed.
//
// A Firebase *web* API key is a public client identifier, not a secret. The
// actual protection is the Firestore rules plus HTTP-referrer/API restrictions
// on the key in Google Cloud Console. The deployed site necessarily includes
// the config in its JavaScript bundle.
export const FIREBASE_CONFIG = {
  apiKey: 'REPLACE_WITH_FIREBASE_WEB_API_KEY',
  authDomain: 'p1-maths.firebaseapp.com',
  projectId: 'p1-maths',
  storageBucket: 'p1-maths.firebasestorage.app',
  messagingSenderId: '593709237589',
  appId: 'REPLACE_WITH_FIREBASE_APP_ID',
  measurementId: 'G-ZWXELF5EK5',
};
