import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getSchemeForTeacher, createSchemeItem, updateSchemeItem, deleteSchemeItem } from '@/lib/schemeService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SchemeEditor from './SchemeEditor';

export default function SchemeOfWorkTab({ courseId }: { courseId?: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);

  useEffect(() => {
    if (!user || !courseId) return;
    load();
  }, [user, courseId]);

  async function load() {
    if (!user || !courseId) return;
    const list = await getSchemeForTeacher(user.id, courseId);
    setItems(list || []);
  }

  const onCreate = async (payload: any) => {
    if (!courseId) return alert('Select a course first');
    await createSchemeItem(courseId, { ...payload, teacherId: user?.id });
    await load();
    setEditing(null);
  };

  const onUpdate = async (id: string, patch: any) => {
    if (!courseId) return;
    await updateSchemeItem(courseId, id, patch);
    await load();
    setEditing(null);
  };

  const onDelete = async (id: string) => {
    if (!courseId) return;
    if (!confirm('Delete this scheme item?')) return;
    await deleteSchemeItem(courseId, id);
    await load();
  };

  if (!courseId) {
    return <Card><CardContent>Please select a course to manage Scheme of Work.</CardContent></Card>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <CardHeader>
          <CardTitle>Scheme of Work</CardTitle>
        </CardHeader>
        <Button onClick={() => setEditing({})}>Create Topic</Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {items.map(it => (
          <Card key={it.id} className="p-4">
            <CardContent>
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-semibold">{it.title}</h4>
                  <p className="text-sm text-muted-foreground">{it.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditing(it)}>Edit</Button>
                  <Button variant="ghost" onClick={() => onDelete(it.id)}>Delete</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editing && (
        <SchemeEditor
          initial={editing}
          onClose={() => setEditing(null)}
          onCreate={onCreate}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}
