import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogFooter } from '@/components/ui/dialog';

export default function SchemeEditor({ initial, onClose, onCreate, onUpdate }: any) {
  const [title, setTitle] = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');

  const save = async () => {
    if (!initial?.id) {
      await onCreate({ title, description });
    } else {
      await onUpdate(initial.id, { title, description });
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <h3 className="text-lg font-semibold">{initial?.id ? 'Edit Topic' : 'Create Topic'}</h3>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Title</label>
            <input className="w-full mt-1 p-2 border rounded" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium">Description</label>
            <textarea className="w-full mt-1 p-2 border rounded" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>{initial?.id ? 'Save' : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
