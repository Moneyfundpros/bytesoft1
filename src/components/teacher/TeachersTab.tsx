import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';

export default function TeachersTab({ courseId }: { courseId?: string }) {
  const [teachers, setTeachers] = useState<any[]>([]);

  useEffect(() => {
    if (!courseId) return;
    load();
  }, [courseId]);

  async function load() {
    if (!courseId) return;
    try {
      const courseRef = doc(db, 'courses', courseId);
      const snap = await getDoc(courseRef);
      if (!snap.exists()) return setTeachers([]);
      const data = snap.data() as any;
      const teacherIds: string[] = [];
      if (data.teacherId) teacherIds.push(data.teacherId);
      if (data.instructorId) teacherIds.push(data.instructorId);
      // remove duplicates
      const uniq = Array.from(new Set(teacherIds));
      const resolved: any[] = [];
      for (const id of uniq) {
        try {
          const u = await getDoc(doc(db, 'users', id));
          if (u.exists()) resolved.push({ id: u.id, ...(u.data() as any) });
        } catch (e) { /* ignore */ }
      }
      setTeachers(resolved);
    } catch (err) {
      console.error('Failed loading teachers for course', err);
      setTeachers([]);
    }
  }

  if (!courseId) return <Card><CardContent>Select a course to view assigned teachers.</CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Teachers</CardTitle>
            <CardDescription>{teachers.length} assigned</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {teachers.map(t => (
            <div key={t.id} className="flex items-center justify-between p-2 bg-muted rounded">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>{(t.name || t.email || 'T').slice(0,2)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{t.name || t.displayName || t.email}</div>
                  <div className="text-xs text-muted-foreground">{t.email}</div>
                </div>
              </div>
              <div>
                <Button variant="ghost">View Profile</Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
