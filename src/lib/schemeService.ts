import { db } from './firebase';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { SchemeItem } from '@/types/cbt';

function schemeCollectionRef(courseId: string) {
  return collection(db, 'courses', courseId, 'scheme');
}

export async function getSchemeForTeacher(teacherId: string, courseId: string) {
  if (!courseId) return [] as SchemeItem[];
  const q = query(schemeCollectionRef(courseId), where('teacherId', '==', teacherId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as SchemeItem[];
}

export async function createSchemeItem(courseId: string, item: Partial<SchemeItem>) {
  const ref = await addDoc(schemeCollectionRef(courseId), {
    ...item,
    createdAt: serverTimestamp(),
  } as any);
  return ref.id;
}

export async function updateSchemeItem(courseId: string, id: string, patch: Partial<SchemeItem>) {
  const d = doc(db, 'courses', courseId, 'scheme', id);
  await updateDoc(d, { ...patch, updatedAt: serverTimestamp() } as any);
}

export async function deleteSchemeItem(courseId: string, id: string) {
  await deleteDoc(doc(db, 'courses', courseId, 'scheme', id));
}

export default { getSchemeForTeacher, createSchemeItem, updateSchemeItem, deleteSchemeItem };
