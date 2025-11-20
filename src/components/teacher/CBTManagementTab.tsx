import React, { useEffect, useState } from 'react';
import { createExam, addQuestion, getExamsForCourse, getAttemptsForExam, generateQuestionsForExam } from '@/lib/cbtService';
import { useAuth } from '@/contexts/AuthContext';

export default function CBTManagementTab() {
  const { user } = useAuth();
  const [examTitle, setExamTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [duration, setDuration] = useState(10);
  const [numQuestions, setNumQuestions] = useState(10);
  const [exams, setExams] = useState<any[]>([]);

  const [questionText, setQuestionText] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correct, setCorrect] = useState<'A'|'B'|'C'|'D'>('A');

  useEffect(() => {
    async function load() {
      try {
        // For demo: load exams for an example course
        const list = await getExamsForCourse(courseId || '');
        setExams(list || []);
      } catch (error) {
        console.error('Error loading exams:', error);
        setExams([]);
      }
    }
    load();
  }, [courseId]);

  const handleCreateExam = async () => {
    if (!user) return;
    try {
      const examId = await createExam({ title: examTitle, courseId, duration, totalQuestions: numQuestions, teacherId: user.id });
      alert('Exam created: ' + examId);
      setExamTitle('');
    } catch (error) {
      console.error('Error creating exam:', error);
      alert('Failed to create exam. Please try again.');
    }
  };

  const handleAddQuestion = async () => {
    if (!user) return;
    try {
      await addQuestion({ questionText, optionA: optA, optionB: optB, optionC: optC, optionD: optD, correctAnswer: correct, teacherId: user.id, courseId });
      alert('Question saved');
      setQuestionText(''); setOptA(''); setOptB(''); setOptC(''); setOptD(''); setCorrect('A');
    } catch (error) {
      console.error('Error saving question:', error);
      alert('Failed to save question. Please try again.');
    }
  };

  const handleGenerate = async () => {
    if (!user) return;
    try {
      const result = await generateQuestionsForExam({ courseId, schemeItems: ['Sample topic'], duration, numQuestions, difficulty: 'Normal' });
      console.log('Generated questions:', result);
      alert('Generated ' + (result.questions?.length || 0) + ' questions (check console for details)');
    } catch (error) {
      console.error('Generation failed:', error);
      alert('Failed to generate questions. See console for details.');
    }
  };

  const viewResults = async (examId: string) => {
    try {
      const r = await getAttemptsForExam(examId);
      alert('Attempts: ' + r.length);
    } catch (error) {
      console.error('Error fetching results:', error);
      alert('Failed to load results. Please try again.');
    }
  };

  return (
    <div>
      <h2>Create CBT Exam</h2>
      <div>
        <input placeholder="Title" value={examTitle} onChange={e => setExamTitle(e.target.value)} />
        <input placeholder="Course ID" value={courseId} onChange={e => setCourseId(e.target.value)} style={{ marginLeft: 8 }} />
        <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} style={{ width: 80, marginLeft: 8 }} /> minutes
        <input type="number" value={numQuestions} onChange={e => setNumQuestions(Number(e.target.value))} style={{ width: 80, marginLeft: 8 }} /> questions
        <button onClick={handleCreateExam} style={{ marginLeft: 8 }}>Create Exam</button>
      </div>

      <h3 style={{ marginTop: 12 }}>Add Question</h3>
      <div>
        <textarea placeholder="Question text" value={questionText} onChange={e => setQuestionText(e.target.value)} rows={3} style={{ width: 600 }} />
        <div>
          <input placeholder="Option A" value={optA} onChange={e => setOptA(e.target.value)} />
          <input placeholder="Option B" value={optB} onChange={e => setOptB(e.target.value)} style={{ marginLeft: 8 }} />
          <input placeholder="Option C" value={optC} onChange={e => setOptC(e.target.value)} style={{ marginLeft: 8 }} />
          <input placeholder="Option D" value={optD} onChange={e => setOptD(e.target.value)} style={{ marginLeft: 8 }} />
        </div>
        <div style={{ marginTop: 8 }}>
          <label>Correct Answer: </label>
          <select value={correct} onChange={e => setCorrect(e.target.value as any)}>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
          </select>
          <button onClick={handleAddQuestion} style={{ marginLeft: 8 }}>Save Question</button>
          <button onClick={handleGenerate} style={{ marginLeft: 8 }}>Generate Questions (AI)</button>
        </div>
      </div>

      <h3 style={{ marginTop: 16 }}>Manage Exams</h3>
      <div>
        {exams.map(e => (
          <div key={e.id} style={{ border: '1px solid #eee', padding: 8, marginBottom: 6 }}>
            <div><strong>{e.title}</strong></div>
            <div>Course: {e.courseId}</div>
            <div>Duration: {e.duration} minutes</div>
            <div>Questions: {e.totalQuestions}</div>
            <button onClick={() => viewResults(e.id)}>View Results</button>
          </div>
        ))}
      </div>
    </div>
  );
}
