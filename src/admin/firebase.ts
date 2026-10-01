// Google sign-in for the admin panel, through Firebase Authentication. The
// backend decides who is internal (verified @apokryfon.com emails); the
// `hd` hint below only pre-selects that domain in Google's account picker.

import { initializeApp } from '@firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from '@firebase/auth';

// The Précis Firebase project (newsdigest-9fd33). These values identify the
// app and ship in every browser build - they aren't secrets. Access is
// enforced by the backend. VITE_FIREBASE_* env vars override them, e.g. for a
// staging project.
const env = import.meta.env;
const config = {
  apiKey: (env.VITE_FIREBASE_API_KEY as string | undefined) || 'AIzaSyDtJjo8vjocn0zB68hp22WlEwBMlZBOBSY',
  authDomain: (env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) || 'newsdigest-9fd33.firebaseapp.com',
  projectId: (env.VITE_FIREBASE_PROJECT_ID as string | undefined) || 'newsdigest-9fd33',
  appId: (env.VITE_FIREBASE_APP_ID as string | undefined) || '1:332066900460:web:6c18abbf69e6c9435f98c9',
};

export const ADMIN_DOMAIN = (import.meta.env.VITE_ADMIN_EMAIL_DOMAIN as string | undefined) ?? 'apokryfon.com';

let auth: Auth | null = null;
function getAdminAuth(): Auth {
  auth ??= getAuth(initializeApp(config, 'precis-admin'));
  return auth;
}

export function watchUser(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(getAdminAuth(), callback);
}

export async function signIn(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ hd: ADMIN_DOMAIN, prompt: 'select_account' });
  await signInWithPopup(getAdminAuth(), provider);
}

export function signOut(): Promise<void> {
  return firebaseSignOut(getAdminAuth());
}

export type { User };
