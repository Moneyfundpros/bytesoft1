import { db } from './firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { CBTExam, CBTQuestion } from '@/types/cbt';

export async function createExam(exam: Partial<CBTExam>) {
  const ref = await addDoc(collection(db, 'cbt_exams'), {
    ...exam,
    status: exam.status || 'draft',
    createdAt: serverTimestamp()
  } as any);
  return ref.id;
}

export async function publishExam(examId: string) {
  const d = doc(db, 'cbt_exams', examId);
  await updateDoc(d, { status: 'published', publishedAt: serverTimestamp() } as any);
}

export async function saveExamQuestions(examId: string, questions: CBTQuestion[]) {
  const d = doc(db, 'cbt_exams', examId);
  await updateDoc(d, { questions } as any);
}

export default { createExam, publishExam, saveExamQuestions };
