import { db } from './firebase';
import { collection, addDoc, doc, setDoc, getDoc, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { generateExamQuestions as callGenerateExamQuestions } from './functionsClient';

export async function createExam(exam: any) {
  const ref = await addDoc(collection(db, 'cbt_exams'), {
    ...exam,
    createdAt: new Date().toISOString()
  });
  return ref.id;
}

export async function addQuestion(question: any) {
  const ref = await addDoc(collection(db, 'cbt_questions'), {
    ...question,
    createdAt: new Date().toISOString()
  });
  return ref.id;
}

export async function getExamsForCourse(courseId: string) {
  const q = query(collection(db, 'cbt_exams'), where('courseId', '==', courseId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getQuestionsForExam(courseId: string) {
  const q = query(collection(db, 'cbt_questions'), where('courseId', '==', courseId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function submitExamAttempt(attempt: any) {
  const ref = await addDoc(collection(db, 'exam_attempts'), {
    ...attempt,
    startedAt: attempt.startedAt || new Date().toISOString()
  });
  return ref.id;
}

export async function getAttemptsForStudent(studentId: string) {
  const q = query(collection(db, 'exam_attempts'), where('studentId', '==', studentId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getAttemptsForExam(examId: string) {
  const q = query(collection(db, 'exam_attempts'), where('examId', '==', examId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function generateQuestionsForExam(params: { courseId: string; schemeItems: string[]; duration: number; numQuestions: number; difficulty: string }) {
  // Calls the callable Cloud Function which enforces teacher/coordinator permissions and uses the system AI key
  return await callGenerateExamQuestions(params);
}
