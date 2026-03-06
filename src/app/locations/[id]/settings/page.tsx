'use client';

import { useState, use, useEffect } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { DEFAULT_STATUS_MAPPINGS } from '@/types/api';
import type { StatusNorm, LocationSettings } from '@/types/api';

const STATUS_NORMS: StatusNorm[] = ['ATTENDED', 'NO_SHOW', 'CANCELLED', 'BOOKED', 'OTHER'];

export default function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [settings, setSettings] = useState<LocationSettings>({
    statusMappings: { ...DEFAULT_STATUS_MAPPINGS },
    defaultBackfillMonths: 12,
    incrementalWindowDays: 7,
    segmentationField: 'email_domain',
  });
  const [timezone, setTimezone] = useState('Australia/Melbourne');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newRaw, setNewRaw] = useState('');
  const [newNorm, setNewNorm] = useState<StatusNorm>('OTHER');

  useEffect(() => {
    fetch(`/api/locations/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.settings) setSettings(data.settings);
        if (data.timezone) setTimezone(data.timezone);
        setLoading(false);
      });
  }, [id]);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/locations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone, settings }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function addMapping() {
    if (!newRaw.trim()) return;
    setSettings(s => ({
      ...s,
      statusMappings: { ...s.statusMappings, [newRaw.toLowerCase().trim()]: newNorm },
    }));
    setNewRaw('');
  }

  function removeMapping(key: string) {
    setSettings(s => {
      const { [key]: _, ...rest } = s.statusMappings;
      return { ...s, statusMappings: rest };
    });
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Settings</h1>

      <Card>
        <CardHeader><CardTitle>Location Settings</CardTitle></CardHeader>
        <div className="space-y-4">
          <div>
            <label className="label">Timezone</label>
            <input className="input" value={timezone} onChange={e => setTimezone(e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">IANA timezone name (e.g. Australia/Melbourne)</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Backfill Months (default)</label>
              <input type="number" className="input" min={1} max={60}
                value={settings.defaultBackfillMonths}
                onChange={e => setSettings(s => ({ ...s, defaultBackfillMonths: parseInt(e.target.value) || 12 }))} />
            </div>
            <div>
              <label className="label">Incremental Window (days)</label>
              <input type="number" className="input" min={1} max={30}
                value={settings.incrementalWindowDays}
                onChange={e => setSettings(s => ({ ...s, incrementalWindowDays: parseInt(e.target.value) || 7 }))} />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader><CardTitle>Status Mappings</CardTitle></CardHeader>
        <p className="text-xs text-gray-500 mb-3">Map raw GHL appointment statuses to normalized values.</p>

        <div className="space-y-1 mb-4">
          {Object.entries(settings.statusMappings).map(([raw, norm]) => (
            <div key={raw} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50">
              <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">{raw}</code>
              <span className="text-gray-400">→</span>
              <span className="font-medium text-gray-700">{norm}</span>
              <button
                className="text-xs text-red-400 hover:text-red-600"
                onClick={() => removeMapping(raw)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="label">Raw Status</label>
            <input className="input" value={newRaw} onChange={e => setNewRaw(e.target.value)}
              placeholder="e.g. rescheduled" />
          </div>
          <div>
            <label className="label">Normalised</label>
            <select className="input" value={newNorm} onChange={e => setNewNorm(e.target.value as StatusNorm)}>
              {STATUS_NORMS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button className="btn-secondary" onClick={addMapping}>Add</button>
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        {saved && <span className="text-sm text-green-600 self-center">Saved!</span>}
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <Spinner size="sm" /> : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
