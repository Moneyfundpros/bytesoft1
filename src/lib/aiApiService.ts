import { db } from './firebase';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';

export async function saveCoordinatorApiKey(coordinatorId: string, apiKey: string) {
  // NOTE: This is a minimal client-side storage implementation. For production,
  // use Cloud Functions + KMS to encrypt and never expose raw keys to the client.
  const encoded = btoa(apiKey);
  const ref = doc(db, 'ai_api_keys', coordinatorId);
  await setDoc(ref, {
    coordinatorId,
    apiKeyEncoded: encoded,
    isVerified: false,
    createdAt: new Date().toISOString()
  });
}

export async function getCoordinatorApiKey(coordinatorId: string) {
  const ref = doc(db, 'ai_api_keys', coordinatorId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  try {
    const raw = data.apiKeyEncoded ? atob(data.apiKeyEncoded) : null;
    return { ...data, apiKey: raw };
  } catch (e) {
    return { ...data, apiKey: null };
  }
}

export async function deleteCoordinatorApiKey(coordinatorId: string) {
  const ref = doc(db, 'ai_api_keys', coordinatorId);
  await deleteDoc(ref);
}
