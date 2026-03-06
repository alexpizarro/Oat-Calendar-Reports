'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';

interface LocationRow {
  id: string;
  name: string;
  timezone: string;
  authMode: string;
  connectedAt: string;
  totalEvents: number;
  lastSyncAt: string | null;
}

function ConnectModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [mode, setMode] = useState<'private' | 'oauth'>('private');
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('Australia/Melbourne');
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          timezone,
          authMode: mode,
          ...(mode === 'private' ? { privateToken: token } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Failed to connect location');
        return;
      }

      if (mode === 'oauth' && data.oauthUrl) {
        window.location.href = data.oauthUrl;
        return;
      }

      onCreated();
      onClose();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Connect a Location</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Location Name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Timezone</label>
            <input className="input" value={timezone} onChange={e => setTimezone(e.target.value)} />
          </div>
          <div>
            <label className="label">Auth Mode</label>
            <div className="flex gap-4 mt-1">
              {(['private', 'oauth'] as const).map(m => (
                <label key={m} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" value={m} checked={mode === m} onChange={() => setMode(m)} />
                  {m === 'private' ? 'Private Token' : 'OAuth'}
                </label>
              ))}
            </div>
          </div>
          {mode === 'private' && (
            <div>
              <label className="label">Private Integration Token</label>
              <input
                type="password"
                className="input"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="pit_…"
                required
              />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 justify-end">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Spinner size="sm" /> : mode === 'oauth' ? 'Connect with OAuth' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LocationsPage() {
  const router = useRouter();
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/locations');
    if (res.ok) setLocations(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">HL Analytics</h1>
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={() => setShowModal(true)}>+ Connect Location</button>
          <button className="btn-secondary" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Connected Locations</h2>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : locations.length === 0 ? (
          <div className="card p-12 text-center text-gray-500">
            <p>No locations connected yet.</p>
            <button className="btn-primary mt-4" onClick={() => setShowModal(true)}>
              Connect your first location
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {locations.map(loc => (
              <Link key={loc.id} href={`/locations/${loc.id}/dashboard`}>
                <div className="card p-5 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{loc.name}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{loc.timezone}</p>
                    </div>
                    <Badge variant={loc.authMode === 'oauth' ? 'info' : 'default'}>
                      {loc.authMode === 'oauth' ? 'OAuth' : 'Private Token'}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-6 text-sm text-gray-500">
                    <span>{loc.totalEvents.toLocaleString()} events</span>
                    <span>Last sync: {loc.lastSyncAt ? new Date(loc.lastSyncAt).toLocaleString() : 'never'}</span>
                    <span>Connected: {new Date(loc.connectedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <ConnectModal onClose={() => setShowModal(false)} onCreated={load} />
      )}
    </div>
  );
}
