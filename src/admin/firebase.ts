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

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const ADMIN_DOMAIN = (import.meta.env.VITE_ADMIN_EMAIL_DOMAIN as string | undefined) ?? 'apokryfon.com';

/** Names of the VITE_FIREBASE_* settings that are missing. */
export const missingFirebaseConfig = Object.entries({
  VITE_FIREBASE_API_KEY: config.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: config.authDomain,
  VITE_FIREBASE_PROJECT_ID: config.projectId,
  VITE_FIREBASE_APP_ID: config.appId,
})
  .filter(([, v]) => !v)
  .map(([k]) => k);

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
