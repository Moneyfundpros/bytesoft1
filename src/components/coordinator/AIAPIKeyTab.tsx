import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getCoordinatorApiKey, saveCoordinatorApiKey, deleteCoordinatorApiKey } from '@/lib/aiApiService';
import { Button } from '@/components/ui/button';

export default function AIAPIKeyTab() {
  const { user } = useAuth();
  const [existing, setExisting] = useState<any>(null);
  const [keyInput, setKeyInput] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      if (!user) return;
      const data = await getCoordinatorApiKey(user.id);
      setExisting(data);
    }
    load();
  }, [user]);

  if (!user || user.role !== 'coordinator') {
    return <div>You do not have access to this page.</div>;
  }

  const masked = (raw: string | null) => {
    if (!raw) return null;
    if (raw.length <= 8) return '****' + raw.slice(-4);
    return raw.slice(0, 4) + '****' + raw.slice(-4);
  };

  const handleSave = async () => {
    setMessage('Saving...');
    try {
      await saveCoordinatorApiKey(user.id, keyInput.trim());
      setMessage('API key saved successfully');
      setExisting({ coordinatorId: user.id, apiKey: 'SAVED' });
      setKeyInput('');
    } catch (e) {
      console.error(e);
      setMessage('Failed to save API key');
    }
  };

  const handleRemove = async () => {
    if (!user) return;
    setMessage('Removing API key...');
    try {
      await deleteCoordinatorApiKey(user.id);
      setExisting(null);
      setMessage('API key removed');
    } catch (e) {
      console.error(e);
      setMessage('Failed to remove API key');
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>AI API Integration</h2>
      <p>Paste your AI provider API key below. This key will be used to generate and mark CBT questions.</p>

      <div style={{ marginTop: 12 }}>
        {existing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div>
              <strong>Existing Key:</strong> <span>{masked(existing.apiKey || '')}</span>
            </div>
            <Button variant="destructive" size="sm" onClick={handleRemove}>Remove</Button>
          </div>
        ) : (
          <div>No API key saved yet.</div>
        )}
      </div>

      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="text"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          placeholder="Paste API key here"
          style={{ width: 420, padding: 8 }}
        />
        <Button onClick={handleSave}>Save API Key</Button>
      </div>

      {message && <div style={{ marginTop: 8 }}>{message}</div>}
    </div>
  );
}
