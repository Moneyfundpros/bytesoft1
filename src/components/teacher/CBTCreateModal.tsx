import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getSchemeForTeacher } from '@/lib/schemeService';
import { generateQuestionsForExam } from '@/lib/cbtService';
import examService from '@/lib/examService';
import { useAuth } from '@/contexts/AuthContext';
import { CBTQuestion } from '@/types/cbt';

export default function CBTCreateModal({ open, onClose, courseId }: any) {
  const { user } = useAuth();
  const [schemeItems, setSchemeItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [extraTopic, setExtraTopic] = useState('');
  const [duration, setDuration] = useState(20);
  const [numQuestions, setNumQuestions] = useState(20);
  const [difficulty, setDifficulty] = useState('Normal');
  const [questions, setQuestions] = useState<CBTQuestion[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!user || !courseId) return;
    load();
  }, [user, courseId]);

  async function load() {
    if (!user || !courseId) return;
    const list = await getSchemeForTeacher(user.id, courseId);
    setSchemeItems(list || []);
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleGenerate = async () => {
    const topics = schemeItems.filter(s => selected.includes(s.id)).map(s => s.title);
    if (extraTopic.trim()) topics.push(extraTopic.trim());
    if (topics.length === 0) return alert('Select at least one topic');
    const res = await generateQuestionsForExam({ courseId, schemeItems: topics, duration, numQuestions, difficulty });
    const qs = (res.questions || []).slice(0, numQuestions).map((q: any, idx: number) => ({
      id: `q_${idx+1}`,
      teacherId: user!.id,
      courseId,
      question: q.question || q,
      options: q.options || q.options || [],
      correct: q.correct || (q.correctOption || q.correct)
    })) as CBTQuestion[];
    setQuestions(qs);
    setPreviewOpen(true);
  };

  const removeQuestion = (idx: number) => {
    const copy = [...questions];
    copy.splice(idx, 1);
    // renumber ids
    setQuestions(copy.map((q, i) => ({ ...q, id: `q_${i+1}` })));
  };

  const editQuestionText = (idx: number, text: string) => {
    const copy = [...questions];
    copy[idx].question = text;
    setQuestions(copy);
  };

  const finalizeExam = async (title: string) => {
    // create exam and save questions then publish
    const examId = await examService.createExam({ title, courseId, teacherId: user!.id, schemeItems: selected.map(id => schemeItems.find(s => s.id === id)?.title).filter(Boolean), questions, difficulty, duration, totalQuestions: questions.length, status: 'published' });
    // publishExam will set publishedAt and status; createExam already set status; ensure published
    await examService.publishExam(examId);
    alert('Exam published to enrolled students');
    setQuestions([]);
    setSelected([]);
    setExtraTopic('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <h3 className="text-lg font-semibold">Create CBT Exam</h3>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h4 className="font-medium">Select Scheme Items</h4>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {schemeItems.map(s => (
                <label key={s.id} className="p-2 border rounded cursor-pointer">
                  <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggleSelect(s.id)} />
                  <span className="ml-2">{s.title}</span>
                </label>
              ))}
            </div>
            <div className="mt-2">
              <input placeholder="Add extra topic" value={extraTopic} onChange={e => setExtraTopic(e.target.value)} className="w-full p-2 border rounded" />
            </div>
          </div>

          <div className="flex gap-4 items-center">
            <div>
              <label className="block text-sm">Duration</label>
              <select value={duration} onChange={e => setDuration(Number(e.target.value))} className="p-2 border rounded">
                {[10,20,30,40,50].map(n => <option key={n} value={n}>{n} minutes</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm">Number of Questions</label>
              <select value={numQuestions} onChange={e => setNumQuestions(Number(e.target.value))} className="p-2 border rounded">
                {[20,25,30,35,40,45,50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm">Difficulty</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="p-2 border rounded">
                {['Easy','Normal','Hard'].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleGenerate}>Generate Questions (AI)</Button>
            <Button variant="outline" onClick={() => { setQuestions([]); setSelected([]); setExtraTopic(''); }}>Reset</Button>
          </div>

          {previewOpen && (
            <div className="mt-4">
              <h4 className="font-semibold">Preview Questions</h4>
              <div className="space-y-3 mt-2">
                {questions.map((q, idx) => (
                  <div key={q.id} className="p-3 border rounded">
                    <div className="flex justify-between items-start">
                      <div className="w-full">
                        <textarea className="w-full p-2 border rounded" value={q.question} onChange={e => editQuestionText(idx, e.target.value)} />
                        <div className="text-sm text-muted-foreground mt-2">Options: {q.options?.join(' | ')}</div>
                      </div>
                      <div className="flex flex-col gap-2 ml-4">
                        <Button variant="ghost" onClick={() => removeQuestion(idx)}>Remove</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => finalizeExam('AI Generated Exam')}>Finalize & Publish</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
