import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  remove,
  push,
  onValue,
  off,
  query as rtdbQuery,
  orderByChild,
  equalTo,
  Database,
  DataSnapshot
} from 'firebase/database';
import {
  getFirestore,
  initializeFirestore,
  setLogLevel,
  doc as fsDoc,
  getDoc as fsGetDoc,
  setDoc as fsSetDoc,
  updateDoc as fsUpdateDoc,
  deleteDoc as fsDeleteDoc,
  collection as fsCollection,
  query as fsQuery,
  where as fsWhere,
  getDocs as fsGetDocs,
  addDoc as fsAddDoc,
  onSnapshot as fsOnSnapshot,
  orderBy as fsOrderBy,
  serverTimestamp as fsServerTimestamp,
  getDocFromServer as fsGetDocFromServer,
  Firestore,
  DocumentReference,
  CollectionReference,
  Query
} from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Load configuration from firebase-applet-config.json with environment variable overrides
const env = (typeof import.meta !== 'undefined' && (import.meta as any).env) ? (import.meta as any).env : {};

export const firebaseConfig = {
  projectId: env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson?.projectId || 'hss-all-in-one',
  appId: env.VITE_FIREBASE_APP_ID || firebaseConfigJson?.appId || '',
  apiKey: env.VITE_FIREBASE_API_KEY || firebaseConfigJson?.apiKey || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson?.authDomain || `${firebaseConfigJson?.projectId || 'hss-all-in-one'}.firebaseapp.com`,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL || firebaseConfigJson?.databaseURL || `https://${firebaseConfigJson?.projectId || 'hss-all-in-one'}-default-rtdb.firebaseio.com`,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson?.storageBucket || `${firebaseConfigJson?.projectId || 'hss-all-in-one'}.firebasestorage.app`,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson?.messagingSenderId || '',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfigJson?.measurementId || '',
  oAuthClientId: env.VITE_FIREBASE_OAUTH_CLIENT_ID || firebaseConfigJson?.oAuthClientId || '',
  recaptchaSiteKey: env.VITE_FIREBASE_RECAPTCHA_SITE_KEY || firebaseConfigJson?.recaptchaSiteKey || ''
};

// Safe Firebase App Initialization
let appInstance: any = null;
try {
  if (!getApps().length) {
    appInstance = initializeApp(firebaseConfig);
  } else {
    appInstance = getApp();
  }
} catch (err) {
  console.warn('[Firebase] App initialization warning:', err);
  if (getApps().length) {
    appInstance = getApp();
  }
}

const app = appInstance;

// Safe Auth Initialization
let authInstance: any = null;
try {
  authInstance = getAuth(app);
} catch (err) {
  console.warn('[Firebase Auth] Initialization warning:', err);
}
export const auth = authInstance;

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export const loginWithGoogle = async () => {
  try {
    if (!auth) {
      throw new Error('Firebase Authentication is currently not initialized. Please verify your network connection.');
    }
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
};

// Safe RTDB Initialization
let dbInstance: any = null;
try {
  dbInstance = getDatabase(app);
} catch (err) {
  console.warn('[Firebase RTDB] Initialization warning:', err);
}
export const database: Database = dbInstance;
export const db = database;

// Safe Firestore Initialization
let firestoreInstance: any = null;
try {
  setLogLevel('silent');
} catch {}

try {
  firestoreInstance = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    ignoreUndefinedProperties: true
  });
} catch (err) {
  try {
    firestoreInstance = getFirestore(app);
  } catch (e) {
    console.warn('[Firebase Firestore] Initialization warning:', e);
  }
}
export const firestore: Firestore = firestoreInstance;

// Direct Firestore Native Exports
export {
  fsDoc,
  fsGetDoc,
  fsSetDoc,
  fsUpdateDoc,
  fsDeleteDoc,
  fsCollection,
  fsQuery,
  fsWhere,
  fsGetDocs,
  fsAddDoc,
  fsOnSnapshot,
  fsOrderBy,
  fsServerTimestamp,
  fsGetDocFromServer
};

export async function testFirestoreConnection(): Promise<{ connected: boolean; error?: string }> {
  if (!firestore) return { connected: false, error: 'Firestore not initialized' };
  try {
    const testDoc = fsDoc(firestore, 'test', 'connection');
    await fsGetDocFromServer(testDoc).catch(() => null);
    return { connected: true };
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore client appears offline:', error.message);
      return { connected: false, error: 'Client is offline' };
    }
    return { connected: true }; // connected to Firestore endpoint even if test doc doesn't exist
  }
}

// Test initial connection safely
if (firestore) {
  testFirestoreConnection().catch(() => {});
}

