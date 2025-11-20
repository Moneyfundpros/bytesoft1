export interface SchemeItem {
  id?: string;
  courseId: string;
  teacherId: string;
  title: string;
  description?: string;
  createdAt?: string;
}

export interface CBTQuestion {
  id?: string;
  teacherId: string;
  courseId: string;
  question: string;
  options: string[];
  correct: string; // exact option text
  schemeItem?: string;
  points?: number;
  createdAt?: string;
}

export interface CBTExam {
  id?: string;
  title: string;
  courseId: string;
  teacherId: string;
  schemeItems: string[];
  questions?: CBTQuestion[];
  difficulty?: 'Easy'|'Normal'|'Hard';
  duration?: number; // minutes
  totalQuestions?: number;
  status?: 'draft'|'published';
  createdAt?: string;
}

export interface ExamAttempt {
  id?: string;
  examId: string;
  courseId: string;
  studentId: string;
  answers: any;
  score?: number;
  startedAt?: string;
  finishedAt?: string;
}
