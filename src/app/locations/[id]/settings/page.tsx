'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { DEFAULT_STATUS_MAPPINGS } from '@/types/api';
import type { StatusNorm, LocationSettings } from '@/types/api';

const STATUS_NORMS: StatusNorm[] = ['ATTENDED', 'NO_SHOW', 'CANCELLED', 'BOOKED', 'OTHER'];

interface Calendar {
  id: string;
  ghl_id: string;
  name: string;
  is_active: boolean;
}

export default function SettingsPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [settings, setSettings] = useState<LocationSettings>({
    statusMappings: { ...DEFAULT_STATUS_MAPPINGS },
    defaultBackfillMonths: 12,
    incrementalWindowDays: 7,
    segmentationField: 'email_domain',
  });
  const [timezone, setTimezone] = useState('Australia/Melbourne');
  const [ghlLocationId, setGhlLocationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newRaw, setNewRaw] = useState('');
  const [newNorm, setNewNorm] = useState<StatusNorm>('OTHER');
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [syncingCalendars, setSyncingCalendars] = useState(false);

  useEffect(() => {
    fetch(`/api/locations/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.settings) setSettings(data.settings);
        if (data.timezone) setTimezone(data.timezone);
        if (data.ghlLocationId) setGhlLocationId(data.ghlLocationId);
        setLoading(false);
      });
    fetch(`/api/locations/${id}/calendars`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setCalendars(data); });
  }, [id]);

  async function handleSyncCalendars() {
    setSyncingCalendars(true);
    const res = await fetch(`/api/locations/${id}/calendars`, { method: 'POST' });
    const data = await res.json();
    if (Array.isArray(data)) setCalendars(data);
    setSyncingCalendars(false);
  }


  async function handleSave() {
    setSaving(true);
    await fetch(`/api/locations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone, ghlLocationId, settings }),
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
          <div>
            <label className="label">GHL Location ID</label>
            <input className="input" value={ghlLocationId} onChange={e => setGhlLocationId(e.target.value)}
              placeholder="e.g. ve9EPM428h8vShlRW1KT" />
            <p className="text-xs text-gray-400 mt-1">Found in your GHL sub-account URL (required for API calls)</p>
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Calendars</CardTitle>
            <button className="btn-secondary text-sm" onClick={handleSyncCalendars} disabled={syncingCalendars}>
              {syncingCalendars ? <Spinner size="sm" /> : 'Sync from GHL'}
            </button>
          </div>
        </CardHeader>
        {calendars.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">No calendars synced yet. Click "Sync from GHL" to fetch them.</p>
        ) : (
          <div className="space-y-1">
            {calendars.map(cal => (
              <div key={cal.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50">
                <span className="text-gray-800">{cal.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${cal.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {cal.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
          </div>
        )}
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