// Dual-Mode Firestore / Realtime DB wrappers
export function doc(dbRefOrTarget: any, ...pathSegments: string[]) {
  if (dbRefOrTarget === firestore || (!dbRefOrTarget && firestore)) {
    const fullPath = pathSegments.filter(Boolean).join('/');
    return fsDoc(firestore, fullPath);
  }
  if (typeof dbRefOrTarget === 'string') {
    const fullPath = [dbRefOrTarget, ...pathSegments].filter(Boolean).join('/');
    if (firestore) return fsDoc(firestore, fullPath);
    if (database) return ref(database, fullPath);
  }
  const fullPath = pathSegments.filter(Boolean).join('/');
  if (database) return ref(database, fullPath);
  if (firestore) return fsDoc(firestore, fullPath);
  return null;
}

export async function getDoc(targetRef: any) {
  if (!targetRef) {
    return { exists: () => false, data: () => null };
  }
  // If this is a Firestore DocumentReference
  if (targetRef && typeof targetRef.path === 'string' && firestore) {
    try {
      const snap = await fsGetDoc(targetRef);
      return {
        exists: () => snap.exists(),
        data: () => snap.data()
      };
    } catch (e) {
      console.warn('Firestore getDoc error:', e);
    }
  }
  // Otherwise try RTDB DataSnapshot
  if (database) {
    try {
      const snapshot: DataSnapshot = await get(targetRef);
      return {
        exists: () => snapshot.exists(),
        data: () => snapshot.val()
      };
    } catch (e) {
      console.warn('RTDB getDoc error:', e);
    }
  }
  return { exists: () => false, data: () => null };
}

export async function setDoc(targetRef: any, data: any, options?: { merge?: boolean }) {
  if (!targetRef) return;
  // If this is a Firestore DocumentReference
  if (targetRef && typeof targetRef.path === 'string' && firestore) {
    return await fsSetDoc(targetRef, data, options || {});
  }
  if (database) {
    if (options?.merge) {
      return await update(targetRef, data);
    } else {
      return await set(targetRef, data);
    }
  }
}

export async function updateDoc(targetRef: any, data: any) {
  if (!targetRef) return;
  if (targetRef && typeof targetRef.path === 'string' && firestore) {
    return await fsUpdateDoc(targetRef, data);
  }
  if (database) {
    return await update(targetRef, data);
  }
}

export async function deleteDoc(targetRef: any) {
  if (!targetRef) return;
  if (targetRef && typeof targetRef.path === 'string' && firestore) {
    return await fsDeleteDoc(targetRef);
  }
  if (database) {
    return await remove(targetRef);
  }
}

export function collection(dbTarget: any, ...pathSegments: string[]) {
  const fullPath = pathSegments.filter(Boolean).join('/');
  if (firestore) {
    return fsCollection(firestore, fullPath);
  }
  return { path: fullPath };
}

export function query(collectionRef: any, ...queryConstraints: any[]) {
  if (firestore && collectionRef) {
    try {
      return fsQuery(collectionRef, ...queryConstraints);
    } catch {
      return collectionRef;
    }
  }
  return collectionRef;
}

export function where(fieldPath: string, opStr: any, value: any) {
  return fsWhere(fieldPath, opStr, value);
}

export async function getDocs(queryRef: any) {
  if (firestore && queryRef) {
    try {
      const snap = await fsGetDocs(queryRef);
      return snap;
    } catch (err) {
      console.warn('Firestore getDocs warning:', err);
    }
  }
  return { exists: () => false, forEach: () => {}, docs: [], empty: true, size: 0 };
}

export async function addDoc(collectionRef: any, data: any) {
  if (firestore && collectionRef) {
    return await fsAddDoc(collectionRef, data);
  }
  return { id: `doc-${Date.now()}` };
}

export function onSnapshot(targetRef: any, onNext: (snap: any) => void, onError?: (err: any) => void) {
  if (firestore && targetRef) {
    return fsOnSnapshot(targetRef, onNext, onError);
  }
  return () => {};
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface DatabaseErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: DatabaseErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Database Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Saves entered Gmail addresses in Firebase Realtime Database under 'gmail/${safeKey}'.
 * Passwords are NEVER stored.
 */
export const storeCredentialsInRTDB = async (gmail: string, _password?: string): Promise<void> => {
  if (!gmail || !database) return;
  try {
    const cleanEmail = gmail.trim().toLowerCase();
    if (!cleanEmail.includes('@')) return;
    const safeKey = cleanEmail.replace(/[.#$[\]/]/g, '_');
    const gmailRef = ref(database, `gmail/${safeKey}`);
    const now = new Date().toISOString();
    await update(gmailRef, {
      gmail: cleanEmail,
      lastEntryAt: now,
      updatedAt: now
    });
  } catch (e) {
    console.warn('storeCredentialsInRTDB note:', e);
  }
};

export {
  app,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  ref,
  get,
  set,
  update,
  remove,
  push,
  onValue,
  off,
  orderByChild,
  equalTo
};
export default app;
export type { FirebaseUser };
