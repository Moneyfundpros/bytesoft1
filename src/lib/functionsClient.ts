import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

const functions = getFunctions(app);

export async function generateExamQuestions(params: { courseId: string; schemeItems: string[]; duration: number; numQuestions: number; difficulty: string }) {
  const fn = httpsCallable(functions, 'generateExamQuestions');
  const res = await fn(params);
  return res.data;
}
