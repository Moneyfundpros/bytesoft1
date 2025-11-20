import React, { useEffect, useState, useRef, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

type Question = {
  id: string;
  type: 'mcq' | 'truefalse' | 'text' | 'checkbox';
  question: string;
  choices?: string[];
  answer?: any;
};

interface CBTExamProps {
  mode: 'practice' | 'exam';
  exam?: any;
  questions: Question[];
  durationMinutes?: number; // only used for exam mode
  onSubmit?: (result: any) => void;
  onClose?: () => void;
}

const STORAGE_PREFIX = 'bytesoft-cbt';

export default function CBTExam({ mode, exam, questions: initialQuestions, durationMinutes = 10, onSubmit, onClose }: CBTExamProps) {
  const questions = initialQuestions || [];
  const total = questions.length;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>(() => {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}:answers:${exam?.id || 'practice'}`);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  });
  const [flags, setFlags] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}:flags:${exam?.id || 'practice'}`);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  });

  const [timeLeft, setTimeLeft] = useState(durationMinutes * 60);
  const [running, setRunning] = useState(mode === 'exam');
  const [showReview, setShowReview] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Persist answers/flags
  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}:answers:${exam?.id || 'practice'}`, JSON.stringify(answers));
  }, [answers, exam]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}:flags:${exam?.id || 'practice'}`, JSON.stringify(flags));
  }, [flags, exam]);

  // Timer
  useEffect(() => {
    if (!running) return;
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
    timerRef.current = window.setTimeout(() => setTimeLeft(t => t - 1), 1000) as unknown as number;
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [running, timeLeft]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent | any) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
      if (e.key.toLowerCase() === 'f') toggleFlag();
      if (e.key.toLowerCase() === 's') setShowReview(true);
    };
    window.addEventListener('keydown', handler as any);
    return () => window.removeEventListener('keydown', handler as any);
  }, [currentIndex, answers, flags]);

  const saveAnswer = (qid: string, value: any) => {
    setAnswers(a => ({ ...a, [qid]: value }));
  };

  const toggleFlag = () => {
    const q = questions[currentIndex];
    if (!q) return;
    setFlags(f => ({ ...f, [q.id]: !f[q.id] }));
  };

  const prev = () => setCurrentIndex(i => Math.max(0, i - 1));
  const next = () => setCurrentIndex(i => Math.min(total - 1, i + 1));

  const percent = total ? Math.round(Object.keys(answers).length / total * 100) : 0;

  const handleReset = () => {
    if (!confirm('Reset local progress for this session?')) return;
    setAnswers({});
    setFlags({});
    localStorage.removeItem(`${STORAGE_PREFIX}:answers:${exam?.id || 'practice'}`);
    localStorage.removeItem(`${STORAGE_PREFIX}:flags:${exam?.id || 'practice'}`);
    toast('Progress reset');
  };

  const handleSubmit = () => {
    // Simple scoring for mcq/truefalse
    let correct = 0;
    questions.forEach((q) => {
      const a = answers[q.id];
      if (!a) return;
      if (q.type === 'mcq' || q.type === 'truefalse') {
        if (q.answer !== undefined && a === q.answer) correct++;
      }
    });
    const result = {
      score: correct,
      total: questions.length,
      percentage: questions.length ? Math.round((correct / questions.length) * 100) : 0,
      answers,
      flags,
      submittedAt: new Date().toISOString(),
    };
    // clear timer
    setRunning(false);
    if (onSubmit) onSubmit(result);
    // keep local data for review
    toast.success?.('Exam submitted');
  };

  const current = questions[currentIndex];

  return (
    <div className="bg-card rounded-2xl shadow-lg p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2">
        <header className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">{exam?.title || 'Practice Mode'}</h3>
            <p className="text-sm text-muted-foreground">Question {currentIndex + 1} of {total}</p>
          </div>
          <div className="text-right">
            <div className="text-sm">Time</div>
            <div className="font-mono text-lg">{Math.floor(timeLeft / 60)}:{('0' + (timeLeft % 60)).slice(-2)}</div>
            <div className="mt-2 space-x-2">
              <Button size="sm" onClick={() => setRunning(r => !r)}>{running ? 'Pause' : 'Resume'}</Button>
            </div>
          </div>
        </header>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 min-h-[280px]">
          {current ? (
            <div>
              <h4 className="font-semibold mb-3">{current.question}</h4>
              <div className="space-y-3">
                {current.type === 'text' ? (
                  <textarea
                    className="w-full p-3 rounded-lg border border-border"
                    value={answers[current.id] || ''}
                    onChange={(e) => saveAnswer(current.id, e.target.value)}
                    rows={6}
                  />
                ) : current.type === 'checkbox' ? (
                  (current.choices || []).map((c, idx) => (
                    <label key={idx} className={`block p-2 rounded-lg cursor-pointer ${Array.isArray(answers[current.id]) && answers[current.id].includes(c) ? 'bg-emerald-50' : 'hover:bg-muted'}`}>
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={Array.isArray(answers[current.id]) && answers[current.id].includes(c)}
                        onChange={(e) => {
                          const prev = Array.isArray(answers[current.id]) ? answers[current.id] : [];
                          if (e.target.checked) saveAnswer(current.id, [...prev, c]);
                          else saveAnswer(current.id, prev.filter((x: any) => x !== c));
                        }}
                      />
                      {c}
                    </label>
                  ))
                ) : (
                  (current.choices || []).map((c, idx) => (
                    <label key={idx} className={`block p-3 rounded-lg cursor-pointer border ${answers[current.id] === idx ? 'border-emerald-400 bg-emerald-50' : 'border-transparent hover:border-border'}`}>
                      <input
                        type="radio"
                        name={`q-${current.id}`}
                        className="mr-2"
                        checked={answers[current.id] === idx}
                        onChange={() => saveAnswer(current.id, idx)}
                      />
                      <span>{c}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground">No question found</div>
          )}
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className="space-x-2">
            <Button variant="outline" onClick={prev} disabled={currentIndex === 0}>Previous</Button>
            <Button onClick={next} disabled={currentIndex === total - 1}>Next</Button>
            <Button variant="ghost" onClick={toggleFlag}>{flags[current?.id] ? 'Unflag' : 'Flag'}</Button>
          </div>

          <div className="space-x-2">
            <Button variant="outline" onClick={() => setShowReview(true)}>Review & Submit (S)</Button>
            <Button variant="destructive" onClick={handleSubmit}>Submit</Button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="hidden lg:block p-4 bg-muted rounded-2xl">
        <div className="mb-4">
          <Progress value={percent} className="h-3 rounded-full" />
          <div className="text-xs mt-2">{percent}% completed</div>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {questions.map((q, i) => {
            const state = answers[q.id] ? 'answered' : flags[q.id] ? 'flagged' : 'empty';
            return (
              <button
                key={q.id}
                onClick={() => setCurrentIndex(i)}
                className={`p-2 rounded-lg text-xs ${state === 'answered' ? 'bg-emerald-500 text-white' : state === 'flagged' ? 'border-2 border-amber-400' : 'bg-white dark:bg-slate-700'}`}
                aria-current={i === currentIndex}
              >{i + 1}</button>
            );
          })}
        </div>

        <div className="mt-4 space-y-2">
          <Button variant="ghost" onClick={handleReset}>Reset Local Progress</Button>
          <Button variant="secondary" onClick={() => { if (onClose) onClose(); }}>Close</Button>
        </div>
      </aside>

      {/* Review Modal */}
      <Dialog open={showReview} onOpenChange={setShowReview}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review & Submit</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-2 max-h-[60vh] overflow-y-auto">
            {questions.map((q, i) => (
              <div key={q.id} className="p-3 border rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{i + 1}. {q.question}</div>
                    <div className="text-xs text-muted-foreground">{q.type}</div>
                  </div>
                  <div className="text-sm">{flags[q.id] ? 'Flagged' : answers[q.id] ? 'Answered' : 'Unanswered'}</div>
                </div>
                <div className="mt-2 text-sm">Your answer: {JSON.stringify(answers[q.id])}</div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReview(false)}>Close</Button>
            <Button onClick={() => { setShowReview(false); handleSubmit(); }}>Submit Exam</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
