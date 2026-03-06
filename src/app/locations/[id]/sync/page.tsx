'use client';

import { useState, useEffect, use } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';

interface Job {
  id: string;
  type: string;
  status: string;
  attempts: number;
  created_at: string;
  updated_at: string;
  last_error: string | null;
  next_run_at: string;
}

interface Checkpoint {
  id: string;
  calendarName: string;
  windowStart: string;
  windowEnd: string;
  lastSuccessAt: string | null;
  lastError: string | null;
}

const STATUS_COLORS: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  SUCCEEDED: 'success',
  RUNNING: 'info',
  FAILED: 'danger',
  QUEUED: 'warning',
};

export default function SyncPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [enqueuing, setEnqueuing] = useState<string | null>(null);
  const [backfillFrom, setBackfillFrom] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
  });

  async function load() {
    const [jRes, cRes] = await Promise.all([
      fetch(`/api/locations/${id}/sync`),
      fetch(`/api/locations/${id}/sync/checkpoint`),
    ]);
    if (jRes.ok) setJobs(await jRes.json());
    if (cRes.ok) setCheckpoints(await cRes.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10_000); // auto-refresh every 10s
    return () => clearInterval(interval);
  }, []);

  async function handleEnqueue(type: 'SYNC_BACKFILL' | 'SYNC_INCREMENTAL') {
    setEnqueuing(type);
    try {
      const body: Record<string, unknown> = { type };
      if (type === 'SYNC_BACKFILL') body.fromDate = backfillFrom;

      const res = await fetch(`/api/locations/${id}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) setTimeout(load, 500);
    } finally {
      setEnqueuing(null);
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Sync</h1>

      {/* Manual controls */}
      <Card>
        <CardHeader><CardTitle>Manual Sync</CardTitle></CardHeader>
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="label">Backfill Start Date</label>
            <input
              type="date"
              className="input w-40"
              value={backfillFrom}
              onChange={e => setBackfillFrom(e.target.value)}
            />
          </div>
          <button
            className="btn-primary"
            onClick={() => handleEnqueue('SYNC_BACKFILL')}
            disabled={enqueuing === 'SYNC_BACKFILL'}
          >
            {enqueuing === 'SYNC_BACKFILL' ? <Spinner size="sm" /> : 'Run Backfill'}
          </button>
          <button
            className="btn-secondary"
            onClick={() => handleEnqueue('SYNC_INCREMENTAL')}
            disabled={enqueuing === 'SYNC_INCREMENTAL'}
          >
            {enqueuing === 'SYNC_INCREMENTAL' ? <Spinner size="sm" /> : 'Run Incremental (7d)'}
          </button>
          <button className="btn-secondary ml-auto" onClick={load}>↻ Refresh</button>
        </div>
      </Card>

      {/* Jobs */}
      <Card>
        <CardHeader><CardTitle>Recent Jobs</CardTitle></CardHeader>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase border-b border-gray-100">
                <th className="text-left py-2 pr-4">Type</th>
                <th className="text-left py-2 pr-4">Status</th>
                <th className="text-right py-2 pr-4">Attempts</th>
                <th className="text-left py-2 pr-4">Created</th>
                <th className="text-left py-2 pr-4">Updated</th>
                <th className="text-left py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id} className="border-b border-gray-50">
                  <td className="py-2 pr-4 font-mono text-xs">{job.type}</td>
                  <td className="py-2 pr-4">
                    <Badge variant={STATUS_COLORS[job.status] ?? 'default'}>{job.status}</Badge>
                  </td>
                  <td className="text-right py-2 pr-4">{job.attempts}</td>
                  <td className="py-2 pr-4 text-gray-500 text-xs">{new Date(job.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-4 text-gray-500 text-xs">{new Date(job.updated_at).toLocaleString()}</td>
                  <td className="py-2 text-red-500 text-xs max-w-xs truncate">{job.last_error ?? '—'}</td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">No jobs yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Checkpoints */}
      <Card>
        <CardHeader><CardTitle>Sync Checkpoints</CardTitle></CardHeader>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase border-b border-gray-100">
                <th className="text-left py-2 pr-4">Calendar</th>
                <th className="text-left py-2 pr-4">Window</th>
                <th className="text-left py-2 pr-4">Last Success</th>
                <th className="text-left py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {checkpoints.map(cp => (
                <tr key={cp.id} className="border-b border-gray-50">
                  <td className="py-2 pr-4 font-medium">{cp.calendarName}</td>
                  <td className="py-2 pr-4 text-xs text-gray-500">
                    {new Date(cp.windowStart).toLocaleDateString()} →{' '}
                    {new Date(cp.windowEnd).toLocaleDateString()}
                  </td>
                  <td className="py-2 pr-4 text-xs text-gray-500">
                    {cp.lastSuccessAt ? new Date(cp.lastSuccessAt).toLocaleString() : (
                      <span className="text-yellow-600">pending</span>
                    )}
                  </td>
                  <td className="py-2 text-red-500 text-xs max-w-xs truncate">{cp.lastError ?? '—'}</td>
                </tr>
              ))}
              {checkpoints.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-400">No checkpoints yet — run a sync first</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
