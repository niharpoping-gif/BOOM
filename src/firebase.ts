import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, serverTimestamp } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();
export { serverTimestamp };

// CRITICAL: Test connection on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: any) {
    if (error?.message?.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function isQuotaExceededError(error: any): boolean {
  if (!error) return false;
  const msg = error.message || String(error);
  return msg.includes('Quota limit exceeded') || 
         msg.includes('resource-exhausted') || 
         msg.includes('Quota exceeded') ||
         /quota/i.test(msg);
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const baseMsg = error instanceof Error ? error.message : String(error);
  let finalMsg = baseMsg;
  
  if (isQuotaExceededError(error)) {
    finalMsg = `Quota limit exceeded. Retry after quota limits are reset or enable billing for this project to avoid quota checks. Cause - Quota exceeded for quota metric 'Free daily read units per project (free tier database)' and limit 'Free daily read units per project (free tier database) per day' of service 'firestore.googleapis.com'. Please upgrade your Firebase database Spark plan or verify limits here: https://console.firebase.google.com/project/gen-lang-client-0273418347/firestore/databases/ai-studio-07655128-023c-452c-928e-6287316b1e4a/data?openUpgradeDialog=true`;
  }

  const errInfo: FirestoreErrorInfo = {
    error: finalMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
