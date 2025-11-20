import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getExamsForCourse, getQuestionsForExam, submitExamAttempt, getAttemptsForStudent } from '@/lib/cbtService';
import CBTExam from './CBTExam';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function CBTTab() {
  const { user } = useAuth();
  const [exams, setExams] = useState<any[]>([]);
  const [selectedExam, setSelectedExam] = useState<any | null>(null);
  const [mode, setMode] = useState<'none' | 'practice' | 'exam'>('none');
  const [questions, setQuestions] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      if (!user) return;
      try {
        const list = await getExamsForCourse('');
        setExams(list || []);
        const hist = await getAttemptsForStudent(user.id);
        setHistory(hist || []);
      } catch (error) {
        console.error('Error loading CBT data:', error);
        setExams([]);
        setHistory([]);
      }
    }
    load();
  }, [user]);

  const openPractice = async () => {
    // load a pool of questions for practice (all available)
    const qs = await getQuestionsForExam('');
    setQuestions(qs || []);
    setSelectedExam(null);
    setMode('practice');
  };

  const openExam = async () => {
    if (!exams || exams.length === 0) {
      alert('No exam found');
      return;
    }
    // pick the first scheduled exam for demo; in real app filter by enrollment/course
    const ex = exams[0];
    setSelectedExam(ex);
    const qs = await getQuestionsForExam(ex.courseId || ex.course);
    setQuestions(qs || []);
    setMode('exam');
  };

  const handleSubmit = async (result: any) => {
    try {
      const attempt = {
        examId: selectedExam?.id || null,
        studentId: user?.id,
        courseId: selectedExam?.courseId || selectedExam?.course || null,
        ...result,
      };
      await submitExamAttempt(attempt);
      const hist = await getAttemptsForStudent(user!.id);
      setHistory(hist || []);
      setMode('none');
      setSelectedExam(null);
      setQuestions([]);
      alert('Exam submitted. Score: ' + result.score + '/' + result.total);
    } catch (error) {
      console.error('Error submitting attempt:', error);
      alert('Failed to submit exam attempt');
    }
  };

  return (
    <div className="space-y-6">
      {mode === 'none' && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-2">CBT Exams</h3>
            <p className="text-sm text-muted-foreground mb-4">Choose a mode to begin.</p>
            <div className="flex gap-3">
              <Button onClick={openExam}>Take Exam</Button>
              <Button variant="outline" onClick={openPractice}>Practice Mode</Button>
            </div>

            <div className="mt-4">
              {exams.length === 0 ? (
                <div className="text-sm text-muted-foreground">No scheduled exams found.</div>
              ) : (
                <div className="space-y-2">
                  {exams.map(e => (
                    <div key={e.id} className="p-3 border rounded-lg">
                      <div className="font-medium">{e.title}</div>
                      <div className="text-xs text-muted-foreground">Duration: {e.duration} minutes · Questions: {e.totalQuestions || 'N/A'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {(mode === 'practice' || mode === 'exam') && (
        <CBTExam
          mode={mode}
          exam={selectedExam}
          questions={questions}
          durationMinutes={selectedExam?.duration || 10}
          onSubmit={handleSubmit}
          onClose={() => { setMode('none'); setQuestions([]); setSelectedExam(null); }}
        />
      )}

      <div>
        <h4 className="text-base font-semibold">History</h4>
        <div className="space-y-2 mt-2">
          {history.length === 0 && <div className="text-sm text-muted-foreground">No past attempts</div>}
          {history.map(h => (
            <div key={h.id} className="p-3 border rounded-lg">
              <div>Exam: {h.examId}</div>
              <div>Score: {h.score} / {h.total}</div>
              <div>Date: {h.completedAt}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
