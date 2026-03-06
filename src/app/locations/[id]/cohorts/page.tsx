'use client';

import { useState, useEffect } from 'react';
import { defaultDateRange } from '@/hooks/use-analytics';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import type { CohortRule, CreateCohortInput } from '@/types/api';

interface Cohort {
  id: string;
  name: string;
  tagName: string;
  conflictTags: string[];
  rule: CohortRule;
  createdAt: string;
}

interface Job {
  id: string;
  type: string;
  status: string;
  created_at: string;
  results: Array<{
    tag_name: string;
    contacts_targeted: number;
    contacts_succeeded: number;
    contacts_failed: number;
  }>;
}

const METRICS = [
  { value: 'no_shows', label: 'No-Shows' },
  { value: 'attended', label: 'Attended' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'lead_time_avg', label: 'Avg Lead Time (hrs)' },
];

const STATUS_COLORS: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  SUCCEEDED: 'success',
  RUNNING: 'info',
  FAILED: 'danger',
  QUEUED: 'warning',
};

export default function CohortsPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [running, setRunning] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<CreateCohortInput>({
    name: '',
    tagName: '',
    conflictTags: [],
    rule: {
      metric: 'no_shows',
      operator: 'gte',
      threshold: 2,
      dateFrom: defaultDateRange().from,
      dateTo: defaultDateRange().to,
    },
  });

  async function load() {
    const [cRes, jRes] = await Promise.all([
      fetch(`/api/locations/${id}/cohorts`),
      fetch(`/api/locations/${id}/sync`),
    ]);
    if (cRes.ok) setCohorts(await cRes.json());
    if (jRes.ok) {
      const allJobs = await jRes.json();
      setJobs(allJobs.filter((j: Job) => j.type === 'TAG_COHORT'));
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handlePreview() {
    setPreviewing(true);
    setPreviewCount(null);
    const res = await fetch(`/api/locations/${id}/cohorts/preview_temp/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rule: form.rule }),
    });
    if (res.ok) {
      const data = await res.json();
      setPreviewCount(data.contactCount);
    }
    setPreviewing(false);
  }

  async function handleCreate() {
    const res = await fetch(`/api/locations/${id}/cohorts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowBuilder(false);
      load();
    }
  }

  async function handleRun(cohortId: string) {
    setRunning(cohortId);
    const res = await fetch(`/api/locations/${id}/cohorts/${cohortId}/run`, { method: 'POST' });
    if (res.ok) {
      setTimeout(() => { load(); setRunning(null); }, 1000);
    } else {
      setRunning(null);
    }
  }

  async function handleDelete(cohortId: string) {
    if (!confirm('Delete this cohort?')) return;
    await fetch(`/api/locations/${id}/cohorts/${cohortId}`, { method: 'DELETE' });
    load();
  }

  const setRule = (patch: Partial<CohortRule>) =>
    setForm(f => ({ ...f, rule: { ...f.rule, ...patch } }));

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Cohorts</h1>
        <button className="btn-primary" onClick={() => setShowBuilder(true)}>+ New Cohort</button>
      </div>

      {/* Rule builder */}
      {showBuilder && (
        <Card>
          <CardHeader>
            <CardTitle>Build Cohort Rule</CardTitle>
            <button className="text-sm text-gray-400 hover:text-gray-600" onClick={() => setShowBuilder(false)}>✕</button>
          </CardHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Cohort Name</label>
                <input className="input" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Tag to Apply</label>
                <input className="input" value={form.tagName}
                  onChange={e => setForm(f => ({ ...f, tagName: e.target.value }))}
                  placeholder="e.g. needs-follow-up" />
              </div>
            </div>

            <div>
              <label className="label">Conflict Tags to Remove (comma-separated)</label>
              <input className="input" placeholder="no-show-1, no-show-2"
                onChange={e => setForm(f => ({
                  ...f,
                  conflictTags: e.target.value.split(',').map(t => t.trim()).filter(Boolean),
                }))} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="label">Metric</label>
                <select className="input" value={form.rule.metric}
                  onChange={e => setRule({ metric: e.target.value as CohortRule['metric'] })}>
                  {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Operator</label>
                <select className="input" value={form.rule.operator}
                  onChange={e => setRule({ operator: e.target.value as CohortRule['operator'] })}>
                  <option value="gte">≥ (at least)</option>
                  <option value="lte">≤ (at most)</option>
                  <option value="eq">= (exactly)</option>
                </select>
              </div>
              <div>
                <label className="label">Threshold</label>
                <input type="number" className="input" value={form.rule.threshold} min={0}
                  onChange={e => setRule({ threshold: parseInt(e.target.value) || 0 })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">From Date</label>
                <input type="date" className="input" value={form.rule.dateFrom}
                  onChange={e => setRule({ dateFrom: e.target.value })} />
              </div>
              <div>
                <label className="label">To Date</label>
                <input type="date" className="input" value={form.rule.dateTo}
                  onChange={e => setRule({ dateTo: e.target.value })} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="btn-secondary" onClick={handlePreview} disabled={previewing}>
                {previewing ? <Spinner size="sm" /> : 'Preview Count'}
              </button>
              {previewCount !== null && (
                <span className="text-sm font-medium text-gray-700">
                  {previewCount} contact{previewCount !== 1 ? 's' : ''} match this rule
                </span>
              )}
              <button
                className="btn-primary ml-auto"
                onClick={handleCreate}
                disabled={!form.name || !form.tagName}
              >
                Save Cohort
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Cohort list */}
      {cohorts.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">No cohorts yet.</div>
      ) : (
        <div className="space-y-3">
          {cohorts.map(cohort => (
            <Card key={cohort.id}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{cohort.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Tag: <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{cohort.tagName}</span>
                    {cohort.conflictTags.length > 0 && (
                      <> · Remove: {cohort.conflictTags.map(t => (
                        <span key={t} className="font-mono text-xs bg-red-50 px-1.5 py-0.5 rounded ml-1">{t}</span>
                      ))}</>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {cohort.rule.metric} {cohort.rule.operator} {cohort.rule.threshold} ·{' '}
                    {cohort.rule.dateFrom} → {cohort.rule.dateTo}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    className="btn-primary text-sm"
                    onClick={() => handleRun(cohort.id)}
                    disabled={running === cohort.id}
                  >
                    {running === cohort.id ? <Spinner size="sm" /> : 'Run'}
                  </button>
                  <button
                    className="btn-secondary text-sm text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => handleDelete(cohort.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Recent tag jobs */}
      {jobs.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Recent Tag Jobs</CardTitle></CardHeader>
          <div className="space-y-2">
            {jobs.slice(0, 10).map(job => (
              <div key={job.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                <div className="text-gray-500 text-xs">{new Date(job.created_at).toLocaleString()}</div>
                <Badge variant={STATUS_COLORS[job.status] ?? 'default'}>{job.status}</Badge>
                {job.results?.[0] && (
                  <div className="text-xs text-gray-500">
                    {job.results[0].contacts_succeeded}/{job.results[0].contacts_targeted} tagged
                    {job.results[0].contacts_failed > 0 && (
                      <span className="text-red-500 ml-1">({job.results[0].contacts_failed} failed)</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
